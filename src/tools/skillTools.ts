/**
 * Skill Tools - create_skill, get_skills
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import type { RPGSkill, RPGDamage, RPGEffect } from "../utils/types.js";
import { Scope, Occasion, DamageType, EffectCode } from "../utils/types.js";

const createSkillSchema = z.object({
    name: z.string().describe("Skill name"),
    description: z.string().describe("Skill description"),
    mpCost: z.number().int().min(0).default(0).describe("MP cost"),
    tpCost: z.number().int().min(0).default(0).describe("TP cost"),
    iconIndex: z.number().int().min(0).default(0).describe("Icon index"),
    scope: z.number().int().min(0).max(11).default(1).describe("Skill scope"),
    damageType: z.number().int().min(0).max(6).default(1).describe("Damage type"),
    damageFormula: z.string().default("a.atk * 4 - b.def * 2").describe("Damage formula"),
});

const createDamageSkillSchema = z.object({
    name: z.string().describe("Skill name"),
    damageFormula: z.string().describe("Damage formula"),
    mpCost: z.number().int().min(0).default(0).describe("MP cost"),
    scope: z.number().int().min(1).max(11).default(Scope.OneEnemy).describe("Target scope"),
    elementId: z.number().int().min(0).default(0).describe("Element ID"),
    description: z.string().default("").describe("Skill description"),
});

const createHealingSkillSchema = z.object({
    name: z.string().describe("Skill name"),
    healFormula: z.string().describe("Healing formula"),
    mpCost: z.number().int().min(0).default(0).describe("MP cost"),
    scope: z.number().int().min(1).max(11).default(Scope.OneAlly).describe("Target scope"),
    description: z.string().default("").describe("Skill description"),
});

const createBuffSkillSchema = z.object({
    name: z.string().describe("Skill name"),
    buffType: z.number().int().min(2).max(7).describe("Buff param ID (2..7)"),
    turns: z.number().int().min(1).max(99).default(3).describe("Buff duration turns"),
    mpCost: z.number().int().min(0).default(0).describe("MP cost"),
    scope: z.number().int().min(1).max(11).default(Scope.OneAlly).describe("Target scope"),
    description: z.string().default("").describe("Skill description"),
});

const createDebuffSkillSchema = z.object({
    name: z.string().describe("Skill name"),
    debuffType: z.number().int().min(2).max(7).describe("Debuff param ID (2..7)"),
    turns: z.number().int().min(1).max(99).default(3).describe("Debuff duration turns"),
    mpCost: z.number().int().min(0).default(0).describe("MP cost"),
    scope: z.number().int().min(1).max(11).default(Scope.OneEnemy).describe("Target scope"),
    description: z.string().default("").describe("Skill description"),
});

const createStateSkillSchema = z.object({
    name: z.string().describe("Skill name"),
    stateId: z.number().int().min(1).describe("State ID to inflict"),
    chance: z.number().min(0).max(1).default(1).describe("State application chance 0..1"),
    mpCost: z.number().int().min(0).default(0).describe("MP cost"),
    scope: z.number().int().min(1).max(11).default(Scope.OneEnemy).describe("Target scope"),
    description: z.string().default("").describe("Skill description"),
});

const getSkillSchema = z.object({
    id: z.number().int().min(1).describe("Skill ID to retrieve"),
});

const searchSkillsSchema = z.object({
    query: z.string().min(1).describe("Search term for skill name or description"),
});

function createDefaultDamage(): RPGDamage {
    return {
        type: DamageType.HPDamage,
        elementId: 0,
        formula: "a.atk * 4 - b.def * 2",
        variance: 20,
        critical: false,
    };
}

function createDefaultSkill(id: number): RPGSkill {
    return {
        id,
        name: "",
        description: "",
        iconIndex: 0,
        stypeId: 1,
        scope: Scope.OneEnemy,
        occasion: Occasion.Battle,
        mpCost: 0,
        tpCost: 0,
        damage: createDefaultDamage(),
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
}

function getNextSkillId(skills: (RPGSkill | null)[]): number {
    let maxId = 0;
    for (const skill of skills) {
        if (skill && skill.id > maxId) {
            maxId = skill.id;
        }
    }
    return maxId + 1;
}

async function saveGeneratedSkill(
    fileHandler: FileHandler,
    safeWriter: SafeWriter,
    build: (id: number) => RPGSkill
): Promise<RPGSkill> {
    const skills = await fileHandler.readJson<(RPGSkill | null)[]>("data/Skills.json");
    const newId = getNextSkillId(skills);
    const newSkill = build(newId);
    skills.push(newSkill);
    await safeWriter.writeToDatabase("Skills.json", skills);
    return newSkill;
}

export function registerSkillTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    // get_skills - List all skills
    server.tool(
        "get_skills",
        "Get all skills from the database",
        {},
        async () => {
            try {
                const skills = await fileHandler.readJson<(RPGSkill | null)[]>("data/Skills.json");
                const skillList = skills
                    .filter((s): s is RPGSkill => s !== null && s.name !== "")
                    .map((s) => ({
                        id: s.id,
                        name: s.name,
                        description: s.description,
                        mpCost: s.mpCost,
                        tpCost: s.tpCost,
                        iconIndex: s.iconIndex,
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(skillList, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // get_skill - Get one skill by ID
    server.tool(
        "get_skill",
        "Get a specific skill by ID",
        getSkillSchema.shape,
        async (args) => {
            try {
                const { id } = args;
                const skills = await fileHandler.readJson<(RPGSkill | null)[]>("data/Skills.json");
                const skill = skills[id] ?? null;

                if (!skill) {
                    return {
                        content: [{ type: "text" as const, text: `Error: Skill with ID ${id} not found` }],
                        isError: true,
                    };
                }

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(skill, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // search_skills - Search skills by name or description
    server.tool(
        "search_skills",
        "Search skills by name or description",
        searchSkillsSchema.shape,
        async (args) => {
            try {
                const { query } = args;
                const term = query.toLowerCase();
                const skills = await fileHandler.readJson<(RPGSkill | null)[]>("data/Skills.json");

                const skillList = skills
                    .filter((s): s is RPGSkill => s !== null && s.name !== "")
                    .filter((s) => s.name.toLowerCase().includes(term) || s.description.toLowerCase().includes(term))
                    .map((s) => ({
                        id: s.id,
                        name: s.name,
                        description: s.description,
                        mpCost: s.mpCost,
                        tpCost: s.tpCost,
                        iconIndex: s.iconIndex,
                    }));

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(skillList, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // create_skill - Create a new skill
    server.tool(
        "create_skill",
        "Create a new skill in the database",
        createSkillSchema.shape,
        async (args) => {
            try {
                const { name, description, mpCost, tpCost, iconIndex, scope, damageType, damageFormula } = args;

                const newSkill = await saveGeneratedSkill(fileHandler, safeWriter, (newId) => {
                    const skill = createDefaultSkill(newId);
                    skill.name = name;
                    skill.description = description;
                    skill.mpCost = mpCost;
                    skill.tpCost = tpCost;
                    skill.iconIndex = iconIndex;
                    skill.scope = scope;
                    skill.damage.type = damageType;
                    skill.damage.formula = damageFormula;
                    return skill;
                });

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Created skill "${name}" with ID ${newSkill.id}`,
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

    server.tool(
        "create_damage_skill",
        "Create a damage-dealing skill with simplified parameters",
        createDamageSkillSchema.shape,
        async (args) => {
            try {
                const { name, damageFormula, mpCost, scope, elementId, description } = args;

                const newSkill = await saveGeneratedSkill(fileHandler, safeWriter, (newId) => {
                    const skill = createDefaultSkill(newId);
                    skill.name = name;
                    skill.description = description;
                    skill.mpCost = mpCost;
                    skill.scope = scope;
                    skill.damage.type = DamageType.HPDamage;
                    skill.damage.elementId = elementId;
                    skill.damage.formula = damageFormula;
                    skill.damage.critical = true;
                    return skill;
                });

                return {
                    content: [{ type: "text" as const, text: `Created damage skill "${name}" with ID ${newSkill.id}` }],
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
        "create_healing_skill",
        "Create a healing skill with simplified parameters",
        createHealingSkillSchema.shape,
        async (args) => {
            try {
                const { name, healFormula, mpCost, scope, description } = args;

                const newSkill = await saveGeneratedSkill(fileHandler, safeWriter, (newId) => {
                    const skill = createDefaultSkill(newId);
                    skill.name = name;
                    skill.description = description;
                    skill.mpCost = mpCost;
                    skill.scope = scope;
                    skill.damage.type = DamageType.HPRecover;
                    skill.damage.elementId = 0;
                    skill.damage.formula = healFormula;
                    skill.damage.critical = false;
                    return skill;
                });

                return {
                    content: [{ type: "text" as const, text: `Created healing skill "${name}" with ID ${newSkill.id}` }],
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
        "create_buff_skill",
        "Create a buff skill with simplified parameters",
        createBuffSkillSchema.shape,
        async (args) => {
            try {
                const { name, buffType, turns, mpCost, scope, description } = args;

                const newSkill = await saveGeneratedSkill(fileHandler, safeWriter, (newId) => {
                    const skill = createDefaultSkill(newId);
                    const effect: RPGEffect = {
                        code: EffectCode.AddBuff,
                        dataId: buffType,
                        value1: turns,
                        value2: 0,
                    };

                    skill.name = name;
                    skill.description = description;
                    skill.mpCost = mpCost;
                    skill.scope = scope;
                    skill.damage.type = DamageType.None;
                    skill.damage.formula = "0";
                    skill.effects.push(effect);
                    return skill;
                });

                return {
                    content: [{ type: "text" as const, text: `Created buff skill "${name}" with ID ${newSkill.id}` }],
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
        "create_debuff_skill",
        "Create a debuff skill with simplified parameters",
        createDebuffSkillSchema.shape,
        async (args) => {
            try {
                const { name, debuffType, turns, mpCost, scope, description } = args;

                const newSkill = await saveGeneratedSkill(fileHandler, safeWriter, (newId) => {
                    const skill = createDefaultSkill(newId);
                    const effect: RPGEffect = {
                        code: EffectCode.AddDebuff,
                        dataId: debuffType,
                        value1: turns,
                        value2: 0,
                    };

                    skill.name = name;
                    skill.description = description;
                    skill.mpCost = mpCost;
                    skill.scope = scope;
                    skill.damage.type = DamageType.None;
                    skill.damage.formula = "0";
                    skill.effects.push(effect);
                    return skill;
                });

                return {
                    content: [{ type: "text" as const, text: `Created debuff skill "${name}" with ID ${newSkill.id}` }],
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
        "create_state_skill",
        "Create a state-inflicting skill with simplified parameters",
        createStateSkillSchema.shape,
        async (args) => {
            try {
                const { name, stateId, chance, mpCost, scope, description } = args;

                const newSkill = await saveGeneratedSkill(fileHandler, safeWriter, (newId) => {
                    const skill = createDefaultSkill(newId);
                    const effect: RPGEffect = {
                        code: EffectCode.AddState,
                        dataId: stateId,
                        value1: chance,
                        value2: 0,
                    };

                    skill.name = name;
                    skill.description = description;
                    skill.mpCost = mpCost;
                    skill.scope = scope;
                    skill.damage.type = DamageType.None;
                    skill.damage.formula = "0";
                    skill.effects.push(effect);
                    return skill;
                });

                return {
                    content: [{ type: "text" as const, text: `Created state skill "${name}" with ID ${newSkill.id}` }],
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
