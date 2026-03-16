/**
 * Onboarding tool — setup completo do MCP.
 *
 * Fluxo principal (single-step):
 *   clickup_onboarding api_key="pk_..." → valida, descobre workspace, lista tudo, salva config.
 *
 * Fluxos auxiliares:
 *   step="choose_list"   → mostra listas para o usuário escolher
 *   step="save"          → salva a lista padrão escolhida
 *   step="reconfigure"   → mostra config atual e permite alterar
 */
import { z } from "zod";
import * as api from "../api.js";
import { setApiKeyOverride } from "../api.js";
import {
  loadConfig,
  saveConfig,
  DEFAULT_CONFIG,
  getConfigPath,
  getApiKey,
} from "../config.js";

export function registerOnboardingTools(server) {
  server.tool(
    "clickup_onboarding",
    `Setup and configure the ClickUp MCP.

HOW TO USE:
1. First time? Call with: api_key="pk_YOUR_KEY_HERE"
   - This validates the key, identifies the user, discovers workspaces and lists, and saves everything.
   - The API key is stored locally in config.json for future use.

2. Want to choose a specific default list? Call with: step="choose_list"
   - Shows all lists (including personal/private) for you to pick one.

3. Want to save a chosen list? Call with: step="save" list_id="..." list_name="..."

4. Want to reconfigure? Call with: step="reconfigure"
   - Shows current config and allows changes.

5. Want to change defaults? Call with: step="save" and any of: priority, tags, due_date_offset_days, assignee_self

The API key can be obtained at: ClickUp > Settings (gear icon) > Apps > API Token
The token starts with "pk_".`,
    {
      api_key: z
        .string()
        .optional()
        .describe(
          'Your ClickUp personal API token (starts with "pk_"). Required on first setup.'
        ),
      step: z
        .enum(["choose_list", "save", "reconfigure"])
        .optional()
        .describe("Optional step for specific actions after initial setup"),
      workspace_id: z
        .string()
        .optional()
        .describe("Workspace ID (auto-detected if not provided)"),
      list_id: z
        .string()
        .optional()
        .describe("Default list ID to save"),
      list_name: z
        .string()
        .optional()
        .describe("Default list name to save"),
      priority: z
        .number()
        .min(1)
        .max(4)
        .optional()
        .describe("Default priority: 1=Urgent, 2=High, 3=Normal, 4=Low"),
      tags: z
        .string()
        .optional()
        .describe("Comma-separated default tags (e.g. 'via-claude,important')"),
      due_date_offset_days: z
        .number()
        .optional()
        .describe("Days from today for default due date"),
      assignee_self: z
        .boolean()
        .optional()
        .describe("Auto-assign tasks to yourself"),
    },
    async (params) => {
      try {
        // --- Main flow: API key provided → full setup ---
        if (params.api_key) {
          return await fullSetup(params.api_key, params);
        }

        // --- Auxiliary flows ---
        switch (params.step) {
          case "choose_list":
            return await stepChooseList(params.workspace_id);
          case "save":
            return await stepSave(params);
          case "reconfigure":
            return await stepReconfigure();
          default:
            // No API key and no step → check if already configured
            const existingKey = getApiKey();
            if (existingKey) {
              return await stepReconfigure();
            }
            return text(
              `**ClickUp MCP — Setup Required**\n\n` +
                `To get started, I need your ClickUp personal API token.\n\n` +
                `**How to get it:**\n` +
                `1. Open ClickUp\n` +
                `2. Click your avatar (bottom-left)\n` +
                `3. Go to **Settings**\n` +
                `4. Click **Apps** in the sidebar\n` +
                `5. Copy your **API Token** (starts with \`pk_\`)\n\n` +
                `Then call: \`clickup_onboarding\` with \`api_key="pk_YOUR_TOKEN"\``
            );
        }
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}

function text(msg) {
  return { content: [{ type: "text", text: msg }] };
}

/**
 * Full setup — validates key, gets user, discovers workspace, lists everything, saves config.
 */
async function fullSetup(apiKey, params) {
  // Temporarily set the API key so API calls work
  setApiKeyOverride(apiKey);

  try {
    // 1. Validate key and get user
    const { user } = await api.getAuthorizedUser();

    // 2. Get workspaces
    const { teams } = await api.getTeams();
    if (!teams || teams.length === 0) {
      return text("No workspaces found for this API key. Check your account.");
    }

    // Auto-select workspace (first one, or specified)
    const workspace =
      teams.find((t) => String(t.id) === params.workspace_id) || teams[0];

    // 3. Discover all lists
    const { spaces } = await api.getSpaces(workspace.id);
    let allLists = [];
    let hierarchyMsg = "";

    for (const space of spaces || []) {
      hierarchyMsg += `\n**Space: ${space.name}**${space.private ? " (Private)" : ""}\n`;

      // Folderless lists
      try {
        const { lists } = await api.getFolderlessLists(space.id);
        for (const list of lists || []) {
          allLists.push({
            id: list.id,
            name: list.name,
            space: space.name,
            folder: null,
          });
          hierarchyMsg += `  - ${list.name} (ID: \`${list.id}\`)\n`;
        }
      } catch {}

      // Lists inside folders
      try {
        const { folders } = await api.getFolders(space.id);
        for (const folder of folders || []) {
          hierarchyMsg += `  **Folder: ${folder.name}**\n`;
          try {
            const { lists } = await api.getListsInFolder(folder.id);
            for (const list of lists || []) {
              allLists.push({
                id: list.id,
                name: list.name,
                space: space.name,
                folder: folder.name,
              });
              hierarchyMsg += `    - ${list.name} (ID: \`${list.id}\`)\n`;
            }
          } catch {}
        }
      } catch {}
    }

    // 4. Build config
    const config = {
      api_key: apiKey,
      workspace_id: String(workspace.id),
      workspace_name: workspace.name,
      default_list_id: params.list_id || null,
      default_list_name: params.list_name || null,
      user_id: String(user.id),
      user_name: user.username,
      user_email: user.email,
      defaults: {
        assignee_self: params.assignee_self ?? true,
        priority: params.priority || 3,
        tags: params.tags
          ? params.tags.split(",").map((t) => t.trim())
          : ["via-claude"],
        due_date_offset_days: params.due_date_offset_days ?? 1,
      },
    };

    // 5. Save
    saveConfig(config);

    // Clear override — future calls will read from config
    setApiKeyOverride(null);

    // 6. Build response
    let msg =
      `**ClickUp MCP configured successfully!**\n\n` +
      `**API Key:** \`${apiKey}\`\n` +
      `**User:** ${user.username} (${user.email})\n` +
      `**User ID:** \`${user.id}\`\n` +
      `**Workspace:** ${workspace.name} (ID: \`${workspace.id}\`)\n`;

    if (teams.length > 1) {
      msg += `\n**Other workspaces available:**\n`;
      for (const t of teams) {
        if (String(t.id) !== String(workspace.id)) {
          msg += `  - ${t.name} (ID: \`${t.id}\`)\n`;
        }
      }
    }

    msg += `\n---\n**Lists found (${allLists.length}):**\n${hierarchyMsg}`;

    if (!params.list_id) {
      msg +=
        `\n---\n**Next step:** Choose a default list.\n` +
        `Call \`clickup_onboarding\` with \`step="save"\` \`list_id="<ID>"\` \`list_name="<name>"\`\n` +
        `Or just start using the tools — you can specify list_id per task.`;
    } else {
      msg += `\n**Default list:** ${params.list_name || params.list_id}`;
    }

    msg +=
      `\n\n**Default task rules:**\n` +
      `  - Auto-assign to me: ${config.defaults.assignee_self}\n` +
      `  - Priority: ${config.defaults.priority} (1=Urgent, 2=High, 3=Normal, 4=Low)\n` +
      `  - Tags: ${config.defaults.tags.join(", ")}\n` +
      `  - Due date: today + ${config.defaults.due_date_offset_days} day(s)\n\n` +
      `Config saved at: \`${getConfigPath()}\``;

    return text(msg);
  } catch (err) {
    setApiKeyOverride(null);
    throw err;
  }
}

/**
 * Show all lists for the user to choose from.
 */
async function stepChooseList(workspaceId) {
  const config = loadConfig();
  const teamId = workspaceId || config?.workspace_id;
  if (!teamId) {
    return text(
      "No workspace configured. Run clickup_onboarding with your api_key first."
    );
  }

  const { spaces } = await api.getSpaces(teamId);
  let msg = `**All lists (including personal/private):**\n\n`;
  let listCount = 0;

  for (const space of spaces || []) {
    msg += `**Space: ${space.name}** ${space.private ? "(Private)" : ""}\n`;

    try {
      const { lists } = await api.getFolderlessLists(space.id);
      for (const list of lists || []) {
        msg += `  - ${list.name} (ID: \`${list.id}\`)\n`;
        listCount++;
      }
    } catch {}

    try {
      const { folders } = await api.getFolders(space.id);
      for (const folder of folders || []) {
        msg += `  **Folder: ${folder.name}**\n`;
        try {
          const { lists } = await api.getListsInFolder(folder.id);
          for (const list of lists || []) {
            msg += `    - ${list.name} (ID: \`${list.id}\`)\n`;
            listCount++;
          }
        } catch {}
      }
    } catch {}

    msg += `\n`;
  }

  msg += `**Total: ${listCount} lists**\n\n`;
  msg += `To set a default list, call: \`clickup_onboarding\` with \`step="save"\` \`list_id="<ID>"\` \`list_name="<name>"\``;
  return text(msg);
}

/**
 * Save configuration changes (list, defaults, etc.)
 */
async function stepSave(params) {
  const existing = loadConfig();
  if (!existing) {
    return text(
      "No configuration found. Run clickup_onboarding with your api_key first."
    );
  }

  const config = {
    ...existing,
    ...(params.workspace_id && { workspace_id: params.workspace_id }),
    ...(params.list_id && { default_list_id: params.list_id }),
    ...(params.list_name && { default_list_name: params.list_name }),
    defaults: {
      assignee_self:
        params.assignee_self ?? existing.defaults?.assignee_self ?? true,
      priority: params.priority || existing.defaults?.priority || 3,
      tags: params.tags
        ? params.tags.split(",").map((t) => t.trim())
        : existing.defaults?.tags || ["via-claude"],
      due_date_offset_days:
        params.due_date_offset_days ??
        existing.defaults?.due_date_offset_days ??
        1,
    },
  };

  saveConfig(config);

  return text(
    `**Configuration updated!**\n\n` +
      `**API Key:** \`${config.api_key}\`\n` +
      `**Workspace:** ${config.workspace_name || config.workspace_id}\n` +
      `**Default list:** ${config.default_list_name || config.default_list_id || "(not set)"}\n` +
      `**User:** ${config.user_name} (${config.user_email})\n\n` +
      `**Defaults:**\n` +
      `  - Auto-assign: ${config.defaults.assignee_self}\n` +
      `  - Priority: ${config.defaults.priority}\n` +
      `  - Tags: ${config.defaults.tags.join(", ")}\n` +
      `  - Due date offset: +${config.defaults.due_date_offset_days} day(s)\n\n` +
      `Saved at: \`${getConfigPath()}\``
  );
}

/**
 * Show current configuration.
 */
async function stepReconfigure() {
  const config = loadConfig();
  if (!config) {
    return text(
      "No configuration found. Run clickup_onboarding with your api_key first."
    );
  }

  return text(
    `**Current ClickUp MCP Configuration:**\n\n` +
      `**API Key:** \`${config.api_key}\`\n` +
      `**Workspace:** ${config.workspace_name || "?"} (ID: \`${config.workspace_id || "?"}\`)\n` +
      `**Default list:** ${config.default_list_name || "?"} (ID: \`${config.default_list_id || "?"}\`)\n` +
      `**User:** ${config.user_name || "?"} (${config.user_email || "?"})\n` +
      `**User ID:** \`${config.user_id || "?"}\`\n\n` +
      `**Defaults:**\n` +
      `  - Auto-assign: ${config.defaults?.assignee_self}\n` +
      `  - Priority: ${config.defaults?.priority} (1=Urgent, 2=High, 3=Normal, 4=Low)\n` +
      `  - Tags: ${config.defaults?.tags?.join(", ") || "none"}\n` +
      `  - Due date offset: +${config.defaults?.due_date_offset_days} day(s)\n\n` +
      `**To change:**\n` +
      `  - New API key: call with \`api_key="pk_..."\`\n` +
      `  - Change default list: call with \`step="save"\` \`list_id="..."\` \`list_name="..."\`\n` +
      `  - Change defaults: call with \`step="save"\` and any of: priority, tags, due_date_offset_days, assignee_self\n\n` +
      `Config file: \`${getConfigPath()}\``
  );
}
