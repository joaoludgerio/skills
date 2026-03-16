/**
 * Task tools — create, get, update, tags.
 */
import { z } from "zod";
import * as api from "../api.js";
import { loadConfig } from "../config.js";

export function registerTaskTools(server) {
  // --- Create task ---
  server.tool(
    "clickup_create_task",
    `Create a new task in ClickUp.
Uses defaults from config.json when fields are not specified:
- Default list from onboarding config
- Auto-assigns to API key owner (if configured)
- Default priority (Normal=3)
- Default tags (e.g. "via-claude")
- Default due date (today + offset days)

Priority values: 1=Urgent, 2=High, 3=Normal, 4=Low`,
    {
      name: z.string().describe("Task name (required)"),
      description: z
        .string()
        .optional()
        .describe("Task description (supports markdown)"),
      list_id: z
        .string()
        .optional()
        .describe("List ID (uses default from config if not provided)"),
      status: z.string().optional().describe("Task status name"),
      priority: z
        .number()
        .min(1)
        .max(4)
        .optional()
        .describe("1=Urgent, 2=High, 3=Normal, 4=Low"),
      assignees: z
        .string()
        .optional()
        .describe("Comma-separated user IDs to assign"),
      tags: z
        .string()
        .optional()
        .describe("Comma-separated tags (overrides defaults)"),
      due_date: z
        .string()
        .optional()
        .describe("Due date as ISO string or timestamp"),
      start_date: z
        .string()
        .optional()
        .describe("Start date as ISO string or timestamp"),
      time_estimate: z
        .number()
        .optional()
        .describe("Time estimate in milliseconds"),
      parent: z
        .string()
        .optional()
        .describe("Parent task ID to create as subtask"),
      notify_all: z
        .boolean()
        .optional()
        .describe("Notify all assignees (default: true)"),
      custom_fields: z
        .string()
        .optional()
        .describe('JSON array of custom field values. Ex: [{"id":"field_id","value":"text"}]'),
    },
    async (params) => {
      const config = loadConfig();
      const listId = params.list_id || config?.default_list_id;

      if (!listId) {
        return errorText(
          "No list_id provided and no default list configured. Run clickup_onboarding first."
        );
      }

      const defaults = config?.defaults || {};

      // Build assignees
      let assignees = [];
      if (params.assignees) {
        assignees = params.assignees.split(",").map((s) => Number(s.trim()));
      } else if (defaults.assignee_self && config?.user_id) {
        assignees = [Number(config.user_id)];
      }

      // Build tags
      let tags = [];
      if (params.tags) {
        tags = params.tags.split(",").map((s) => s.trim());
      } else if (defaults.tags?.length > 0) {
        tags = defaults.tags;
      }

      // Build due date
      let due_date;
      if (params.due_date) {
        due_date = toTimestamp(params.due_date);
      } else if (defaults.due_date_offset_days) {
        const d = new Date();
        d.setDate(d.getDate() + defaults.due_date_offset_days);
        d.setHours(23, 59, 59, 0);
        due_date = d.getTime();
      }

      const body = {
        name: params.name,
        ...(params.description && {
          markdown_description: params.description,
        }),
        ...(assignees.length > 0 && { assignees }),
        ...(tags.length > 0 && { tags }),
        ...(params.status && { status: params.status }),
        priority: params.priority || defaults.priority || null,
        ...(due_date && { due_date }),
        ...(params.start_date && {
          start_date: toTimestamp(params.start_date),
        }),
        ...(params.time_estimate && { time_estimate: params.time_estimate }),
        ...(params.parent && { parent: params.parent }),
        notify_all: params.notify_all ?? true,
        ...(params.custom_fields && {
          custom_fields: JSON.parse(params.custom_fields),
        }),
      };

      const task = await api.createTask(listId, body);

      return okText(
        `Task created successfully!\n\n` +
          `**Name:** ${task.name}\n` +
          `**ID:** \`${task.id}\`\n` +
          `**URL:** ${task.url}\n` +
          `**Status:** ${task.status?.status}\n` +
          `**List:** ${task.list?.name}\n` +
          `**Assignees:** ${task.assignees?.map((a) => a.username).join(", ") || "none"}\n` +
          `**Priority:** ${task.priority?.priority || "none"}\n` +
          `**Tags:** ${task.tags?.map((t) => t.name).join(", ") || "none"}\n` +
          `**Due date:** ${task.due_date ? new Date(Number(task.due_date)).toISOString() : "none"}`
      );
    }
  );

  // --- Get task ---
  server.tool(
    "clickup_get_task",
    "Get full details of a task by ID, including subtasks and markdown description.",
    {
      task_id: z.string().describe("The task ID"),
    },
    async ({ task_id }) => {
      const task = await api.getTask(task_id);
      return okText(formatTask(task));
    }
  );

  // --- Update task ---
  server.tool(
    "clickup_update_task",
    `Update an existing task. Only provide fields you want to change.
Priority values: 1=Urgent, 2=High, 3=Normal, 4=Low`,
    {
      task_id: z.string().describe("The task ID to update"),
      name: z.string().optional().describe("New task name"),
      description: z.string().optional().describe("New description (markdown)"),
      status: z.string().optional().describe("New status name"),
      priority: z
        .number()
        .min(1)
        .max(4)
        .optional()
        .describe("1=Urgent, 2=High, 3=Normal, 4=Low"),
      assignees_add: z
        .string()
        .optional()
        .describe("Comma-separated user IDs to add as assignees"),
      assignees_remove: z
        .string()
        .optional()
        .describe("Comma-separated user IDs to remove from assignees"),
      due_date: z.string().optional().describe("New due date (ISO or timestamp)"),
      start_date: z
        .string()
        .optional()
        .describe("New start date (ISO or timestamp)"),
      time_estimate: z
        .number()
        .optional()
        .describe("Time estimate in milliseconds"),
      archived: z.boolean().optional().describe("Archive or unarchive the task"),
      parent: z
        .string()
        .optional()
        .describe("Move task under a parent (make subtask)"),
      custom_fields: z
        .string()
        .optional()
        .describe('JSON array of custom field values. Ex: [{"id":"field_id","value":"text"}]'),
    },
    async (params) => {
      const body = {};

      if (params.name) body.name = params.name;
      if (params.description)
        body.markdown_description = params.description;
      if (params.status) body.status = params.status;
      if (params.priority !== undefined) body.priority = params.priority;
      if (params.due_date) body.due_date = toTimestamp(params.due_date);
      if (params.start_date)
        body.start_date = toTimestamp(params.start_date);
      if (params.time_estimate !== undefined)
        body.time_estimate = params.time_estimate;
      if (params.archived !== undefined) body.archived = params.archived;
      if (params.parent) body.parent = params.parent;

      if (params.assignees_add || params.assignees_remove) {
        body.assignees = {};
        if (params.assignees_add) {
          body.assignees.add = params.assignees_add
            .split(",")
            .map((s) => Number(s.trim()));
        }
        if (params.assignees_remove) {
          body.assignees.rem = params.assignees_remove
            .split(",")
            .map((s) => Number(s.trim()));
        }
      }

      if (params.custom_fields) {
        body.custom_fields = JSON.parse(params.custom_fields);
      }

      const task = await api.updateTask(params.task_id, body);

      return okText(
        `Task updated successfully!\n\n` + formatTask(task)
      );
    }
  );

  // --- List tasks in a list ---
  server.tool(
    "clickup_list_tasks",
    "List tasks in a specific ClickUp list with optional filters. More reliable than search for known lists.",
    {
      list_id: z.string().describe("The list ID to fetch tasks from"),
      statuses: z
        .string()
        .optional()
        .describe("Comma-separated statuses to filter by. Ex: 'a fazer,em execução'"),
      assignees: z
        .string()
        .optional()
        .describe("Comma-separated user IDs to filter by"),
      include_closed: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include closed/completed tasks (default: false)"),
      page: z
        .number()
        .optional()
        .default(0)
        .describe("Page number for pagination (default: 0, 100 tasks per page)"),
    },
    async (params) => {
      const query = {
        include_closed: params.include_closed ?? false,
        page: params.page ?? 0,
      };

      if (params.statuses) {
        query.statuses = params.statuses.split(",").map((s) => s.trim());
      }
      if (params.assignees) {
        query.assignees = params.assignees.split(",").map((s) => Number(s.trim()));
      }

      const result = await api.getTasksInList(params.list_id, query);
      const tasks = result.tasks || [];

      if (tasks.length === 0) {
        return okText(`No tasks found in list \`${params.list_id}\`.`);
      }

      let msg = `**Tasks in list \`${params.list_id}\` — ${tasks.length} found (page ${params.page ?? 0}):**\n\n`;
      for (const t of tasks) {
        const assignees = t.assignees?.map((a) => a.username).join(", ") || "unassigned";
        const due = t.due_date ? new Date(Number(t.due_date)).toLocaleDateString("pt-BR") : "none";
        const priority = t.priority?.priority || "none";
        msg += `- **${t.name}** (ID: \`${t.id}\`) — Status: ${t.status?.status || "?"} | Assignees: ${assignees} | Priority: ${priority} | Due: ${due}\n`;
      }

      return okText(msg);
    }
  );

  // --- Delete task ---
  server.tool(
    "clickup_delete_task",
    "Permanently delete a task by ID. This action cannot be undone.",
    {
      task_id: z.string().describe("The task ID to delete"),
    },
    async ({ task_id }) => {
      await api.deleteTask(task_id);
      return okText(`Task \`${task_id}\` deleted permanently.`);
    }
  );

  // --- Add tag ---
  server.tool(
    "clickup_add_tag_to_task",
    "Add a tag to a task.",
    {
      task_id: z.string().describe("The task ID"),
      tag_name: z.string().describe("Tag name to add"),
    },
    async ({ task_id, tag_name }) => {
      await api.addTagToTask(task_id, tag_name);
      return okText(`Tag "${tag_name}" added to task \`${task_id}\`.`);
    }
  );

  // --- Remove tag ---
  server.tool(
    "clickup_remove_tag_from_task",
    "Remove a tag from a task.",
    {
      task_id: z.string().describe("The task ID"),
      tag_name: z.string().describe("Tag name to remove"),
    },
    async ({ task_id, tag_name }) => {
      await api.removeTagFromTask(task_id, tag_name);
      return okText(`Tag "${tag_name}" removed from task \`${task_id}\`.`);
    }
  );
}

