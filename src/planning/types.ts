export type PlannerTaskStatus = "pending" | "in_progress" | "blocked" | "done" | "unknown";

export interface TaskAction {
    tool: string;
    arguments: Record<string, unknown>;
}

export interface TaskDefinition {
    id: string;
    title: string;
    description: string;
    status: PlannerTaskStatus;
    dependencies: string[];
    priority: number;
    sources: string[];
    actions: TaskAction[];
    file: string;
}

export interface PlannerIssue {
    severity: "error" | "warn";
    message: string;
    source: string;
}
