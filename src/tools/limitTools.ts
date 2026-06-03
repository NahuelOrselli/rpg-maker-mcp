/**
 * Database Limit Tools - set_database_limit, get_database_limits
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";

const setLimitSchema = z.object({
    database: z.enum(["items", "weapons", "armors", "skills", "actors", "classes", "enemies", "states", "animations", "tilesets", "troops", "commonEvents"]).describe("Database to resize"),
    limit: z.number().int().min(1).max(9999).describe("New maximum limit"),
});

const databaseFiles: Record<string, string> = {
    items: "Items.json",
    weapons: "Weapons.json",
    armors: "Armors.json",
    skills: "Skills.json",
    actors: "Actors.json",
    classes: "Classes.json",
    enemies: "Enemies.json",
    states: "States.json",
    animations: "Animations.json",
    tilesets: "Tilesets.json",
    troops: "Troops.json",
    commonEvents: "CommonEvents.json",
};

export function registerLimitTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    // get_database_limits - Get current limits for all databases
    server.tool(
        "get_database_limits",
        "Get current maximum limits for all databases",
        {},
        async () => {
            try {
                const limits: Record<string, number> = {};

                for (const [name, filename] of Object.entries(databaseFiles)) {
                    try {
                        const data = await fileHandler.readJson<unknown[]>(`data/${filename}`);
                        limits[name] = data.length - 1; // Subtract 1 because index 0 is null
                    } catch {
                        limits[name] = 0;
                    }
                }

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(limits, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // set_database_limit - Set the maximum limit for a database
    server.tool(
        "set_database_limit",
        "Set the maximum limit for a database (expands or shrinks the array)",
        setLimitSchema.shape,
        async (args) => {
            try {
                const { database, limit } = args;
                const filename = databaseFiles[database];

                if (!filename) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Unknown database "${database}"` }],
                        isError: true,
                    };
                }

                const data = await fileHandler.readJson<unknown[]>(`data/${filename}`);
                const currentLimit = data.length - 1;
                const targetLength = limit + 1; // +1 for null at index 0

                if (targetLength > data.length) {
                    // Expand: add null entries
                    while (data.length < targetLength) {
                        data.push(null);
                    }
                } else if (targetLength < data.length) {
                    // Shrink: remove entries (only nulls, preserve data)
                    while (data.length > targetLength) {
                        const last = data[data.length - 1];
                        if (last !== null) {
                            return {
                                content: [{
                                    type: "text" as const,
                                    text: `Error: Cannot shrink ${database} to ${limit}. Entry at ID ${data.length - 1} has data.`
                                }],
                                isError: true,
                            };
                        }
                        data.pop();
                    }
                }

                await safeWriter.writeToDatabase(filename, data);

                return {
                    content: [{
                        type: "text" as const,
                        text: `${database} limit changed from ${currentLimit} to ${limit}`
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
}
