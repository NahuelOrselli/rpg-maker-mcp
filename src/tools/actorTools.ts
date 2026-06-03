/**
 * Actor Tools - create_actor, get_actors, update_actor
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import { RPGActor } from "../utils/types.js";

const createActorSchema = z.object({
    name: z.string().describe("Actor name"),
    nickname: z.string().optional().default("").describe("Actor nickname"),
    classId: z.number().int().min(1).default(1).describe("Class ID"),
    initialLevel: z.number().int().min(1).default(1).describe("Initial level"),
    maxLevel: z.number().int().min(1).default(99).describe("Max level"),
    profile: z.string().optional().default("").describe("Profile description"),
    characterName: z.string().optional().default("").describe("Character sprite name"),
    characterIndex: z.number().int().min(0).default(0).describe("Character sprite index"),
    faceName: z.string().optional().default("").describe("Face image name"),
    faceIndex: z.number().int().min(0).default(0).describe("Face image index"),
});

const updateActorSchema = z.object({
    id: z.number().int().min(1).describe("Actor ID to update"),
    name: z.string().optional(),
    nickname: z.string().optional(),
    classId: z.number().int().min(1).optional(),
    initialLevel: z.number().int().min(1).optional(),
    maxLevel: z.number().int().min(1).optional(),
    profile: z.string().optional(),
    characterName: z.string().optional(),
    faceName: z.string().optional(),
});

const getActorSchema = z.object({
    id: z.number().int().min(1).describe("Actor ID to retrieve"),
});

const searchActorsSchema = z.object({
    query: z.string().min(1).describe("Search term for actor name or nickname"),
});

function createDefaultActor(id: number): RPGActor {
    return {
        id,
        name: "",
        nickname: "",
        classId: 1,
        initialLevel: 1,
        maxLevel: 99,
        characterName: "",
        characterIndex: 0,
        faceName: "",
        faceIndex: 0,
        battlerName: "",
        equips: [0, 0, 0, 0, 0], // Weapon, Shield, Head, Body, Accessory
        profile: "",
        note: "",
    };
}

export function registerActorTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    // get_actors - List all actors
    server.tool(
        "get_actors",
        "Get all actors from the database",
        {},
        async () => {
            try {
                const actors = await fileHandler.readJson<(RPGActor | null)[]>("data/Actors.json");
                const actorList = actors
                    .filter((a): a is RPGActor => a !== null)
                    .map((a) => ({
                        id: a.id,
                        name: a.name,
                        nickname: a.nickname,
                        classId: a.classId,
                        levelRaw: `${a.initialLevel} / ${a.maxLevel}`,
                        graphics: {
                            character: a.characterName,
                            face: a.faceName
                        }
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(actorList, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // get_actor - Get one actor by ID
    server.tool(
        "get_actor",
        "Get a specific actor by ID",
        getActorSchema.shape,
        async (args) => {
            try {
                const { id } = args;
                const actors = await fileHandler.readJson<(RPGActor | null)[]>("data/Actors.json");
                const actor = actors[id] ?? null;

                if (!actor) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Actor with ID ${id} not found` }],
                        isError: true,
                    };
                }

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(actor, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // search_actors - Search actors by name or nickname
    server.tool(
        "search_actors",
        "Search actors by name or nickname",
        searchActorsSchema.shape,
        async (args) => {
            try {
                const { query } = args;
                const term = query.toLowerCase();
                const actors = await fileHandler.readJson<(RPGActor | null)[]>("data/Actors.json");

                const actorList = actors
                    .filter((a): a is RPGActor => a !== null)
                    .filter((a) => a.name.toLowerCase().includes(term) || a.nickname.toLowerCase().includes(term))
                    .map((a) => ({
                        id: a.id,
                        name: a.name,
                        nickname: a.nickname,
                        classId: a.classId,
                        levelRaw: `${a.initialLevel} / ${a.maxLevel}`,
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(actorList, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // create_actor - Create a new actor
    server.tool(
        "create_actor",
        "Create a new actor in the database",
        createActorSchema.shape,
        async (args) => {
            try {
                const {
                    name, nickname, classId, initialLevel, maxLevel,
                    profile, characterName, characterIndex, faceName, faceIndex
                } = args;

                const actors = await fileHandler.readJson<(RPGActor | null)[]>("data/Actors.json");
                const newId = actors.length;

                const newActor = createDefaultActor(newId);
                newActor.name = name;
                newActor.nickname = nickname;
                newActor.classId = classId;
                newActor.initialLevel = initialLevel;
                newActor.maxLevel = maxLevel;
                newActor.profile = profile;
                newActor.characterName = characterName;
                newActor.characterIndex = characterIndex;
                newActor.faceName = faceName;
                newActor.faceIndex = faceIndex;

                actors.push(newActor);
                await safeWriter.writeToDatabase("Actors.json", actors);

                return {
                    content: [{ type: "text" as const, text: `Created actor "${name}" with ID ${newId}` }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // update_actor - Update an existing actor
    server.tool(
        "update_actor",
        "Update an existing actor's properties",
        updateActorSchema.shape,
        async (args) => {
            try {
                const { id, name, nickname, classId, initialLevel, maxLevel, profile, characterName, faceName } = args;

                const actors = await fileHandler.readJson<(RPGActor | null)[]>("data/Actors.json");

                if (id >= actors.length || !actors[id]) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Actor ID ${id} not found` }],
                        isError: true,
                    };
                }

                const actor = actors[id]!;

                if (name !== undefined) actor.name = name;
                if (nickname !== undefined) actor.nickname = nickname;
                if (classId !== undefined) actor.classId = classId;
                if (initialLevel !== undefined) actor.initialLevel = initialLevel;
                if (maxLevel !== undefined) actor.maxLevel = maxLevel;
                if (profile !== undefined) actor.profile = profile;
                if (characterName !== undefined) actor.characterName = characterName;
                if (faceName !== undefined) actor.faceName = faceName;

                await safeWriter.writeToDatabase("Actors.json", actors);

                return {
                    content: [{ type: "text" as const, text: `Updated actor "${actor.name}" (ID ${id})` }],
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
