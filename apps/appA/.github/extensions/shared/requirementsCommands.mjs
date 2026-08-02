/**
 * Requirements-agent command prompt builders.
 *
 * Pure functions returning the prompt text for each requirements command.
 * Separated from the extension entry point so the logic is testable and
 * the prompts are easy to audit independently.
 */

export const REQUIREMENTS_COMMAND_TIMEOUT_MS = 5 * 60 * 1_000;

function isHeadlessRequirementsSession() {
    return process.env.COPILOT_AGENT_HEADLESS === "true";
}

/**
 * Returns the prompt to inject when the user invokes a requirements slash-command.
 */
export function buildRequirementsCommandPrompt(commandName) {
    const headless = isHeadlessRequirementsSession();

    if (commandName === "preview") {
        return [
            "The user invoked /preview.",
            "Show the current task breakdown in a readable list for review.",
            "Do not create, edit, or delete any backlog items during this preview.",
            headless
                ? "Do not ask follow-up questions or request interactive input. If the preview is incomplete, note the gaps and continue with the best available understanding."
                : "Ask only the minimum follow-up questions if the plan is too incomplete to preview safely.",
        ].join(" ");
    }

    if (commandName === "handoff") {
        return [
            "The user invoked /handoff.",
            "If the backlog has not been created yet but the plan is approved, finalize it now using the registered MCP backlog tools.",
            "Then summarize the resulting backlog briefly and confirm that implementation can begin.",
            "Do not write files, shell scripts, or direct HTTP calls to reach MCP.",
            ...(headless
                ? [
                    "Do not ask follow-up questions or request interactive input during handoff.",
                    "If important details are still missing, make the smallest reasonable assumptions explicit and proceed autonomously.",
                ]
                : []),
        ].join(" ");
    }

    return [
        "The user invoked /finalize.",
        "If the task breakdown has been approved, create the backlog now using the registered MCP backlog tools.",
        "Do not write files, shell scripts, or direct HTTP calls to reach MCP.",
        headless
            ? "Do not ask follow-up questions or request interactive input. If crucial product information is still missing, make the smallest reasonable assumptions explicit and create the backlog anyway."
            : "If crucial product information is still missing, ask one concise follow-up question instead of creating the backlog prematurely.",
    ].join(" ");
}
