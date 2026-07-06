#!/usr/bin/env node

/**
 * ClickUp MCP Server — Local, API Key based.
 *
 * Provides full ClickUp task management via Claude Code.
 * Supports personal/private lists, onboarding, and default task creation rules.
 *
 * No env var required — run clickup_onboarding to configure everything.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerOnboardingTools } from "./tools/onboarding.js";
import { registerWorkspaceTools } from "./tools/workspace.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerTimeTrackingTools } from "./tools/timetracking.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerChatTools } from "./tools/chat.js";
import { loadConfig, getApiKey } from "./config.js";

async function main() {
  const config = loadConfig();
  const hasApiKey = !!getApiKey();

  // Build dynamic instructions
  let instructions =
    "ClickUp MCP — personal API key integration for task management.";

  if (hasApiKey && config?.workspace_id) {
    instructions += `\nWorkspace: ${config.workspace_name || config.workspace_id}`;
    instructions += `\nDefault list: ${config.default_list_name || config.default_list_id || "(not set)"}`;
    instructions += `\nUser: ${config.user_name || "?"} (${config.user_email || "?"})`;
  } else {
    instructions +=
      "\n\nNot configured yet. Run clickup_onboarding with your API key to set up." +
      "\nThe user needs to provide their ClickUp personal API token (Settings > Apps > API Token).";
  }

  const server = new McpServer(
    {
      name: "clickup-local",
      version: "1.0.0",
    },
    {
      instructions,
    }
  );

  // Register all tools
  registerOnboardingTools(server);
  registerWorkspaceTools(server);
  registerTaskTools(server);
  registerCommentTools(server);
  registerTimeTrackingTools(server);
  registerDocumentTools(server);
  registerChatTools(server);

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Cleanup: encerra o processo quando o stdin do pai (Claude Code/Desktop) fechar.
  // Sem isso, em Windows o processo node fica zumbi após restart do host.
  process.stdin.on("end", () => process.exit(0));
  process.stdin.on("close", () => process.exit(0));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
