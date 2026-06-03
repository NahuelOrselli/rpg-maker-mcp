# 🎮 jrpg-mcp

Servidor **MCP (Model Context Protocol)** para manipular proyectos de **RPG Maker MZ** de forma segura, automatizable y lista para agentes AI.

## ✨ Qué hace

- 📦 Gestiona base de datos del juego: actores, clases, items, skills, armas, armaduras, enemigos y estados.
- 🗺️ Gestiona mapas y eventos: lectura, creación/edición de eventos y comandos de evento.
- ⚙️ Gestiona `System.json`: variables, switches, título del juego y posición inicial.
- 🧩 Gestiona plugins y escaneo de recursos del proyecto/engine.
- 🛡️ Aplica escritura segura con backup + refresh de `versionId` para evitar corrupción y problemas de sincronización.

## 🔒 Seguridad y confiabilidad

- `SafeWriter` obligatorio para mutaciones en base de datos/mapas/system.
- Backup `.bak` automático cuando aplica.
- Validación de inputs en cada tool.
- Preflight al iniciar: verifica que `RPGMAKER_PROJECT_PATH` apunte a un proyecto MZ válido (`game.rmmzproject` y `data/System.json`).

## 🧰 Herramientas disponibles

### Database Core
- `get_database_info`

### Actors
- `get_actors`, `get_actor`, `search_actors`, `create_actor`, `update_actor`

### Classes
- `get_classes`, `create_class`, `update_class`

### Items / Equipment
- `get_items`, `create_item`, `update_item`
- `get_weapons`, `create_weapon`, `update_weapon`
- `get_armors`, `create_armor`, `update_armor`

### Skills
- `get_skills`, `get_skill`, `search_skills`, `create_skill`
- `create_damage_skill`, `create_healing_skill`, `create_buff_skill`, `create_debuff_skill`, `create_state_skill`

### Enemies / States
- `get_enemies`, `create_enemy`, `update_enemy`
- `get_states`, `create_state`, `update_state`

### Maps / Events
- `get_maps`, `get_map`, `update_map`, `create_map`
- `get_map_events`, `get_map_event`, `search_map_events`
- `create_map_event`, `update_map_event`, `add_event_command`

### System
- `get_system`, `get_variables`, `set_variable_name`
- `get_switches`, `set_switch_name`
- `get_game_title`, `update_game_title`, `update_starting_position`

### Plugins / Resources / Limits
- `get_installed_plugins`, `install_plugin`
- `scan_resources`, `scan_dlc_packages`, `get_generator_parts`, `get_sample_maps`, `get_core_script_versions`
- `get_database_limits`, `set_database_limit`

## 🚀 Instalación

```bash
npm install
npm run build
```

## ⚙️ Configuración

Variables de entorno:

- `RPGMAKER_PROJECT_PATH` (obligatoria)
- `RPGMAKER_ENGINE_PATH` (opcional, para tools de recursos del engine)

Ejemplo de config MCP (Claude/VS Code):

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

## 📌 Recomendaciones

- Cierra el editor de RPG Maker MZ mientras haces cambios vía MCP.
- Haz backup del proyecto antes de operaciones grandes.
- Después de cambios automáticos, abre el proyecto y valida en editor/test play.

## 🧪 Estado de release

Versión actual: **`0.1.0-rc1`** ✅
