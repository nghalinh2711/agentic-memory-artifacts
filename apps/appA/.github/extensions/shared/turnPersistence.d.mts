import type {ResolvedAgentContext} from "./agentContext.mjs";

export interface TurnPersistenceSessionEvent {
    type: string;
    data?: Record<string, unknown>;
    timestamp?: string;
}

export interface TurnPersistenceSession {
    on(handler: (event: TurnPersistenceSessionEvent) => void): () => void;
}

export type AgentContextResolver = (timestamp: string) => ResolvedAgentContext | null;

export type HumanMessageTypeClassifier = (content: unknown) => "user" | "pipeline";

export interface AttachTurnPersistenceOptions {
    classifyHumanMessageType?: HumanMessageTypeClassifier;
    subTurnToolNames?: string[];
    debugLog?: (msg: string) => void;
    initialUserPrompt?: string;
}

export interface TurnPersistenceHandle {
    unsubscribe: () => void;
    flush: () => Promise<boolean>;
    recordAskUserAnswer: (question: unknown, answer: unknown, timestamp?: unknown) => void;
    setPendingUserMessage: (content: unknown, timestamp?: unknown) => void;
    clear: () => void;
}

export declare function attachTurnPersistence(
    session: TurnPersistenceSession,
    sessionId: string,
    resolveAgentContext?: AgentContextResolver | null,
    options?: AttachTurnPersistenceOptions,
): TurnPersistenceHandle;
