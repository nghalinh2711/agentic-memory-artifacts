export interface ExtensionPromptManager {
    getAdaptiveRules(): string;

    getAdaptiveContext(): string;

    getAgentContext(): string;
}

export interface ExtensionPromptSectionAction {
    action: ((current: string) => string) | (() => string) | "append" | "remove";
    content?: string;
}

export interface ExtensionCustomizeSystemMessage {
    mode: "customize";
    sections: Record<string, ExtensionPromptSectionAction> & {
        last_instructions: ExtensionPromptSectionAction;
    };
}

export interface ExtensionReplaceSystemMessage {
    mode: "replace";
    content: string;
}

export type ExtensionSystemMessage =
    | ExtensionCustomizeSystemMessage
    | ExtensionReplaceSystemMessage;

export declare function buildRequirementsSystemMessage(
    manager: ExtensionPromptManager,
): ExtensionSystemMessage;

export declare function buildCodingSystemMessage(
    manager: ExtensionPromptManager,
): ExtensionCustomizeSystemMessage;

export declare function buildMemorySystemMessage(
    manager: ExtensionPromptManager,
): ExtensionCustomizeSystemMessage;

export declare function buildSystemMessage(
    role: string,
    manager: ExtensionPromptManager,
): ExtensionSystemMessage;

export declare function buildBacklogExecutionPrompt(backlog: {
    id: string;
    name: string;
}): string;