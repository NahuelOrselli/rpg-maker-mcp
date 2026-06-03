/**
 * File Handler - Safe file operations for RPG Maker MZ projects
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export class FileHandler {
    constructor(
        private projectPath: string,
        private enginePath?: string
    ) { }

    /**
     * Read and parse a JSON file
     */
    async readJson<T>(filePath: string): Promise<T> {
        const fullPath = this.resolvePath(filePath);
        const content = await fs.readFile(fullPath, "utf-8");
        return JSON.parse(content) as T;
    }

    /**
     * Write JSON to file with pretty formatting
     */
    async writeJson(filePath: string, data: unknown): Promise<void> {
        const fullPath = this.resolvePath(filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, JSON.stringify(data, null, 2), "utf-8");
    }

    /**
     * Write text content to file
     */
    async writeText(filePath: string, content: string): Promise<void> {
        const fullPath = this.resolvePath(filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, "utf-8");
    }

    /**
     * Check if file exists
     */
    async exists(filePath: string): Promise<boolean> {
        try {
            const fullPath = this.resolvePath(filePath);
            await fs.access(fullPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Create backup of a file
     */
    async backup(filePath: string): Promise<string> {
        const fullPath = this.resolvePath(filePath);
        const backupPath = `${fullPath}.bak`;
        await fs.copyFile(fullPath, backupPath);
        return backupPath;
    }

    /**
     * List files in directory with optional extension filter
     */
    async listFiles(dirPath: string, extension?: string): Promise<string[]> {
        const fullPath = this.resolvePath(dirPath);
        try {
            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            let files = entries
                .filter((e) => e.isFile())
                .map((e) => e.name);

            if (extension) {
                files = files.filter((f) => f.endsWith(extension));
            }

            return files;
        } catch {
            return [];
        }
    }

    /**
     * List directories in path
     */
    async listDirs(dirPath: string): Promise<string[]> {
        const fullPath = this.resolvePath(dirPath);
        try {
            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            return entries
                .filter((e) => e.isDirectory())
                .map((e) => e.name);
        } catch {
            return [];
        }
    }

    /**
     * Resolve path relative to project or engine
     */
    private resolvePath(filePath: string): string {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        return path.join(this.projectPath, filePath);
    }

    /**
     * Get engine path for resource scanning
     */
    getEnginePath(): string | undefined {
        return this.enginePath;
    }

    /**
     * Get project path
     */
    getProjectPath(): string {
        return this.projectPath;
    }

    /**
     * Resolve engine-relative path
     */
    resolveEnginePath(relativePath: string): string | null {
        if (!this.enginePath) return null;
        return path.join(this.enginePath, relativePath);
    }
}

export async function validateProjectPath(projectPath: string): Promise<boolean> {
    try {
        const projectFile = path.join(projectPath, "game.rmmzproject");
        const systemFile = path.join(projectPath, "data", "System.json");
        await fs.access(projectFile);
        await fs.access(systemFile);
        return true;
    } catch {
        return false;
    }
}
