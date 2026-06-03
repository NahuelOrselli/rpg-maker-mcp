import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import type { RPGEffect, RPGEvent, RPGMap, RPGSkill, RPGSystem } from "../utils/types.js";
import { DamageType, EffectCode, Scope } from "../utils/types.js";

export interface ToolExecutionResult {
    tool: string;
    filesModified: string[];
    message: string;
}

export class RpgToolExecutor {
    constructor(private fileHandler: FileHandler, private safeWriter: SafeWriter) { }

    getSupportedTools(): string[] {
        return [
            "update_game_title",
            "update_starting_position",
            "set_variable_name",
            "set_switch_name",
            "create_map_event",
            "update_map_event",
            "add_event_command",
            "create_damage_skill",
            "create_healing_skill",
            "create_buff_skill",
            "create_debuff_skill",
            "create_state_skill",
        ];
    }

    estimateFiles(tool: string, args: Record<string, unknown>): string[] {
        switch (tool) {
            case "update_game_title":
            case "update_starting_position":
            case "set_variable_name":
            case "set_switch_name":
                return ["data/System.json"];
            case "create_map_event":
            case "update_map_event":
            case "add_event_command": {
                const mapId = Number(args.mapId ?? 1);
                const mapFile = `Map${String(mapId).padStart(3, "0")}.json`;
                return [`data/${mapFile}`, "data/System.json"];
            }
            case "create_damage_skill":
            case "create_healing_skill":
            case "create_buff_skill":
            case "create_debuff_skill":
            case "create_state_skill":
                return ["data/Skills.json", "data/System.json"];
            default:
                return [];
        }
    }

    async execute(tool: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
        switch (tool) {
            case "update_game_title":
                return this.updateGameTitle(String(args.title ?? ""));
            case "update_starting_position":
                return this.updateStartingPosition(Number(args.mapId), Number(args.x), Number(args.y));
            case "set_variable_name":
                return this.setVariableName(Number(args.variableId), String(args.name ?? ""));
            case "set_switch_name":
                return this.setSwitchName(Number(args.switchId), String(args.name ?? ""));
            case "create_map_event":
                return this.createMapEvent(args);
            case "update_map_event":
                return this.updateMapEvent(args);
            case "add_event_command":
                return this.addEventCommand(args);
            case "create_damage_skill":
            case "create_healing_skill":
            case "create_buff_skill":
            case "create_debuff_skill":
            case "create_state_skill":
                return this.createHelperSkill(tool, args);
            default:
                throw new Error(`Unsupported tool for task.execute: ${tool}`);
        }
    }

    private async updateGameTitle(title: string): Promise<ToolExecutionResult> {
        if (!title.trim()) {
            throw new Error("title is required");
        }
        const system = await this.fileHandler.readJson<RPGSystem>("data/System.json");
        system.gameTitle = title;
        await this.safeWriter.writeToDatabase("System.json", system);
        return { tool: "update_game_title", filesModified: ["data/System.json"], message: `Updated game title to \"${title}\"` };
    }

    private async updateStartingPosition(mapId: number, x: number, y: number): Promise<ToolExecutionResult> {
        if (!Number.isInteger(mapId) || mapId < 1) throw new Error("mapId must be >= 1");
        if (!Number.isInteger(x) || x < 0 || !Number.isInteger(y) || y < 0) throw new Error("x/y must be >= 0");

        const mapPath = `data/Map${String(mapId).padStart(3, "0")}.json`;
        if (!(await this.fileHandler.exists(mapPath))) {
            throw new Error(`Map with ID ${mapId} not found`);
        }

        const system = await this.fileHandler.readJson<RPGSystem>("data/System.json");
        system.startMapId = mapId;
        system.startX = x;
        system.startY = y;
        await this.safeWriter.writeToDatabase("System.json", system);
        return { tool: "update_starting_position", filesModified: ["data/System.json"], message: `Updated starting position to map ${mapId}` };
    }

    private async setVariableName(variableId: number, name: string): Promise<ToolExecutionResult> {
        if (!Number.isInteger(variableId) || variableId < 1) throw new Error("variableId must be >= 1");
        const system = await this.fileHandler.readJson<RPGSystem>("data/System.json");
        if (!Array.isArray(system.variables) || variableId >= system.variables.length) {
            throw new Error(`Variable ID ${variableId} not found`);
        }
        system.variables[variableId] = name;
        await this.safeWriter.writeToDatabase("System.json", system);
        return { tool: "set_variable_name", filesModified: ["data/System.json"], message: `Updated variable ${variableId}` };
    }

