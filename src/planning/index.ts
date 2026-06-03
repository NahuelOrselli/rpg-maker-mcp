import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { TaskRepository } from "./taskRepository.js";
import { DependencyGraph } from "./dependencyGraph.js";
import { ProjectStateReader } from "./projectStateReader.js";
import type { PlannerIssue, TaskDefinition } from "./types.js";
import { WorkspacePaths } from "../workspace/paths.js";
import { TaskGenerator } from "./taskGenerator.js";

const byTaskSchema = z.object({
    taskId: z.string().min(1).describe("Task ID"),
});

const nextTaskSchema = z.object({
    includeInProgress: z.boolean().default(false).describe("Include tasks already in progress"),
});

const generateForChapterSchema = z.object({
    chapter: z.string().min(1).describe("Chapter title or identifier"),
    docsRoot: z.string().optional().describe("Optional docs root relative to workspace"),
    maxTasks: z.number().int().min(1).max(200).default(30).describe("Maximum generated tasks"),
    strict: z.boolean().default(true).describe("Strict mode for deterministic actionable tasks"),
});

const generateFromDocsSchema = z.object({
    docsRoot: z.string().optional().describe("Optional docs root relative to workspace"),
    includeChapters: z.array(z.string().min(1)).default([]).describe("Optional chapter filters"),
    maxTasks: z.number().int().min(1).max(500).default(80).describe("Maximum generated tasks"),
    strict: z.boolean().default(true).describe("Strict mode for deterministic actionable tasks"),
});

const refinePlanSchema = z.object({
    planId: z.string().min(1).describe("Generated plan ID"),
    dedupe: z.boolean().default(true).describe("Remove duplicated tasks"),
    recomputeDependencies: z.boolean().default(true).describe("Recompute or normalize dependencies"),
});

const publishBacklogSchema = z.object({
    planId: z.string().min(1).describe("Generated plan ID"),
    targetTasksFile: z.string().min(1).describe("Target file path for tasks JSON"),
    targetPlanningFile: z.string().min(1).describe("Target file path for planning JSON"),
    updateEstadoProyecto: z.boolean().default(true).describe("Append generated tasks to estado_proyecto"),
});

function summarizeTask(task: TaskDefinition) {
    return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dependencies: task.dependencies,
        sources: task.sources,
        actions: task.actions,
        file: task.file,
    };
}

