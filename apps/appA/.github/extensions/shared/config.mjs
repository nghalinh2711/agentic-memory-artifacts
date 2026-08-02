const DEFAULT_MEMORY_BASE_URL = "https://v0-agentic-memory.vercel.app";
const DEFAULT_LOCAL_MEMORY_BASE_URL = "http://127.0.0.1:3000";

export const MEMORY_TOOL_NAMES = [
    "save_memory",
    "search_memory",
    "get_scratchpad",
    "update_scratchpad",
];

export const REQUIREMENTS_BACKLOG_TOOL_NAMES = [
    "create_backlog",
    "create_tasks",
    "get_tasks",
    "delete_task",
    "delete_backlog",
];

export const CODING_BACKLOG_TOOL_NAMES = [
    "list_backlogs",
    "claim_next_task",
    "get_tasks",
    "update_task",
];

export function getAgentRole() {
    const role = String(process.env.COPILOT_AGENT_ROLE ?? "").trim();
    return role === "requirements" || role === "coding" || role === "feedback"
        ? role
        : "memory";
}

export function getSessionId(role = getAgentRole()) {
    if (role === "requirements") {
        return (
            String(process.env.COPILOT_REQUIREMENTS_SESSION_ID ?? "").trim() ||
            "copilot-requirements-session"
        );
    }

    if (role === "coding") {
        return (
            String(process.env.COPILOT_CODING_SESSION_ID ?? "").trim() ||
            "copilot-coding-session"
        );
    }

    if (role === "feedback") {
        return (
            String(process.env.COPILOT_FEEDBACK_SESSION_ID ?? "").trim() ||
            "copilot-feedback-session"
        );
    }

    return (
        String(process.env.COPILOT_SESSION_ID ?? "").trim() ||
        String(process.env.COPILOT_CODING_SESSION_ID ?? "").trim() ||
        "copilot-memory-session"
    );
}

export function isMemoryEnabled() {
    return process.env.AGENT_MEMORY_ENABLED === "true";
}

export function isBacklogEnabled() {
    return process.env.AGENT_BACKLOG_ENABLED === "true";
}

export function isMcpEnabled() {
    return isMemoryEnabled() || isBacklogEnabled();
}

export function isRemoteMemory() {
    return process.env.REMOTE_MEMORY === "true";
}

function getVercelBypass() {
    return String(process.env.X_VERCEL_PROTECTION_BYPASS ?? "").trim();
}

/**
 * Appends `x-vercel-protection-bypass` as a query parameter when
 * {@link isRemoteMemory} returns true and `X_VERCEL_PROTECTION_BYPASS` is set.
 * Keeps the URL unchanged otherwise so the bypass is never leaked to
 * non-Vercel targets (e.g. localhost).
 *
 * The helper automatically uses `?` or `&` depending on whether the URL
 * already contains query parameters.
 */
export function appendVercelBypass(url) {
    if (!isRemoteMemory()) {
        return url;
    }

    const bypass = getVercelBypass();
    if (!bypass) {
        return url;
    }

    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
}

export function getMemoryBaseUrl() {
    const configured =
        String(process.env.AGENT_MEMORY_URL ?? "").trim() ||
        String(process.env.MEMORY_API_BASE_URL ?? "").trim();

    if (configured) {
        return configured.replace(/\/+$/, "");
    }

    return process.env.AGENT_MEMORY_ENABLED === "true"
        ? DEFAULT_MEMORY_BASE_URL
        : DEFAULT_LOCAL_MEMORY_BASE_URL;
}

export function getMemoryApiUrl() {
    return `${getMemoryBaseUrl()}/api`;
}

export function getMemoryMcpUrl() {
    return appendVercelBypass(`${getMemoryBaseUrl()}/mcp`);
}

export function getRequiredMemoryIdentity() {
    const agentId = String(process.env.AGENT_MEMORY_ID ?? "").trim();
    const secret = String(process.env.AGENT_MEMORY_SECRET ?? "").trim();

    if (!agentId || !secret) {
        throw new Error(
            "AGENT_MEMORY_ID and AGENT_MEMORY_SECRET must both be set for agentic-memory.",
        );
    }

    return {agentId, secret};
}
