/**
 * Comments and attachments tools.
 */
import { z } from "zod";
import * as api from "../api.js";
import { readFileSync } from "fs";

export function registerCommentTools(server) {
  // --- Get task comments ---
  server.tool(
    "clickup_get_task_comments",
    "Get all comments on a task.",
    {
      task_id: z.string().describe("The task ID"),
    },
    async ({ task_id }) => {
      const { comments } = await api.getTaskComments(task_id);

      if (!comments || comments.length === 0) {
        return okText(`No comments on task \`${task_id}\`.`);
      }

      let msg = `**Comments on task \`${task_id}\` (${comments.length}):**\n\n`;
      for (const c of comments) {
        const date = c.date
          ? new Date(Number(c.date)).toISOString()
          : "unknown";
        const author = c.user?.username || "unknown";
        const text =
          c.comment_text ||
          c.comment?.map((part) => part.text).join("") ||
          "(no text)";
        msg += `**${author}** (${date}):\n${text}\n\n---\n\n`;
      }

      return okText(msg);
    }
  );

  // --- Create task comment ---
  server.tool(
    "clickup_create_task_comment",
    "Add a comment to a task.",
    {
      task_id: z.string().describe("The task ID"),
      comment_text: z.string().describe("The comment text"),
      notify_all: z
        .boolean()
        .optional()
        .describe("Notify all assignees (default: true)"),
      assignee: z
        .number()
        .optional()
        .describe("User ID to assign the comment to"),
    },
    async (params) => {
      const body = {
        comment_text: params.comment_text,
        notify_all: params.notify_all ?? true,
      };
      if (params.assignee) body.assignee = params.assignee;

      const result = await api.createTaskComment(params.task_id, body);

      return okText(
        `Comment added to task \`${params.task_id}\`.\n` +
          `**Comment ID:** \`${result.id}\``
      );
    }
  );

  // --- Delete comment ---
  server.tool(
    "clickup_delete_comment",
    "Delete a comment from a task by comment ID.",
    {
      comment_id: z.string().describe("The comment ID to delete"),
    },
    async ({ comment_id }) => {
      await api.deleteComment(comment_id);
      return okText(`Comment \`${comment_id}\` deleted successfully.`);
    }
  );

  // --- Attach file to task ---
  server.tool(
    "clickup_attach_task_file",
    `Attach a file to a task. Provide the local file path on the machine where the MCP runs.
The file will be uploaded to ClickUp and attached to the task.`,
    {
      task_id: z.string().describe("The task ID"),
      file_path: z.string().describe("Absolute local file path to attach"),
      file_name: z
        .string()
        .optional()
        .describe(
          "File name to use in ClickUp (defaults to the original file name)"
        ),
    },
    async (params) => {
      let buffer;
      try {
        buffer = readFileSync(params.file_path);
      } catch (err) {
        return errorText(`Cannot read file: ${err.message}`);
      }

      const fileName =
        params.file_name || params.file_path.split(/[/\\]/).pop();

      const result = await api.createTaskAttachment(
        params.task_id,
        buffer,
        fileName
      );

      return okText(
        `File attached to task \`${params.task_id}\`.\n` +
          `**File:** ${fileName}\n` +
          `**URL:** ${result.url || "(see task attachments)"}`
      );
    }
  );
}

function okText(msg) {
  return { content: [{ type: "text", text: msg }] };
}

function errorText(msg) {
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}