function toTimestamp(value) {
  if (!value) return undefined;
  const n = Number(value);
  if (!isNaN(n) && n > 1e12) return n; // already ms timestamp
  const d = new Date(value);
  if (isNaN(d.getTime())) return undefined;
  return d.getTime();
}

function okText(msg) {
  return { content: [{ type: "text", text: msg }] };
}

function errorText(msg) {
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

function formatTask(task) {
  const assignees =
    task.assignees?.map((a) => `${a.username} (${a.id})`).join(", ") ||
    "none";
  const tags = task.tags?.map((t) => t.name).join(", ") || "none";
  const subtasks = task.subtasks?.length || 0;

  let msg =
    `**${task.name}**\n` +
    `**ID:** \`${task.id}\`\n` +
    `**URL:** ${task.url}\n` +
    `**Status:** ${task.status?.status || "?"}\n` +
    `**List:** ${task.list?.name || "?"}\n` +
    `**Folder:** ${task.folder?.name || "?"}\n` +
    `**Space:** ${task.space?.id || "?"}\n` +
    `**Assignees:** ${assignees}\n` +
    `**Priority:** ${task.priority?.priority || "none"}\n` +
    `**Tags:** ${tags}\n` +
    `**Due date:** ${task.due_date ? new Date(Number(task.due_date)).toISOString() : "none"}\n` +
    `**Start date:** ${task.start_date ? new Date(Number(task.start_date)).toISOString() : "none"}\n` +
    `**Time estimate:** ${task.time_estimate ? `${Math.round(task.time_estimate / 3600000)}h` : "none"}\n` +
    `**Subtasks:** ${subtasks}\n` +
    `**Created:** ${task.date_created ? new Date(Number(task.date_created)).toISOString() : "?"}\n` +
    `**Updated:** ${task.date_updated ? new Date(Number(task.date_updated)).toISOString() : "?"}\n`;

  if (task.markdown_description || task.text_content) {
    const desc = task.markdown_description || task.text_content || "";
    msg += `\n**Description:**\n${desc.substring(0, 2000)}${desc.length > 2000 ? "..." : ""}\n`;
  }

  if (task.subtasks?.length > 0) {
    msg += `\n**Subtasks:**\n`;
    for (const st of task.subtasks) {
      msg += `  - ${st.name} (\`${st.id}\`) — ${st.status?.status || "?"}\n`;
    }
  }

  if (task.custom_fields?.length > 0) {
    const filled = task.custom_fields.filter(
      (f) => f.value !== undefined && f.value !== null && f.value !== ""
    );
    if (filled.length > 0) {
      msg += `\n**Custom Fields:**\n`;
      for (const f of filled) {
        let val = f.value;
        if (typeof val === "object") val = JSON.stringify(val);
        msg += `  - ${f.name}: ${val}\n`;
      }
    }
  }

  return msg;
}
