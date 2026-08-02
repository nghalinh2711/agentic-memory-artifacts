export declare function isWithinWorkspace(candidatePath: unknown, workspaceRoot: string): boolean;

export declare function findOutOfBoundsPathArg(
    value: unknown,
    workspaceRoot: string,
    ancestry?: string[],
): string | null;

export declare function findOutOfBoundsShellReference(
    command: unknown,
    workspaceRoot: string,
): string | null;

export declare function buildWorkspaceScopeViolation(
    toolName: string,
    detail: string,
    workspaceRoot: string,
): {
    permissionDecision: string;
    permissionDecisionReason: string;
    additionalContext: string;
};
