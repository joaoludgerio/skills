# ClickUp MCP Server

Local MCP (Model Context Protocol) server for ClickUp, using **personal API Key** authentication. Designed for Claude Code but compatible with any MCP client.

Unlike OAuth-based integrations, this MCP uses your personal API token — giving you access to **all your lists, including personal and private ones**.

> **Credentials are personal.** Each person uses their own ClickUp API key. No credentials are included in this repository.

## Features

- **36 tools** covering tasks, comments, time tracking, documents, chat, and workspace management
- **One-step onboarding** — just provide your API key and everything configures automatically
- **Personal/private list access** — full visibility via API Key
- **Default task rules** — auto-assign, default priority, tags, and due dates
- **No env var required** — API key is stored locally in config.json after onboarding

## Quick Start

### 1. Install

```bash
git clone https://github.com/ericlucianoferreira/clickup-mcp.git
cd clickup-mcp
npm install
```

### 2. Add to Claude Code

Add this to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "clickup-local": {
      "type": "stdio",
      "command": "node",
      "args": ["C:\\path\\to\\clickup-mcp\\index.js"]
    }
  }
}
```

**That's it.** No API key in the config — the onboarding handles everything.

Linux/Mac:
```json
"args": ["/home/user/clickup-mcp/index.js"]
```

### 3. Run onboarding

Start a new Claude Code session and say:

> "Configure the ClickUp MCP with my API key: pk_YOUR_KEY_HERE"

The onboarding will automatically:
- Validate your API key
- Identify your user account
- Discover all workspaces
- List all spaces, folders, and lists (including personal/private)
- Save everything to `config.json`

### Getting your API Key

1. Open ClickUp
2. Click your **avatar** (bottom-left)
3. Go to **Settings**
4. Click **Apps** in the sidebar
5. Copy your **API Token** (starts with `pk_`)

## Alternative: API Key via Environment Variable

You can also pass the API key as an env var (takes priority over config.json):

```json
{
  "mcpServers": {
    "clickup-local": {
      "type": "stdio",
      "command": "node",
      "args": ["C:\\path\\to\\clickup-mcp\\index.js"],
      "env": {
        "CLICKUP_API_KEY": "pk_YOUR_KEY"
      }
    }
  }
}
```

## Available Tools (36)

### Setup (1)
| Tool | Description |
|------|-------------|
| `clickup_onboarding` | Setup / reconfigure the MCP |

### Search & Navigation (2)
| Tool | Description |
|------|-------------|
| `clickup_search` | Search tasks across workspace (client-side text filter) |
| `clickup_get_workspace_hierarchy` | View full hierarchy: spaces → folders → lists |

### Tasks (7)
| Tool | Description |
|------|-------------|
| `clickup_create_task` | Create task (uses config defaults for list, assignee, priority, tags, due date) |
| `clickup_get_task` | Get full task details including subtasks, custom fields, markdown description |
| `clickup_update_task` | Update any task field (name, status, priority, assignees, dates, custom fields) |
| `clickup_list_tasks` | List tasks in a list with filters (status, assignee, pagination) |
| `clickup_delete_task` | Permanently delete a task |
| `clickup_add_tag_to_task` | Add tag to task |
| `clickup_remove_tag_from_task` | Remove tag from task |

### Lists & Folders (7)
| Tool | Description |
|------|-------------|
| `clickup_get_list` | Get list details |
| `clickup_create_list` | Create list in a space (folderless) |
| `clickup_create_list_in_folder` | Create list inside a folder |
| `clickup_update_list` | Update list name, content or status |
| `clickup_get_folder` | Get folder details |
| `clickup_create_folder` | Create folder in a space |
| `clickup_update_folder` | Update folder name |

### Members (3)
| Tool | Description |
|------|-------------|
| `clickup_get_workspace_members` | List all workspace members with IDs and roles |
| `clickup_find_member_by_name` | Find member by partial name or email |
| `clickup_resolve_assignees` | Resolve names to user IDs (useful before creating tasks) |

### Comments & Files (4)
| Tool | Description |
|------|-------------|
| `clickup_get_task_comments` | Get all comments on a task |
| `clickup_create_task_comment` | Add comment to task |
| `clickup_delete_comment` | Delete a comment by ID |
| `clickup_attach_task_file` | Upload file attachment to task |

### Time Tracking (5)
| Tool | Description |
|------|-------------|
| `clickup_get_task_time_entries` | Get time entries for a task |
| `clickup_start_time_tracking` | Start timer on a task |
| `clickup_stop_time_tracking` | Stop current running timer |
| `clickup_add_time_entry` | Add manual time entry |
| `clickup_get_current_time_entry` | Get currently running timer |

### Documents — API v3 (5)
| Tool | Description |
|------|-------------|
| `clickup_create_document` | Create a ClickUp Doc (with optional initial page) |
| `clickup_list_document_pages` | List all pages in a doc |
| `clickup_get_document_pages` | Get content of a specific page |
| `clickup_create_document_page` | Create new page in a doc |
| `clickup_update_document_page` | Update page content (modes: replace / append / prepend) |

### Chat (2)
| Tool | Description |
|------|-------------|
| `clickup_get_chat_channels` | List chat channels |
| `clickup_send_chat_message` | Send message to a chat channel |

## Config File

After onboarding, a `config.json` is created locally (gitignored):

```json
{
  "api_key": "pk_...",
  "workspace_id": "1234567",
  "workspace_name": "My Workspace",
  "default_list_id": "900100200300",
  "default_list_name": "My Personal List",
  "user_id": "12345678",
  "user_name": "Eric",
  "user_email": "eric@example.com",
  "defaults": {
    "assignee_self": true,
    "priority": 3,
    "tags": ["via-claude"],
    "due_date_offset_days": 1
  }
}
```

## License

MIT
