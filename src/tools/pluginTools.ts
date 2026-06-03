/**
 * Plugin Tools - install_plugin, get_installed_plugins
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileHandler } from "../utils/fileHandler.js";
import { SafeWriter } from "../utils/safeWriter.js";
import type { PluginConfig } from "../utils/types.js";

const installPluginSchema = z.object({
    filename: z.string().describe("Plugin filename without .js extension"),
    code: z.string().describe("Plugin JavaScript code"),
    description: z.string().describe("Plugin description"),
    author: z.string().describe("Plugin author"),
});

const MZ_HEADER_REGEX = /\/\*:\s*\n?\s*\*\s*@target\s+MZ/i;

function createPluginHeader(description: string, author: string): string {
    return `/*:
 * @target MZ
 * @plugindesc ${description}
 * @author ${author}
 * @help
 * This plugin was installed via MCP server.
 */
`;
}

export function registerPluginTools(server: McpServer, fileHandler: FileHandler, safeWriter: SafeWriter) {
    // get_installed_plugins - List all plugins with status
    server.tool(
        "get_installed_plugins",
        "Get all installed plugins with their registration status",
        {},
        async () => {
            try {
                // Read plugins.js registry
                let registered: PluginConfig[] = [];
                try {
                    const pluginsContent = await fileHandler.readJson<string>("js/plugins.js");
                    // plugins.js is actually JS, not JSON, so we need to parse it differently
                    const pluginsJsContent = await (await import("node:fs/promises")).readFile(
                        fileHandler.getProjectPath() + "/js/plugins.js",
                        "utf-8"
                    );
                    const match = pluginsJsContent.match(/\$plugins\s*=\s*(\[[\s\S]*\]);?/);
                    if (match) {
                        registered = JSON.parse(match[1]);
                    }
                } catch {
                    registered = [];
                }

                // List .js files in plugins folder
                const pluginFiles = await fileHandler.listFiles("js/plugins", ".js");
                const availablePlugins = pluginFiles.map((f) => f.replace(".js", ""));

                // Find unregistered plugins
                const registeredNames = new Set(registered.map((p) => p.name));
                const unregistered = availablePlugins.filter((name) => !registeredNames.has(name));

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify({
                                registered: registered.map((p) => ({
                                    name: p.name,
                                    status: p.status ? "ON" : "OFF",
                                    description: p.description,
                                })),
                                available: unregistered,
                            }, null, 2),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );

    // install_plugin - Install and register a plugin
    server.tool(
        "install_plugin",
        "Install a new plugin and register it in plugins.js",
        installPluginSchema.shape,
        async (args) => {
            try {
                const { filename, code, description, author } = args;

                // Check if code has MZ header, add if missing
                let finalCode = code;
                if (!MZ_HEADER_REGEX.test(code)) {
                    finalCode = createPluginHeader(description, author) + "\n" + code;
                }

                // Write plugin file
                await safeWriter.writePlugin(filename, finalCode);

                // Update plugins.js registry
                let plugins: PluginConfig[] = [];
                try {
                    const pluginsJsContent = await (await import("node:fs/promises")).readFile(
                        fileHandler.getProjectPath() + "/js/plugins.js",
                        "utf-8"
                    );
                    const match = pluginsJsContent.match(/\$plugins\s*=\s*(\[[\s\S]*\]);?/);
                    if (match) {
                        plugins = JSON.parse(match[1]);
                    }
                } catch {
                    plugins = [];
                }

                // Check if already registered
                const existingIndex = plugins.findIndex((p) => p.name === filename);
                const pluginEntry: PluginConfig = {
                    name: filename,
                    status: true,
                    description: description,
                    parameters: {},
                };

                if (existingIndex >= 0) {
                    plugins[existingIndex] = pluginEntry;
                } else {
                    plugins.push(pluginEntry);
                }

                await safeWriter.updatePluginsRegistry(plugins);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Plugin "${filename}" installed and registered successfully`,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${error}` }],
                    isError: true,
                };
            }
        }
    );
}
