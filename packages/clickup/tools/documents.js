/**
 * Document tools — ClickUp Docs (API v3).
 */
import { z } from "zod";
import * as api from "../api.js";
import { loadConfig } from "../config.js";

export function registerDocumentTools(server) {
  // --- Create document ---
  server.tool(
    "clickup_create_document",
    `Create a new ClickUp Doc in the workspace.
The doc can be linked to a list, folder, or space via the parent object.`,
    {
      title: z.string().describe("Document title"),
      content: z
        .string()
        .optional()
        .describe("Initial page content (markdown)"),
      parent_id: z
        .string()
        .optional()
        .describe("ID of the parent (list, folder, or space)"),
      parent_type: z
        .enum(["list", "folder", "space"])
        .optional()
        .describe("Type of the parent"),
      visibility: z
        .enum(["private", "workspace"])
        .optional()
        .describe("Doc visibility (default: workspace)"),
    },
    async (params) => {
      const config = loadConfig();
      const workspaceId = config?.workspace_id;
      if (!workspaceId)
        return errorText("No workspace configured. Run clickup_onboarding.");

      const body = {
        title: params.title,
        ...(params.visibility && { visibility: params.visibility }),
        ...(params.parent_id &&
          params.parent_type && {
            parent: { id: params.parent_id, type: Number(params.parent_type === "list" ? 6 : params.parent_type === "folder" ? 5 : 4) },
          }),
      };

      if (params.content) {
        body.pages = [{ title: params.title, content: params.content }];
      }

      const result = await api.createDoc(workspaceId, body);
      return okText(
        `Document created!\n\n` +
          `**Title:** ${result.title || params.title}\n` +
          `**ID:** \`${result.id}\`\n` +
          `**URL:** ${result.url || "(check ClickUp)"}`
      );
    }
  );

  // --- List document pages ---
  server.tool(
    "clickup_list_document_pages",
    "List all pages in a ClickUp Doc.",
    {
      doc_id: z.string().describe("The document ID"),
      workspace_id: z.string().optional().describe("Workspace ID"),
    },
    async (params) => {
      const config = loadConfig();
      const workspaceId = params.workspace_id || config?.workspace_id;
      if (!workspaceId)
        return errorText("No workspace configured. Run clickup_onboarding.");

      const result = await api.getDocPages(workspaceId, params.doc_id);
      const pages = result.pages || result || [];

      if (!Array.isArray(pages) || pages.length === 0) {
        return okText(`No pages found in document \`${params.doc_id}\`.`);
      }

      let msg = `**Pages in document \`${params.doc_id}\`:**\n\n`;
      for (const page of pages) {
        msg += `- **${page.title || "(untitled)"}** (ID: \`${page.id}\`)\n`;
      }
      return okText(msg);
    }
  );

  // --- Get document pages ---
  server.tool(
    "clickup_get_document_pages",
    "Get the content of a specific page in a ClickUp Doc.",
    {
      doc_id: z.string().describe("The document ID"),
      page_id: z.string().describe("The page ID"),
      workspace_id: z.string().optional().describe("Workspace ID"),
    },
    async (params) => {
      const config = loadConfig();
      const workspaceId = params.workspace_id || config?.workspace_id;
      if (!workspaceId)
        return errorText("No workspace configured. Run clickup_onboarding.");

      const page = await api.getDocPage(
        workspaceId,
        params.doc_id,
        params.page_id
      );

      return okText(
        `**Page: ${page.title || "(untitled)"}**\n` +
          `**ID:** \`${page.id}\`\n\n` +
          `${page.content || "(no content)"}`
      );
    }
  );

  // --- Create document page ---
  server.tool(
    "clickup_create_document_page",
    "Create a new page in a ClickUp Doc.",
    {
      doc_id: z.string().describe("The document ID"),
      title: z.string().describe("Page title"),
      content: z.string().optional().describe("Page content (markdown)"),
      workspace_id: z.string().optional().describe("Workspace ID"),
    },
    async (params) => {
      const config = loadConfig();
      const workspaceId = params.workspace_id || config?.workspace_id;
      if (!workspaceId)
        return errorText("No workspace configured. Run clickup_onboarding.");

      const body = {
        title: params.title,
        ...(params.content && { content: params.content }),
      };

      const result = await api.createDocPage(
        workspaceId,
        params.doc_id,
        body
      );

      return okText(
        `Page created in document \`${params.doc_id}\`.\n` +
          `**Title:** ${params.title}\n` +
          `**Page ID:** \`${result.id || "?"}\``
      );
    }
  );

  // --- Update document page ---
  server.tool(
    "clickup_update_document_page",
    `Update an existing page in a ClickUp Doc.
Supports three edit modes:
- replace (default): overwrites content entirely
- append: adds content AFTER existing content (use to add notes without losing formatting)
- prepend: adds content BEFORE existing content`,
    {
      doc_id: z.string().describe("The document ID"),
      page_id: z.string().describe("The page ID to update"),
      title: z.string().optional().describe("New page title"),
      content: z.string().optional().describe("Content (markdown)"),
      content_edit_mode: z
        .enum(["replace", "append", "prepend"])
        .optional()
        .default("replace")
        .describe("How to update content: replace (default), append or prepend"),
      workspace_id: z.string().optional().describe("Workspace ID"),
    },
    async (params) => {
      const config = loadConfig();
      const workspaceId = params.workspace_id || config?.workspace_id;
      if (!workspaceId)
        return errorText("No workspace configured. Run clickup_onboarding.");

      const mode = params.content_edit_mode || "replace";

      // For append/prepend, read existing content first
      let finalContent = params.content;
      if (params.content && (mode === "append" || mode === "prepend")) {
        try {
          const existing = await api.getDocPage(workspaceId, params.doc_id, params.page_id);
          const existingContent = existing.content || "";
          if (mode === "append") {
            finalContent = existingContent + "\n\n" + params.content;
          } else {
            finalContent = params.content + "\n\n" + existingContent;
          }
        } catch {
          // fallback to replace if read fails
        }
      }

      const body = {};
      if (params.title) body.title = params.title;
      if (finalContent !== undefined) body.content = finalContent;

      await api.updateDocPage(workspaceId, params.doc_id, params.page_id, body);

      const modeLabel = mode === "append" ? "appended to" : mode === "prepend" ? "prepended to" : "replaced in";
      return okText(`Page \`${params.page_id}\` content ${modeLabel} document \`${params.doc_id}\`.`);
    }
  );
}

function okText(msg) {
  return { content: [{ type: "text", text: msg }] };
}

function errorText(msg) {
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}
