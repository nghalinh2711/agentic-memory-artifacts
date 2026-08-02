/**
 * Classifies delivery-pipeline orchestration prompts so they can be persisted
 * with messageType "pipeline" (excluded from fact extraction).
 */

export const PIPELINE_USER_PROMPT_PREFIXES = [
    "The user invoked /",
    "Work only from backlog \"",
    "Continue implementing backlog \"",
    "Run the backlog-driven task workflow now.",
    "Containerize the application in this workspace",
    "Resume runtime finalization for the app you just built",
];

export function isPipelineUserPrompt(prompt) {
    const text = String(prompt ?? "").trim();
    return PIPELINE_USER_PROMPT_PREFIXES.some((prefix) => text.startsWith(prefix));
}
