/**
 * RPG Maker MZ MCP Server
 * Main entry point for the Model Context Protocol server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FileHandler, validateProjectPath } from "./utils/fileHandler.js";
import { SafeWriter } from "./utils/safeWriter.js";
import { registerDatabaseTools } from "./tools/databaseTools.js";
import { registerItemTools } from "./tools/itemTools.js";
import { registerPluginTools } from "./tools/pluginTools.js";
import { registerMapTools } from "./tools/mapTools.js";
import { registerResourceTools } from "./tools/resourceTools.js";
import { registerSkillTools } from "./tools/skillTools.js";
import { registerLimitTools } from "./tools/limitTools.js";
import { registerWeaponTools } from "./tools/weaponTools.js";
import { registerStateTools } from "./tools/stateTools.js";
import { registerEnemyTools } from "./tools/enemyTools.js";
import { registerArmorTools } from "./tools/armorTools.js";
import { registerActorTools } from "./tools/actorTools.js";
import { registerClassTools } from "./tools/classTools.js";
import { registerSystemTools } from "./tools/systemTools.js";

// Get configuration from environment variables
const projectPath = process.env.RPGMAKER_PROJECT_PATH;
const enginePath = process.env.RPGMAKER_ENGINE_PATH;

if (!projectPath) {
    console.error("Error: RPGMAKER_PROJECT_PATH environment variable is required");
    process.exit(1);
}

const projectPathIsValid = await validateProjectPath(projectPath);
if (!projectPathIsValid) {
    console.error("Error: Invalid RPG Maker MZ project path");
    console.error("Expected files: game.rmmzproject and data/System.json");
    process.exit(1);
}

// Initialize utilities
const fileHandler = new FileHandler(projectPath, enginePath);
const safeWriter = new SafeWriter(fileHandler);

// Initialize MCP server
const server = new McpServer({
    name: "jrpg-mcp",
    version: "0.1.0",
});

// Register all tools
registerDatabaseTools(server, fileHandler);
registerItemTools(server, fileHandler, safeWriter);
registerPluginTools(server, fileHandler, safeWriter);
registerMapTools(server, fileHandler, safeWriter);
registerResourceTools(server, fileHandler);
registerSkillTools(server, fileHandler, safeWriter);
registerLimitTools(server, fileHandler, safeWriter);
registerWeaponTools(server, fileHandler, safeWriter);
registerStateTools(server, fileHandler, safeWriter);
registerEnemyTools(server, fileHandler, safeWriter);
registerArmorTools(server, fileHandler, safeWriter);
registerActorTools(server, fileHandler, safeWriter);
registerClassTools(server, fileHandler, safeWriter);
registerSystemTools(server, fileHandler, safeWriter);

// Start server with stdio transport
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Log to stderr so it doesn't interfere with MCP protocol on stdout
    console.error("JRPG MCP Server started");
    console.error(`Project: ${projectPath}`);
    if (enginePath) {
        console.error(`Engine: ${enginePath}`);
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
