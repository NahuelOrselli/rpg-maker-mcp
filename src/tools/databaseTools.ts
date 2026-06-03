/**
 * Database Tools - get_database_info
 * 
 * Note: get_actors and get_classes have been moved to their respective tool files.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import type { RPGActor, RPGClass, RPGItem, RPGSkill, RPGWeapon, RPGArmor, RPGEnemy, RPGState } from "../utils/types.js";

export function registerDatabaseTools(server: McpServer, fileHandler: FileHandler) {
    // get_database_info - Get summary of all database contents
    server.tool(
        "get_database_info",
        "Get a summary of all database contents (actors, classes, items, skills, weapons, armors counts)",
        {},
        async () => {
            try {
                const [actors, classes, items, skills, weapons, armors, enemies, states] = await Promise.all([
                    fileHandler.readJson<(RPGActor | null)[]>("data/Actors.json"),
                    fileHandler.readJson<(RPGClass | null)[]>("data/Classes.json"),
                    fileHandler.readJson<(RPGItem | null)[]>("data/Items.json"),
                    fileHandler.readJson<(RPGSkill | null)[]>("data/Skills.json"),
                    fileHandler.readJson<(RPGWeapon | null)[]>("data/Weapons.json"),
                    fileHandler.readJson<(RPGArmor | null)[]>("data/Armors.json"),
                    fileHandler.readJson<(RPGEnemy | null)[]>("data/Enemies.json"),
                    fileHandler.readJson<(RPGState | null)[]>("data/States.json"),
                ]);

                // Helper to count non-null entries (ignoring the 0th index if it's null/empty)
                const count = (arr: any[]) => arr.filter(i => i !== null && i.name !== "").length;

                const summary = {
                    actors: { count: count(actors) },
                    classes: { count: count(classes) },
                    skills: { count: count(skills) },
                    items: { count: count(items) },
                    weapons: { count: count(weapons) },
                    armors: { count: count(armors) },
                    enemies: { count: count(enemies) },
                    states: { count: count(states) },
                };

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
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
