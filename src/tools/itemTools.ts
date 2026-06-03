/**
 * Item Tools - create_item, get_items, update_item
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import type { RPGItem, RPGDamage, RPGEffect } from "../utils/types.js";
import { ItemType, Scope, Occasion, EffectCode, DamageType } from "../utils/types.js";

const createItemSchema = z.object({
    name: z.string().describe("Item name"),
    description: z.string().describe("Item description"),
    price: z.number().int().min(0).describe("Item price"),
    type: z.enum(["regular", "key"]).default("regular").describe("Item type"),
    hpRecoveryPercent: z.number().min(0).max(100).default(0).describe("HP recovery percentage (0-100)"),
    hpRecoveryFixed: z.number().int().min(0).default(0).describe("HP recovery fixed amount"),
    mpRecoveryPercent: z.number().min(0).max(100).default(0).describe("MP recovery percentage (0-100)"),
    mpRecoveryFixed: z.number().int().min(0).default(0).describe("MP recovery fixed amount"),
    addStateId: z.number().int().min(0).default(0).describe("State ID to add (e.g., for buffs/regen)"),
    iconIndex: z.number().int().min(0).default(0).describe("Icon index from IconSet"),
});

const updateItemSchema = z.object({
    id: z.number().int().min(1).describe("Item ID to update"),
    name: z.string().optional(),
    description: z.string().optional(),
    price: z.number().int().min(0).optional(),
    iconIndex: z.number().int().min(0).optional(),
});

function createDefaultDamage(): RPGDamage {
    return {
        type: DamageType.None,
        elementId: 0,
        formula: "0",
        variance: 20,
        critical: false,
    };
}

function createDefaultItem(id: number): RPGItem {
    return {
        id,
        name: "",
        description: "",
        iconIndex: 0,
        price: 0,
        itypeId: ItemType.Regular,
        consumable: true,
        scope: Scope.OneAlly,
        occasion: Occasion.Always,
        animationId: 0,
        damage: createDefaultDamage(),
        effects: [],
        hitType: 0,
        repeats: 1,
        speed: 0,
        successRate: 100,
        tpGain: 0,
        note: "",
    };
}

export function registerItemTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    // get_items - List all items
    server.tool(
        "get_items",
        "Get all items from the database",
        {},
        async () => {
            try {
                const items = await fileHandler.readJson<(RPGItem | null)[]>("data/Items.json");
                const itemList = items
                    .filter((i): i is RPGItem => i !== null && i.name !== "")
                    .map((i) => ({
                        id: i.id,
                        name: i.name,
                        description: i.description,
                        price: i.price,
                        iconIndex: i.iconIndex,
                        type: i.itypeId === ItemType.KeyItem ? "key" : "regular",
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(itemList, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // create_item - Create a new item
    server.tool(
        "create_item",
        "Create a new item in the database with HP and/or MP recovery",
        createItemSchema.shape,
        async (args) => {
            try {
                const { name, description, price, type, hpRecoveryPercent, hpRecoveryFixed, mpRecoveryPercent, mpRecoveryFixed, addStateId, iconIndex } = args;

                const items = await fileHandler.readJson<(RPGItem | null)[]>("data/Items.json");
                const newId = items.length;

                const newItem = createDefaultItem(newId);
                newItem.name = name;
                newItem.description = description;
                newItem.price = price;
                newItem.iconIndex = iconIndex;
                newItem.itypeId = type === "key" ? ItemType.KeyItem : ItemType.Regular;

                // Add HP recovery effect if specified
                if (hpRecoveryPercent > 0 || hpRecoveryFixed > 0) {
                    const effect: RPGEffect = {
                        code: EffectCode.RecoverHP,
                        dataId: 0,
                        value1: hpRecoveryPercent / 100,
                        value2: hpRecoveryFixed,
                    };
                    newItem.effects.push(effect);
                }

                // Add MP recovery effect if specified
                if (mpRecoveryPercent > 0 || mpRecoveryFixed > 0) {
                    const effect: RPGEffect = {
                        code: EffectCode.RecoverMP,
                        dataId: 0,
                        value1: mpRecoveryPercent / 100,
                        value2: mpRecoveryFixed,
                    };
                    newItem.effects.push(effect);
                }

                // Add State effect if specified
                if (addStateId > 0) {
                    const effect: RPGEffect = {
                        code: EffectCode.AddState,
                        dataId: addStateId,
                        value1: 1, // 100% chance
                        value2: 0,
                    };
                    newItem.effects.push(effect);
                }

                // Set scope if any recovery effect was added
                if (newItem.effects.length > 0) {
                    newItem.scope = Scope.OneAlly;
                    newItem.occasion = Occasion.Always;
                }

                items.push(newItem);
                await safeWriter.writeToDatabase("Items.json", items);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Created item "${name}" with ID ${newId}`,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // update_item - Update an existing item
    server.tool(
        "update_item",
        "Update an existing item in the database",
        updateItemSchema.shape,
        async (args) => {
            try {
                const { id, name, description, price, iconIndex } = args;

                const items = await fileHandler.readJson<(RPGItem | null)[]>("data/Items.json");

                if (id >= items.length || items[id] === null) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Item with ID ${id} not found` }],
                        isError: true,
                    };
                }

                const item = items[id]!;
                if (name !== undefined) item.name = name;
                if (description !== undefined) item.description = description;
                if (price !== undefined) item.price = price;
                if (iconIndex !== undefined) item.iconIndex = iconIndex;

                await safeWriter.writeToDatabase("Items.json", items);

                return {
                    content: [{ type: "text" as const, text: `Updated item ID ${id}` }],
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