    private async setSwitchName(switchId: number, name: string): Promise<ToolExecutionResult> {
        if (!Number.isInteger(switchId) || switchId < 1) throw new Error("switchId must be >= 1");
        const system = await this.fileHandler.readJson<RPGSystem>("data/System.json");
        if (!Array.isArray(system.switches) || switchId >= system.switches.length) {
            throw new Error(`Switch ID ${switchId} not found`);
        }
        system.switches[switchId] = name;
        await this.safeWriter.writeToDatabase("System.json", system);
        return { tool: "set_switch_name", filesModified: ["data/System.json"], message: `Updated switch ${switchId}` };
    }

    private async createMapEvent(args: Record<string, unknown>): Promise<ToolExecutionResult> {
        const mapId = Number(args.mapId);
        const name = String(args.name ?? "");
        const x = Number(args.x);
        const y = Number(args.y);
        const note = String(args.note ?? "");
        const pages = Array.isArray(args.pages) ? args.pages : [];

        if (!Number.isInteger(mapId) || mapId < 1) throw new Error("mapId must be >= 1");
        if (!name.trim()) throw new Error("name is required");
        if (!Number.isInteger(x) || x < 0 || !Number.isInteger(y) || y < 0) throw new Error("x/y must be >= 0");
        if (pages.length === 0) throw new Error("pages must contain at least one page");

        const mapFile = `Map${String(mapId).padStart(3, "0")}.json`;
        const mapPath = `data/${mapFile}`;
        if (!(await this.fileHandler.exists(mapPath))) throw new Error(`Map with ID ${mapId} not found`);

        const mapData = await this.fileHandler.readJson<RPGMap>(mapPath);
        const events = mapData.events ?? [];
        let maxId = 0;
        for (let i = 1; i < events.length; i++) {
            const event = events[i];
            if (event && event.id > maxId) maxId = event.id;
        }
        const eventId = maxId + 1;
        const newEvent: RPGEvent = { id: eventId, name, x, y, note, pages: pages as RPGEvent["pages"] };
        while (events.length <= eventId) events.push(null);
        events[eventId] = newEvent;
        mapData.events = events;
        await this.safeWriter.writeToDatabase(mapFile, mapData);

        return {
            tool: "create_map_event",
            filesModified: [`data/${mapFile}`, "data/System.json"],
            message: `Created event ${eventId} on map ${mapId}`,
        };
    }

    private async updateMapEvent(args: Record<string, unknown>): Promise<ToolExecutionResult> {
        const mapId = Number(args.mapId);
        const eventId = Number(args.eventId);
        if (!Number.isInteger(mapId) || mapId < 1) throw new Error("mapId must be >= 1");
        if (!Number.isInteger(eventId) || eventId < 1) throw new Error("eventId must be >= 1");

        const mapFile = `Map${String(mapId).padStart(3, "0")}.json`;
        const mapPath = `data/${mapFile}`;
        if (!(await this.fileHandler.exists(mapPath))) throw new Error(`Map with ID ${mapId} not found`);

        const mapData = await this.fileHandler.readJson<RPGMap>(mapPath);
        const event = mapData.events?.[eventId] ?? null;
        if (!event) throw new Error(`Event with ID ${eventId} not found on map ${mapId}`);

        if (typeof args.name === "string") event.name = args.name;
        if (typeof args.x === "number") event.x = args.x;
        if (typeof args.y === "number") event.y = args.y;
        if (typeof args.note === "string") event.note = args.note;
        if (Array.isArray(args.pages) && args.pages.length > 0) event.pages = args.pages as RPGEvent["pages"];

        await this.safeWriter.writeToDatabase(mapFile, mapData);
        return {
            tool: "update_map_event",
            filesModified: [`data/${mapFile}`, "data/System.json"],
            message: `Updated event ${eventId} on map ${mapId}`,
        };
    }

