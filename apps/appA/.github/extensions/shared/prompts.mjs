import {existsSync, readFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {isMemoryEnabled} from "./config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, "../../..");
const externalRepoRoot = String(process.env.COPILOT_EXTENSION_REPO_ROOT ?? "").trim();
const promptDirCandidates = [
    resolve(workspaceRoot, "src/copilot-sdk/prompts"),
    ...(externalRepoRoot ? [resolve(externalRepoRoot, "src/copilot-sdk/prompts")] : []),
];

function loadPrompt(name) {
    for (const promptDir of promptDirCandidates) {
        const promptPath = resolve(promptDir, name);
        if (existsSync(promptPath)) {
            return readFileSync(promptPath, "utf8").trim();
        }
    }

    throw new Error(`[adaptive-memory] Prompt file not found: ${name}`);
}

const MEMORY_SYSTEM_OVERVIEW = loadPrompt("memory-system-overview.md");
const MEMORY_TOOL_INSTRUCTIONS = loadPrompt("memory-tool-instructions.md");
const ADAPTIVE_CONTEXT_INSTRUCTIONS = loadPrompt("adaptive-context-instructions.md");
const REQUIREMENTS_AGENT_PROMPT = loadPrompt("requirements-agent.md");
const CODING_AGENT_BACKLOG_INSTRUCTIONS = loadPrompt("coding-agent-backlog-instructions.md");
const CODING_AGENT_README_INSTRUCTIONS = loadPrompt(
    "coding-agent-readme-instructions.md",
);
const ASK_USER_TOOL_INSTRUCTIONS = loadPrompt("ask-user-tool-instructions.md");
const HEADLESS_REQUIREMENTS_INSTRUCTIONS = [
    "This is a headless requirements session.",
    "Do not use ask_user or request interactive input.",
    "Rely only on the conversation turns that were already provided and the registered MCP tools.",
    "If details are still missing at finalize time, state the smallest reasonable assumptions explicitly and continue autonomously.",
].join(" ");

function buildAppendedSectionContent(content, tag) {
    if (!content) return "";
    if (tag) return `<${tag}>\n\n${content}\n\n</${tag}>`;
    return `\n\n${content}\n\n`;
}

function buildEnvironmentContextContent(manager) {
    return buildAppendedSectionContent(manager.getAgentContext());
}

function isHeadlessRequirementsSession() {
    return process.env.COPILOT_AGENT_HEADLESS === "true";
}

function buildCodingInstructionsContent(memoryEnabled = isMemoryEnabled(), includeBacklogInstructions = false) {
    const instructionBlocks = [
        memoryEnabled ? MEMORY_TOOL_INSTRUCTIONS : "",
        includeBacklogInstructions ? CODING_AGENT_BACKLOG_INSTRUCTIONS : "",
        CODING_AGENT_README_INSTRUCTIONS,
    ]
        .filter(Boolean)
        .join("\n\n");

    return buildAppendedSectionContent(instructionBlocks);
}

function buildAdaptiveContextInstructionsContent() {
    return buildAppendedSectionContent(ADAPTIVE_CONTEXT_INSTRUCTIONS);
}

function buildAdaptiveSystemSections(manager, options = {}) {
    const {
        conversationHistory,
        includeConversationHistory = false,
        memoryEnabled = isMemoryEnabled(),
        explicitContextMention = false,
    } = options;

    const sections = {
        last_instructions: {
            action: (current) => {
                let result = current;
                const adaptiveContext = manager.getAdaptiveContext();
                if (adaptiveContext) {
                    result = `${buildAppendedSectionContent(adaptiveContext, "adaptive_context")}${result}`;
                }
                if (includeConversationHistory && conversationHistory) {
                    result = `\n\n<conversation_history>\n${conversationHistory}\n</conversation_history>\n\n${result}`;
                }
                if (explicitContextMention) {
                    result +=
                        " Always mention explicitly in your response if you are using any of the above context or rules to generate your response.\n\n";
                }
                return result;
            },
        },
    };

    if (memoryEnabled) {
        sections.code_change_rules = {
            action: (current) => {
                const rules = manager.getAdaptiveRules();
                return rules
                    ? `${current}${buildAppendedSectionContent(rules, "adaptive_rules")}`
                    : current;
            },
        };
    }

    return sections;
}

const COPILOT_SYSTEM_MESSAGE_SECTIONS = [
    "identity",
    "tone",
    "tool_efficiency",
    "environment_context",
    "code_change_rules",
    "guidelines",
    "safety",
    "tool_instructions",
    "custom_instructions",
    "runtime_instructions",
];

function removeCopilotSystemSections() {
    return Object.fromEntries(
        COPILOT_SYSTEM_MESSAGE_SECTIONS.map((sectionId) => [sectionId, {action: "remove"}]),
    );
}

function buildRequirementsStaticContent(manager) {
    const parts = [REQUIREMENTS_AGENT_PROMPT];

    if (isHeadlessRequirementsSession()) {
        parts.push(buildAppendedSectionContent(HEADLESS_REQUIREMENTS_INSTRUCTIONS, "headless_requirements"));
    } else {
        parts.push(buildAppendedSectionContent(ASK_USER_TOOL_INSTRUCTIONS, "ask_user"));
    }

    const agentContext = manager.getAgentContext();
    if (agentContext) {
        parts.push(agentContext);
    }

    if (isMemoryEnabled()) {
        parts.push(
            [
                "<memory_instructions>",
                [MEMORY_SYSTEM_OVERVIEW, MEMORY_TOOL_INSTRUCTIONS, ADAPTIVE_CONTEXT_INSTRUCTIONS].join(
                    "\n\n",
                ),
                "</memory_instructions>",
            ].join("\n"),
        );
    }

    return parts.join("\n\n");
}

function appendRequirementsAdaptiveSuffix(content, manager) {
    let result = content;
    const rules = manager.getAdaptiveRules();

    if (rules) {
        result += buildAppendedSectionContent(rules, "adaptive_rules");
    }

    const adaptiveContext = manager.getAdaptiveContext();
    if (adaptiveContext) {
        result += buildAppendedSectionContent(adaptiveContext, "adaptive_context");
    }

    return result;
}

function buildRequirementsSystemPromptContent(manager) {
    return appendRequirementsAdaptiveSuffix(buildRequirementsStaticContent(manager), manager);
}

export function buildRequirementsSystemMessage(manager) {
    if (!isMemoryEnabled()) {
        return {
            mode: "replace",
            content: buildRequirementsSystemPromptContent(manager),
        };
    }

    return {
        mode: "customize",
        sections: {
            ...removeCopilotSystemSections(),
            last_instructions: {
                action: () => buildRequirementsSystemPromptContent(manager),
            },
        },
    };
}

export function buildCodingSystemMessage(manager) {
    const memoryEnabled = isMemoryEnabled();

    return {
        mode: "customize",
        sections: {
            tool_efficiency: {
                action: "append",
                content: memoryEnabled ? buildAppendedSectionContent(MEMORY_SYSTEM_OVERVIEW) : "",
            },
            environment_context: {
                action: "append",
                content: buildEnvironmentContextContent(manager),
            },
            tool_instructions: {
                action: "append",
                content: buildCodingInstructionsContent(memoryEnabled, true),
            },
            custom_instructions: {
                action: "append",
                content: memoryEnabled ? buildAdaptiveContextInstructionsContent() : "",
            },
            ...buildAdaptiveSystemSections(manager, {explicitContextMention: true}),
        },
    };
}

export function buildMemorySystemMessage(manager) {
    return {
        mode: "customize",
        sections: {
            environment_context: {
                action: "append",
                content: buildEnvironmentContextContent(manager),
            },
            tool_efficiency: {
                action: "append",
                content:
                    "This agent receives memory-derived context in an <adaptive_context> block each turn.",
            },
            tool_instructions: {
                action: "append",
                content: buildAppendedSectionContent(MEMORY_TOOL_INSTRUCTIONS),
            },
            custom_instructions: {
                action: "append",
                content: buildAdaptiveContextInstructionsContent(),
            },
            ...buildAdaptiveSystemSections(manager),
        },
    };
}

export function buildSystemMessage(role, manager) {
    if (role === "requirements") {
        return buildRequirementsSystemMessage(manager);
    }

    if (role === "coding") {
        return buildCodingSystemMessage(manager);
    }

    return buildMemorySystemMessage(manager);
}

export function buildBacklogExecutionPrompt(backlog) {
    return [
        `Work only from backlog "${backlog.name}" (backlogId="${backlog.id}").`,
        "Use claim_next_task as the primary task-acquisition mechanism.",
        "Always take the next available task, let claim_next_task put it into in_progress before you work on it, and then make sure you put it into done when the implementation is verified.",
        "For each claimed task, review any existing scratchpad notes, implement and verify the change, then call update_task to mark it done.",
        "After each completed task, call update_scratchpad with concise carry-forward notes before claiming the next task.",
        "If a task cannot be completed (missing dependency, missing information, or verification failure): mark it blocked via update_task, record the retry count in update_scratchpad keyed by taskId, then claim the next task via claim_next_task.",
        "When claim_next_task surfaces in_progress or blocked tasks: resolve in_progress tasks first, then retry blocked tasks with fewer than 3 retries (check scratchpad for retry count, set to in_progress, implement, verify, mark done).",
        "Retry a blocked task at most 3 times total. Never ask for user permission to retry.",
        "After the third failure, leave the task in blocked — it is exhaustively blocked.",
        "When claim_next_task reports no more claimable to_do tasks, call get_tasks and verify that no tasks remain in to_do, in_progress, or blocked.",
        "If any tasks still remain, stop and report them as unresolved instead of claiming the backlog is complete.",
    ].join(" ");
}
