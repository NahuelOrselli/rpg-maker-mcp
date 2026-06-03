/**
 * Weapon Tools - create_weapon, get_weapons, update_weapon
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import { RPGWeapon, RPGTrait } from "../utils/types.js";

const createWeaponSchema = z.object({
    name: z.string().describe("Weapon name"),
    description: z.string().describe("Weapon description"),
    price: z.number().int().min(0).describe("Weapon price"),
    wtypeId: z.number().int().min(1).default(1).describe("Weapon type ID (1=Dagger, 2=Sword, 3=Flail, etc.)"),
    attack: z.number().int().min(0).default(0).describe("Attack power (ATK bonus)"),
    elementId: z.number().int().min(0).default(0).describe("Element ID (1=Physical, 2=Fire, 3=Ice, 4=Thunder, etc.)"),
    iconIndex: z.number().int().min(0).default(0).describe("Icon index from IconSet"),
    animationId: z.number().int().min(0).default(0).describe("Attack animation ID"),
});

const updateWeaponSchema = z.object({
    id: z.number().int().min(1).describe("Weapon ID to update"),
    name: z.string().optional(),
    description: z.string().optional(),
    price: z.number().int().min(0).optional(),
    attack: z.number().int().min(0).optional(),
    iconIndex: z.number().int().min(0).optional(),
});

function createDefaultWeapon(id: number): RPGWeapon {
    return {
        id,
        name: "",
        description: "",
        iconIndex: 0,
        price: 0,
        wtypeId: 1, // Default to dagger
        etypeId: 1, // Weapon slot
        params: [0, 0, 0, 0, 0, 0, 0, 0], // MaxHP, MaxMP, ATK, DEF, MATK, MDEF, AGI, LUCK
        traits: [],
        animationId: 0,
        note: "",
    };
}

export function registerWeaponTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    // get_weapons - List all weapons
    server.tool(
        "get_weapons",
        "Get all weapons from the database",
        {},
        async () => {
            try {
                const weapons = await fileHandler.readJson<(RPGWeapon | null)[]>("data/Weapons.json");
                const weaponList = weapons
                    .filter((w): w is RPGWeapon => w !== null && w.name !== "")
                    .map((w) => ({
                        id: w.id,
                        name: w.name,
                        description: w.description,
                        price: w.price,
                        attack: w.params[2], // ATK is index 2
                        wtypeId: w.wtypeId,
                        iconIndex: w.iconIndex,
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(weaponList, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // create_weapon - Create a new weapon
    server.tool(
        "create_weapon",
        "Create a new weapon in the database with attack power and optional element",
        createWeaponSchema.shape,
        async (args) => {
            try {
                const { name, description, price, wtypeId, attack, elementId, iconIndex, animationId } = args;

                const weapons = await fileHandler.readJson<(RPGWeapon | null)[]>("data/Weapons.json");
                const newId = weapons.length;

                const newWeapon = createDefaultWeapon(newId);
                newWeapon.name = name;
                newWeapon.description = description;
                newWeapon.price = price;
                newWeapon.wtypeId = wtypeId;
                newWeapon.iconIndex = iconIndex;
                newWeapon.animationId = animationId;

                // Set attack parameter (index 2 in params array)
                newWeapon.params[2] = attack;

                // Add element trait if specified
                if (elementId > 0) {
                    const elementTrait: RPGTrait = {
                        code: 31, // Element Rate
                        dataId: elementId,
                        value: 1,
                    };
                    newWeapon.traits.push(elementTrait);
                }

                weapons.push(newWeapon);
                await safeWriter.writeToDatabase("Weapons.json", weapons);

                return {
                    content: [{ type: "text" as const, text: `Created weapon "${name}" with ID ${newId}` }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // update_weapon - Update an existing weapon
    server.tool(
        "update_weapon",
        "Update an existing weapon's properties",
        updateWeaponSchema.shape,
        async (args) => {
            try {
                const { id, name, description, price, attack, iconIndex } = args;

                const weapons = await fileHandler.readJson<(RPGWeapon | null)[]>("data/Weapons.json");

                if (id >= weapons.length || !weapons[id]) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Weapon ID ${id} not found` }],
                        isError: true,
                    };
                }

                const weapon = weapons[id]!;

                if (name !== undefined) weapon.name = name;
                if (description !== undefined) weapon.description = description;
                if (price !== undefined) weapon.price = price;
                if (attack !== undefined) weapon.params[2] = attack;
                if (iconIndex !== undefined) weapon.iconIndex = iconIndex;

                await safeWriter.writeToDatabase("Weapons.json", weapons);

                return {
                    content: [{ type: "text" as const, text: `Updated weapon "${weapon.name}" (ID ${id})` }],
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
