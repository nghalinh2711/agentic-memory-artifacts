import {MEMORY_TOOL_NAMES} from "./config.mjs";

export function resolveMemoryToolName(toolName, knownToolNames = MEMORY_TOOL_NAMES) {
    const normalized = String(toolName ?? "").trim();
    for (const name of knownToolNames) {
        if (
            normalized === name ||
            normalized.endsWith(`.${name}`) ||
            normalized.endsWith(`/${name}`)
        ) {
            return name;
        }
    }

    return normalized;
}

export function buildMemoryToolArgs(toolName, rawArgs, agentContext, sessionId) {
    const modifiedArgs = {
        ...rawArgs,
        sessionId,
    };

    if (!agentContext) {
        return modifiedArgs;
    }

    const resolvedToolName = resolveMemoryToolName(toolName);

    if (resolvedToolName === "save_memory") {
        return {
            ...modifiedArgs,
            project: agentContext.project,
            role: agentContext.role,
            task: agentContext.task,
        };
    }

    if (resolvedToolName === "search_memory") {
        return {
            ...modifiedArgs,
            project: agentContext.project,
            role: agentContext.role,
            task: agentContext.task,
            timestamp: agentContext.timestamp,
            ...(agentContext.domain ? {domain: agentContext.domain} : {}),
        };
    }

    return modifiedArgs;
}
