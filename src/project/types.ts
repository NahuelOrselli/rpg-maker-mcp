export type EntityType =
    | "actor"
    | "class"
    | "item"
    | "skill"
    | "weapon"
    | "armor"
    | "enemy"
    | "state"
    | "map";

export interface ProjectIssue {
    kind: "structure" | "reference" | "link";
    severity: "error" | "warn" | "info";
    message: string;
    source: string;
}
