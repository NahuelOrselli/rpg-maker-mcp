import * as fs from "node:fs/promises";
import * as path from "node:path";
import { WorkspacePaths } from "../workspace/paths.js";
import type { GeneratedPlan, GeneratedTask, SourceRef, TaskAction } from "./types.js";

interface GeneratorOptions {
    docsRoot?: string;
    maxTasks?: number;
    strict?: boolean;
}

const SKILL_REGEX = /(skill|ability|spell|technique|habilidad|hechizo)\s*[:\-]\s*["“]?([A-Za-z0-9][^"”\n]{1,60})/i;
const CHAPTER_HEADING_REGEX = /^(#{1,6}\s*)?(chapter|capitulo)\s+([0-9ivxlcdm]+|[a-z0-9 _-]+)/i;

export class TaskGenerator {
    constructor(private workspacePaths: WorkspacePaths) { }

    async generateForChapter(chapter: string, options: GeneratorOptions = {}): Promise<GeneratedPlan> {
        const chapterText = chapter.trim();
        if (!chapterText) {
            throw new Error("chapter is required");
        }

        const maxTasks = Math.max(1, options.maxTasks ?? 30);
        const strict = options.strict ?? true;
        const docsRoot = this.resolveDocsRoot(options.docsRoot);

        const docs = await this.collectDocFiles(docsRoot);
        const filtered = docs.filter((doc) => this.matchesChapter(doc.content, chapterText));

        const warnings: string[] = [];
        if (filtered.length === 0) {
            warnings.push(`No documents matched chapter \"${chapterText}\"`);
        }

        const tasks = this.extractTasks(filtered, { strict, maxTasks });
        const planId = this.buildPlanId(chapterText);

        const plan: GeneratedPlan = {
            chapter: chapterText,
            planId,
            tasks,
            warnings,
            unmappedNarrative: this.collectUnmappedNarrative(filtered, tasks),
        };

        await this.saveDraft(plan);
        return plan;
    }

    async generateFromDocs(options: {
        docsRoot?: string;
        includeChapters?: string[];
        maxTasks?: number;
        strict?: boolean;
    } = {}): Promise<GeneratedPlan> {
        const maxTasks = Math.max(1, options.maxTasks ?? 80);
        const strict = options.strict ?? true;
        const docsRoot = this.resolveDocsRoot(options.docsRoot);
        const includeChapters = (options.includeChapters ?? []).map((c) => c.trim()).filter(Boolean);

        const docs = await this.collectDocFiles(docsRoot);
        const filtered = includeChapters.length === 0
            ? docs
            : docs.filter((doc) => includeChapters.some((chapter) => this.matchesChapter(doc.content, chapter)));

        const chapterLabel = includeChapters.length > 0 ? includeChapters.join(", ") : "all-docs";
        const warnings: string[] = [];
        if (filtered.length === 0) {
            warnings.push("No documents matched includeChapters filter");
        }

        const tasks = this.extractTasks(filtered, { strict, maxTasks });
        const planId = this.buildPlanId(chapterLabel);

        const plan: GeneratedPlan = {
            chapter: chapterLabel,
            planId,
            tasks,
            warnings,
            unmappedNarrative: this.collectUnmappedNarrative(filtered, tasks),
        };

        await this.saveDraft(plan);
        return plan;
    }

    async refinePlan(planId: string, options: { dedupe?: boolean; recomputeDependencies?: boolean } = {}) {
        const plan = await this.loadDraft(planId);
        const dedupe = options.dedupe ?? true;
        const recomputeDependencies = options.recomputeDependencies ?? true;

        let deduplicated = 0;
        let removedInvalid = 0;
        let relinkedDependencies = 0;

        let tasks = [...plan.tasks];

        if (dedupe) {
            const seen = new Set<string>();
            const filtered: GeneratedTask[] = [];
            for (const task of tasks) {
                const key = `${task.title.toLowerCase()}::${task.actions.map((a) => a.tool).join(",")}`;
                if (seen.has(key)) {
                    deduplicated += 1;
                    continue;
                }
                seen.add(key);
                filtered.push(task);
            }
            tasks = filtered;
        }

        const validTaskIds = new Set(tasks.map((t) => t.id));

        tasks = tasks.map((task) => {
            let dependencies = task.dependencies.filter((dep) => dep !== task.id && validTaskIds.has(dep));
            if (dependencies.length !== task.dependencies.length) {
                relinkedDependencies += 1;
            }

            if (recomputeDependencies && dependencies.length === 0) {
                const prev = this.findImmediatePreviousTask(tasks, task.id);
                if (prev) {
                    dependencies = [prev.id];
                    relinkedDependencies += 1;
                }
            }

            return {
                ...task,
                dependencies,
            };
        });

        tasks = tasks.filter((task) => {
            const valid = !!task.id && !!task.title;
            if (!valid) removedInvalid += 1;
            return valid;
        });

        const refined: GeneratedPlan = {
            ...plan,
            tasks,
        };

        await this.saveDraft(refined);

        return {
            planId,
            tasks,
            changes: {
                deduplicated,
                relinkedDependencies,
                removedInvalid,
            },
            issues: [],
        };
    }

    async publishBacklog(params: {
        planId: string;
        targetTasksFile: string;
        targetPlanningFile: string;
        updateEstadoProyecto?: boolean;
    }) {
        const plan = await this.loadDraft(params.planId);
        const targetTasksPath = this.resolveWorkspaceRelative(params.targetTasksFile);
        const targetPlanningPath = this.resolveWorkspaceRelative(params.targetPlanningFile);

        await fs.mkdir(path.dirname(targetTasksPath), { recursive: true });
        await fs.mkdir(path.dirname(targetPlanningPath), { recursive: true });

        const payload = plan.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            dependencies: task.dependencies,
            priority: task.priority,
            sources: task.sources,
            actions: task.actions,
            sourceRefs: task.sourceRefs,
            confidence: task.confidence,
            assumptions: task.assumptions,
        }));

        await fs.writeFile(targetTasksPath, JSON.stringify(payload, null, 2), "utf-8");
        await fs.writeFile(targetPlanningPath, JSON.stringify(payload, null, 2), "utf-8");

        const files = [
            this.toWorkspaceRelative(targetTasksPath),
            this.toWorkspaceRelative(targetPlanningPath),
        ];

        if (params.updateEstadoProyecto ?? true) {
            await this.ensureStateEntries(plan.tasks.map((task) => task.id));
            files.push(this.toWorkspaceRelative(this.workspacePaths.statePath));
        }

        return {
            published: true,
            files,
            taskCount: plan.tasks.length,
        };
    }

    private extractTasks(docs: Array<{ file: string; content: string }>, opts: { strict: boolean; maxTasks: number }): GeneratedTask[] {
        const tasks: GeneratedTask[] = [];
        let taskIndex = 1;

        for (const doc of docs) {
            const lines = doc.content.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const match = line.match(SKILL_REGEX);
                if (!match) continue;

                const skillName = this.cleanName(match[2]);
                if (!skillName) continue;

                const sourceRef: SourceRef = {
                    file: doc.file,
                    lineStart: i + 1,
                    excerpt: line.trim().slice(0, 200),
                };

                const actions: TaskAction[] = [
                    {
                        tool: "create_damage_skill",
                        arguments: {
                            name: skillName,
                            damageFormula: "a.mat * 3 - b.mdf",
                            mpCost: 8,
                            scope: 1,
                            elementId: 0,
                            description: `Generated from ${doc.file}`,
                        },
                    },
                ];

                const id = `TASK-GEN-${String(taskIndex).padStart(3, "0")}`;
                const dependencies = taskIndex > 1 ? [`TASK-GEN-${String(taskIndex - 1).padStart(3, "0")}`] : [];

                tasks.push({
                    id,
                    title: `Create skill: ${skillName}`,
                    description: `Implements skill referenced in documentation (${doc.file})`,
                    status: "pending",
                    dependencies,
                    priority: 50,
                    sources: [doc.file],
                    actions,
                    file: doc.file,
                    sourceRefs: [sourceRef],
                    confidence: 0.9,
                    assumptions: [],
                });

                taskIndex += 1;
                if (tasks.length >= opts.maxTasks) {
                    return tasks;
                }
            }
        }

        if (!opts.strict) {
            for (const doc of docs) {
                if (tasks.length >= opts.maxTasks) break;
                tasks.push({
                    id: `TASK-GEN-${String(taskIndex).padStart(3, "0")}`,
                    title: `Review narrative alignment: ${path.basename(doc.file)}`,
                    description: "Manual review task generated because no deterministic action was found",
                    status: "pending",
                    dependencies: taskIndex > 1 ? [`TASK-GEN-${String(taskIndex - 1).padStart(3, "0")}`] : [],
                    priority: 90,
                    sources: [doc.file],
                    actions: [],
                    file: doc.file,
                    sourceRefs: [{ file: doc.file, lineStart: 1, excerpt: "No deterministic actionable pattern found" }],
                    confidence: 0.35,
                    assumptions: ["Manual action mapping required"],
                });
                taskIndex += 1;
            }
        }

        return tasks;
    }

    private collectUnmappedNarrative(docs: Array<{ file: string; content: string }>, tasks: GeneratedTask[]): string[] {
        if (tasks.length > 0) return [];
        return docs.map((doc) => `No actionable extraction from ${doc.file}`);
    }

    private async collectDocFiles(docsRoot: string): Promise<Array<{ file: string; content: string }>> {
        const files: string[] = [];

        const walk = async (dir: string) => {
            let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
            try {
                entries = (await fs.readdir(dir, { withFileTypes: true })) as Array<{
                    name: string;
                    isDirectory(): boolean;
                    isFile(): boolean;
                }>;
            } catch {
                return;
            }

            entries.sort((a, b) => a.name.localeCompare(b.name));
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await walk(full);
                } else if (entry.isFile() && this.isDocFile(entry.name)) {
                    files.push(full);
                }
            }
        };

        await walk(docsRoot);

        const docs: Array<{ file: string; content: string }> = [];
        for (const abs of files) {
            try {
                const content = await fs.readFile(abs, "utf-8");
                docs.push({
                    file: this.toWorkspaceRelative(abs),
                    content,
                });
            } catch {
                continue;
            }
        }
        return docs;
    }

    private matchesChapter(content: string, chapter: string): boolean {
        const normalizedChapter = chapter.toLowerCase();
        const lower = content.toLowerCase();
        if (lower.includes(normalizedChapter)) return true;

        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            if (CHAPTER_HEADING_REGEX.test(line) && line.toLowerCase().includes(normalizedChapter)) {
                return true;
            }
        }
        return false;
    }

    private async saveDraft(plan: GeneratedPlan): Promise<void> {
        const generatedDir = path.join(this.workspacePaths.planningPath, ".generated");
        await fs.mkdir(generatedDir, { recursive: true });
        const filePath = path.join(generatedDir, `${plan.planId}.json`);
        await fs.writeFile(filePath, JSON.stringify(plan, null, 2), "utf-8");
    }

    private async loadDraft(planId: string): Promise<GeneratedPlan> {
        const filePath = path.join(this.workspacePaths.planningPath, ".generated", `${planId}.json`);
        const content = await fs.readFile(filePath, "utf-8");
        return JSON.parse(content) as GeneratedPlan;
    }

    private async ensureStateEntries(taskIds: string[]): Promise<void> {
        const statePath = this.workspacePaths.statePath;
        let content = "";
        try {
            content = await fs.readFile(statePath, "utf-8");
        } catch {
            content = "# estado_proyecto\n\n";
        }

        const linesToAppend: string[] = [];
        for (const id of taskIds) {
            const regex = new RegExp(`\\b${id}\\b`);
            if (!regex.test(content)) {
                linesToAppend.push(`- [ ] ${id} pending`);
            }
        }

        if (linesToAppend.length > 0) {
            const prefix = content.endsWith("\n") ? content : `${content}\n`;
            const out = `${prefix}${linesToAppend.join("\n")}\n`;
            await fs.mkdir(path.dirname(statePath), { recursive: true });
            await fs.writeFile(statePath, out, "utf-8");
        }
    }

    private resolveDocsRoot(input?: string): string {
        if (!input || !input.trim()) {
            return this.workspacePaths.docsPath;
        }
        return this.resolveWorkspaceRelative(input);
    }

    private resolveWorkspaceRelative(p: string): string {
        if (path.isAbsolute(p)) return p;
        return path.resolve(this.workspacePaths.workspaceRoot, p);
    }

    private toWorkspaceRelative(absPath: string): string {
        return path.relative(this.workspacePaths.workspaceRoot, absPath).replaceAll(path.sep, "/");
    }

    private buildPlanId(seed: string): string {
        const compact = seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "plan";
        const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
        return `plan-${compact}-${stamp}`;
    }

    private cleanName(raw: string): string {
        return raw
            .replace(/["”'`]/g, "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 60);
    }

    private findImmediatePreviousTask(tasks: GeneratedTask[], taskId: string): GeneratedTask | null {
        const idx = tasks.findIndex((t) => t.id === taskId);
        if (idx <= 0) return null;
        return tasks[idx - 1] ?? null;
    }

    private isDocFile(name: string): boolean {
        const lower = name.toLowerCase();
        return lower.endsWith(".md") || lower.endsWith(".txt");
    }
}
