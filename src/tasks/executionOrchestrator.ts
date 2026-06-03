import * as fs from "node:fs/promises";
import * as path from "node:path";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import { TaskRepository } from "../planning/taskRepository.js";
import { DependencyGraph } from "../planning/dependencyGraph.js";
import { ProjectStateReader } from "../planning/projectStateReader.js";
import { DocumentationIndex } from "../knowledge/documentationIndex.js";
import { ConsistencyValidator } from "../project/consistencyValidator.js";
import { HistoryStore, type TaskExecutionLog } from "./historyStore.js";
import { RpgToolExecutor } from "./rpgToolExecutor.js";

export interface TaskPreviewResult {
    taskId: string;
    tools: string[];
    filesAffected: string[];
    dependencies: {
        direct: string[];
        transitive: string[];
        missing: string[];
        hasCycle: boolean;
    };
    risks: string[];
}

export interface TaskExecuteResult {
    taskId: string;
    status: "success" | "failed";
    toolsUsed: string[];
    filesModified: string[];
    validations: {
        errors: number;
        warnings: number;
    };
    auditLogFile: string;
    message: string;
}

export class ExecutionOrchestrator {
    private taskRepository: TaskRepository;
    private stateReader: ProjectStateReader;
    private documentationIndex: DocumentationIndex;
    private consistencyValidator: ConsistencyValidator;
    private historyStore: HistoryStore;
    private toolExecutor: RpgToolExecutor;

    constructor(private fileHandler: FileHandler, safeWriter: SafeWriter) {
        this.taskRepository = new TaskRepository(fileHandler);
        this.stateReader = new ProjectStateReader(fileHandler);
        this.documentationIndex = new DocumentationIndex(fileHandler);
        this.consistencyValidator = new ConsistencyValidator(fileHandler);
        this.historyStore = new HistoryStore(fileHandler);
        this.toolExecutor = new RpgToolExecutor(fileHandler, safeWriter);
    }

    async preview(taskId: string): Promise<TaskPreviewResult> {
        const task = await this.taskRepository.loadById(taskId);
        if (!task) throw new Error(`Task ${taskId} not found`);

        const tasks = await this.taskRepository.loadAll();
        const graph = new DependencyGraph(tasks);
        const dep = graph.resolve(task.id);

        const tools = task.actions.map((a) => a.tool);
        const filesAffected = Array.from(
            new Set(task.actions.flatMap((a) => this.toolExecutor.estimateFiles(a.tool, a.arguments)))
        ).sort((a, b) => a.localeCompare(b));

        const risks: string[] = [];
        if (task.actions.length === 0) risks.push("Task has no actions");
        if (dep.missing.length > 0) risks.push(`Missing dependencies: ${dep.missing.join(", ")}`);
        if (dep.hasCycle) risks.push("Dependency cycle detected");

        const supported = new Set(this.toolExecutor.getSupportedTools());
        const unsupported = tools.filter((tool) => !supported.has(tool));
        if (unsupported.length > 0) {
            risks.push(`Unsupported tools in actions: ${Array.from(new Set(unsupported)).join(", ")}`);
        }

        return {
            taskId: task.id,
            tools,
            filesAffected,
            dependencies: {
                direct: dep.direct,
                transitive: dep.transitive,
                missing: dep.missing,
                hasCycle: dep.hasCycle,
            },
            risks,
        };
    }

    async execute(taskId: string): Promise<TaskExecuteResult> {
        const now = new Date().toISOString();
        const task = await this.taskRepository.loadById(taskId);
        if (!task) throw new Error(`Task ${taskId} not found`);

        const preview = await this.preview(taskId);
        if (preview.risks.some((risk) => risk.startsWith("Missing dependencies") || risk.includes("cycle") || risk.includes("Unsupported tools"))) {
            const logFile = await this.historyStore.append({
                timestamp: now,
                taskId,
                status: "failed",
                toolsUsed: preview.tools,
                filesModified: [],
                result: "Blocked by dependency/tool constraints",
                details: { risks: preview.risks },
            });

            return {
                taskId,
                status: "failed",
                toolsUsed: preview.tools,
                filesModified: [],
                validations: { errors: 0, warnings: 0 },
                auditLogFile: logFile,
                message: "Execution blocked due to unresolved dependencies or unsupported tools",
            };
        }

        const docsHits = task.sources.length > 0
            ? await Promise.all(task.sources.map((source) => this.documentationIndex.search(source, 5)))
            : await this.documentationIndex.search(task.title || task.id, 5);

        const toolsUsed: string[] = [];
        const filesModified = new Set<string>();

        try {
            for (const action of task.actions) {
                const result = await this.toolExecutor.execute(action.tool, action.arguments);
                toolsUsed.push(result.tool);
                for (const file of result.filesModified) {
                    filesModified.add(file);
                }
            }

            const validationIssues = await this.consistencyValidator.validate();
            const validationErrors = validationIssues.filter((i) => i.severity === "error").length;
            const validationWarnings = validationIssues.filter((i) => i.severity === "warn").length;

            await this.markTaskDone(task.id);

            const logFile = await this.historyStore.append({
                timestamp: now,
                taskId: task.id,
                status: "success",
                toolsUsed,
                filesModified: Array.from(filesModified).sort((a, b) => a.localeCompare(b)),
                result: "Execution completed",
                details: {
                    docsConsulted: docsHits.flat().map((hit) => ({ file: hit.file, heading: hit.heading, lineStart: hit.lineStart })),
                    validation: { errors: validationErrors, warnings: validationWarnings },
                },
            } satisfies TaskExecutionLog);

            return {
                taskId: task.id,
                status: "success",
                toolsUsed,
                filesModified: Array.from(filesModified).sort((a, b) => a.localeCompare(b)),
                validations: { errors: validationErrors, warnings: validationWarnings },
                auditLogFile: logFile,
                message: "Task executed successfully",
            };
        } catch (error) {
            const logFile = await this.historyStore.append({
                timestamp: now,
                taskId: task.id,
                status: "failed",
                toolsUsed,
                filesModified: Array.from(filesModified).sort((a, b) => a.localeCompare(b)),
                result: `Execution failed: ${error}`,
                details: {
                    docsConsulted: docsHits.flat().map((hit) => ({ file: hit.file, heading: hit.heading, lineStart: hit.lineStart })),
                },
            });

            return {
                taskId: task.id,
                status: "failed",
                toolsUsed,
                filesModified: Array.from(filesModified).sort((a, b) => a.localeCompare(b)),
                validations: { errors: 0, warnings: 0 },
                auditLogFile: logFile,
                message: `Execution failed: ${error}`,
            };
        }
    }

    async history(taskId?: string, limit = 50) {
        return this.historyStore.list(taskId, limit);
    }

    private async markTaskDone(taskId: string): Promise<void> {
        const projectPath = this.fileHandler.getProjectPath();
        const filePath = path.join(projectPath, "estado_proyecto.md");
        const doneSet = await this.stateReader.loadDoneTaskIds();
        if (doneSet.has(taskId)) return;

        const line = `- [x] ${taskId} done ${new Date().toISOString()}`;

        let content = "";
        try {
            content = await fs.readFile(filePath, "utf-8");
        } catch {
            content = "# estado_proyecto\n\n";
        }

        const final = content.endsWith("\n") ? `${content}${line}\n` : `${content}\n${line}\n`;
        await fs.writeFile(filePath, final, "utf-8");
    }
}
