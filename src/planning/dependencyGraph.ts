import type { TaskDefinition } from "./types.js";

export interface DependencyResolution {
    taskId: string;
    direct: string[];
    transitive: string[];
    missing: string[];
    hasCycle: boolean;
}

export class DependencyGraph {
    private map: Map<string, TaskDefinition>;

    constructor(tasks: TaskDefinition[]) {
        this.map = new Map(tasks.map((task) => [task.id, task]));
    }

    resolve(taskId: string): DependencyResolution {
        const task = this.map.get(taskId);
        if (!task) {
            return {
                taskId,
                direct: [],
                transitive: [],
                missing: [],
                hasCycle: false,
            };
        }

        const direct = [...task.dependencies];
        const transitiveSet = new Set<string>();
        const missingSet = new Set<string>();
        const visiting = new Set<string>();
        const visited = new Set<string>();
        let hasCycle = false;

        const dfs = (currentId: string) => {
            if (visiting.has(currentId)) {
                hasCycle = true;
                return;
            }
            if (visited.has(currentId)) return;

            visiting.add(currentId);
            visited.add(currentId);

            const current = this.map.get(currentId);
            if (!current) {
                missingSet.add(currentId);
                visiting.delete(currentId);
                return;
            }

            for (const dep of current.dependencies) {
                transitiveSet.add(dep);
                if (!this.map.has(dep)) {
                    missingSet.add(dep);
                    continue;
                }
                dfs(dep);
            }

            visiting.delete(currentId);
        };

        for (const dep of direct) {
            transitiveSet.add(dep);
            dfs(dep);
        }

        return {
            taskId,
            direct: direct.sort((a, b) => a.localeCompare(b)),
            transitive: Array.from(transitiveSet).sort((a, b) => a.localeCompare(b)),
            missing: Array.from(missingSet).sort((a, b) => a.localeCompare(b)),
            hasCycle,
        };
    }
}
