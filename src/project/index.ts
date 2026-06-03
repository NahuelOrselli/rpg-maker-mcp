import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { ProjectSnapshotService } from "./snapshotService.js";
import { ConsistencyValidator } from "./consistencyValidator.js";
import { WorkspacePaths } from "../workspace/paths.js";

const diffSchema = z.object({
    limit: z.number().int().min(1).max(500).default(50).describe("Max IDs per list"),
});

const auditSchema = z.object({
    limit: z.number().int().min(1).max(500).default(50).describe("Max IDs per list"),
});

export function registerProjectTools(server: McpServer, fileHandler: FileHandler, workspacePaths: WorkspacePaths) {
    const snapshotService = new ProjectSnapshotService(fileHandler, workspacePaths);
    const consistencyValidator = new ConsistencyValidator(fileHandler, workspacePaths);

    server.tool(
        "project.status",
        "Get current project status (docs/data/js and entity counts)",
        {},
        async () => {
            try {
                const snapshot = await snapshotService.createSnapshot();
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(snapshot, null, 2) }],
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
        "project.validate",
        "Validate consistency between docs and RPG Maker data",
        {},
        async () => {
            try {
                const issues = await consistencyValidator.validate();
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(issues, null, 2) }],
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
        "project.diff",
        "Compare docs references and RPG data coverage",
        diffSchema.shape,
        async (args) => {
            try {
                const diff = await consistencyValidator.diff(args.limit);
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(diff, null, 2) }],
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
        "project.audit",
        "Run consolidated status + validation + diff audit",
        auditSchema.shape,
        async (args) => {
            try {
                const [status, validation, diff] = await Promise.all([
                    snapshotService.createSnapshot(),
                    consistencyValidator.validate(),
                    consistencyValidator.diff(args.limit),
                ]);

                const summary = {
                    errors: validation.filter((i) => i.severity === "error").length,
                    warnings: validation.filter((i) => i.severity === "warn").length,
                    infos: validation.filter((i) => i.severity === "info").length,
                };

                return {
                    content: [{ type: "text" as const, text: JSON.stringify({ status, validation, diff, summary }, null, 2) }],
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
