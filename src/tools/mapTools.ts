/**
 * Map Tools - create_map, get_maps, update_map
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import type { RPGEvent, RPGEventPage, RPGMap, RPGMapInfo } from "../utils/types.js";
import { ScrollType } from "../utils/types.js";

const createMapSchema = z.object({
    name: z.string().describe("Map name (shown in editor)"),
    displayName: z.string().default("").describe("Display name (shown in game)"),
    width: z.number().int().min(1).max(256).default(17).describe("Map width in tiles"),
    height: z.number().int().min(1).max(256).default(13).describe("Map height in tiles"),
    tilesetId: z.number().int().min(1).default(1).describe("Tileset ID to use"),
    scrollType: z.number().int().min(0).max(3).default(0).describe("Scroll type: 0=NoLoop, 1=Vertical, 2=Horizontal, 3=Both"),
    encounterSteps: z.number().int().min(1).max(999).default(30).describe("Average steps between encounters"),
    parentId: z.number().int().min(0).default(0).describe("Parent map ID for hierarchy"),
});

const updateMapSchema = z.object({
    id: z.number().int().min(1).describe("Map ID to update"),
    displayName: z.string().optional(),
    tilesetId: z.number().int().min(1).optional(),
    encounterSteps: z.number().int().min(1).max(999).optional(),
});

const getMapSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID to retrieve"),
});

const getMapEventsSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID to list events"),
});

const getMapEventSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID containing the event"),
    eventId: z.number().int().min(1).describe("Event ID to retrieve"),
});

const searchMapEventsSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID to search"),
    query: z.string().min(1).describe("Search term for event name"),
});

const createMapEventSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID to create event in"),
    name: z.string().min(1).describe("Event name"),
    x: z.number().int().min(0).describe("Event X position"),
    y: z.number().int().min(0).describe("Event Y position"),
    note: z.string().default("").describe("Event note"),
    pages: z.array(z.unknown()).min(1).describe("Event pages"),
});

const updateMapEventSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID containing the event"),
    eventId: z.number().int().min(1).describe("Event ID to update"),
    name: z.string().optional(),
    x: z.number().int().min(0).optional(),
    y: z.number().int().min(0).optional(),
    note: z.string().optional(),
    pages: z.array(z.unknown()).min(1).optional(),
});

const addEventCommandSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID containing the event"),
    eventId: z.number().int().min(1).describe("Event ID to update"),
    pageIndex: z.number().int().min(0).describe("Page index to modify"),
    command: z.object({
        code: z.number().int().describe("Event command code"),
        indent: z.number().int().min(0).default(0).describe("Command indent"),
        parameters: z.array(z.unknown()).default([]).describe("Command parameters"),
    }),
    position: z.number().int().min(0).optional().describe("Insert position in command list"),
});

function mapFilenameById(mapId: number): string {
    return `Map${String(mapId).padStart(3, "0")}.json`;
}

function createDefaultMap(width: number, height: number): RPGMap {
    // Map data array: width * height * 6 layers (A through R)
    const dataSize = width * height * 6;
    const data = new Array(dataSize).fill(0);

    return {
        displayName: "",
        tilesetId: 1,
        width,
        height,
        scrollType: ScrollType.NoLoop,
        specifyBattleback: false,
        battleback1Name: "",
        battleback2Name: "",
        autoplayBgm: false,
        bgm: { name: "", pan: 0, pitch: 100, volume: 90 },
        autoplayBgs: false,
        bgs: { name: "", pan: 0, pitch: 100, volume: 90 },
        disableDashing: false,
        encounterList: [],
        encounterStep: 30,
        parallaxName: "",
        parallaxLoopX: false,
        parallaxLoopY: false,
        parallaxSx: 0,
        parallaxSy: 0,
        parallaxShow: false,
        data,
        events: [],
        note: "",
    };
}

export function registerMapTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    // get_maps - List all maps
    server.tool(
        "get_maps",
        "Get all maps from the project",
        {},
        async () => {
            try {
                const mapInfos = await fileHandler.readJson<(RPGMapInfo | null)[]>("data/MapInfos.json");
                const mapList = mapInfos
                    .filter((m): m is RPGMapInfo => m !== null)
                    .map((m) => ({
                        id: m.id,
                        name: m.name,
                        parentId: m.parentId,
                        order: m.order,
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(mapList, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // get_map - Get map JSON by ID
    server.tool(
        "get_map",
        "Get full map data by map ID",
        getMapSchema.shape,
        async (args) => {
            try {
                const { mapId } = args;
                const mapFile = mapFilenameById(mapId);
                const mapPath = `data/${mapFile}`;

                if (!(await fileHandler.exists(mapPath))) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Map with ID ${mapId} not found` }],
                        isError: true,
                    };
                }

                const mapData = await fileHandler.readJson<RPGMap>(mapPath);

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(mapData, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // get_map_events - List events in one map
    server.tool(
        "get_map_events",
        "Get all events from a map",
        getMapEventsSchema.shape,
        async (args) => {
            try {
                const { mapId } = args;
                const mapFile = mapFilenameById(mapId);
                const mapPath = `data/${mapFile}`;

                if (!(await fileHandler.exists(mapPath))) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Map with ID ${mapId} not found` }],
                        isError: true,
                    };
                }

                const mapData = await fileHandler.readJson<RPGMap>(mapPath);
                const events = (mapData.events ?? [])
                    .filter((event): event is RPGEvent => event !== null)
                    .map((event) => ({
                        id: event.id,
                        name: event.name,
                        x: event.x,
                        y: event.y,
                        pages: event.pages.length,
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(events, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // get_map_event - Get one event from a map
    server.tool(
        "get_map_event",
        "Get a specific event from a map",
        getMapEventSchema.shape,
        async (args) => {
            try {
                const { mapId, eventId } = args;
                const mapFile = mapFilenameById(mapId);
                const mapPath = `data/${mapFile}`;

                if (!(await fileHandler.exists(mapPath))) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Map with ID ${mapId} not found` }],
                        isError: true,
                    };
                }

                const mapData = await fileHandler.readJson<RPGMap>(mapPath);
                const event = mapData.events?.[eventId] ?? null;

                if (!event) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Event with ID ${eventId} not found on map ${mapId}` }],
                        isError: true,
                    };
                }

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(event, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // create_map - Create a new map
    server.tool(
        "create_map",
        "Create a new map in the project",
        createMapSchema.shape,
        async (args) => {
            try {
                const { name, displayName, width, height, tilesetId, scrollType, encounterSteps, parentId } = args;

                // Read MapInfos to determine next ID
                const mapInfos = await fileHandler.readJson<(RPGMapInfo | null)[]>("data/MapInfos.json");

                // Find next available ID
                let newId = 1;
                for (let i = 1; i < mapInfos.length; i++) {
                    if (mapInfos[i] !== null) {
                        newId = i + 1;
                    }
                }
                if (mapInfos.length > newId) {
                    newId = mapInfos.length;
                }

                // Calculate order (max order + 1)
                const maxOrder = mapInfos
                    .filter((m): m is RPGMapInfo => m !== null)
                    .reduce((max, m) => Math.max(max, m.order || 0), 0);

                // Create map data
                const mapData = createDefaultMap(width, height);
                mapData.displayName = displayName;
                mapData.tilesetId = tilesetId;
                mapData.scrollType = scrollType;
                mapData.encounterStep = encounterSteps;

                // Create map info
                const mapInfo: RPGMapInfo = {
                    id: newId,
                    name,
                    parentId,
                    expanded: false,
                    scrollX: 0,
                    scrollY: 0,
                    order: maxOrder + 1,
                };

                // Write map using SafeWriter
                await safeWriter.writeMap(newId, mapData, mapInfo);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Created map "${name}" with ID ${newId} (${width}x${height} tiles)`,
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

    // create_map_event - Create event in a map
    server.tool(
        "create_map_event",
        "Create a new event on a map",
        createMapEventSchema.shape,
        async (args) => {
            try {
                const { mapId, name, x, y, note, pages } = args;
                const mapFile = mapFilenameById(mapId);
                const mapPath = `data/${mapFile}`;

                if (!(await fileHandler.exists(mapPath))) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Map with ID ${mapId} not found` }],
                        isError: true,
                    };
                }

                const mapData = await fileHandler.readJson<RPGMap>(mapPath);
                const events = mapData.events ?? [];

                let maxId = 0;
                for (let i = 1; i < events.length; i++) {
                    const event = events[i];
                    if (event && event.id > maxId) {
                        maxId = event.id;
                    }
                }

                const newEventId = maxId + 1;
                const newEvent: RPGEvent = {
                    id: newEventId,
                    name,
                    x,
                    y,
                    note,
                    pages: pages as RPGEventPage[],
                };

                while (events.length <= newEventId) {
                    events.push(null);
                }
                events[newEventId] = newEvent;
                mapData.events = events;

                await safeWriter.writeToDatabase(mapFile, mapData);

                return {
                    content: [{ type: "text" as const, text: `Created event "${name}" with ID ${newEventId} on map ${mapId}` }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // update_map_event - Update event fields on a map
    server.tool(
        "update_map_event",
        "Update a map event's properties",
        updateMapEventSchema.shape,
        async (args) => {
            try {
                const { mapId, eventId, name, x, y, note, pages } = args;
                const mapFile = mapFilenameById(mapId);
                const mapPath = `data/${mapFile}`;

                if (!(await fileHandler.exists(mapPath))) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Map with ID ${mapId} not found` }],
                        isError: true,
                    };
                }

                const mapData = await fileHandler.readJson<RPGMap>(mapPath);
                const event = mapData.events?.[eventId] ?? null;

                if (!event) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Event with ID ${eventId} not found on map ${mapId}` }],
                        isError: true,
                    };
                }

                if (name !== undefined) event.name = name;
                if (x !== undefined) event.x = x;
                if (y !== undefined) event.y = y;
                if (note !== undefined) event.note = note;
                if (pages !== undefined) event.pages = pages as RPGEventPage[];

                await safeWriter.writeToDatabase(mapFile, mapData);

                return {
                    content: [{ type: "text" as const, text: `Updated event ID ${eventId} on map ${mapId}` }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // add_event_command - Insert command in one event page
    server.tool(
        "add_event_command",
        "Add a command to an event page",
        addEventCommandSchema.shape,
        async (args) => {
            try {
                const { mapId, eventId, pageIndex, command, position } = args;
                const mapFile = mapFilenameById(mapId);
                const mapPath = `data/${mapFile}`;

                if (!(await fileHandler.exists(mapPath))) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Map with ID ${mapId} not found` }],
                        isError: true,
                    };
                }

                const mapData = await fileHandler.readJson<RPGMap>(mapPath);
                const event = mapData.events?.[eventId] ?? null;

                if (!event) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Event with ID ${eventId} not found on map ${mapId}` }],
                        isError: true,
                    };
                }

                const page = event.pages[pageIndex];
                if (!page) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Page index ${pageIndex} not found on event ${eventId}` }],
                        isError: true,
                    };
                }

                const commandList = page.list;
                const insertAt =
                    position !== undefined && position >= 0 && position < commandList.length
                        ? position
                        : Math.max(commandList.length - 1, 0);

                commandList.splice(insertAt, 0, {
                    code: command.code,
                    indent: command.indent,
                    parameters: command.parameters,
                });

                await safeWriter.writeToDatabase(mapFile, mapData);

                return {
                    content: [{ type: "text" as const, text: `Added command to event ${eventId} page ${pageIndex} on map ${mapId}` }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // search_map_events - Search events by name
    server.tool(
        "search_map_events",
        "Search events by name on a map",
        searchMapEventsSchema.shape,
        async (args) => {
            try {
                const { mapId, query } = args;
                const term = query.toLowerCase();
                const mapFile = mapFilenameById(mapId);
                const mapPath = `data/${mapFile}`;

                if (!(await fileHandler.exists(mapPath))) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Map with ID ${mapId} not found` }],
                        isError: true,
                    };
                }

                const mapData = await fileHandler.readJson<RPGMap>(mapPath);
                const matches = (mapData.events ?? [])
                    .filter((event): event is RPGEvent => event !== null)
                    .filter((event) => event.name.toLowerCase().includes(term))
                    .map((event) => ({
                        id: event.id,
                        name: event.name,
                        x: event.x,
                        y: event.y,
                        pages: event.pages.length,
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(matches, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // update_map - Update an existing map's properties
    server.tool(
        "update_map",
        "Update an existing map's properties",
        updateMapSchema.shape,
        async (args) => {
            try {
                const { id, displayName, tilesetId, encounterSteps } = args;

                const mapFilename = `Map${String(id).padStart(3, "0")}.json`;

                if (!(await fileHandler.exists(`data/${mapFilename}`))) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Map with ID ${id} not found` }],
                        isError: true,
                    };
                }

                const mapData = await fileHandler.readJson<RPGMap>(`data/${mapFilename}`);

                if (displayName !== undefined) mapData.displayName = displayName;
                if (tilesetId !== undefined) mapData.tilesetId = tilesetId;
                if (encounterSteps !== undefined) mapData.encounterStep = encounterSteps;

                await safeWriter.writeToDatabase(mapFilename, mapData);

                return {
                    content: [{ type: "text" as const, text: `Updated map ID ${id}` }],
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
