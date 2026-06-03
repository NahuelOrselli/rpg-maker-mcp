/**
 * State Tools - create_state, get_states, update_state
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import { RPGState, RPGTrait, EffectCode } from "../utils/types.js";

const createStateSchema = z.object({
    name: z.string().describe("State name"),
    iconIndex: z.number().int().min(0).default(0).describe("Icon index"),
    restriction: z.number().int().min(0).max(4).default(0).describe("Restriction: 0=None, 1=Attack Enemy, 2=Attack Anyone, 3=Attack Ally, 4=Cannot Move"),
    priority: z.number().int().min(0).max(100).default(50).describe("Priority (0-100)"),
    minTurns: z.number().int().min(0).default(1).describe("Minimum turns"),
    maxTurns: z.number().int().min(0).default(1).describe("Maximum turns"),
    autoRemovalTiming: z.number().int().min(0).max(2).default(0).describe("Auto removal: 0=None, 1=Action End, 2=Turn End"),
    chanceByDamage: z.number().int().min(0).max(100).default(0).describe("Chance to remove by damage %"),
    removeAtBattleEnd: z.boolean().default(true).describe("Remove at battle end"),
    regenerateMpRate: z.number().min(-100).max(100).default(0).describe("MP Regeneration Rate % (negative for damage)"),
});

const updateStateSchema = z.object({
    id: z.number().int().min(1).describe("State ID to update"),
    name: z.string().optional(),
    iconIndex: z.number().int().min(0).optional(),
    minTurns: z.number().int().min(0).optional(),
    maxTurns: z.number().int().min(0).optional(),
});

function createDefaultState(id: number): RPGState {
    return {
        id,
        name: "",
        iconIndex: 0,
        restriction: 0,
        priority: 50,
        motion: 0,
        overlay: 0,
        removeAtBattleEnd: true,
        removeByRestriction: false,
        autoRemovalTiming: 0,
        minTurns: 1,
        maxTurns: 1,
        removeByDamage: false,
        chanceByDamage: 0,
        removeByWalking: false,
        stepsToRemove: 100,
        message1: "",
        message2: "",
        message3: "",
        message4: "",
        traits: [],
        note: "",
    };
}

export function registerStateTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    // get_states - List all states
    server.tool(
        "get_states",
        "Get all states from the database",
        {},
        async () => {
            try {
                const states = await fileHandler.readJson<(RPGState | null)[]>("data/States.json");
                const stateList = states
                    .filter((s): s is RPGState => s !== null && s.name !== "")
                    .map((s) => ({
                        id: s.id,
                        name: s.name,
                        iconIndex: s.iconIndex,
                        restriction: s.restriction,
                        duration: `${s.minTurns}-${s.maxTurns} turns`
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(stateList, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // create_state - Create a new state
    server.tool(
        "create_state",
        "Create a new state (status effect) in the database",
        createStateSchema.shape,
        async (args) => {
            try {
                const {
                    name, iconIndex, restriction, priority,
                    minTurns, maxTurns, autoRemovalTiming,
                    chanceByDamage, removeAtBattleEnd,
                    regenerateMpRate
                } = args;

                const states = await fileHandler.readJson<(RPGState | null)[]>("data/States.json");
                const newId = states.length;

                const newState = createDefaultState(newId);
                newState.name = name;
                newState.iconIndex = iconIndex;
                newState.restriction = restriction;
                newState.priority = priority;
                newState.minTurns = minTurns;
                newState.maxTurns = maxTurns;
                newState.autoRemovalTiming = autoRemovalTiming;
                newState.removeAtBattleEnd = removeAtBattleEnd;

                if (chanceByDamage > 0) {
                    newState.removeByDamage = true;
                    newState.chanceByDamage = chanceByDamage;
                }

                // Add MP Regeneration Trait (Code 22: Ex-Parameter, ID 7: MRG)
                // Actually MP Regeneration is usually done via "x-param" trait
                // Code 22 = Ex-Parameter. DataId 2 = HRG (Hp Regen), 3 = MRG (Mp Regen), 4 = TRG (Tp Regen)
                if (regenerateMpRate !== 0) {
                    const mpRegenTrait: RPGTrait = {
                        code: 22,
                        dataId: 3, // MRG
                        value: regenerateMpRate / 100 // Convert percentage to rate
                    };
                    newState.traits.push(mpRegenTrait);
                }

                states.push(newState);
                await safeWriter.writeToDatabase("States.json", states);

                return {
                    content: [{ type: "text" as const, text: `Created state "${name}" with ID ${newId}` }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // update_state - Update an existing state
    server.tool(
        "update_state",
        "Update an existing state's properties",
        updateStateSchema.shape,
        async (args) => {
            try {
                const { id, name, iconIndex, minTurns, maxTurns } = args;

                const states = await fileHandler.readJson<(RPGState | null)[]>("data/States.json");

                if (id >= states.length || !states[id]) {
                    return {
                        content: [{ type: "text" as const, text: `Error: State ID ${id} not found` }],
                        isError: true,
                    };
                }

                const state = states[id]!;

                if (name !== undefined) state.name = name;
                if (iconIndex !== undefined) state.iconIndex = iconIndex;
                if (minTurns !== undefined) state.minTurns = minTurns;
                if (maxTurns !== undefined) state.maxTurns = maxTurns;

                await safeWriter.writeToDatabase("States.json", states);

                return {
                    content: [{ type: "text" as const, text: `Updated state "${state.name}" (ID ${id})` }],
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
