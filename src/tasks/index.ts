import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import { ExecutionOrchestrator } from "./executionOrchestrator.js";

const byTaskSchema = z.object({
    taskId: z.string().min(1).describe("Task ID to inspect/execute"),
});

const historySchema = z.object({
    taskId: z.string().min(1).optional().describe("Optional filter by task ID"),
    limit: z.number().int().min(1).max(500).default(50).describe("Max history entries"),
});

export function registerTaskTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    const orchestrator = new ExecutionOrchestrator(fileHandler, safeWriter);

    server.tool(
        "task.preview",
        "Preview task execution plan, dependencies and risks without changes",
        byTaskSchema.shape,
        async (args) => {
            try {
                const preview = await orchestrator.preview(args.taskId);
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(preview, null, 2) }],
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
        "task.execute",
        "Execute a task end-to-end with dependency checks and audit logging",
        byTaskSchema.shape,
        async (args) => {
            try {
                const result = await orchestrator.execute(args.taskId);
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
                    ...(result.status === "failed" ? { isError: true } : {}),
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
        "task.history",
        "List task execution history from logs",
        historySchema.shape,
        async (args) => {
            try {
                const history = await orchestrator.history(args.taskId, args.limit);
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(history, null, 2) }],
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
