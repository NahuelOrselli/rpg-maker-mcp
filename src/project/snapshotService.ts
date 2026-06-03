import * as fs from "node:fs/promises";
import * as path from "node:path";
import { FileHandler } from "../utils/fileHandler.js";
import type { EntityType } from "./types.js";

const ENTITY_FILES: Record<EntityType, string> = {
    actor: "Actors.json",
    class: "Classes.json",
    item: "Items.json",
    skill: "Skills.json",
    weapon: "Weapons.json",
    armor: "Armors.json",
    enemy: "Enemies.json",
    state: "States.json",
    map: "MapInfos.json",
};

export interface ProjectSnapshot {
    paths: {
        docsExists: boolean;
        dataExists: boolean;
        jsExists: boolean;
    };
    docs: {
        markdownFiles: number;
    };
    entities: Record<EntityType, { count: number; ids: number[] }>;
}

export class ProjectSnapshotService {
    constructor(private fileHandler: FileHandler) { }

    async createSnapshot(): Promise<ProjectSnapshot> {
        const projectPath = this.fileHandler.getProjectPath();
        const docsRoot = path.join(projectPath, "docs");

        const paths = {
            docsExists: await this.existsAbsolute(docsRoot),
            dataExists: await this.fileHandler.exists("data"),
            jsExists: await this.fileHandler.exists("js"),
        };

        const markdownFiles = paths.docsExists ? await this.countMarkdownFiles(docsRoot) : 0;

        const entities = {} as Record<EntityType, { count: number; ids: number[] }>;
        for (const [type, file] of Object.entries(ENTITY_FILES) as Array<[EntityType, string]>) {
            entities[type] = await this.loadEntityIds(file, type === "map");
        }

        return {
            paths,
            docs: { markdownFiles },
            entities,
        };
    }

    private async loadEntityIds(filename: string, mapInfos: boolean): Promise<{ count: number; ids: number[] }> {
        try {
            const data = await this.fileHandler.readJson<Array<{ id?: number; name?: string } | null>>(`data/${filename}`);
            const ids = data
                .filter((row): row is { id?: number; name?: string } => row !== null)
                .map((row, index) => (typeof row.id === "number" ? row.id : index))
                .filter((id) => Number.isInteger(id) && id > 0)
                .filter((id, index, arr) => arr.indexOf(id) === index)
                .sort((a, b) => a - b);

            if (mapInfos) {
                return { count: ids.length, ids };
            }

            return { count: ids.length, ids };
        } catch {
            return { count: 0, ids: [] };
        }
    }

    private async countMarkdownFiles(rootDir: string): Promise<number> {
        let count = 0;

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
                    count += 1;
                }
            }
        };

        await walk(rootDir);
        return count;
    }

    private async existsAbsolute(targetPath: string): Promise<boolean> {
        try {
            await fs.access(targetPath);
            return true;
        } catch {
            return false;
        }
    }
}

export function getEntityFiles(): Record<EntityType, string> {
    return ENTITY_FILES;
}
