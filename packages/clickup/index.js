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

import { registerOnboardingTools } from "./src/tools/onboarding.js";
import { registerWorkspaceTools } from "./src/tools/workspace.js";
import { registerTaskTools } from "./src/tools/tasks.js";
import { registerCommentTools } from "./src/tools/comments.js";
import { registerTimeTrackingTools } from "./src/tools/timetracking.js";
import { registerDocumentTools } from "./src/tools/documents.js";
import { registerChatTools } from "./src/tools/chat.js";
import { loadConfig, getApiKey } from "./src/config.js";

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
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
