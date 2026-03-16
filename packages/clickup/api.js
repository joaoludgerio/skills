/**
 * ClickUp API v2 client
 * All HTTP calls to the ClickUp API go through here.
 * API key is resolved from: env var → config.json
 */

import { getApiKey as resolveApiKey } from "./config.js";

const BASE_URL = "https://api.clickup.com/api/v2";

/**
 * Get API key, with optional override (used during onboarding).
 */
let _apiKeyOverride = null;

export function setApiKeyOverride(key) {
  _apiKeyOverride = key;
}

function getApiKey() {
  if (_apiKeyOverride) return _apiKeyOverride;
  const key = resolveApiKey();
  if (!key) {
    throw new Error(
      "No API key configured. Run clickup_onboarding with your API key first."
    );
  }
  return key;
}

function headers(extra = {}) {
  return {
    Authorization: getApiKey(),
    "Content-Type": "application/json",
    ...extra,
  };
}

async function request(method, path, body = null, query = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) {
      if (Array.isArray(v)) {
        v.forEach((item) => url.searchParams.append(`${k}[]`, item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const opts = {
    method,
    headers: headers(),
  };

  if (body && method !== "GET") {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), opts);
  const text = await res.text();

  if (!res.ok) {
    let detail = text;
    try {
      detail = JSON.stringify(JSON.parse(text), null, 2);
    } catch {}
    throw new Error(`ClickUp API ${res.status}: ${detail}`);
  }

  if (!text) return {};
  return JSON.parse(text);
}

async function uploadFile(path, fileBuffer, fileName) {
  const boundary = `----formdata-${Date.now()}`;
  const CRLF = "\r\n";

  const header = `--${boundary}${CRLF}Content-Disposition: form-data; name="attachment"; filename="${fileName}"${CRLF}Content-Type: application/octet-stream${CRLF}${CRLF}`;
  const footer = `${CRLF}--${boundary}--${CRLF}`;

  const headerBuf = Buffer.from(header, "utf-8");
  const footerBuf = Buffer.from(footer, "utf-8");
  const bodyBuf = Buffer.concat([headerBuf, fileBuffer, footerBuf]);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: getApiKey(),
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: bodyBuf,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ClickUp API ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

// --- Auth / User ---
export const getAuthorizedUser = () => request("GET", "/user");
export const getTeams = () => request("GET", "/team");

// --- Workspace hierarchy ---
export const getSpaces = (teamId) =>
  request("GET", `/team/${teamId}/space`, null, { archived: false });
export const getFolders = (spaceId) =>
  request("GET", `/space/${spaceId}/folder`, null, { archived: false });
export const getFolderlessLists = (spaceId) =>
  request("GET", `/space/${spaceId}/list`, null, { archived: false });
export const getListsInFolder = (folderId) =>
  request("GET", `/folder/${folderId}/list`, null, { archived: false });
export const getList = (listId) => request("GET", `/list/${listId}`);
export const createList = (spaceId, data) => request("POST", `/space/${spaceId}/list`, data);
export const createListInFolder = (folderId, data) => request("POST", `/folder/${folderId}/list`, data);
export const updateList = (listId, data) => request("PUT", `/list/${listId}`, data);
export const getFolder = (folderId) => request("GET", `/folder/${folderId}`);
export const createFolder = (spaceId, data) => request("POST", `/space/${spaceId}/folder`, data);
export const updateFolder = (folderId, data) => request("PUT", `/folder/${folderId}`, data);

// --- Tasks ---
export const createTask = (listId, data) =>
  request("POST", `/list/${listId}/task`, data);
export const getTask = (taskId) =>
  request("GET", `/task/${taskId}`, null, {
    include_markdown_description: true,
    include_subtasks: true,
    custom_fields: true,
  });
export const getTasksInList = (listId, query = {}) =>
  request("GET", `/list/${listId}/task`, null, {
    include_markdown_description: true,
    subtasks: true,
    ...query,
  });
export const updateTask = (taskId, data) =>
  request("PUT", `/task/${taskId}`, data);
export const deleteTask = (taskId) =>
  request("DELETE", `/task/${taskId}`);
export const searchTasks = (teamId, query = {}) =>
  request("GET", `/team/${teamId}/task`, null, query);

// --- Tags ---
export const addTagToTask = (taskId, tagName) =>
  request("POST", `/task/${taskId}/tag/${encodeURIComponent(tagName)}`);
export const removeTagFromTask = (taskId, tagName) =>
  request("DELETE", `/task/${taskId}/tag/${encodeURIComponent(tagName)}`);

// --- Comments ---
export const getTaskComments = (taskId) =>
  request("GET", `/task/${taskId}/comment`);
export const createTaskComment = (taskId, data) =>
  request("POST", `/task/${taskId}/comment`, data);
export const deleteComment = (commentId) =>
  request("DELETE", `/comment/${commentId}`);

// --- Attachments ---
export { uploadFile };
export const createTaskAttachment = (taskId, fileBuffer, fileName) =>
  uploadFile(`/task/${taskId}/attachment`, fileBuffer, fileName);

// --- Time Tracking ---
export const getTaskTimeEntries = (taskId) =>
  request("GET", `/task/${taskId}/time`);
export const startTimeEntry = (teamId, data) =>
  request("POST", `/team/${teamId}/time_entries/start`, data);
export const stopTimeEntry = (teamId) =>
  request("POST", `/team/${teamId}/time_entries/stop`);
export const addTimeEntry = (teamId, data) =>
  request("POST", `/team/${teamId}/time_entries`, data);
export const getRunningTimeEntry = (teamId, assignee) =>
  request("GET", `/team/${teamId}/time_entries/current`, null, { assignee });

// --- Members ---
export const getWorkspaceMembers = (teamId) =>
  request("GET", `/team/${teamId}`);

// --- Chat / Comments on views (v3 for chat, fallback) ---
export const getListComments = (listId) =>
  request("GET", `/list/${listId}/comment`);
export const createListComment = (listId, data) =>
  request("POST", `/list/${listId}/comment`, data);

// --- Docs (ClickUp API v3) ---
const BASE_URL_V3 = "https://api.clickup.com/api/v3";

async function requestV3(method, path, body = null, query = {}) {
  const url = new URL(`${BASE_URL_V3}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const opts = { method, headers: headers() };
  if (body && method !== "GET") opts.body = JSON.stringify(body);

  const res = await fetch(url.toString(), opts);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ClickUp API v3 ${res.status}: ${text}`);
  }
  if (!text) return {};
  return JSON.parse(text);
}

export const createDoc = (workspaceId, data) =>
  requestV3("POST", `/workspaces/${workspaceId}/docs`, data);
export const searchDocs = (workspaceId, query = {}) =>
  requestV3("GET", `/workspaces/${workspaceId}/docs`, null, query);
export const getDocPages = (workspaceId, docId) =>
  requestV3("GET", `/workspaces/${workspaceId}/docs/${docId}/pages`);
export const getDocPage = (workspaceId, docId, pageId) =>
  requestV3(
    "GET",
    `/workspaces/${workspaceId}/docs/${docId}/pages/${pageId}`
  );
export const createDocPage = (workspaceId, docId, data) =>
  requestV3("POST", `/workspaces/${workspaceId}/docs/${docId}/pages`, data);
export const updateDocPage = (workspaceId, docId, pageId, data) =>
  requestV3(
    "PUT",
    `/workspaces/${workspaceId}/docs/${docId}/pages/${pageId}`,
    data
  );
