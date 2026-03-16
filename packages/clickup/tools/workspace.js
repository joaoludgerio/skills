/**
 * Workspace tools — hierarchy, members, search.
 */
import { z } from "zod";
import * as api from "../api.js";
import { loadConfig } from "../config.js";

export function registerWorkspaceTools(server) {
  // --- Search ---
  server.tool(
    "clickup_search",
    `Search for tasks across the workspace.
Returns matching tasks with basic details. Use clickup_get_task for full details on a specific task.`,
    {
      query: z.string().describe("Search query string"),
      list_ids: z
        .string()
        .optional()
        .describe("Comma-separated list IDs to filter by"),
      statuses: z
        .string()
        .optional()
        .describe("Comma-separated statuses to filter by"),
      assignees: z
        .string()
        .optional()
        .describe("Comma-separated user IDs to filter by"),
      include_closed: z
        .boolean()
        .optional()
        .describe("Include closed tasks (default: false)"),
      page: z.number().optional().describe("Page number (default: 0)"),
    },
    async (params) => {
      const config = loadConfig();
      const teamId = config?.workspace_id;
      if (!teamId) {
        return errorText(
          "No workspace configured. Run clickup_onboarding first."
        );
      }

      const queryParams = {
        page: params.page || 0,
        include_closed: params.include_closed || false,
      };

      // ClickUp search uses different endpoints:
      // For simple text search, we filter tasks
      if (params.list_ids) {
        queryParams.list_ids = params.list_ids.split(",").map((s) => s.trim());
      }
      if (params.statuses) {
        queryParams.statuses = params.statuses.split(",").map((s) => s.trim());
      }
      if (params.assignees) {
        queryParams.assignees = params.assignees
          .split(",")
          .map((s) => s.trim());
      }

      // Note: ClickUp API v2 does not support text search via query param on /team/task.
      // We fetch tasks with server filters (list, status, assignee) and filter by text client-side.
      const result = await api.searchTasks(teamId, queryParams);
      const tasks = result.tasks || [];

      const query = params.query.toLowerCase();
      const filtered = tasks.filter(
        (t) =>
          t.name?.toLowerCase().includes(query) ||
          t.text_content?.toLowerCase().includes(query)
      );

      if (filtered.length === 0) {
        return okText(`No tasks found matching "${params.query}".`);
      }

      let msg = `**Found ${filtered.length} task(s):**\n\n`;
      for (const t of filtered) {
        const assignees =
          t.assignees?.map((a) => a.username).join(", ") || "unassigned";
        msg += `- **${t.name}** (ID: \`${t.id}\`) — Status: ${t.status?.status || "?"} | Assignees: ${assignees} | Priority: ${t.priority?.priority || "none"}\n`;
      }
      return okText(msg);
    }
  );

  // --- Workspace hierarchy ---
  server.tool(
    "clickup_get_workspace_hierarchy",
    `Get the full workspace hierarchy: spaces → folders → lists.
Includes personal/private spaces and lists accessible by the API key owner.
Returns a structured view of the entire workspace.`,
    {
      workspace_id: z
        .string()
        .optional()
        .describe(
          "Workspace/team ID (uses default from config if not provided)"
        ),
    },
    async (params) => {
      const config = loadConfig();
      const teamId = params.workspace_id || config?.workspace_id;
      if (!teamId) {
        return errorText(
          "No workspace_id provided and no default configured. Run clickup_onboarding first."
        );
      }

      const { spaces } = await api.getSpaces(teamId);
      let msg = `**Workspace Hierarchy:**\n\n`;

      for (const space of spaces || []) {
        msg += `**Space: ${space.name}** (ID: \`${space.id}\`)${space.private ? " 🔒 Private" : ""}\n`;

        // Folderless lists
        try {
          const { lists } = await api.getFolderlessLists(space.id);
          for (const list of lists || []) {
            msg += `  └─ List: ${list.name} (ID: \`${list.id}\`) — ${list.task_count || 0} tasks\n`;
          }
        } catch {}

        // Folders
        try {
          const { folders } = await api.getFolders(space.id);
          for (const folder of folders || []) {
            msg += `  └─ **Folder: ${folder.name}** (ID: \`${folder.id}\`)\n`;
            try {
              const { lists } = await api.getListsInFolder(folder.id);
              for (const list of lists || []) {
                msg += `      └─ List: ${list.name} (ID: \`${list.id}\`) — ${list.task_count || 0} tasks\n`;
              }
            } catch {}
          }
        } catch {}

        msg += `\n`;
      }

      return okText(msg);
    }
  );

  // --- Get List ---
  server.tool(
    "clickup_get_list",
    "Get details of a specific list by ID.",
    {
      list_id: z.string().describe("The list ID"),
    },
    async ({ list_id }) => {
      const list = await api.getList(list_id);
      return okText(formatObject(list));
    }
  );

  // --- Create List (in space, folderless) ---
  server.tool(
    "clickup_create_list",
    "Create a new list directly in a space (folderless).",
    {
      space_id: z.string().describe("The space ID to create the list in"),
      name: z.string().describe("List name"),
      content: z.string().optional().describe("List description"),
      status: z.string().optional().describe("Initial status"),
    },
    async (params) => {
      const body = {
        name: params.name,
        ...(params.content && { content: params.content }),
        ...(params.status && { status: params.status }),
      };
      const list = await api.createList(params.space_id, body);
      return okText(
        `List created!\n**Name:** ${list.name}\n**ID:** \`${list.id}\`\n**Space:** ${list.space?.name || params.space_id}`
      );
    }
  );

  // --- Create List in Folder ---
  server.tool(
    "clickup_create_list_in_folder",
    "Create a new list inside a folder.",
    {
      folder_id: z.string().describe("The folder ID"),
      name: z.string().describe("List name"),
      content: z.string().optional().describe("List description"),
      status: z.string().optional().describe("Initial status"),
    },
    async (params) => {
      const body = {
        name: params.name,
        ...(params.content && { content: params.content }),
        ...(params.status && { status: params.status }),
      };
      const list = await api.createListInFolder(params.folder_id, body);
      return okText(
        `List created in folder!\n**Name:** ${list.name}\n**ID:** \`${list.id}\``
      );
    }
  );

  // --- Update List ---
  server.tool(
    "clickup_update_list",
    "Update a list's name, content or status.",
    {
      list_id: z.string().describe("The list ID to update"),
      name: z.string().optional().describe("New list name"),
      content: z.string().optional().describe("New description"),
      status: z.string().optional().describe("New status"),
    },
    async (params) => {
      const body = {};
      if (params.name) body.name = params.name;
      if (params.content) body.content = params.content;
      if (params.status) body.status = params.status;
      const list = await api.updateList(params.list_id, body);
      return okText(
        `List updated!\n**Name:** ${list.name}\n**ID:** \`${list.id}\``
      );
    }
  );

  // --- Get Folder ---
  server.tool(
    "clickup_get_folder",
    "Get details of a specific folder by ID.",
    {
      folder_id: z.string().describe("The folder ID"),
    },
    async ({ folder_id }) => {
      const folder = await api.getFolder(folder_id);
      return okText(formatObject(folder));
    }
  );

  // --- Create Folder ---
  server.tool(
    "clickup_create_folder",
    "Create a new folder in a space.",
    {
      space_id: z.string().describe("The space ID to create the folder in"),
      name: z.string().describe("Folder name"),
    },
    async (params) => {
      const folder = await api.createFolder(params.space_id, { name: params.name });
      return okText(
        `Folder created!\n**Name:** ${folder.name}\n**ID:** \`${folder.id}\``
      );
    }
  );

  // --- Update Folder ---
  server.tool(
    "clickup_update_folder",
    "Update a folder's name.",
    {
      folder_id: z.string().describe("The folder ID to update"),
      name: z.string().describe("New folder name"),
    },
    async (params) => {
      const folder = await api.updateFolder(params.folder_id, { name: params.name });
      return okText(
        `Folder updated!\n**Name:** ${folder.name}\n**ID:** \`${folder.id}\``
      );
    }
  );

  // --- Get workspace members ---
  server.tool(
    "clickup_get_workspace_members",
    "List all members in the workspace with their IDs, names, and roles.",
    {
      workspace_id: z
        .string()
        .optional()
        .describe("Workspace ID (uses default from config if not provided)"),
    },
    async (params) => {
      const config = loadConfig();
      const teamId = params.workspace_id || config?.workspace_id;
      if (!teamId) {
        return errorText("No workspace_id. Run clickup_onboarding first.");
      }

      const team = await api.getWorkspaceMembers(teamId);
      const members = team.team?.members || [];

      let msg = `**Workspace Members (${members.length}):**\n\n`;
      for (const m of members) {
        const u = m.user;
        msg += `- **${u.username}** (ID: \`${u.id}\`) — ${u.email} — Role: ${m.role === 1 ? "Owner" : m.role === 2 ? "Admin" : m.role === 3 ? "Member" : "Guest"}\n`;
      }
      return okText(msg);
    }
  );

  // --- Find member by name ---
  server.tool(
    "clickup_find_member_by_name",
    "Find a workspace member by name (partial match). Returns matching members with their IDs.",
    {
      name: z.string().describe("Name or partial name to search for"),
      workspace_id: z.string().optional().describe("Workspace ID"),
    },
    async (params) => {
      const config = loadConfig();
      const teamId = params.workspace_id || config?.workspace_id;
      if (!teamId) {
        return errorText("No workspace_id. Run clickup_onboarding first.");
      }

      const team = await api.getWorkspaceMembers(teamId);
      const members = team.team?.members || [];
      const query = params.name.toLowerCase();
      const matches = members.filter(
        (m) =>
          m.user.username?.toLowerCase().includes(query) ||
          m.user.email?.toLowerCase().includes(query)
      );

      if (matches.length === 0) {
        return okText(`No members found matching "${params.name}".`);
      }

      let msg = `**Matching members:**\n\n`;
      for (const m of matches) {
        msg += `- **${m.user.username}** (ID: \`${m.user.id}\`) — ${m.user.email}\n`;
      }
      return okText(msg);
    }
  );

  // --- Resolve assignees ---
  server.tool(
    "clickup_resolve_assignees",
    `Resolve assignee names to user IDs. Useful before creating/updating tasks.
Pass comma-separated names and get back the corresponding user IDs.`,
    {
      names: z
        .string()
        .describe("Comma-separated names to resolve"),
      workspace_id: z.string().optional().describe("Workspace ID"),
    },
    async (params) => {
      const config = loadConfig();
      const teamId = params.workspace_id || config?.workspace_id;
      if (!teamId) {
        return errorText("No workspace_id. Run clickup_onboarding first.");
      }

      const team = await api.getWorkspaceMembers(teamId);
      const members = team.team?.members || [];
      const names = params.names.split(",").map((n) => n.trim().toLowerCase());

      const resolved = [];
      const unresolved = [];

      for (const name of names) {
        const match = members.find(
          (m) =>
            m.user.username?.toLowerCase().includes(name) ||
            m.user.email?.toLowerCase().includes(name)
        );
        if (match) {
          resolved.push({
            name: match.user.username,
            id: match.user.id,
            email: match.user.email,
          });
        } else {
          unresolved.push(name);
        }
      }

      let msg = `**Resolved assignees:**\n`;
      for (const r of resolved) {
        msg += `- ${r.name} → ID: \`${r.id}\`\n`;
      }
      if (unresolved.length > 0) {
        msg += `\n**Could not resolve:** ${unresolved.join(", ")}`;
      }
      msg += `\n\n**User IDs array:** [${resolved.map((r) => r.id).join(", ")}]`;
      return okText(msg);
    }
  );
}

function okText(msg) {
  return { content: [{ type: "text", text: msg }] };
}

function errorText(msg) {
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

function formatObject(obj) {
  return "```json\n" + JSON.stringify(obj, null, 2) + "\n```";
}
