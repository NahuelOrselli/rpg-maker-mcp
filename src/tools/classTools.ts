/**
 * Class Tools - create_class, get_classes, update_class
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import { RPGClass } from "../utils/types.js";

const createClassSchema = z.object({
    name: z.string().describe("Class name"),
    expBase: z.number().int().min(10).default(30).describe("EXP Base (Curve)"),
    expAccel: z.number().int().min(10).default(30).describe("EXP Acceleration (Curve)"),
    maxHp: z.number().int().min(1).default(450).describe("Base Max HP at Level 1"),
    maxMp: z.number().int().min(0).default(90).describe("Base Max MP at Level 1"),
    atk: z.number().int().min(1).default(16).describe("Base ATK at Level 1"),
    def: z.number().int().min(1).default(16).describe("Base DEF at Level 1"),
});

const updateClassSchema = z.object({
    id: z.number().int().min(1).describe("Class ID to update"),
    name: z.string().optional(),
});

function createDefaultClass(id: number): RPGClass {
    return {
        id,
        name: "",
        expParams: [30, 20, 30, 30],
        params: [
            // Level 1 to 99 curves for: HP, MP, ATK, DEF, MAT, MDF, AGI, LUK
            // We usually just set curve parameters but here we'll simplify initialization
            new Array(100).fill(100),
            new Array(100).fill(100),
            new Array(100).fill(10),
            new Array(100).fill(10),
            new Array(100).fill(10),
            new Array(100).fill(10),
            new Array(100).fill(10),
            new Array(100).fill(10)
        ],
        learnings: [],
        traits: [],
        note: "",
    };
}

export function registerClassTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    // get_classes - List all classes
    server.tool(
        "get_classes",
        "Get all classes from the database",
        {},
        async () => {
            try {
                const classes = await fileHandler.readJson<(RPGClass | null)[]>("data/Classes.json");
                const classList = classes
                    .filter((c): c is RPGClass => c !== null && c.name !== "")
                    .map((c) => ({
                        id: c.id,
                        name: c.name,
                        learningsCount: c.learnings.length
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(classList, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // create_class - Create a new class
    server.tool(
        "create_class",
        "Create a new class in the database",
        createClassSchema.shape,
        async (args) => {
            try {
                const { name, expBase, expAccel } = args;

                const classes = await fileHandler.readJson<(RPGClass | null)[]>("data/Classes.json");
                const newId = classes.length;

                const newClass = createDefaultClass(newId);
                newClass.name = name;
                newClass.expParams[0] = expBase;
                newClass.expParams[1] = expAccel;

                classes.push(newClass);
                await safeWriter.writeToDatabase("Classes.json", classes);

                return {
                    content: [{ type: "text" as const, text: `Created class "${name}" with ID ${newId}` }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // update_class - Update an existing class
    server.tool(
        "update_class",
        "Update an existing class's name",
        updateClassSchema.shape,
        async (args) => {
            try {
                const { id, name } = args;

                const classes = await fileHandler.readJson<(RPGClass | null)[]>("data/Classes.json");

                if (id >= classes.length || !classes[id]) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Class ID ${id} not found` }],
                        isError: true,
                    };
                }

                const rpgClass = classes[id]!;

                if (name !== undefined) rpgClass.name = name;

                await safeWriter.writeToDatabase("Classes.json", classes);

                return {
                    content: [{ type: "text" as const, text: `Updated class "${rpgClass.name}" (ID ${id})` }],
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
