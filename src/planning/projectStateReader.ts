import * as fs from "node:fs/promises";
import { FileHandler } from "../utils/fileHandler.js";
import { WorkspacePaths } from "../workspace/paths.js";

const COMPLETED_LINE_REGEX = /\b([A-Za-z][A-Za-z0-9_-]*-\d+)\b.*\b(done|completed|hecho)\b/i;
const CHECKBOX_DONE_REGEX = /\[[xX]\]\s*([A-Za-z][A-Za-z0-9_-]*-\d+)/;

export class ProjectStateReader {
    constructor(private _fileHandler: FileHandler, private workspacePaths: WorkspacePaths) { }

    async loadDoneTaskIds(): Promise<Set<string>> {
        const done = new Set<string>();
        const statePath = this.workspacePaths.statePath;

        let content: string;
        try {
            content = await fs.readFile(statePath, "utf-8");
        } catch {
            return done;
        }

        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            const checkboxMatch = line.match(CHECKBOX_DONE_REGEX);
            if (checkboxMatch) {
                done.add(checkboxMatch[1]);
                continue;
            }

            const completedMatch = line.match(COMPLETED_LINE_REGEX);
            if (completedMatch) {
                done.add(completedMatch[1]);
            }
        }

        return done;
    }
}
