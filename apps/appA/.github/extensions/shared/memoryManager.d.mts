import type {AgentContextConfig, ResolvedAgentContext} from "./agentContext.mjs";

export interface ExtensionMemoryManager {
    initializeAgentContext(config: AgentContextConfig | null, role: string): void;

    clearAdaptiveContext(): void;

    clearTurnContext(): void;

    setAdaptiveContext(ctx: string): void;

    setAdaptiveRules(rules: string): void;

    getAdaptiveContext(): string;

    getAdaptiveRules(): string;

    refreshAgentContext(timestamp: string): ResolvedAgentContext | null;

    getAgentContext(): string;

    getAgentContextFile(): AgentContextConfig | null;

    setAgentTaskOverride(task: string, taskId?: string): void;

    clearAgentTaskOverride(taskId?: string): void;

    clearAgentContext(): void;
}

export declare function createMemoryManager(): ExtensionMemoryManager;