/**
 * Resource Tools - scan_resources, scan_dlc_packages, get_generator_parts, get_sample_maps, get_core_script_versions
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import * as path from "node:path";

const scanResourcesSchema = z.object({
    category: z.enum([
        "plugins", "tilesets", "characters", "faces", "sv_actors", "sv_enemies",
        "battlebacks1", "battlebacks2", "parallaxes", "pictures", "animations",
        "enemies", "titles1", "titles2", "system",
        "bgm", "bgs", "me", "se"
    ]).describe("Resource category to scan"),
    source: z.enum(["project", "engine", "all"]).default("all").describe("Source to scan"),
});

function getCategoryPath(category: string): string {
    // Audio categories
    if (["bgm", "bgs", "me", "se"].includes(category)) {
        return `audio/${category}`;
    }
    // Plugin category
    if (category === "plugins") {
        return "js/plugins";
    }
    // Image categories
    return `img/${category}`;
}

export function registerResourceTools(server: McpServer, fileHandler: FileHandler) {
    // scan_resources - Scan available resources
    server.tool(
        "scan_resources",
        "Scan available resources from project and/or engine",
        scanResourcesSchema.shape,
        async (args) => {
            try {
                const { category, source } = args;
                const categoryPath = getCategoryPath(category);
                const extension = category === "plugins" ? ".js" : undefined;

                const result: { project: string[]; engine: string[] } = {
                    project: [],
                    engine: [],
                };

                // Scan project
                if (source === "project" || source === "all") {
                    result.project = await fileHandler.listFiles(categoryPath, extension);
                }

                // Scan engine (newdata folder)
                if (source === "engine" || source === "all") {
                    const enginePath = fileHandler.getEnginePath();
                    if (enginePath) {
                        const engineCategoryPath = path.join(enginePath, "newdata", categoryPath);
                        try {
                            const fs = await import("node:fs/promises");
                            const entries = await fs.readdir(engineCategoryPath, { withFileTypes: true });
                            result.engine = entries
                                .filter((e) => e.isFile())
                                .filter((e) => !extension || e.name.endsWith(extension))
                                .map((e) => e.name);
                        } catch {
                            result.engine = [];
                        }
                    }
                }

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // scan_dlc_packages - List DLC packages
    server.tool(
        "scan_dlc_packages",
        "List all DLC packages in the engine folder",
        {},
        async () => {
            try {
                const enginePath = fileHandler.getEnginePath();
                if (!enginePath) {
                    return {
                        content: [{ type: "text" as const, text: "Error: RPGMAKER_ENGINE_PATH not set" }],
                        isError: true,
                    };
                }

                const dlcPath = path.join(enginePath, "dlc");
                const fs = await import("node:fs/promises");

                const entries = await fs.readdir(dlcPath, { withFileTypes: true });
                const packages = entries
                    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
                    .map((e) => e.name);

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(packages, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // get_generator_parts - List character generator parts
    server.tool(
        "get_generator_parts",
        "List available character generator parts",
        {},
        async () => {
            try {
                const enginePath = fileHandler.getEnginePath();
                if (!enginePath) {
                    return {
                        content: [{ type: "text" as const, text: "Error: RPGMAKER_ENGINE_PATH not set" }],
                        isError: true,
                    };
                }

                const generatorPath = path.join(enginePath, "generator");
                const fs = await import("node:fs/promises");

                const entries = await fs.readdir(generatorPath, { withFileTypes: true });
                const categories = entries
                    .filter((e) => e.isDirectory())
                    .map((e) => e.name);

                // Get count of parts in each category
                const result: Record<string, number> = {};
                for (const cat of categories) {
                    try {
                        const catPath = path.join(generatorPath, cat);
                        const catEntries = await fs.readdir(catPath, { recursive: true });
                        result[cat] = catEntries.filter((e) =>
                            typeof e === "string" && e.endsWith(".png")
                        ).length;
                    } catch {
                        result[cat] = 0;
                    }
                }

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // get_sample_maps - List sample maps
    server.tool(
        "get_sample_maps",
        "List available sample maps from the engine",
        {},
        async () => {
            try {
                const enginePath = fileHandler.getEnginePath();
                if (!enginePath) {
                    return {
                        content: [{ type: "text" as const, text: "Error: RPGMAKER_ENGINE_PATH not set" }],
                        isError: true,
                    };
                }

                const samplemapsPath = path.join(enginePath, "samplemaps");
                const fs = await import("node:fs/promises");

                const entries = await fs.readdir(samplemapsPath);
                const maps = entries
                    .filter((e) => e.endsWith(".json") && e.startsWith("Map"))
                    .map((e) => {
                        const id = parseInt(e.replace("Map", "").replace(".json", ""), 10);
                        return {
                            id,
                            jsonFile: e,
                            previewFile: e.replace(".json", ".png"),
                        };
                    })
                    .sort((a, b) => a.id - b.id);

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(maps, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // get_core_script_versions - List core script versions
    server.tool(
        "get_core_script_versions",
        "List available core script versions",
        {},
        async () => {
            try {
                const enginePath = fileHandler.getEnginePath();
                if (!enginePath) {
                    return {
                        content: [{ type: "text" as const, text: "Error: RPGMAKER_ENGINE_PATH not set" }],
                        isError: true,
                    };
                }

                const corescriptPath = path.join(enginePath, "corescript");
                const fs = await import("node:fs/promises");

                const entries = await fs.readdir(corescriptPath, { withFileTypes: true });
                const versions = entries
                    .filter((e) => e.isDirectory() && e.name.startsWith("v"))
                    .map((e) => e.name)
                    .sort((a, b) => {
                        const parseVersion = (v: string) => {
                            const parts = v.slice(1).split(".").map(Number);
                            return parts[0] * 10000 + parts[1] * 100 + (parts[2] || 0);
                        };
                        return parseVersion(a) - parseVersion(b);
                    });

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(versions, null, 2) }],
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