export function registerPlannerTools(server: McpServer, fileHandler: FileHandler, workspacePaths: WorkspacePaths) {
    const taskRepository = new TaskRepository(fileHandler, workspacePaths);
    const stateReader = new ProjectStateReader(fileHandler, workspacePaths);
    const taskGenerator = new TaskGenerator(workspacePaths);

    server.tool(
        "planner.load_task",
        "Load one task by ID from planning/tasks sources",
        byTaskSchema.shape,
        async (args) => {
            try {
                const task = await taskRepository.loadById(args.taskId);
                if (!task) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Task ${args.taskId} not found` }],
                        isError: true,
                    };
                }

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(summarizeTask(task), null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "planner.dependencies",
        "Get task dependencies and graph diagnostics",
        byTaskSchema.shape,
        async (args) => {
            try {
                const tasks = await taskRepository.loadAll();
                const graph = new DependencyGraph(tasks);
                const resolution = graph.resolve(args.taskId);
                const task = tasks.find((t) => t.id === args.taskId) ?? null;

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({ task: task ? summarizeTask(task) : null, dependencies: resolution }, null, 2),
                    }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "planner.validate_task",
        "Validate task definition quality and dependency consistency",
        byTaskSchema.shape,
        async (args) => {
            try {
                const tasks = await taskRepository.loadAll();
                const task = tasks.find((t) => t.id === args.taskId);
                if (!task) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Task ${args.taskId} not found` }],
                        isError: true,
                    };
                }

                const graph = new DependencyGraph(tasks);
                const dep = graph.resolve(task.id);
                const issues: PlannerIssue[] = [];

                if (!task.title) {
                    issues.push({ severity: "error", message: "Missing title", source: task.file });
                }

                if (task.dependencies.includes(task.id)) {
                    issues.push({ severity: "error", message: "Task depends on itself", source: task.file });
                }

                for (const missing of dep.missing) {
                    issues.push({
                        severity: "error",
                        message: `Missing dependency: ${missing}`,
                        source: task.file,
                    });
                }

                if (dep.hasCycle) {
                    issues.push({ severity: "error", message: "Dependency cycle detected", source: task.file });
                }

                for (const source of task.sources) {
                    const sourcePath = path.join(workspacePaths.workspaceRoot, source);
                    const exists = await existsAbsolute(sourcePath);
                    if (!exists) {
                        issues.push({
                            severity: "warn",
                            message: `Source file not found: ${source}`,
                            source: task.file,
                        });
                    }
                }

                return {
                    content: [{ type: "text" as const, text: JSON.stringify({ task: summarizeTask(task), issues }, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "planner.next_task",
        "Select next executable task based on status and dependencies",
        nextTaskSchema.shape,
        async (args) => {
            try {
                const tasks = await taskRepository.loadAll();
                const doneFromState = await stateReader.loadDoneTaskIds();
                const graph = new DependencyGraph(tasks);

                const doneSet = new Set<string>([
                    ...tasks.filter((t) => t.status === "done").map((t) => t.id),
                    ...doneFromState,
                ]);

                const candidates = tasks
                    .filter((task) => {
                        if (!args.includeInProgress && task.status === "in_progress") return false;
                        if (task.status === "done" || task.status === "blocked") return false;
                        const dep = graph.resolve(task.id);
                        if (dep.hasCycle || dep.missing.length > 0) return false;
                        return dep.direct.every((d) => doneSet.has(d));
                    })
                    .sort((a, b) => {
                        if (a.priority !== b.priority) return a.priority - b.priority;
                        return a.id.localeCompare(b.id);
                    });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify(
                            {
                                next: candidates.length > 0 ? summarizeTask(candidates[0]) : null,
                                totalCandidates: candidates.length,
                                doneTaskIds: Array.from(doneSet).sort((a, b) => a.localeCompare(b)),
                            },
                            null,
                            2
                        ),
                    }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "planner.generate_for_chapter",
        "Generate a draft plan from docs for a specific chapter",
        generateForChapterSchema.shape,
        async (args) => {
            try {
                const plan = await taskGenerator.generateForChapter(args.chapter, {
                    docsRoot: args.docsRoot,
                    maxTasks: args.maxTasks,
                    strict: args.strict,
                });
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(plan, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "planner.generate_from_docs",
        "Generate a draft plan from docs globally or by chapter filters",
        generateFromDocsSchema.shape,
        async (args) => {
            try {
                const plan = await taskGenerator.generateFromDocs({
                    docsRoot: args.docsRoot,
                    includeChapters: args.includeChapters,
                    maxTasks: args.maxTasks,
                    strict: args.strict,
                });
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(plan, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "planner.refine_plan",
        "Refine a generated draft plan (dedupe and dependency normalization)",
        refinePlanSchema.shape,
        async (args) => {
            try {
                const refined = await taskGenerator.refinePlan(args.planId, {
                    dedupe: args.dedupe,
                    recomputeDependencies: args.recomputeDependencies,
                });
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(refined, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "planner.publish_backlog",
        "Publish a generated plan into tasks/planning/state files",
        publishBacklogSchema.shape,
        async (args) => {
            try {
                const published = await taskGenerator.publishBacklog({
                    planId: args.planId,
                    targetTasksFile: args.targetTasksFile,
                    targetPlanningFile: args.targetPlanningFile,
                    updateEstadoProyecto: args.updateEstadoProyecto,
                });
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(published, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );
}

async function existsAbsolute(targetPath: string): Promise<boolean> {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}
