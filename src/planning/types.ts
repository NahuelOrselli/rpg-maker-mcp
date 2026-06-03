export type PlannerTaskStatus = "pending" | "in_progress" | "blocked" | "done" | "unknown";

export interface TaskAction {
    tool: string;
    arguments: Record<string, unknown>;
}

export interface SourceRef {
    file: string;
    lineStart: number;
    excerpt: string;
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

export interface GeneratedTask extends TaskDefinition {
    sourceRefs: SourceRef[];
    confidence: number;
    assumptions: string[];
}

export interface GeneratedPlan {
    chapter: string;
    planId: string;
    tasks: GeneratedTask[];
    warnings: string[];
    unmappedNarrative: string[];
}

export interface PlannerIssue {
    severity: "error" | "warn";
    message: string;
    source: string;
}
