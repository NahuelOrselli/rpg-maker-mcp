/**
 * Enemy Tools - create_enemy, get_enemies, update_enemy
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import { RPGEnemy } from "../utils/types.js";

const createEnemySchema = z.object({
    name: z.string().describe("Enemy name"),
    maxHp: z.number().int().min(1).default(100).describe("Max HP"),
    maxMp: z.number().int().min(0).default(0).describe("Max MP"),
    atk: z.number().int().min(0).default(10).describe("Attack (ATK)"),
    def: z.number().int().min(0).default(10).describe("Defense (DEF)"),
    mat: z.number().int().min(0).default(10).describe("Magic Attack (MAT)"),
    mdf: z.number().int().min(0).default(10).describe("Magic Defense (MDF)"),
    agi: z.number().int().min(0).default(10).describe("Agility (AGI)"),
    luk: z.number().int().min(0).default(10).describe("Luck (LUK)"),
    exp: z.number().int().min(0).default(0).describe("Experience reward"),
    gold: z.number().int().min(0).default(0).describe("Gold reward"),
    battlerName: z.string().optional().describe("Battler image name"),
    battlerHue: z.number().int().min(0).default(0).describe("Battler hue (0-360)"),
});

const updateEnemySchema = z.object({
    id: z.number().int().min(1).describe("Enemy ID to update"),
    name: z.string().optional(),
    maxHp: z.number().int().min(1).optional(),
    atk: z.number().int().min(0).optional(),
    exp: z.number().int().min(0).optional(),
    gold: z.number().int().min(0).optional(),
    battlerName: z.string().optional(),
});

function createDefaultEnemy(id: number): RPGEnemy {
    return {
        id,
        name: "",
        battlerName: "",
        battlerHue: 0,
        params: [100, 0, 10, 10, 10, 10, 10, 10], // HP, MP, ATK, DEF, MAT, MDF, AGI, LUK
        exp: 0,
        gold: 0,
        dropItems: [
            { kind: 0, dataId: 1, denominator: 1 },
            { kind: 0, dataId: 1, denominator: 1 },
            { kind: 0, dataId: 1, denominator: 1 }
        ],
        actions: [],
        traits: [],
        note: "",
    };
}

export function registerEnemyTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    // get_enemies - List all enemies
    server.tool(
        "get_enemies",
        "Get all enemies from the database",
        {},
        async () => {
            try {
                const enemies = await fileHandler.readJson<(RPGEnemy | null)[]>("data/Enemies.json");
                const enemyList = enemies
                    .filter((e): e is RPGEnemy => e !== null && e.name !== "")
                    .map((e) => ({
                        id: e.id,
                        name: e.name,
                        stats: {
                            hp: e.params[0],
                            atk: e.params[2],
                            def: e.params[3]
                        },
                        rewards: {
                            exp: e.exp,
                            gold: e.gold
                        },
                        battler: e.battlerName
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(enemyList, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // create_enemy - Create a new enemy
    server.tool(
        "create_enemy",
        "Create a new enemy in the database",
        createEnemySchema.shape,
        async (args) => {
            try {
                const {
                    name, maxHp, maxMp, atk, def, mat, mdf, agi, luk,
                    exp, gold, battlerName, battlerHue
                } = args;

                const enemies = await fileHandler.readJson<(RPGEnemy | null)[]>("data/Enemies.json");
                const newId = enemies.length;

                const newEnemy = createDefaultEnemy(newId);
                newEnemy.name = name;
                newEnemy.params = [maxHp, maxMp, atk, def, mat, mdf, agi, luk];
                newEnemy.exp = exp;
                newEnemy.gold = gold;
                if (battlerName) newEnemy.battlerName = battlerName;
                newEnemy.battlerHue = battlerHue;

                enemies.push(newEnemy);
                await safeWriter.writeToDatabase("Enemies.json", enemies);

                return {
                    content: [{ type: "text" as const, text: `Created enemy "${name}" with ID ${newId}` }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // update_enemy - Update an existing enemy
    server.tool(
        "update_enemy",
        "Update an existing enemy's properties",
        updateEnemySchema.shape,
        async (args) => {
            try {
                const { id, name, maxHp, atk, exp, gold, battlerName } = args;

                const enemies = await fileHandler.readJson<(RPGEnemy | null)[]>("data/Enemies.json");

                if (id >= enemies.length || !enemies[id]) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Enemy ID ${id} not found` }],
                        isError: true,
                    };
                }

                const enemy = enemies[id]!;

                if (name !== undefined) enemy.name = name;
                if (maxHp !== undefined) enemy.params[0] = maxHp; // HP is index 0
                if (atk !== undefined) enemy.params[2] = atk;     // ATK is index 2
                if (exp !== undefined) enemy.exp = exp;
                if (gold !== undefined) enemy.gold = gold;
                if (battlerName !== undefined) enemy.battlerName = battlerName;

                await safeWriter.writeToDatabase("Enemies.json", enemies);

                return {
                    content: [{ type: "text" as const, text: `Updated enemy "${enemy.name}" (ID ${id})` }],
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
