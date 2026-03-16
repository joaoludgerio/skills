/**
 * Chat tools — ClickUp chat channels and messages.
 * Uses ClickUp API v3 for chat features.
 */
import { z } from "zod";
import { loadConfig, getApiKey } from "../config.js";

const BASE_URL_V3 = "https://api.clickup.com/api/v3";

async function requestV3(method, path, body = null, query = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No API key configured. Run clickup_onboarding first.");

  const url = new URL(`${BASE_URL_V3}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const opts = {
    method,
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
  };
  if (body && method !== "GET") opts.body = JSON.stringify(body);

  const res = await fetch(url.toString(), opts);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ClickUp API v3 ${res.status}: ${text}`);
  }
  if (!text) return {};
  return JSON.parse(text);
}

export function registerChatTools(server) {
  // --- Get chat channels ---
  server.tool(
    "clickup_get_chat_channels",
    `List chat channels (views) available in the workspace.
Note: ClickUp chat is part of their views system. This fetches chat-type views.`,
    {
      workspace_id: z.string().optional().describe("Workspace ID"),
    },
    async (params) => {
      const config = loadConfig();
      const workspaceId = params.workspace_id || config?.workspace_id;
      if (!workspaceId)
        return errorText("No workspace configured. Run clickup_onboarding.");

      try {
        const result = await requestV3(
          "GET",
          `/workspaces/${workspaceId}/chat/channels`
        );
        const channels = result.channels || result.data || [];

        if (!Array.isArray(channels) || channels.length === 0) {
          return okText("No chat channels found in this workspace.");
        }

        let msg = `**Chat channels (${channels.length}):**\n\n`;
        for (const ch of channels) {
          msg += `- **${ch.name || ch.title || "(unnamed)"}** (ID: \`${ch.id}\`)\n`;
        }
        return okText(msg);
      } catch (err) {
        // Fallback: chat may not be available via API
        return okText(
          `Chat channels API returned an error: ${err.message}\n\n` +
            `Note: ClickUp Chat API may have limited availability. ` +
            `Consider using task comments as an alternative for communication.`
        );
      }
    }
  );

  // --- Send chat message ---
  server.tool(
    "clickup_send_chat_message",
    `Send a message to a ClickUp chat channel.
Note: This uses the ClickUp v3 chat API. If the chat API is not available, consider using task comments instead.`,
    {
      channel_id: z.string().describe("The chat channel ID"),
      content: z.string().describe("Message content"),
      workspace_id: z.string().optional().describe("Workspace ID"),
    },
    async (params) => {
      const config = loadConfig();
      const workspaceId = params.workspace_id || config?.workspace_id;
      if (!workspaceId)
        return errorText("No workspace configured. Run clickup_onboarding.");

      try {
        const result = await requestV3(
          "POST",
          `/workspaces/${workspaceId}/chat/channels/${params.channel_id}/messages`,
          { content: params.content }
        );

        return okText(
          `Message sent to channel \`${params.channel_id}\`.\n` +
            `**Message ID:** \`${result.id || "?"}\``
        );
      } catch (err) {
        return errorText(
          `Failed to send message: ${err.message}\n\n` +
            `If the chat API is not available, consider using clickup_create_task_comment instead.`
        );
      }
    }
  );
}

function okText(msg) {
  return { content: [{ type: "text", text: msg }] };
}

function errorText(msg) {
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}
