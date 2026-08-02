export declare const MEMORY_TOOL_NAMES: string[];

export declare const REQUIREMENTS_BACKLOG_TOOL_NAMES: string[];

export declare const CODING_BACKLOG_TOOL_NAMES: string[];

export declare function getAgentRole(): string;

export declare function getSessionId(role?: string): string;

export declare function isMemoryEnabled(): boolean;

export declare function isBacklogEnabled(): boolean;

export declare function isMcpEnabled(): boolean;

export declare function isRemoteMemory(): boolean;

export declare function appendVercelBypass(url: string): string;

export declare function getMemoryBaseUrl(): string;

export declare function getMemoryApiUrl(): string;

export declare function getMemoryMcpUrl(): string;

export declare function getRequiredMemoryIdentity(): { agentId: string; secret: string };
