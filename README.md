# 🎮 JRPG-MCP

Servidor **MCP (Model Context Protocol)** para construir y operar proyectos **JRPG en RPG Maker MZ** con enfoque de plataforma: herramientas RPG + conocimiento documental + planificación + ejecución de tareas.

## 🌟 ¿Qué incluye?

- 🛠️ **Capa RPG Maker sólida**: CRUD de database, mapas, eventos, system, plugins y recursos.
- 📚 **Knowledge Layer**: consulta determinista de `docs/` (`knowledge.*`).
- 📊 **Project Layer**: estado, validación, diff y auditoría de consistencia (`project.*`).
- 🧭 **Planning Layer**: carga de tareas, dependencias, siguiente tarea (`planner.*`).
- ⚙️ **Task Layer**: preview/execute/history con auditoría (`task.*`).

## 🧱 Arquitectura por capas

Estructura principal en `src/`:

- `src/tools/` → herramientas RPG Maker existentes (compatibles)
- `src/knowledge/` → lectura de documentación
- `src/project/` → estado y validación proyecto/docs
- `src/planning/` → planificación y dependencias
- `src/tasks/` → orquestación de ejecución y logs
- `src/utils/` → `FileHandler`, `SafeWriter`, tipos comunes

## 🔐 Seguridad y compatibilidad

- ✅ `SafeWriter` para mutaciones críticas.
- ✅ Backup `.bak` automático cuando aplica.
- ✅ Refresh de `System.json.versionId`.
- ✅ Validación de input con `zod`.
- ✅ Preflight de proyecto (`game.rmmzproject` + `data/System.json`).
- ✅ No se eliminan ni rompen tools RPG existentes.

## 🧰 Herramientas destacadas

### RPG Layer (extracto)
- `get_database_info`
- `get_actors`, `create_actor`, `update_actor`
- `get_items`, `create_item`, `update_item`
- `get_maps`, `get_map`, `create_map`, `update_map`
- `create_map_event`, `update_map_event`, `add_event_command`
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

### Task Layer
- `task.preview`
- `task.execute`
- `task.history`

## 📁 Plantillas oficiales (recomendado)

Usa estas plantillas para arrancar rápido:

- `tasks/templates/task.template.json`
- `planning/templates/roadmap.template.json`
- `estado_proyecto.template.md`

Flujo recomendado:

1. Crear tareas JSON desde plantilla.
2. Registrar estado inicial en `estado_proyecto.md`.
3. Ejecutar `planner.validate_task` y `task.preview`.
4. Ejecutar `task.execute`.
5. Revisar `logs/` con `task.history`.

## 🚀 Instalación

```bash
npm install
npm run build
```

## ⚙️ Configuración

Variables de entorno:

- `RPGMAKER_PROJECT_PATH` (obligatoria)
- `RPGMAKER_ENGINE_PATH` (opcional)

Ejemplo de configuración MCP:

```json
{
  "mcpServers": {
    "jrpg-mcp": {
      "command": "node",
      "args": ["/ruta/a/jrpg-mcp/dist/index.js"],
      "env": {
        "RPGMAKER_PROJECT_PATH": "/ruta/a/tu/proyecto-rmmz",
        "RPGMAKER_ENGINE_PATH": "/ruta/a/RPG Maker MZ"
      }
    }
  }
}
```

## ▶️ Uso

```bash
npm start
```

## ✅ Estado de release

Versión actual: **`0.2.0-rc1`**

Documento de arquitectura activo:

- `docs/phase2-architecture.md`
