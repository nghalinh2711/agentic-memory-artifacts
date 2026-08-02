import type {ResolvedAgentContext} from "./agentContext.mjs";

export interface AdaptiveContextRelationshipStep {
    source: string;
    type: string;
    target: string;
    description?: string;
    factDescriptions?: string[];
}

export interface AdaptiveContextEntityPath {
    path: string;
    relationships?: AdaptiveContextRelationshipStep[];
}

export interface AdaptiveContextEntityMatch {
    id: string;
    name: string;
    description?: string;
    score: number;
}

export interface AdaptiveContextResponse {
    rules?: string[];
    memories?: string[];
    knowledge?: string[];
    insights?: string[];
    entityPaths?: AdaptiveContextEntityPath[];
    entityMatches?: AdaptiveContextEntityMatch[];
}

export declare function formatAdaptiveRules(context: AdaptiveContextResponse | null | undefined): string;

export declare function formatAdaptiveContextBlock(
    context: AdaptiveContextResponse | null | undefined,
): string;

export declare function fetchAdaptiveContext(
    sessionId: string,
    query: unknown,
    agentContext?: ResolvedAgentContext | null,
): Promise<AdaptiveContextResponse | null>;

export interface JournalMessageInput {
    source: "human" | "ai";
    content: string;
    timestamp?: string;
    messageType?: string;
}

export declare function appendJournalEntries(
    sessionId: string,
    messages: JournalMessageInput[],
    agentContext?: ResolvedAgentContext | null,
): Promise<boolean>;