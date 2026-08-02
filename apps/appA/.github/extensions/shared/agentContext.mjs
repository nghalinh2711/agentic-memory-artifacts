import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, isAbsolute, join} from "node:path";

export const DEFAULT_AGENT_CONTEXT_PATH = "context/agent-context.json";

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value) {
    const normalized = normalizeString(value);
    return normalized || undefined;
}

function toOptionalProperty(key, value) {
    const normalized = normalizeOptionalString(value);
    return normalized ? {[key]: normalized} : {};
}

function buildAgentContextLines(context) {
    return [
        "<agent_context>",
        "You are working in the following agent context. You do not need to make additional tool calls to verify this.",
        "",
        `- Project: ${context.project}`,
        `- Role: ${context.role}`,
        ...(context.domain ? [`- Domain: ${context.domain}`] : []),
        `- Current task: ${context.task}`,
        ...(context.taskId ? [`- Task ID: ${context.taskId}`] : []),
        `- Session timestamp: ${context.timestamp}`,
        "</agent_context>",
    ];
}

export function resolveAgentContextPath(workspaceRoot) {
    const configuredPath =
        normalizeString(process.env.COPILOT_AGENT_CONTEXT_FILE) || DEFAULT_AGENT_CONTEXT_PATH;
    return isAbsolute(configuredPath) ? configuredPath : join(workspaceRoot, configuredPath);
}

export function parseAgentContextConfig(value) {
    if (!value || typeof value !== "object") {
        return null;
    }

    const candidate = value;
    const project = normalizeString(candidate.project);
    const task = normalizeString(candidate.task);
    if (!project || !task) {
        return null;
    }

    return {
        project,
        task,
        ...toOptionalProperty("domain", candidate.domain),
        ...toOptionalProperty("taskId", candidate.taskId),
        ...toOptionalProperty("contextQuery", candidate.contextQuery),
    };
}

export function loadAgentContext(filePath) {
    if (!existsSync(filePath)) {
        return null;
    }

    try {
        return parseAgentContextConfig(JSON.parse(readFileSync(filePath, "utf8")));
    } catch {
        return null;
    }
}

export function resolveAgentTimestamp(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }

    const normalized = normalizeString(value);
    return normalized || new Date().toISOString();
}

export function buildResolvedAgentContext(config, role, timestamp, taskOverride, taskIdOverride) {
    if (!config) {
        return null;
    }

    const normalizedRole = normalizeString(role);
    const task = normalizeString(taskOverride) || normalizeString(config.task);
    if (!normalizedRole || !task) {
        return null;
    }

    const taskId = normalizeOptionalString(taskIdOverride) ?? config.taskId;

    return {
        project: config.project,
        role: normalizedRole,
        task,
        timestamp: resolveAgentTimestamp(timestamp),
        ...(config.domain ? {domain: config.domain} : {}),
        ...(taskId ? {taskId} : {}),
    };
}

export function formatAgentContextBlock(context) {
    if (!context) {
        return "";
    }

    return buildAgentContextLines(context).join("\n");
}

export function toStoreAgentContext(context) {
    if (!context) {
        return null;
    }

    return {
        project: context.project,
        role: context.role,
        task: context.task,
    };
}

export function appendAgentContextSearchParams(url, agentContext) {
    if (!agentContext) {
        return;
    }

    url.searchParams.set("project", agentContext.project);
    url.searchParams.set("role", agentContext.role);
    url.searchParams.set("task", agentContext.task);
    url.searchParams.set("timestamp", agentContext.timestamp);

    if (agentContext.domain) {
        url.searchParams.set("domain", agentContext.domain);
    }
}

export function appendStoreAgentContextSearchParams(url, storeContext) {
    if (!storeContext) {
        return;
    }

    url.searchParams.set("project", storeContext.project);
    url.searchParams.set("role", storeContext.role);
    url.searchParams.set("task", storeContext.task);
}

export function matchesQualifiedToolName(toolName, expected) {
    return (
        toolName === expected ||
        toolName.endsWith(`.${expected}`) ||
        toolName.endsWith(`/${expected}`) ||
        toolName.endsWith(`__${expected}`)
    );
}

export function matchesAnyQualifiedToolName(toolName, expectedNames) {
    const normalized = normalizeString(toolName);
    return expectedNames.some((name) => matchesQualifiedToolName(normalized, name));
}

export function formatAgentTask(title, description) {
    const normalizedTitle = normalizeString(title);
    const normalizedDescription = normalizeOptionalString(description);

    if (!normalizedTitle) {
        return normalizedDescription ?? "";
    }

    return normalizedDescription
        ? `${normalizedTitle}: ${normalizedDescription}`
        : normalizedTitle;
}

export function extractClaimedTaskContext(textResult) {
    const match = String(textResult ?? "").trim().match(
        /^Claimed task "([^"]+)" \(([^)]+)\) and marked it in_progress\.(?: Acceptance criteria\/context: ([\s\S]+))?$/,
    );
    if (!match) {
        return null;
    }

    const [, title, taskId, description] = match;
    const task = formatAgentTask(title, description);
    if (!task) {
        return null;
    }

    return {
        taskId: normalizeString(taskId),
        title: normalizeString(title),
        ...toOptionalProperty("description", description),
        task,
    };
}

function matchesToolName(toolName, expected) {
    return matchesQualifiedToolName(normalizeString(toolName), expected);
}

function getTaskUpdate(toolArgs) {
    if (!toolArgs || typeof toolArgs !== "object") {
        return {};
    }

    const taskId = normalizeString(toolArgs.taskId);
    const state = normalizeString(toolArgs.state);

    return {
        ...(taskId ? {taskId} : {}),
        ...(state ? {state} : {}),
    };
}

export function applyAgentContextToolUpdate(manager, input) {
    const toolName = normalizeString(input?.toolName);
    const resultType = normalizeString(input?.toolResult?.resultType);
    if (resultType !== "success") {
        return false;
    }

    if (matchesToolName(toolName, "claim_next_task")) {
        const claimedTask = extractClaimedTaskContext(input?.toolResult?.textResultForLlm);
        if (!claimedTask) {
            return false;
        }

        manager.setAgentTaskOverride(claimedTask.task, claimedTask.taskId);
        return true;
    }

    if (matchesToolName(toolName, "update_task")) {
        const {taskId, state} = getTaskUpdate(input?.toolArgs);
        if (state === "done" || state === "to_do") {
            manager.clearAgentTaskOverride(taskId);
            return true;
        }
    }

    return false;
}

export function persistAgentContextFile(workspaceRoot, contextFile) {
    if (!contextFile || typeof contextFile !== "object") {
        return false;
    }

    const project = normalizeString(contextFile.project);
    const task = normalizeString(contextFile.task);
    if (!project || !task) {
        return false;
    }

    const payload = {
        project,
        task,
        ...toOptionalProperty("domain", contextFile.domain),
        ...toOptionalProperty("taskId", contextFile.taskId),
    };

    try {
        const filePath = resolveAgentContextPath(workspaceRoot);
        mkdirSync(dirname(filePath), {recursive: true});
        writeFileSync(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
        return true;
    } catch {
        return false;
    }
}