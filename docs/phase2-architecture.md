# JRPG-MCP Phase 2 Architecture

Estado: Diseno
Alcance: FASE A (sin cambios de codigo funcional)

## 1) Arquitectura actual

### 1.1 Entrada y bootstrap

- `src/index.ts` inicializa `McpServer`.
- Lee `RPGMAKER_PROJECT_PATH` y `RPGMAKER_ENGINE_PATH`.
- Ejecuta preflight con `validateProjectPath`.
- Crea `FileHandler` y `SafeWriter` compartidos.
- Registra tools por modulo (`registerXTools(...)`).

### 1.2 Capas actuales (runtime)

- `src/utils/fileHandler.ts`
  - I/O base JSON/texto.
  - listing de archivos/carpetas.
  - resolucion de paths proyecto/engine.
- `src/utils/safeWriter.ts`
  - escritura segura con backup `.bak`.
  - refresh de `System.json.versionId`.
  - soporte para mapas y plugins.
- `src/tools/*`
  - modulo por dominio RPG Maker MZ.
  - validacion de input por `zod`.
  - respuesta MCP con `content` e `isError`.

### 1.3 Inventario funcional existente

- Database: actors, classes, items, skills, weapons, armors, enemies, states.
- Maps: create/read/update map + eventos + comandos.
- System: variables, switches, titulo, start position.
- Plugins y resources scan.
- Database limits y resumen general.

### 1.4 Estilo arquitectonico actual

- Registro modular de tools (separacion por dominio).
- Sin capa de servicios de orquestacion global.
- Fuertemente orientado a CRUD de RPG Maker.

## 2) Dependencias actuales

### 2.1 Runtime

- `@modelcontextprotocol/sdk` (servidor MCP y stdio transport).
- `zod` (validacion de input en frontera).

### 2.2 Toolchain

- `typescript`, `tsx`, `@types/node`.
- Node >= 18.

### 2.3 Dependencias implicitas

- Estructura de proyecto RPG Maker MZ en disco (`data/`, `js/`, etc.).
- Convencion de archivos JSON de MZ (Actors.json, System.json, MapXXX.json...).

## 3) Puntos de extension recomendados

Objetivo: agregar nuevas capacidades sin tocar ni romper tools RPG existentes.

### 3.1 Nueva estructura de carpetas objetivo

Agregar en `src/`:

- `src/knowledge/`
- `src/project/`
- `src/planning/`
- `src/tasks/`

### 3.2 Patron de extension

- Mantener tools RPG en `src/tools/*` sin cambios de comportamiento.
- Incorporar nuevos registradores de tools por capa:
  - `registerKnowledgeTools(...)`
  - `registerProjectTools(...)`
  - `registerPlannerTools(...)`
  - `registerTaskTools(...)`
- En `index.ts`, registrar estas capas despues de tools RPG.

### 3.3 Servicios transversales recomendados

- `DocumentationIndex` (lectura e indexado determinista de `docs/`).
- `ProjectSnapshotService` (estado actual: docs + data + js).
- `TaskResolver` (carga tarea, dependencias, validacion).
- `ExecutionOrchestrator` (preview/execute/history).
- `AuditLogger` (persistencia en `logs/`).

### 3.4 Principios para nuevas capas

- `knowledge.*`: solo lectura, determinista, sin generacion narrativa.
- `project.*`: validaciones y auditoria de consistencia docs vs proyecto.
- `planner.*`: resolucion de tarea y dependencias desde `planning/`, `tasks/`, `estado_proyecto.md`.
- `task.*`: orquestacion de ejecucion con previsualizacion y auditoria.

## 4) Riesgos

### 4.1 Riesgos tecnicos

- Acoplar lectura de docs a formatos no estables (markdown libre).
- Ambiguedad de referencias entre `docs/` y entities MZ (ids vs nombres).
- Sobrecarga de `index.ts` al registrar demasiadas tools sin modularizar inicializacion.
- Crecimiento de latencia si no hay indice reutilizable de documentacion.

### 4.2 Riesgos funcionales

- `task.execute` puede alterar datos sin trazabilidad si no centraliza logging.
- Posible duplicidad de validaciones entre `project.validate` y `planner.validate_task`.
- Deriva de alcance: intentar "disenar historia" en vez de ejecutar specs documentadas.

### 4.3 Riesgos de compatibilidad

- Cambios involuntarios en tools RPG existentes.
- Cambios de schema de salida de tools actuales.

### 4.4 Mitigaciones

- Regla de no-modificacion: tools RPG solo se consumen, no se reescriben.
- Test de regresion de registro de tools existentes.
- Definir contratos estrictos para nuevas tools antes de codificar.
- Auditoria obligatoria por cada `task.execute`.

## 5) Plan de implementacion por fases

## FASE A (actual): Diseno

- Analisis completo del repo.
- Definicion de arquitectura objetivo y riesgos.
- Documento `docs/phase2-architecture.md`.

## FASE B: Knowledge Layer

Tools a crear:

- `knowledge.search`
- `knowledge.character`
- `knowledge.location`
- `knowledge.chapter`
- `knowledge.quest`

Entregables:

- `src/knowledge/index.ts` (registro de tools).
- `src/knowledge/documentationIndex.ts`.
- `src/knowledge/parsers/*` (extractores deterministas).

Reglas:

- solo lectura de `docs/`.
- sin IA generativa.
- respuestas trazables a archivo y seccion origen.

## FASE C: Project Layer

Tools:

- `project.status`
- `project.validate`
- `project.diff`
- `project.audit`

Entregables:

- `src/project/index.ts`
- `src/project/snapshotService.ts`
- `src/project/consistencyValidator.ts`

Reglas:

- no modificar RPG Maker.
- deteccion de referencias rotas y faltantes.

## FASE D: Planning Layer

Tools:

- `planner.next_task`
- `planner.load_task`
- `planner.dependencies`
- `planner.validate_task`

Fuentes:

- `planning/`
- `tasks/`
- `estado_proyecto.md`

Entregables:

- `src/planning/index.ts`
- `src/planning/taskRepository.ts`
- `src/planning/dependencyGraph.ts`

## FASE E: Task Layer

Tools:

- `task.preview`
- `task.execute`
- `task.history`

Entregables:

- `src/tasks/index.ts`
- `src/tasks/executionOrchestrator.ts`
- `src/tasks/historyStore.ts`

Reglas para `task.preview`:

- listar tools a usar, archivos afectados, dependencias y riesgos.
- cero mutaciones.

Reglas para `task.execute`:

1. cargar tarea
2. resolver dependencias
3. consultar documentacion relacionada
4. ejecutar tools RPG necesarias
5. validar resultados
6. actualizar estado
7. registrar auditoria

## FASE F: Auditoria

- Crear `logs/` para trazabilidad por ejecucion.
- Registro minimo:
  - fecha
  - task
  - tools usadas
  - archivos modificados
  - resultado

## Criterios de aceptacion de arquitectura (Phase 2)

- Ninguna tool RPG existente cambia contrato.
- Nuevas capas agregadas de forma incremental y desacoplada.
- Toda accion de `task.execute` queda auditada.
- Toda consulta narrativa proviene de `docs/` (sin invencion).
