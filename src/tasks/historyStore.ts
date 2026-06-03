import * as fs from "node:fs/promises";
import * as path from "node:path";
import { FileHandler } from "../utils/fileHandler.js";
import { WorkspacePaths } from "../workspace/paths.js";

export interface TaskExecutionLog {
    timestamp: string;
    taskId: string;
    status: "success" | "failed";
    toolsUsed: string[];
    filesModified: string[];
    result: string;
    details?: Record<string, unknown>;
}

export class HistoryStore {
    constructor(private _fileHandler: FileHandler, private workspacePaths: WorkspacePaths) { }

    async append(log: TaskExecutionLog): Promise<string> {
        const logsDir = this.workspacePaths.logsPath;
        await fs.mkdir(logsDir, { recursive: true });

        const safeTaskId = log.taskId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const stamp = log.timestamp.replace(/[:.]/g, "-");
        const fileName = `${stamp}-${safeTaskId}.json`;
        const fullPath = path.join(logsDir, fileName);
        await fs.writeFile(fullPath, JSON.stringify(log, null, 2), "utf-8");
        return path.join(path.basename(logsDir), fileName).replaceAll(path.sep, "/");
    }

    async list(taskId?: string, limit = 50): Promise<Array<{ file: string; log: TaskExecutionLog }>> {
        const logsDir = this.workspacePaths.logsPath;
        let entries: string[];
        try {
            entries = await fs.readdir(logsDir);
        } catch {
            return [];
        }

        const files = entries
            .filter((name) => name.toLowerCase().endsWith(".json"))
            .sort((a, b) => b.localeCompare(a));

        const results: Array<{ file: string; log: TaskExecutionLog }> = [];
        for (const file of files) {
            const fullPath = path.join(logsDir, file);
            try {
                const content = await fs.readFile(fullPath, "utf-8");
                const parsed = JSON.parse(content) as TaskExecutionLog;
                if (taskId && parsed.taskId !== taskId) {
                    continue;
                }
                results.push({ file: path.join(path.basename(logsDir), file).replaceAll(path.sep, "/"), log: parsed });
                if (results.length >= Math.max(1, limit)) {
                    break;
                }
            } catch {
                continue;
            }
        }

        return results;
    }
}
