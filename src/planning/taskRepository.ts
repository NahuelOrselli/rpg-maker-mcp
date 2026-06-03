import * as fs from "node:fs/promises";
import * as path from "node:path";
import { FileHandler } from "../utils/fileHandler.js";
import type { PlannerTaskStatus, TaskDefinition } from "./types.js";
import { WorkspacePaths } from "../workspace/paths.js";

interface RawTask {
    id?: unknown;
    title?: unknown;
    description?: unknown;
    status?: unknown;
    dependencies?: unknown;
    priority?: unknown;
    sources?: unknown;
    actions?: unknown;
}

const STATUS_MAP: Record<string, PlannerTaskStatus> = {
    pending: "pending",
    todo: "pending",
    in_progress: "in_progress",
    doing: "in_progress",
    blocked: "blocked",
    done: "done",
    completed: "done",
};

export class TaskRepository {
    constructor(private fileHandler: FileHandler, private workspacePaths: WorkspacePaths) { }

    async loadAll(): Promise<TaskDefinition[]> {
        const projectPath = this.workspacePaths.workspaceRoot;
        const roots = [this.workspacePaths.tasksPath, this.workspacePaths.planningPath];
        const files = await this.collectJsonFiles(roots);

        const tasks: TaskDefinition[] = [];

        for (const absPath of files) {
            const relative = path.relative(projectPath, absPath).replaceAll(path.sep, "/");
            let parsed: unknown;
            try {
                const content = await fs.readFile(absPath, "utf-8");
                parsed = JSON.parse(content);
            } catch {
                continue;
            }

            const candidates = Array.isArray(parsed) ? parsed : [parsed];
            for (const candidate of candidates) {
                const normalized = this.normalizeTask(candidate as RawTask, relative);
                if (normalized) {
                    tasks.push(normalized);
                }
            }
        }

        tasks.sort((a, b) => {
            if (a.id !== b.id) return a.id.localeCompare(b.id);
            return a.file.localeCompare(b.file);
        });

        return tasks;
    }

    async loadById(taskId: string): Promise<TaskDefinition | null> {
        const tasks = await this.loadAll();
        return tasks.find((task) => task.id === taskId) ?? null;
    }

    private normalizeTask(raw: RawTask, file: string): TaskDefinition | null {
        if (typeof raw !== "object" || raw === null) return null;
        if (typeof raw.id !== "string" || raw.id.trim() === "") return null;

        const id = raw.id.trim();
        const title = typeof raw.title === "string" ? raw.title.trim() : "";
        const description = typeof raw.description === "string" ? raw.description : "";

        const rawStatus = typeof raw.status === "string" ? raw.status.trim().toLowerCase() : "unknown";
        const status = STATUS_MAP[rawStatus] ?? "unknown";

        const dependencies = Array.isArray(raw.dependencies)
            ? raw.dependencies.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim())
            : [];

        const priority = typeof raw.priority === "number" && Number.isFinite(raw.priority) ? raw.priority : 100;

        const sources = Array.isArray(raw.sources)
            ? raw.sources.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim())
            : [];

        const actions = Array.isArray(raw.actions)
            ? raw.actions
                .filter((a): a is { tool: string; arguments?: Record<string, unknown> } => {
                    if (typeof a !== "object" || a === null) return false;
                    const obj = a as Record<string, unknown>;
                    return typeof obj.tool === "string" && obj.tool.trim() !== "";
                })
                .map((a) => ({
                    tool: a.tool.trim(),
                    arguments: a.arguments && typeof a.arguments === "object" ? a.arguments : {},
                }))
            : [];

        return {
            id,
            title,
            description,
            status,
            dependencies,
            priority,
            sources,
            actions,
            file,
        };
    }

    private async collectJsonFiles(roots: string[]): Promise<string[]> {
        const results: string[] = [];

        const walk = async (dir: string) => {
            let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
            try {
                entries = (await fs.readdir(dir, { withFileTypes: true })) as Array<{
                    name: string;
                    isDirectory(): boolean;
                    isFile(): boolean;
                }>;
            } catch {
                return;
            }

            entries.sort((a, b) => a.name.localeCompare(b.name));
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await walk(full);
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
                    results.push(full);
                }
            }
        };

        for (const root of roots) {
            await walk(root);
        }

        results.sort((a, b) => a.localeCompare(b));
        return results;
    }
}
