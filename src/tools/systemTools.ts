import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import type { RPGSystem } from "../utils/types.js";

const setVariableNameSchema = z.object({
    variableId: z.number().int().min(1).describe("Variable ID to rename"),
    name: z.string().describe("New variable name"),
});

const setSwitchNameSchema = z.object({
    switchId: z.number().int().min(1).describe("Switch ID to rename"),
    name: z.string().describe("New switch name"),
});

const updateGameTitleSchema = z.object({
    title: z.string().min(1).describe("New game title"),
});

const updateStartingPositionSchema = z.object({
    mapId: z.number().int().min(1).describe("Start map ID"),
    x: z.number().int().min(0).describe("Start X"),
    y: z.number().int().min(0).describe("Start Y"),
});

export function registerSystemTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    server.tool(
        "get_system",
        "Get system data",
        {},
        async () => {
            try {
                const system = await fileHandler.readJson<RPGSystem>("data/System.json");
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(system, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "get_variables",
        "Get all variable names",
        {},
        async () => {
            try {
                const system = await fileHandler.readJson<RPGSystem>("data/System.json");
                const variables = Array.isArray(system.variables) ? system.variables : [];
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(variables, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "set_variable_name",
        "Set variable name by ID",
        setVariableNameSchema.shape,
        async (args) => {
            try {
                const { variableId, name } = args;
                const system = await fileHandler.readJson<RPGSystem>("data/System.json");

                if (!Array.isArray(system.variables) || variableId >= system.variables.length) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Variable ID ${variableId} not found` }],
                        isError: true,
                    };
                }

                system.variables[variableId] = name;
                await safeWriter.writeToDatabase("System.json", system);

                return {
                    content: [{ type: "text" as const, text: `Updated variable ID ${variableId}` }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "get_switches",
        "Get all switch names",
        {},
        async () => {
            try {
                const system = await fileHandler.readJson<RPGSystem>("data/System.json");
                const switches = Array.isArray(system.switches) ? system.switches : [];
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(switches, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "set_switch_name",
        "Set switch name by ID",
        setSwitchNameSchema.shape,
        async (args) => {
            try {
                const { switchId, name } = args;
                const system = await fileHandler.readJson<RPGSystem>("data/System.json");

                if (!Array.isArray(system.switches) || switchId >= system.switches.length) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Switch ID ${switchId} not found` }],
                        isError: true,
                    };
                }

                system.switches[switchId] = name;
                await safeWriter.writeToDatabase("System.json", system);

                return {
                    content: [{ type: "text" as const, text: `Updated switch ID ${switchId}` }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "get_game_title",
        "Get game title",
        {},
        async () => {
            try {
                const system = await fileHandler.readJson<RPGSystem>("data/System.json");
                return {
                    content: [{ type: "text" as const, text: JSON.stringify({ gameTitle: system.gameTitle }, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "update_game_title",
        "Update game title",
        updateGameTitleSchema.shape,
        async (args) => {
            try {
                const { title } = args;
                const system = await fileHandler.readJson<RPGSystem>("data/System.json");
                system.gameTitle = title;

                await safeWriter.writeToDatabase("System.json", system);

                return {
                    content: [{ type: "text" as const, text: `Updated game title to "${title}"` }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "update_starting_position",
        "Update game starting position",
        updateStartingPositionSchema.shape,
        async (args) => {
            try {
                const { mapId, x, y } = args;
                const mapPath = `data/Map${String(mapId).padStart(3, "0")}.json`;

                if (!(await fileHandler.exists(mapPath))) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Map with ID ${mapId} not found` }],
                        isError: true,
                    };
                }

                const system = await fileHandler.readJson<RPGSystem>("data/System.json");
                system.startMapId = mapId;
                system.startX = x;
                system.startY = y;

                await safeWriter.writeToDatabase("System.json", system);

                return {
                    content: [{ type: "text" as const, text: `Updated starting position to map ${mapId} at (${x}, ${y})` }],
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
