import * as path from "node:path";

export interface WorkspacePaths {
    workspaceRoot: string;
    docsPath: string;
    planningPath: string;
    tasksPath: string;
    statePath: string;
    logsPath: string;
}

function resolvePath(input: string): string {
    return path.resolve(input);
}

export function resolveWorkspacePathsFromEnv(): WorkspacePaths {
    const workspaceRootEnv = process.env.JRPG_WORKSPACE_PATH;

    if (!workspaceRootEnv) {
        throw new Error("JRPG_WORKSPACE_PATH environment variable is required");
    }

    const workspaceRoot = resolvePath(workspaceRootEnv);

    const docsPath = resolvePath(process.env.JRPG_DOCS_PATH ?? path.join(workspaceRoot, "docs"));
    const planningPath = resolvePath(process.env.JRPG_PLANNING_PATH ?? path.join(workspaceRoot, "planning"));
    const tasksPath = resolvePath(process.env.JRPG_TASKS_PATH ?? path.join(workspaceRoot, "tasks"));
    const statePath = resolvePath(process.env.JRPG_STATE_PATH ?? path.join(workspaceRoot, "estado_proyecto.md"));
    const logsPath = resolvePath(process.env.JRPG_LOGS_PATH ?? path.join(workspaceRoot, "logs"));

    return {
        workspaceRoot,
        docsPath,
        planningPath,
        tasksPath,
        statePath,
        logsPath,
    };
}
