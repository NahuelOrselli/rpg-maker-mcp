import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { EntityType, ProjectIssue } from "./types.js";
import { FileHandler } from "../utils/fileHandler.js";
import { ProjectSnapshotService, getEntityFiles } from "./snapshotService.js";

const REFERENCE_REGEX = /\b(actor|class|item|skill|weapon|armor|enemy|state|map):\s*(\d+)\b/gi;
const MARKDOWN_LINK_REGEX = /\[[^\]]+\]\(([^)]+)\)/g;

interface DocReference {
    type: EntityType;
    id: number;
    source: string;
}

export class ConsistencyValidator {
    private snapshotService: ProjectSnapshotService;

    constructor(private fileHandler: FileHandler) {
        this.snapshotService = new ProjectSnapshotService(fileHandler);
    }

    async validate(): Promise<ProjectIssue[]> {
        const snapshot = await this.snapshotService.createSnapshot();
        const issues: ProjectIssue[] = [];

        if (!snapshot.paths.docsExists) {
            issues.push({
                kind: "structure",
                severity: "warn",
                message: "docs/ directory not found",
                source: "docs",
            });
            return issues;
        }

        if (!snapshot.paths.dataExists) {
            issues.push({
                kind: "structure",
                severity: "error",
                message: "data/ directory not found",
                source: "data",
            });
            return issues;
        }

        const { references, linkIssues } = await this.extractReferencesAndLinks();
        issues.push(...linkIssues);

        const entityIds = snapshot.entities;
        for (const ref of references) {
            const exists = entityIds[ref.type].ids.includes(ref.id);
            if (!exists) {
                issues.push({
                    kind: "reference",
                    severity: "error",
                    message: `Reference ${ref.type}:${ref.id} not found in data/${getEntityFiles()[ref.type]}`,
                    source: ref.source,
                });
            }
        }

        return issues;
    }

    async diff(limit = 50): Promise<Record<EntityType, {
        referencedInDocs: number[];
        existingInData: number[];
        missingInData: number[];
        unreferencedInDocs: number[];
    }>> {
        const snapshot = await this.snapshotService.createSnapshot();
        const { references } = await this.extractReferencesAndLinks();

        const docsByType = new Map<EntityType, Set<number>>();
        for (const type of Object.keys(getEntityFiles()) as EntityType[]) {
            docsByType.set(type, new Set<number>());
        }

        for (const ref of references) {
            docsByType.get(ref.type)?.add(ref.id);
        }

        const out = {} as Record<EntityType, {
            referencedInDocs: number[];
            existingInData: number[];
            missingInData: number[];
            unreferencedInDocs: number[];
        }>;

        for (const type of Object.keys(getEntityFiles()) as EntityType[]) {
            const referenced = Array.from(docsByType.get(type) ?? []).sort((a, b) => a - b);
            const existing = [...snapshot.entities[type].ids].sort((a, b) => a - b);

            const existingSet = new Set(existing);
            const referencedSet = new Set(referenced);

            const missingInData = referenced.filter((id) => !existingSet.has(id)).slice(0, Math.max(1, limit));
            const unreferencedInDocs = existing.filter((id) => !referencedSet.has(id)).slice(0, Math.max(1, limit));

            out[type] = {
                referencedInDocs: referenced.slice(0, Math.max(1, limit)),
                existingInData: existing.slice(0, Math.max(1, limit)),
                missingInData,
                unreferencedInDocs,
            };
        }

        return out;
    }

    private async extractReferencesAndLinks(): Promise<{ references: DocReference[]; linkIssues: ProjectIssue[] }> {
        const projectPath = this.fileHandler.getProjectPath();
        const docsRoot = path.join(projectPath, "docs");
        const markdownFiles = await this.collectMarkdownFiles(docsRoot);

        const references: DocReference[] = [];
        const linkIssues: ProjectIssue[] = [];

        for (const fullPath of markdownFiles) {
            const relativeFile = path.relative(projectPath, fullPath).replaceAll(path.sep, "/");
            const content = await fs.readFile(fullPath, "utf-8");

            let refMatch: RegExpExecArray | null;
            REFERENCE_REGEX.lastIndex = 0;
            while ((refMatch = REFERENCE_REGEX.exec(content)) !== null) {
                references.push({
                    type: refMatch[1].toLowerCase() as EntityType,
                    id: Number(refMatch[2]),
                    source: relativeFile,
                });
            }

            let linkMatch: RegExpExecArray | null;
            MARKDOWN_LINK_REGEX.lastIndex = 0;
            while ((linkMatch = MARKDOWN_LINK_REGEX.exec(content)) !== null) {
                const target = linkMatch[1].trim();
                if (!this.isLocalRelativeLink(target)) continue;

                const resolved = path.resolve(path.dirname(fullPath), target.split("#")[0]);
                const exists = await this.existsAbsolute(resolved);
                if (!exists) {
                    linkIssues.push({
                        kind: "link",
                        severity: "warn",
                        message: `Broken relative link: ${target}`,
                        source: relativeFile,
                    });
                }
            }
        }

        references.sort((a, b) => {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            if (a.id !== b.id) return a.id - b.id;
            return a.source.localeCompare(b.source);
        });

        return { references, linkIssues };
    }

    private isLocalRelativeLink(link: string): boolean {
        if (!link) return false;
        if (link.startsWith("http://") || link.startsWith("https://")) return false;
        if (link.startsWith("mailto:")) return false;
        if (link.startsWith("#")) return false;
        return !path.isAbsolute(link);
    }

    private async collectMarkdownFiles(rootDir: string): Promise<string[]> {
        const results: string[] = [];

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
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath);
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
                    results.push(fullPath);
                }
            }
        };

        await walk(rootDir);
        return results;
    }

    private async existsAbsolute(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
