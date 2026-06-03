# JRPG-MCP Phase 2 Architecture

Status: Active
Scope: Platform layers on top of existing RPG Maker tools

## Current architecture

`jrpg-mcp` keeps the original RPG Maker MZ toolset intact and adds four non-breaking layers:

- `knowledge/*` for deterministic documentation queries
- `project/*` for status, consistency checks, and audits
- `planning/*` for task loading, dependency resolution, validation, and generation
- `tasks/*` for preview/execute/history orchestration with audit logs

Core runtime is still:

- `src/index.ts` -> MCP bootstrap + tool registration
- `src/utils/fileHandler.ts` -> filesystem access
- `src/utils/safeWriter.ts` -> safe writes, backups, `versionId` refresh

## Workspace separation (engine vs content)

The MCP repository is the engine. Narrative and planning content live in an external workspace.

Required env vars:

- `RPGMAKER_PROJECT_PATH` (RPG Maker project)
- `JRPG_WORKSPACE_PATH` (docs/planning/tasks/state/logs root)

Optional path overrides:

- `JRPG_DOCS_PATH`
- `JRPG_PLANNING_PATH`
- `JRPG_TASKS_PATH`
- `JRPG_STATE_PATH`
- `JRPG_LOGS_PATH`

No fallback to `RPGMAKER_PROJECT_PATH` is used for workspace content.

## Extension points

- Add new deterministic readers/parsers in `knowledge/*`
- Add project checks in `project/*`
- Add planners/generators in `planning/*`
- Add orchestrated operations in `tasks/*` without changing RPG tool contracts

## Risks

- Weakly structured docs can reduce extraction quality.
- Invalid task JSON can produce partial planner results.
- Overly generic generation rules may produce low-confidence tasks.

## Mitigations

- Keep all generation traceable (`sourceRefs`, file + line).
- Validate dependencies before execution.
- Block execution on unsupported tools or missing dependencies.
- Persist execution logs under workspace `logs/`.

## Implementation phases

- Phase A: architecture analysis and design
- Phase B: knowledge tools
- Phase C: project status/validation/diff/audit
- Phase D: planning and dependency tools
- Phase E: task preview/execute/history
- Phase F: execution audit logging
- Phase 2.5: task generator from docs (`planner.generate_*` + publish flow)
