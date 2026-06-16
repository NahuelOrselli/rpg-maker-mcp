# 🎮 JRPG-MCP

JRPG-MCP is an **MCP (Model Context Protocol) server** for building and operating JRPG projects on top of **RPG Maker MZ**.

It combines:

- a stable RPG Maker tool layer (CRUD + safe writes)
- deterministic documentation querying
- project consistency checks
- planning/dependency tooling
- task orchestration with audit logging

## Important Architecture Rule

The MCP repository is the engine.

Your narrative and planning content must live in an **external workspace** (not inside this repo).

## ✨ What You Get

- 🛠️ **RPG Layer**: database/map/event/system/plugin/resource tools
- 📚 **Knowledge Layer**: deterministic search over docs (`.md` + `.txt`)
- 📊 **Project Layer**: status, validation, diff, audit
- 🧭 **Planning Layer**: load tasks, dependency graph, validation, next-task selection
- ⚙️ **Task Layer**: preview/execute/history with logs
- 🤖 **Task Generator**: generate draft backlogs from chapter docs

## 🧱 Source Layout

- `src/tools/` -> existing RPG Maker tools (kept compatible)
- `src/knowledge/` -> docs index + `knowledge.*`
- `src/project/` -> project analysis + `project.*`
- `src/planning/` -> planning + generator + `planner.*`
- `src/tasks/` -> task orchestration + `task.*`
- `src/workspace/` -> workspace path resolution
- `src/utils/` -> file access + safe writer + shared types

## 🔐 Safety and Compatibility

- `SafeWriter` for critical writes
- automatic `.bak` creation when applicable
- `System.json.versionId` refresh
- zod input validation for tools
- startup preflight for RPG Maker project path
- existing RPG tools preserved (no contract breakage)

## 🧰 Tool Highlights

### RPG Layer (subset)
- `get_database_info`
- `get_actors`, `create_actor`, `update_actor`
- `get_items`, `create_item`, `update_item`
- `get_maps`, `get_map`, `create_map`, `update_map`
- `create_map_event`, `update_map_event`, `add_event_command`
- `get_map_tile`, `set_map_tile`, `set_map_tile_rect`
- `set_map_region_rect`, `set_map_terrain_tag_rect`
- `replace_event_page_commands`, `patch_event_page_commands`, `move_event_page`
- `get_active_event_page`, `debug_event_page_conflicts`, `get_playtest_snapshot`
- `add_narrator_command`
- `create_damage_skill`, `create_healing_skill`, `create_buff_skill`, `create_debuff_skill`, `create_state_skill`

### Knowledge Layer
- `knowledge.search`
- `knowledge.character`
- `knowledge.location`
- `knowledge.chapter`
- `knowledge.quest`

### Project Layer
- `project.status`
- `project.validate`
- `project.diff`
- `project.audit`

### Planning Layer
- `planner.next_task`
- `planner.load_task`
- `planner.dependencies`
- `planner.validate_task`
- `planner.generate_for_chapter` ⭐
- `planner.generate_from_docs`
- `planner.refine_plan`
- `planner.publish_backlog`

### Task Layer
- `task.preview`
- `task.execute`
- `task.history`

## 🤖 New: Chapter-to-Backlog Generator

You can now generate a draft plan directly from chapter docs.

Typical flow:

1. Put chapter docs in your workspace `docs/` (`.md` or `.txt`)
2. Run `planner.generate_for_chapter`
3. Optionally run `planner.refine_plan`
4. Publish with `planner.publish_backlog`
5. Execute with `task.preview` / `task.execute`

The generator is deterministic and source-traceable. It does not invent story content.

## 📁 Official Templates

- `tasks/templates/task.template.json`
- `planning/templates/roadmap.template.json`
- `estado_proyecto.template.md`

## 🚀 Install

```bash
npm install
npm run build
```

## ⚙️ Configuration

### Required

- `RPGMAKER_PROJECT_PATH` -> your RPG Maker MZ project
- `JRPG_WORKSPACE_PATH` -> your narrative/planning workspace root

### Optional path overrides

- `JRPG_DOCS_PATH` (default: `${JRPG_WORKSPACE_PATH}/docs`)
- `JRPG_PLANNING_PATH` (default: `${JRPG_WORKSPACE_PATH}/planning`)
- `JRPG_TASKS_PATH` (default: `${JRPG_WORKSPACE_PATH}/tasks`)
- `JRPG_STATE_PATH` (default: `${JRPG_WORKSPACE_PATH}/estado_proyecto.md`)
- `JRPG_LOGS_PATH` (default: `${JRPG_WORKSPACE_PATH}/logs`)
- `RPGMAKER_ENGINE_PATH` (optional engine resources)

There is **no fallback** from workspace paths to `RPGMAKER_PROJECT_PATH`.

### Example MCP config

```json
{
  "mcpServers": {
    "jrpg-mcp": {
      "command": "node",
      "args": ["/path/to/jrpg-mcp/dist/index.js"],
      "env": {
        "RPGMAKER_PROJECT_PATH": "/path/to/game-rmmz",
        "JRPG_WORKSPACE_PATH": "/path/to/game-workspace",
        "RPGMAKER_ENGINE_PATH": "/path/to/RPG Maker MZ"
      }
    }
  }
}
```

## 🗂️ Recommended External Workspace

```text
my-jrpg-workspace/
  docs/
  planning/
  tasks/
  estado_proyecto.md
  logs/
```

## ▶️ Run

```bash
npm start
```

## 📘 Architecture Doc

- `docs/phase2-architecture.md`

## ✅ Release

Current version: **`0.2.0-rc1`**
