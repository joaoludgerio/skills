/**
 * Config manager — reads/writes config.json for onboarding defaults.
 * The API key is stored here after onboarding (no env var required).
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "..", "config.json");

const DEFAULT_CONFIG = {
  api_key: null,
  workspace_id: null,
  workspace_name: null,
  default_list_id: null,
  default_list_name: null,
  user_id: null,
  user_name: null,
  user_email: null,
  defaults: {
    assignee_self: true,
    priority: 3, // 1=Urgent, 2=High, 3=Normal, 4=Low
    tags: ["via-claude"],
    due_date_offset_days: 1,
  },
};

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return null;
  }
}

export function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export function getConfigPath() {
  return CONFIG_PATH;
}

/**
 * Get the API key from: env var (priority) → config.json → null
 */
export function getApiKey() {
  if (process.env.CLICKUP_API_KEY) {
    return process.env.CLICKUP_API_KEY;
  }
  const config = loadConfig();
  if (config?.api_key) {
    return config.api_key;
  }
  return null;
}

export { DEFAULT_CONFIG };
