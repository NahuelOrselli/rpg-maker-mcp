import * as fs from "node:fs/promises";
import * as path from "node:path";
import { FileHandler } from "../utils/fileHandler.js";

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
    constructor(private fileHandler: FileHandler) { }

    async append(log: TaskExecutionLog): Promise<string> {
        const logsDir = path.join(this.fileHandler.getProjectPath(), "logs");
        await fs.mkdir(logsDir, { recursive: true });

        const safeTaskId = log.taskId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const stamp = log.timestamp.replace(/[:.]/g, "-");
        const fileName = `${stamp}-${safeTaskId}.json`;
        const fullPath = path.join(logsDir, fileName);
        await fs.writeFile(fullPath, JSON.stringify(log, null, 2), "utf-8");
        return `logs/${fileName}`;
    }

    async list(taskId?: string, limit = 50): Promise<Array<{ file: string; log: TaskExecutionLog }>> {
        const logsDir = path.join(this.fileHandler.getProjectPath(), "logs");
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
                results.push({ file: `logs/${file}`, log: parsed });
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
