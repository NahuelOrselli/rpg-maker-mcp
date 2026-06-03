/**
 * Armor Tools - create_armor, get_armors, update_armor
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import { RPGArmor, RPGTrait } from "../utils/types.js";

const createArmorSchema = z.object({
    name: z.string().describe("Armor name"),
    description: z.string().describe("Armor description"),
    price: z.number().int().min(0).describe("Armor price"),
    atypeId: z.number().int().min(1).default(1).describe("Armor type ID (1=General, 2=Magic, 3=Heavy, etc.)"),
    etypeId: z.number().int().min(2).default(2).describe("Equip type ID (2=Shield, 3=Head, 4=Body, 5=Accessory)"),
    def: z.number().int().min(0).default(0).describe("Defense (DEF)"),
    mdf: z.number().int().min(0).default(0).describe("Magic Defense (MDF)"),
    agi: z.number().int().min(0).default(0).describe("Agility (AGI)"),
    iconIndex: z.number().int().min(0).default(0).describe("Icon index"),
});

const updateArmorSchema = z.object({
    id: z.number().int().min(1).describe("Armor ID to update"),
    name: z.string().optional(),
    description: z.string().optional(),
    price: z.number().int().min(0).optional(),
    def: z.number().int().min(0).optional(),
    mdf: z.number().int().min(0).optional(),
    iconIndex: z.number().int().min(0).optional(),
});

function createDefaultArmor(id: number): RPGArmor {
    return {
        id,
        name: "",
        description: "",
        iconIndex: 0,
        price: 0,
        atypeId: 1,
        etypeId: 2, // Shield
        params: [0, 0, 0, 0, 0, 0, 0, 0], // MaxHP, MaxMP, ATK, DEF, MAT, MDF, AGI, LUK
        traits: [],
        note: "",
    };
}

export function registerArmorTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    // get_armors - List all armors
    server.tool(
        "get_armors",
        "Get all armors from the database",
        {},
        async () => {
            try {
                const armors = await fileHandler.readJson<(RPGArmor | null)[]>("data/Armors.json");
                const armorList = armors
                    .filter((a): a is RPGArmor => a !== null && a.name !== "")
                    .map((a) => ({
                        id: a.id,
                        name: a.name,
                        description: a.description,
                        price: a.price,
                        stats: {
                            def: a.params[3],
                            mdf: a.params[5],
                            agi: a.params[6]
                        },
                        etypeId: a.etypeId,
                        iconIndex: a.iconIndex,
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(armorList, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // create_armor - Create a new armor
    server.tool(
        "create_armor",
        "Create a new armor in the database",
        createArmorSchema.shape,
        async (args) => {
            try {
                const {
                    name, description, price, atypeId, etypeId,
                    def, mdf, agi, iconIndex
                } = args;

                const armors = await fileHandler.readJson<(RPGArmor | null)[]>("data/Armors.json");
                const newId = armors.length;

                const newArmor = createDefaultArmor(newId);
                newArmor.name = name;
                newArmor.description = description;
                newArmor.price = price;
                newArmor.atypeId = atypeId;
                newArmor.etypeId = etypeId;
                newArmor.iconIndex = iconIndex;

                newArmor.params[3] = def; // DEF is index 3
                newArmor.params[5] = mdf; // MDF is index 5
                newArmor.params[6] = agi; // AGI is index 6

                armors.push(newArmor);
                await safeWriter.writeToDatabase("Armors.json", armors);

                return {
                    content: [{ type: "text" as const, text: `Created armor "${name}" with ID ${newId}` }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // update_armor - Update an existing armor
    server.tool(
        "update_armor",
        "Update an existing armor's properties",
        updateArmorSchema.shape,
        async (args) => {
            try {
                const { id, name, description, price, def, mdf, iconIndex } = args;

                const armors = await fileHandler.readJson<(RPGArmor | null)[]>("data/Armors.json");

                if (id >= armors.length || !armors[id]) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Armor ID ${id} not found` }],
                        isError: true,
                    };
                }

                const armor = armors[id]!;

                if (name !== undefined) armor.name = name;
                if (description !== undefined) armor.description = description;
                if (price !== undefined) armor.price = price;
                if (def !== undefined) armor.params[3] = def;
                if (mdf !== undefined) armor.params[5] = mdf;
                if (iconIndex !== undefined) armor.iconIndex = iconIndex;

                await safeWriter.writeToDatabase("Armors.json", armors);

                return {
                    content: [{ type: "text" as const, text: `Updated armor "${armor.name}" (ID ${id})` }],
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
