import * as fs from "node:fs/promises";
import * as path from "node:path";
import { FileHandler } from "../utils/fileHandler.js";

export type KnowledgeKind = "character" | "location" | "chapter" | "quest";

export interface DocSection {
    file: string;
    heading: string;
    level: number;
    lineStart: number;
    content: string;
}

const KIND_KEYWORDS: Record<KnowledgeKind, string[]> = {
    character: ["character", "personaje", "npc", "hero", "villain"],
    location: ["location", "locacion", "lugar", "ciudad", "dungeon", "map"],
    chapter: ["chapter", "capitulo", "act", "arc"],
    quest: ["quest", "mision", "objetivo", "side quest"],
};

export class DocumentationIndex {
    private cache: DocSection[] | null = null;

    constructor(private fileHandler: FileHandler) { }

    async search(query: string, limit = 20): Promise<DocSection[]> {
        const sections = await this.getSections();
        const q = query.trim().toLowerCase();
        if (!q) return [];

        return sections
            .filter((section) => this.includesText(section, q))
            .slice(0, Math.max(1, limit));
    }

    async byKind(kind: KnowledgeKind, name?: string, limit = 20): Promise<DocSection[]> {
        const sections = await this.getSections();
        const keywords = KIND_KEYWORDS[kind];
        const normalizedName = name?.trim().toLowerCase();

        const matches = sections.filter((section) => {
            const heading = section.heading.toLowerCase();
            const isKind = keywords.some((k) => heading.includes(k));
            if (!isKind) return false;
            if (!normalizedName) return true;
            return heading.includes(normalizedName) || section.content.toLowerCase().includes(normalizedName);
        });

        return matches.slice(0, Math.max(1, limit));
    }

    private includesText(section: DocSection, query: string): boolean {
        return section.heading.toLowerCase().includes(query) || section.content.toLowerCase().includes(query);
    }

    private async getSections(): Promise<DocSection[]> {
        if (this.cache) return this.cache;

        const docsRoot = path.join(this.fileHandler.getProjectPath(), "docs");
        const markdownFiles = await this.collectMarkdownFiles(docsRoot);

        const allSections: DocSection[] = [];
        for (const filePath of markdownFiles) {
            const relative = path.relative(this.fileHandler.getProjectPath(), filePath).replaceAll(path.sep, "/");
            const content = await fs.readFile(filePath, "utf-8");
            const sections = this.parseSections(relative, content);
            allSections.push(...sections);
        }

        allSections.sort((a, b) => {
            if (a.file !== b.file) return a.file.localeCompare(b.file);
            return a.lineStart - b.lineStart;
        });

        this.cache = allSections;
        return allSections;
    }

    private parseSections(file: string, content: string): DocSection[] {
        const lines = content.split(/\r?\n/);
        const headingRegex = /^(#{1,6})\s+(.+)$/;

        const sections: DocSection[] = [];
        let currentHeading = path.basename(file, path.extname(file));
        let currentLevel = 1;
        let currentLineStart = 1;
        let buffer: string[] = [];

        const flush = () => {
            const body = buffer.join("\n").trim();
            if (!body && sections.length > 0) return;
            sections.push({
                file,
                heading: currentHeading,
                level: currentLevel,
                lineStart: currentLineStart,
                content: body,
            });
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(headingRegex);

            if (match) {
                flush();
                currentHeading = match[2].trim();
                currentLevel = match[1].length;
                currentLineStart = i + 1;
                buffer = [];
            } else {
                buffer.push(line);
            }
        }

        flush();
        return sections;
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
}
