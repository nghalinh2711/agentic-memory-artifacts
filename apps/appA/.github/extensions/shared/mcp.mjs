import {
    CODING_BACKLOG_TOOL_NAMES,
    getMemoryMcpUrl,
    isBacklogEnabled,
    isMcpEnabled,
    isMemoryEnabled,
    MEMORY_TOOL_NAMES,
    REQUIREMENTS_BACKLOG_TOOL_NAMES,
} from "./config.mjs";
import {getMcpToken} from "./jwt.mjs";

function toolsForRole(role) {
    const tools = [];

    if (isMemoryEnabled()) {
        tools.push(...MEMORY_TOOL_NAMES);
    }

    if (isBacklogEnabled()) {
        if (role === "requirements") {
            tools.push(...REQUIREMENTS_BACKLOG_TOOL_NAMES);
        } else if (role === "coding") {
            tools.push(...CODING_BACKLOG_TOOL_NAMES);
        } else {
            // For "memory" role, include both backlog tool sets when backlog is enabled
            tools.push(...REQUIREMENTS_BACKLOG_TOOL_NAMES, ...CODING_BACKLOG_TOOL_NAMES);
        }
    }

    return tools;
}

export async function buildMcpServersIfConfigured(role) {
    if (!isMcpEnabled()) {
        return {mcpServers: undefined, setupError: null};
    }

    try {
        const token = await getMcpToken();
        return {
            mcpServers: {
                "agentic-memory": {
                    type: "http",
                    url: getMemoryMcpUrl(),
                    tools: toolsForRole(role),
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            },
            setupError: null,
        };
    } catch (error) {
        return {
            mcpServers: undefined,
            setupError: error instanceof Error ? error.message : String(error),
        };
    }
}