    private async addEventCommand(args: Record<string, unknown>): Promise<ToolExecutionResult> {
        const mapId = Number(args.mapId);
        const eventId = Number(args.eventId);
        const pageIndex = Number(args.pageIndex);
        const command = (args.command ?? {}) as { code?: number; indent?: number; parameters?: unknown[] };
        const position = typeof args.position === "number" ? args.position : undefined;

        if (!Number.isInteger(mapId) || mapId < 1) throw new Error("mapId must be >= 1");
        if (!Number.isInteger(eventId) || eventId < 1) throw new Error("eventId must be >= 1");
        if (!Number.isInteger(pageIndex) || pageIndex < 0) throw new Error("pageIndex must be >= 0");
        if (!Number.isInteger(command.code ?? NaN)) throw new Error("command.code is required");

        const mapFile = `Map${String(mapId).padStart(3, "0")}.json`;
        const mapPath = `data/${mapFile}`;
        if (!(await this.fileHandler.exists(mapPath))) throw new Error(`Map with ID ${mapId} not found`);

        const mapData = await this.fileHandler.readJson<RPGMap>(mapPath);
        const event = mapData.events?.[eventId] ?? null;
        if (!event) throw new Error(`Event with ID ${eventId} not found on map ${mapId}`);
        const page = event.pages[pageIndex];
        if (!page) throw new Error(`Page index ${pageIndex} not found`);

        const insertAt =
            position !== undefined && Number.isInteger(position) && position >= 0 && position < page.list.length
                ? position
                : Math.max(page.list.length - 1, 0);

        page.list.splice(insertAt, 0, {
            code: command.code!,
            indent: Number.isInteger(command.indent ?? NaN) ? command.indent! : 0,
            parameters: Array.isArray(command.parameters) ? command.parameters : [],
        });

        await this.safeWriter.writeToDatabase(mapFile, mapData);
        return {
            tool: "add_event_command",
            filesModified: [`data/${mapFile}`, "data/System.json"],
            message: `Added command to event ${eventId} map ${mapId}`,
        };
    }

    private async createHelperSkill(tool: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
        const name = String(args.name ?? "");
        const description = String(args.description ?? "");
        const mpCost = Number(args.mpCost ?? 0);
        const scope = Number(args.scope ?? Scope.OneEnemy);

        if (!name.trim()) throw new Error("name is required");

        const skills = await this.fileHandler.readJson<(RPGSkill | null)[]>("data/Skills.json");
        let maxId = 0;
        for (const s of skills) {
            if (s && s.id > maxId) maxId = s.id;
        }
        const newId = maxId + 1;

        const skill: RPGSkill = {
            id: newId,
            name,
            description,
            iconIndex: 0,
            stypeId: 1,
            scope,
            occasion: 1,
            mpCost,
            tpCost: 0,
            damage: { type: DamageType.None, elementId: 0, formula: "0", variance: 20, critical: false },
            effects: [],
            requiredWtypeId1: 0,
            requiredWtypeId2: 0,
            speed: 0,
            successRate: 100,
            repeats: 1,
            tpGain: 0,
            hitType: 1,
            animationId: 0,
            message1: "",
            message2: "",
            note: "",
        };

        if (tool === "create_damage_skill") {
            skill.damage.type = DamageType.HPDamage;
            skill.damage.formula = String(args.damageFormula ?? "0");
            skill.damage.elementId = Number(args.elementId ?? 0);
            skill.damage.critical = true;
        } else if (tool === "create_healing_skill") {
            skill.damage.type = DamageType.HPRecover;
            skill.damage.formula = String(args.healFormula ?? "0");
            skill.damage.critical = false;
        } else if (tool === "create_buff_skill") {
            const effect: RPGEffect = {
                code: EffectCode.AddBuff,
                dataId: Number(args.buffType ?? 2),
                value1: Number(args.turns ?? 3),
                value2: 0,
            };
            skill.effects.push(effect);
        } else if (tool === "create_debuff_skill") {
            const effect: RPGEffect = {
                code: EffectCode.AddDebuff,
                dataId: Number(args.debuffType ?? 2),
                value1: Number(args.turns ?? 3),
                value2: 0,
            };
            skill.effects.push(effect);
        } else if (tool === "create_state_skill") {
            const effect: RPGEffect = {
                code: EffectCode.AddState,
                dataId: Number(args.stateId ?? 1),
                value1: Number(args.chance ?? 1),
                value2: 0,
            };
            skill.effects.push(effect);
        }

        skills.push(skill);
        await this.safeWriter.writeToDatabase("Skills.json", skills);
        return {
            tool,
            filesModified: ["data/Skills.json", "data/System.json"],
            message: `Created skill ${name} (${newId})`,
        };
    }
}
