export interface AgentContextConfig {
    project: string;
    task: string;
    domain?: string;
    taskId?: string;
}

export interface ResolvedAgentContext {
    project: string;
    role: string;
    task: string;
    timestamp: string;
    domain?: string;
    taskId?: string;
}

export interface ClaimedTaskContext {
    taskId: string;
    title: string;
    description?: string;
    task: string;
}

export declare const DEFAULT_AGENT_CONTEXT_PATH: string;

export declare function resolveAgentContextPath(workspaceRoot: string): string;

export declare function parseAgentContextConfig(value: unknown): AgentContextConfig | null;

export declare function loadAgentContext(filePath: string): AgentContextConfig | null;

export declare function resolveAgentTimestamp(value: unknown): string;

export declare function buildResolvedAgentContext(
    config: AgentContextConfig | null,
    role: unknown,
    timestamp: unknown,
    taskOverride?: unknown,
    taskIdOverride?: unknown,
): ResolvedAgentContext | null;

export declare function formatAgentContextBlock(
    context: ResolvedAgentContext | null,
): string;

export declare function toStoreAgentContext(
    context: ResolvedAgentContext | null | undefined,
): Pick<ResolvedAgentContext, "project" | "role" | "task"> | null;

export declare function appendAgentContextSearchParams(
    url: URL,
    agentContext?: ResolvedAgentContext | null,
): void;

export declare function appendStoreAgentContextSearchParams(
    url: URL,
    storeContext?: Pick<ResolvedAgentContext, "project" | "role" | "task"> | null,
): void;

export declare function matchesQualifiedToolName(toolName: unknown, expected: string): boolean;

export declare function matchesAnyQualifiedToolName(toolName: unknown, expectedNames: readonly string[]): boolean;

export declare function formatAgentTask(title: unknown, description?: unknown): string;

export declare function extractClaimedTaskContext(textResult: unknown): ClaimedTaskContext | null;

export declare function applyAgentContextToolUpdate(
    manager: {
        setAgentTaskOverride(task: string, taskId?: string): void;
        clearAgentTaskOverride(taskId?: string): void;
    },
    input: {
        toolName?: unknown;
        toolArgs?: unknown;
        toolResult?: {
            resultType?: unknown;
            textResultForLlm?: unknown;
        };
    },
): boolean;

export declare function persistAgentContextFile(
    workspaceRoot: string,
    contextFile: AgentContextConfig | null | undefined,
): boolean;