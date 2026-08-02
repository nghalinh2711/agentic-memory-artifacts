export declare function resolveMemoryToolName(
    toolName: unknown,
    knownToolNames?: string[],
): string;

export declare function buildMemoryToolArgs(
    toolName: unknown,
    rawArgs: Record<string, unknown>,
    agentContext: Record<string, unknown> | null | undefined,
    sessionId: string,
): Record<string, unknown>;
