/**
 * Time tracking tools.
 */
import { z } from "zod";
import * as api from "../api.js";
import { loadConfig } from "../config.js";

export function registerTimeTrackingTools(server) {
  // --- Get task time entries ---
  server.tool(
    "clickup_get_task_time_entries",
    "Get all time entries for a specific task.",
    {
      task_id: z.string().describe("The task ID"),
    },
    async ({ task_id }) => {
      const { data } = await api.getTaskTimeEntries(task_id);
      const entries = data || [];

      if (entries.length === 0) {
        return okText(`No time entries for task \`${task_id}\`.`);
      }

      let total = 0;
      let msg = `**Time entries for task \`${task_id}\` (${entries.length}):**\n\n`;

      for (const e of entries) {
        const duration = Number(e.duration || 0);
        total += duration;
        const hours = (duration / 3600000).toFixed(2);
        const user = e.user?.username || "unknown";
        const start = e.start
          ? new Date(Number(e.start)).toISOString()
          : "?";
        const end = e.end ? new Date(Number(e.end)).toISOString() : "running";
        msg += `- **${user}** — ${hours}h (${start} → ${end})\n`;
        if (e.description) msg += `  _${e.description}_\n`;
      }

      msg += `\n**Total:** ${(total / 3600000).toFixed(2)}h`;
      return okText(msg);
    }
  );

  // --- Start time tracking ---
  server.tool(
    "clickup_start_time_tracking",
    "Start a timer on a task. Only one timer can run at a time.",
    {
      task_id: z.string().describe("The task ID to track time on"),
      description: z
        .string()
        .optional()
        .describe("Description for this time entry"),
      billable: z.boolean().optional().describe("Whether this is billable"),
    },
    async (params) => {
      const config = loadConfig();
      const teamId = config?.workspace_id;
      if (!teamId)
        return errorText("No workspace configured. Run clickup_onboarding.");

      const body = {
        tid: params.task_id,
        ...(params.description && { description: params.description }),
        ...(params.billable !== undefined && { billable: params.billable }),
      };

      const result = await api.startTimeEntry(teamId, body);
      const data = result.data || result;

      return okText(
        `Timer started on task \`${params.task_id}\`.\n` +
          `**Timer ID:** \`${data.id || "?"}\`\n` +
          `**Started at:** ${data.start ? new Date(Number(data.start)).toISOString() : "now"}`
      );
    }
  );

  // --- Stop time tracking ---
  server.tool(
    "clickup_stop_time_tracking",
    "Stop the currently running timer.",
    {},
    async () => {
      const config = loadConfig();
      const teamId = config?.workspace_id;
      if (!teamId)
        return errorText("No workspace configured. Run clickup_onboarding.");

      const result = await api.stopTimeEntry(teamId);
      const data = result.data || result;

      return okText(
        `Timer stopped.\n` +
          `**Duration:** ${data.duration ? (Number(data.duration) / 3600000).toFixed(2) + "h" : "?"}\n` +
          `**Task:** \`${data.task?.id || "?"}\``
      );
    }
  );

  // --- Add time entry ---
  server.tool(
    "clickup_add_time_entry",
    "Add a manual time entry to a task.",
    {
      task_id: z.string().describe("The task ID"),
      duration: z.number().describe("Duration in milliseconds"),
      description: z.string().optional().describe("Description"),
      start: z
        .string()
        .optional()
        .describe("Start time (ISO string or timestamp). Defaults to now."),
      billable: z.boolean().optional().describe("Whether this is billable"),
    },
    async (params) => {
      const config = loadConfig();
      const teamId = config?.workspace_id;
      if (!teamId)
        return errorText("No workspace configured. Run clickup_onboarding.");

      const startMs = params.start
        ? toTimestamp(params.start) || Date.now()
        : Date.now();

      const body = {
        tid: params.task_id,
        duration: params.duration,
        start: startMs,
        ...(params.description && { description: params.description }),
        ...(params.billable !== undefined && { billable: params.billable }),
      };

      const result = await api.addTimeEntry(teamId, body);
      const data = result.data || result;

      return okText(
        `Time entry added to task \`${params.task_id}\`.\n` +
          `**Duration:** ${(params.duration / 3600000).toFixed(2)}h\n` +
          `**Entry ID:** \`${data.id || "?"}\``
      );
    }
  );

  // --- Get current running time entry ---
  server.tool(
    "clickup_get_current_time_entry",
    "Get the currently running timer for the authenticated user.",
    {},
    async () => {
      const config = loadConfig();
      const teamId = config?.workspace_id;
      const userId = config?.user_id;
      if (!teamId || !userId)
        return errorText("No workspace/user configured. Run clickup_onboarding.");

      const result = await api.getRunningTimeEntry(teamId, userId);
      const data = result.data;

      if (!data) {
        return okText("No timer currently running.");
      }

      const elapsed = data.start
        ? ((Date.now() - Number(data.start)) / 3600000).toFixed(2)
        : "?";

      return okText(
        `**Timer running:**\n` +
          `**Task:** \`${data.task?.id || "?"}\` — ${data.task?.name || "?"}\n` +
          `**Started:** ${data.start ? new Date(Number(data.start)).toISOString() : "?"}\n` +
          `**Elapsed:** ${elapsed}h\n` +
          `**Description:** ${data.description || "(none)"}`
      );
    }
  );
}

function toTimestamp(value) {
  if (!value) return undefined;
  const n = Number(value);
  if (!isNaN(n) && n > 1e12) return n;
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
