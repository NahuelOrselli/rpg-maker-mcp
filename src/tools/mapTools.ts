/**
 * Map Tools - create_map, get_maps, update_map
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import type { RPGEvent, RPGEventCommand, RPGEventPage, RPGMap, RPGMapInfo, RPGTileset } from "../utils/types.js";
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

const setMapTileSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID to update"),
    layer: z.number().int().min(0).max(5).describe("Layer index (0..5)"),
    x: z.number().int().min(0).describe("Tile X"),
    y: z.number().int().min(0).describe("Tile Y"),
    tileId: z.number().int().min(0).describe("Tile ID to set"),
});

const setMapTileRectSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID to update"),
    layer: z.number().int().min(0).max(5).describe("Layer index (0..5)"),
    x: z.number().int().describe("Start X"),
    y: z.number().int().describe("Start Y"),
    width: z.number().int().min(1).describe("Rectangle width"),
    height: z.number().int().min(1).describe("Rectangle height"),
    tileId: z.number().int().min(0).describe("Tile ID to paint"),
    onlyIfCurrentTileIn: z.array(z.number().int().min(0)).optional().describe("Paint only when current tile is in this whitelist"),
});

const getMapTileSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID"),
    layer: z.number().int().min(0).max(5).describe("Layer index (0..5)"),
    x: z.number().int().min(0).describe("Tile X"),
    y: z.number().int().min(0).describe("Tile Y"),
});

const setMapRegionRectSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID to update"),
    x: z.number().int().describe("Start X"),
    y: z.number().int().describe("Start Y"),
    width: z.number().int().min(1).describe("Rectangle width"),
    height: z.number().int().min(1).describe("Rectangle height"),
    regionId: z.number().int().min(0).max(255).describe("Region ID (0..255)"),
});

const setMapTerrainTagRectSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID to inspect tiles from"),
    x: z.number().int().describe("Start X"),
    y: z.number().int().describe("Start Y"),
    width: z.number().int().min(1).describe("Rectangle width"),
    height: z.number().int().min(1).describe("Rectangle height"),
    terrainTag: z.number().int().min(0).max(15).describe("Terrain tag (0..15)"),
});

const eventCommandSchema = z.object({
    code: z.number().int().describe("Event command code"),
    indent: z.number().int().min(0).default(0).describe("Command indent"),
    parameters: z.array(z.unknown()).default([]).describe("Command parameters"),
});

const replaceEventPageCommandsSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID containing the event"),
    eventId: z.number().int().min(1).describe("Event ID to update"),
    pageIndex: z.number().int().min(0).describe("Page index to replace"),
    commands: z.array(eventCommandSchema).describe("New command list"),
});

const patchEventPageCommandsSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID containing the event"),
    eventId: z.number().int().min(1).describe("Event ID to patch"),
    pageIndex: z.number().int().min(0).describe("Page index to patch"),
    ops: z.array(
        z.discriminatedUnion("op", [
            z.object({
                op: z.literal("insert"),
                at: z.number().int().min(0),
                command: eventCommandSchema,
            }),
            z.object({
                op: z.literal("delete"),
                at: z.number().int().min(0),
            }),
            z.object({
                op: z.literal("replace"),
                at: z.number().int().min(0),
                command: eventCommandSchema,
            }),
        ])
    ).min(1),
});

const moveEventPageSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID containing the event"),
    eventId: z.number().int().min(1).describe("Event ID to update"),
    fromPageIndex: z.number().int().min(0).describe("Current page index"),
    toPageIndex: z.number().int().min(0).describe("Destination page index"),
});

const runtimeStateSchema = z.object({
    runtime: z.boolean().default(false).describe("When true, merge state from save/mcp_snapshot.json if available"),
    snapshotFile: z.string().default("save/mcp_snapshot.json").describe("Path to runtime snapshot JSON (relative to project root)"),
    switches: z.record(z.boolean()).optional().describe("Switch values keyed by ID"),
    variables: z.record(z.number()).optional().describe("Variable values keyed by ID"),
    selfSwitches: z.record(z.boolean()).optional().describe("Self switches keyed as mapId,eventId,letter (example: 10,6,A)"),
});

const getActiveEventPageSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID containing the event"),
    eventId: z.number().int().min(1).describe("Event ID to evaluate"),
}).merge(runtimeStateSchema.partial({ snapshotFile: true }));

const debugEventPageConflictsSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID to inspect"),
}).merge(runtimeStateSchema.partial({ snapshotFile: true }));

const getPlaytestSnapshotSchema = z.object({
    includeEvents: z.boolean().default(true).describe("Include active page for map events"),
    includeSwitches: z.array(z.number().int().min(1)).default([]).describe("Switch IDs to include"),
    includeVariables: z.array(z.number().int().min(1)).default([]).describe("Variable IDs to include"),
    mapId: z.number().int().min(1).optional().describe("Map ID override when runtime is false"),
}).merge(runtimeStateSchema);

const addNarratorCommandSchema = z.object({
    mapId: z.number().int().min(1).describe("Map ID containing the event"),
    eventId: z.number().int().min(1).describe("Event ID to update"),
    pageIndex: z.number().int().min(0).describe("Page index to update"),
    position: z.number().int().min(0).optional().describe("Insert position in command list"),
    text: z.string().describe("Narrator text"),
    speed: z.number().int().min(1).max(9).default(2).describe("Narrator speed"),
    wait: z.boolean().default(true).describe("Wait for narrator command"),
    clearQueue: z.boolean().default(false).describe("Clear queue before showing"),
});

function mapFilenameById(mapId: number): string {
    return `Map${String(mapId).padStart(3, "0")}.json`;
}

function mapPathById(mapId: number): string {
    return `data/${mapFilenameById(mapId)}`;
}

function tileIndex(map: RPGMap, layer: number, x: number, y: number): number {
    return (layer * map.height + y) * map.width + x;
}

function normalizeEventCommand(command: z.infer<typeof eventCommandSchema>): RPGEventCommand {
    return {
        code: command.code,
        indent: command.indent,
        parameters: command.parameters,
    };
}

function ensureEventListTerminator(commands: RPGEventCommand[]): RPGEventCommand[] {
    if (commands.length === 0) {
        return [{ code: 0, indent: 0, parameters: [] }];
    }
    const last = commands[commands.length - 1];
    if (last.code === 0) {
        return commands;
    }
    return [...commands, { code: 0, indent: 0, parameters: [] }];
}

function responseJson(payload: unknown) {
    return {
        content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    };
}

function errorResponse(error: unknown) {
    return {
        content: [{ type: "text" as const, text: `Error: ${error}` }],
        isError: true,
    };
}

function clampRect(map: RPGMap, x: number, y: number, width: number, height: number) {
    const startX = Math.max(0, x);
    const startY = Math.max(0, y);
    const endX = Math.min(map.width, x + width);
    const endY = Math.min(map.height, y + height);
    const clamped = startX !== x || startY !== y || endX !== x + width || endY !== y + height;

    return {
        startX,
        startY,
        endX,
        endY,
        clamped,
    };
}

async function loadMap(fileHandler: FileHandler, mapId: number): Promise<{ mapFile: string; mapPath: string; mapData: RPGMap }> {
    const mapFile = mapFilenameById(mapId);
    const mapPath = mapPathById(mapId);

    if (!(await fileHandler.exists(mapPath))) {
        throw new Error(`Map with ID ${mapId} not found`);
    }

    const mapData = await fileHandler.readJson<RPGMap>(mapPath);
    return { mapFile, mapPath, mapData };
}

function resolveEvent(mapData: RPGMap, mapId: number, eventId: number): RPGEvent {
    const event = mapData.events?.[eventId] ?? null;
    if (!event) {
        throw new Error(`Event with ID ${eventId} not found on map ${mapId}`);
    }
    return event;
}

function resolvePage(event: RPGEvent, eventId: number, pageIndex: number): RPGEventPage {
    const page = event.pages[pageIndex];
    if (!page) {
        throw new Error(`Page index ${pageIndex} not found on event ${eventId}`);
    }
    return page;
}

function mapMutationPayload(changed: string[], summary: string, extra: Record<string, unknown> = {}) {
    return {
        ok: true,
        changed,
        summary,
        ...extra,
    };
}

interface RuntimeSnapshot {
    mapId?: number;
    player?: { x: number; y: number };
    switches?: Record<string, boolean>;
    variables?: Record<string, number>;
    selfSwitches?: Record<string, boolean>;
}

async function readRuntimeSnapshot(fileHandler: FileHandler, snapshotFile: string): Promise<RuntimeSnapshot | null> {
    if (!(await fileHandler.exists(snapshotFile))) {
        return null;
    }

    return fileHandler.readJson<RuntimeSnapshot>(snapshotFile);
}

function conditionSpecificity(page: RPGEventPage): number {
    const c = page.conditions;
    return [c.switch1Valid, c.switch2Valid, c.variableValid, c.selfSwitchValid, c.actorValid, c.itemValid].filter(Boolean).length;
}

function evaluatePageCondition(
    mapId: number,
    eventId: number,
    page: RPGEventPage,
    state: { switches: Record<string, boolean>; variables: Record<string, number>; selfSwitches: Record<string, boolean> }
): { matches: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const c = page.conditions;

    if (c.switch1Valid) {
        const value = state.switches[String(c.switch1Id)] ?? false;
        if (!value) {
            reasons.push(`switch${c.switch1Id} must be true`);
        }
    }

    if (c.switch2Valid) {
        const value = state.switches[String(c.switch2Id)] ?? false;
        if (!value) {
            reasons.push(`switch${c.switch2Id} must be true`);
        }
    }

    if (c.variableValid) {
        const value = state.variables[String(c.variableId)] ?? 0;
        if (value < c.variableValue) {
            reasons.push(`variable${c.variableId} must be >= ${c.variableValue}`);
        }
    }

    if (c.selfSwitchValid) {
        const key = `${mapId},${eventId},${c.selfSwitchCh}`;
        const value = state.selfSwitches[key] ?? false;
        if (!value) {
            reasons.push(`selfSwitch ${key} must be true`);
        }
    }

    if (c.actorValid) {
        reasons.push(`actor condition not supported in evaluator (actorId=${c.actorId})`);
    }

    if (c.itemValid) {
        reasons.push(`item condition not supported in evaluator (itemId=${c.itemId})`);
    }

    return {
        matches: reasons.length === 0,
        reasons,
    };
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

    server.tool(
        "get_map_tile",
        "Get tileId from map data by layer/x/y",
        getMapTileSchema.shape,
        async (args) => {
            try {
                const { mapId, layer, x, y } = args;
                const { mapData } = await loadMap(fileHandler, mapId);

                if (x >= mapData.width || y >= mapData.height) {
                    throw new Error(`Tile coordinates out of bounds for map ${mapId} (${mapData.width}x${mapData.height})`);
                }

                const tileId = mapData.data[tileIndex(mapData, layer, x, y)] ?? 0;
                return responseJson({ tileId });
            } catch (error) {
                return errorResponse(error);
            }
        }
    );

    server.tool(
        "set_map_tile",
        "Set one tile by map/layer/x/y",
        setMapTileSchema.shape,
        async (args) => {
            try {
                const { mapId, layer, x, y, tileId } = args;
                const { mapData, mapFile } = await loadMap(fileHandler, mapId);

                if (x >= mapData.width || y >= mapData.height) {
                    throw new Error(`Tile coordinates out of bounds for map ${mapId} (${mapData.width}x${mapData.height})`);
                }

                const idx = tileIndex(mapData, layer, x, y);
                const previous = mapData.data[idx] ?? 0;
                mapData.data[idx] = tileId;

                await safeWriter.writeToDatabase(mapFile, mapData);

                return responseJson(mapMutationPayload([mapPathById(mapId)], `tile[${layer},${x},${y}]: ${previous} -> ${tileId}`));
            } catch (error) {
                return errorResponse(error);
            }
        }
    );

    server.tool(
        "set_map_tile_rect",
        "Paint a tile rectangle in one map layer",
        setMapTileRectSchema.shape,
        async (args) => {
            try {
                const { mapId, layer, x, y, width, height, tileId, onlyIfCurrentTileIn } = args;
                const { mapData, mapFile } = await loadMap(fileHandler, mapId);
                const rect = clampRect(mapData, x, y, width, height);

                let painted = 0;
                const whitelist = onlyIfCurrentTileIn ? new Set<number>(onlyIfCurrentTileIn) : null;

                for (let ty = rect.startY; ty < rect.endY; ty++) {
                    for (let tx = rect.startX; tx < rect.endX; tx++) {
                        const idx = tileIndex(mapData, layer, tx, ty);
                        const current = mapData.data[idx] ?? 0;

                        if (whitelist && !whitelist.has(current)) {
                            continue;
                        }

                        if (current !== tileId) {
                            mapData.data[idx] = tileId;
                            painted += 1;
                        }
                    }
                }

                await safeWriter.writeToDatabase(mapFile, mapData);

                return responseJson(
                    mapMutationPayload(
                        [mapPathById(mapId)],
                        `layer${layer} rect (${rect.startX},${rect.startY})-(${rect.endX - 1},${rect.endY - 1}): painted ${painted}`,
                        {
                            painted,
                            clamped: rect.clamped,
                        }
                    )
                );
            } catch (error) {
                return errorResponse(error);
            }
        }
    );

    server.tool(
        "set_map_region_rect",
        "Paint region IDs in a map rectangle",
        setMapRegionRectSchema.shape,
        async (args) => {
            try {
                const { mapId, x, y, width, height, regionId } = args;
                const { mapData, mapFile } = await loadMap(fileHandler, mapId);
                const rect = clampRect(mapData, x, y, width, height);

                let painted = 0;
                const layer = 5;

                for (let ty = rect.startY; ty < rect.endY; ty++) {
                    for (let tx = rect.startX; tx < rect.endX; tx++) {
                        const idx = tileIndex(mapData, layer, tx, ty);
                        const current = mapData.data[idx] ?? 0;
                        if (current !== regionId) {
                            mapData.data[idx] = regionId;
                            painted += 1;
                        }
                    }
                }

                await safeWriter.writeToDatabase(mapFile, mapData);

                return responseJson(
                    mapMutationPayload(
                        [mapPathById(mapId)],
                        `regions rect (${rect.startX},${rect.startY})-(${rect.endX - 1},${rect.endY - 1}): painted ${painted}`,
                        {
                            painted,
                            clamped: rect.clamped,
                        }
                    )
                );
            } catch (error) {
                return errorResponse(error);
            }
        }
    );

    server.tool(
        "set_map_terrain_tag_rect",
        "Set terrain tag in tileset for tiles used in map rectangle",
        setMapTerrainTagRectSchema.shape,
        async (args) => {
            try {
                const { mapId, x, y, width, height, terrainTag } = args;
                const { mapData } = await loadMap(fileHandler, mapId);
                const rect = clampRect(mapData, x, y, width, height);

                const tilesets = await fileHandler.readJson<(RPGTileset | null)[]>("data/Tilesets.json");
                const tileset = tilesets[mapData.tilesetId];
                if (!tileset) {
                    throw new Error(`Tileset ID ${mapData.tilesetId} not found for map ${mapId}`);
                }

                const touchedTileIds = new Set<number>();
                for (let ty = rect.startY; ty < rect.endY; ty++) {
                    for (let tx = rect.startX; tx < rect.endX; tx++) {
                        for (let layer = 0; layer <= 3; layer++) {
                            const tileId = mapData.data[tileIndex(mapData, layer, tx, ty)] ?? 0;
                            if (tileId > 0) {
                                touchedTileIds.add(tileId);
                            }
                        }
                    }
                }

                let updatedTiles = 0;
                for (const tileId of touchedTileIds) {
                    if (tileId >= tileset.flags.length) {
                        continue;
                    }

                    const currentFlag = tileset.flags[tileId] ?? 0;
                    const currentTag = (currentFlag >> 12) & 0x0f;
                    if (currentTag === terrainTag) {
                        continue;
                    }

                    const nextFlag = (currentFlag & 0x0fff) | (terrainTag << 12);
                    tileset.flags[tileId] = nextFlag;
                    updatedTiles += 1;
                }

                await safeWriter.writeToDatabase("Tilesets.json", tilesets);

                return responseJson(
                    mapMutationPayload(
                        ["data/Tilesets.json"],
                        `tileset ${mapData.tilesetId} terrainTag=${terrainTag} on ${updatedTiles} unique tileIds from map ${mapId}`,
                        {
                            updatedTiles,
                            clamped: rect.clamped,
                            tilesetId: mapData.tilesetId,
                        }
                    )
                );
            } catch (error) {
                return errorResponse(error);
            }
        }
    );

    server.tool(
        "replace_event_page_commands",
        "Replace a page command list atomically",
        replaceEventPageCommandsSchema.shape,
        async (args) => {
            try {
                const { mapId, eventId, pageIndex, commands } = args;
                const { mapData, mapFile } = await loadMap(fileHandler, mapId);
                const event = resolveEvent(mapData, mapId, eventId);
                const page = resolvePage(event, eventId, pageIndex);

                const nextCommands = ensureEventListTerminator(commands.map(normalizeEventCommand));
                const before = page.list.length;
                page.list = nextCommands;

                await safeWriter.writeToDatabase(mapFile, mapData);

                return responseJson(
                    mapMutationPayload([mapPathById(mapId)], `event ${eventId} page ${pageIndex} commands: ${before} -> ${nextCommands.length}`, {
                        commandCount: nextCommands.length,
                    })
                );
            } catch (error) {
                return errorResponse(error);
            }
        }
    );

    server.tool(
        "patch_event_page_commands",
        "Patch command list on an event page",
        patchEventPageCommandsSchema.shape,
        async (args) => {
            try {
                const { mapId, eventId, pageIndex, ops } = args;
                const { mapData, mapFile } = await loadMap(fileHandler, mapId);
                const event = resolveEvent(mapData, mapId, eventId);
                const page = resolvePage(event, eventId, pageIndex);

                const list = [...page.list];
                for (const op of ops) {
                    if (op.op === "insert") {
                        if (op.at > list.length) {
                            throw new Error(`insert.at ${op.at} out of bounds (len=${list.length})`);
                        }
                        list.splice(op.at, 0, normalizeEventCommand(op.command));
                    }

                    if (op.op === "delete") {
                        if (op.at < 0 || op.at >= list.length) {
                            throw new Error(`delete.at ${op.at} out of bounds (len=${list.length})`);
                        }
                        list.splice(op.at, 1);
                    }

                    if (op.op === "replace") {
                        if (op.at < 0 || op.at >= list.length) {
                            throw new Error(`replace.at ${op.at} out of bounds (len=${list.length})`);
                        }
                        list[op.at] = normalizeEventCommand(op.command);
                    }
                }

                const normalized = ensureEventListTerminator(list);
                const before = page.list.length;
                page.list = normalized;

                await safeWriter.writeToDatabase(mapFile, mapData);

                return responseJson(
                    mapMutationPayload([mapPathById(mapId)], `event ${eventId} page ${pageIndex} commands: ${before} -> ${normalized.length}`, {
                        commandCount: normalized.length,
                    })
                );
            } catch (error) {
                return errorResponse(error);
            }
        }
    );

    server.tool(
        "move_event_page",
        "Move event page index preserving content",
        moveEventPageSchema.shape,
        async (args) => {
            try {
                const { mapId, eventId, fromPageIndex, toPageIndex } = args;
                const { mapData, mapFile } = await loadMap(fileHandler, mapId);
                const event = resolveEvent(mapData, mapId, eventId);

                if (fromPageIndex >= event.pages.length || toPageIndex >= event.pages.length) {
                    throw new Error(`Page move out of range (pages=${event.pages.length})`);
                }

                if (fromPageIndex !== toPageIndex) {
                    const [page] = event.pages.splice(fromPageIndex, 1);
                    event.pages.splice(toPageIndex, 0, page);
                }

                await safeWriter.writeToDatabase(mapFile, mapData);

                return responseJson(
                    mapMutationPayload([mapPathById(mapId)], `event ${eventId} moved page ${fromPageIndex} -> ${toPageIndex}`)
                );
            } catch (error) {
                return errorResponse(error);
            }
        }
    );

    server.tool(
        "add_narrator_command",
        "Insert NarratorLayer plugin command (code 357)",
        addNarratorCommandSchema.shape,
        async (args) => {
            try {
                const { mapId, eventId, pageIndex, position, text, speed, wait, clearQueue } = args;
                const { mapData, mapFile } = await loadMap(fileHandler, mapId);
                const event = resolveEvent(mapData, mapId, eventId);
                const page = resolvePage(event, eventId, pageIndex);

                const command = {
                    code: 357,
                    indent: 0,
                    parameters: [
                        "ViboxOrnic_NarratorLayer",
                        "ShowNarrator",
                        "Show Narrator",
                        {
                            text,
                            speed: String(speed),
                            clearQueue: String(clearQueue),
                            wait: String(wait),
                        },
                    ],
                } satisfies RPGEventCommand;

                const commandList = page.list;
                const insertAt =
                    position !== undefined && position >= 0 && position < commandList.length
                        ? position
                        : Math.max(commandList.length - 1, 0);

                commandList.splice(insertAt, 0, command);
                await safeWriter.writeToDatabase(mapFile, mapData);

                return responseJson(
                    mapMutationPayload([mapPathById(mapId)], `event ${eventId} page ${pageIndex} inserted narrator command at ${insertAt}`, {
                        insertedAt: insertAt,
                    })
                );
            } catch (error) {
                return errorResponse(error);
            }
        }
    );

    server.tool(
        "get_active_event_page",
        "Evaluate which event page is active for a given state",
        getActiveEventPageSchema.shape,
        async (args) => {
            try {
                const { mapId, eventId } = args;
                const runtime = args.runtime ?? false;
                const snapshotFile = args.snapshotFile ?? "save/mcp_snapshot.json";

                const runtimeSnapshot = runtime ? await readRuntimeSnapshot(fileHandler, snapshotFile) : null;
                const state = {
                    switches: { ...(runtimeSnapshot?.switches ?? {}), ...(args.switches ?? {}) },
                    variables: { ...(runtimeSnapshot?.variables ?? {}), ...(args.variables ?? {}) },
                    selfSwitches: { ...(runtimeSnapshot?.selfSwitches ?? {}), ...(args.selfSwitches ?? {}) },
                };

                const { mapData } = await loadMap(fileHandler, mapId);
                const event = resolveEvent(mapData, mapId, eventId);

                const evaluation = event.pages.map((page, pageIndex) => {
                    const result = evaluatePageCondition(mapId, eventId, page, state);
                    return {
                        pageIndex,
                        matches: result.matches,
                        reasons: result.reasons,
                        specificity: conditionSpecificity(page),
                    };
                });

                const activePageIndex = (() => {
                    for (let i = evaluation.length - 1; i >= 0; i--) {
                        if (evaluation[i].matches) {
                            return i;
                        }
                    }
                    return -1;
                })();

                return responseJson({
                    activePageIndex,
                    evaluation,
                    runtimeLoaded: runtime ? runtimeSnapshot !== null : false,
                });
            } catch (error) {
                return errorResponse(error);
            }
        }
    );

    server.tool(
        "debug_event_page_conflicts",
        "Find events where a fallback page overrides specific pages",
        debugEventPageConflictsSchema.shape,
        async (args) => {
            try {
                const { mapId } = args;
                const runtime = args.runtime ?? false;
                const snapshotFile = args.snapshotFile ?? "save/mcp_snapshot.json";
                const runtimeSnapshot = runtime ? await readRuntimeSnapshot(fileHandler, snapshotFile) : null;

                const state = {
                    switches: { ...(runtimeSnapshot?.switches ?? {}), ...(args.switches ?? {}) },
                    variables: { ...(runtimeSnapshot?.variables ?? {}), ...(args.variables ?? {}) },
                    selfSwitches: { ...(runtimeSnapshot?.selfSwitches ?? {}), ...(args.selfSwitches ?? {}) },
                };

                const { mapData } = await loadMap(fileHandler, mapId);
                const conflicts: Array<{
                    eventId: number;
                    activePageIndex: number;
                    activeSpecificity: number;
                    overshadowedPageIndex: number;
                    overshadowedSpecificity: number;
                }> = [];

                for (const event of (mapData.events ?? []).filter((e): e is RPGEvent => e !== null)) {
                    const evaluations = event.pages.map((page, pageIndex) => ({
                        pageIndex,
                        matches: evaluatePageCondition(mapId, event.id, page, state).matches,
                        specificity: conditionSpecificity(page),
                    }));

                    const active = [...evaluations].reverse().find((item) => item.matches);
                    if (!active) {
                        continue;
                    }

                    for (const candidate of evaluations) {
                        if (!candidate.matches || candidate.pageIndex === active.pageIndex) {
                            continue;
                        }

                        if (candidate.pageIndex < active.pageIndex && candidate.specificity > active.specificity) {
                            conflicts.push({
                                eventId: event.id,
                                activePageIndex: active.pageIndex,
                                activeSpecificity: active.specificity,
                                overshadowedPageIndex: candidate.pageIndex,
                                overshadowedSpecificity: candidate.specificity,
                            });
                        }
                    }
                }

                return responseJson({
                    mapId,
                    conflictCount: conflicts.length,
                    conflicts,
                    runtimeLoaded: runtime ? runtimeSnapshot !== null : false,
                });
            } catch (error) {
                return errorResponse(error);
            }
        }
    );

    server.tool(
        "get_playtest_snapshot",
        "Get consolidated playtest state snapshot",
        getPlaytestSnapshotSchema.shape,
        async (args) => {
            try {
                const runtimeSnapshot = args.runtime ? await readRuntimeSnapshot(fileHandler, args.snapshotFile) : null;
                const mapId = args.mapId ?? runtimeSnapshot?.mapId;

                if (!mapId) {
                    throw new Error("mapId is required when runtime is false or snapshot does not provide mapId");
                }

                const switches = { ...(runtimeSnapshot?.switches ?? {}), ...(args.switches ?? {}) };
                const variables = { ...(runtimeSnapshot?.variables ?? {}), ...(args.variables ?? {}) };
                const selfSwitches = { ...(runtimeSnapshot?.selfSwitches ?? {}), ...(args.selfSwitches ?? {}) };

                const selectedSwitches = Object.fromEntries(args.includeSwitches.map((id) => [String(id), switches[String(id)] ?? false]));
                const selectedVariables = Object.fromEntries(args.includeVariables.map((id) => [String(id), variables[String(id)] ?? 0]));

                const response: {
                    mapId: number;
                    player: { x: number; y: number } | null;
                    activeEvents: Array<{ eventId: number; activePageIndex: number }>;
                    switches: Record<string, boolean>;
                    variables: Record<string, number>;
                    runtimeLoaded: boolean;
                } = {
                    mapId,
                    player: runtimeSnapshot?.player ?? null,
                    activeEvents: [],
                    switches: selectedSwitches,
                    variables: selectedVariables,
                    runtimeLoaded: args.runtime ? runtimeSnapshot !== null : false,
                };

                if (args.includeEvents) {
                    const { mapData } = await loadMap(fileHandler, mapId);
                    const state = { switches, variables, selfSwitches };

                    response.activeEvents = (mapData.events ?? [])
                        .filter((event): event is RPGEvent => event !== null)
                        .map((event) => {
                            let activePageIndex = -1;
                            for (let i = event.pages.length - 1; i >= 0; i--) {
                                if (evaluatePageCondition(mapId, event.id, event.pages[i], state).matches) {
                                    activePageIndex = i;
                                    break;
                                }
                            }
                            return {
                                eventId: event.id,
                                activePageIndex,
                            };
                        });
                }

                return responseJson(response);
            } catch (error) {
                return errorResponse(error);
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

                return responseJson(
                    mapMutationPayload(
                        [`data/${mapFilenameById(newId)}`, "data/MapInfos.json"],
                        `created map ${newId} (${width}x${height}) named \"${name}\"`
                    )
                );
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

                return responseJson(
                    mapMutationPayload([mapPathById(mapId)], `created event ${newEventId} on map ${mapId} (pages=${newEvent.pages.length})`)
                );
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

                return responseJson(mapMutationPayload([mapPathById(mapId)], `updated event ${eventId} on map ${mapId}`));
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

                return responseJson(
                    mapMutationPayload([mapPathById(mapId)], `event ${eventId} page ${pageIndex} commands: inserted at ${insertAt}`)
                );
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

                return responseJson(mapMutationPayload([`data/${mapFilename}`], `updated map ${id}`));
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );
}
