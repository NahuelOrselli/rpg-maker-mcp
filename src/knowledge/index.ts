import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { DocumentationIndex, type DocSection, type KnowledgeKind } from "./documentationIndex.js";
import { WorkspacePaths } from "../workspace/paths.js";

const searchSchema = z.object({
    query: z.string().min(1).describe("Search query"),
    limit: z.number().int().min(1).max(200).default(20).describe("Max number of results"),
});

const byNameSchema = z.object({
    name: z.string().min(1).optional().describe("Optional entity name filter"),
    limit: z.number().int().min(1).max(200).default(20).describe("Max number of results"),
});

function formatSections(sections: DocSection[]) {
    return sections.map((section) => ({
        file: section.file,
        heading: section.heading,
        lineStart: section.lineStart,
        excerpt: section.content.slice(0, 400),
    }));
}

function registerKindTool(
    server: McpServer,
    documentationIndex: DocumentationIndex,
    toolName: string,
    description: string,
    kind: KnowledgeKind
) {
    server.tool(toolName, description, byNameSchema.shape, async (args) => {
        try {
            const sections = await documentationIndex.byKind(kind, args.name, args.limit);
            return {
                content: [{ type: "text" as const, text: JSON.stringify(formatSections(sections), null, 2) }],
            };
        } catch (error) {
            return {
                content: [{ type: "text" as const, text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
}

export function registerKnowledgeTools(server: McpServer, _fileHandler: FileHandler, workspacePaths: WorkspacePaths) {
    const documentationIndex = new DocumentationIndex(workspacePaths);

    server.tool(
        "knowledge.search",
        "Search information in docs markdown files",
        searchSchema.shape,
        async (args) => {
            try {
                const sections = await documentationIndex.search(args.query, args.limit);
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(formatSections(sections), null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    registerKindTool(
        server,
        documentationIndex,
        "knowledge.character",
        "Get character-related sections from docs",
        "character"
    );

    registerKindTool(
        server,
        documentationIndex,
        "knowledge.location",
        "Get location-related sections from docs",
        "location"
    );

    registerKindTool(
        server,
        documentationIndex,
        "knowledge.chapter",
        "Get chapter-related sections from docs",
        "chapter"
    );

    registerKindTool(
        server,
        documentationIndex,
        "knowledge.quest",
        "Get quest-related sections from docs",
        "quest"
    );
}
