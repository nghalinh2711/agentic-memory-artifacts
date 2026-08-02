/**
 * Copilot CLI repo extension — adaptive memory
 *
 * Demonstrates repo-level extensions under `.github/extensions/`:
 * - Injects retrieved memory into the system prompt each turn (section transforms)
 * - Requirements role uses replace-mode static prompt plus adaptive system sections
 * - Persists completed turns (user + assistant) to agentic-memory
 * - Registers role-specific agentic-memory MCP tools
 * - Supports requirements and coding agent roles for delivery pipeline runs
 *
 * Requires agentic-memory running locally and env:
 *   AGENT_MEMORY_ID, AGENT_MEMORY_SECRET (hex, >= 32 bytes)
 * Optional: MEMORY_API_BASE_URL (default http://127.0.0.1:3000)
 */

import {resolve} from "node:path";
import {approveAll} from "@github/copilot-sdk";
import {joinSession} from "@github/copilot-sdk/extension";
import {
    applyAgentContextToolUpdate,
    extractClaimedTaskContext,
    loadAgentContext,
    matchesAnyQualifiedToolName,
    matchesQualifiedToolName,
    persistAgentContextFile,
    resolveAgentContextPath,
    resolveAgentTimestamp,
} from "../shared/agentContext.mjs";
import {
    CODING_BACKLOG_TOOL_NAMES,
    getAgentRole,
    getSessionId,
    isBacklogEnabled,
    isMemoryEnabled,
    MEMORY_TOOL_NAMES,
    REQUIREMENTS_BACKLOG_TOOL_NAMES,
} from "../shared/config.mjs";
import {buildMcpServersIfConfigured} from "../shared/mcp.mjs";
import {fetchAdaptiveContext, formatAdaptiveContextBlock, formatAdaptiveRules,} from "../shared/memoryClient.mjs";
import {promptForUserInput} from "../shared/interactiveInput.mjs";
import {createMemoryManager} from "../shared/memoryManager.mjs";
import {buildMemoryToolArgs} from "../shared/memoryToolArgs.mjs";
import {buildBacklogExecutionPrompt, buildSystemMessage,} from "../shared/prompts.mjs";
import {recordHandoffRequest,} from "../shared/pipelineState.mjs";
import {isPipelineUserPrompt} from "../shared/pipelinePrompts.mjs";
import {buildRequirementsCommandPrompt, REQUIREMENTS_COMMAND_TIMEOUT_MS,} from "../shared/requirementsCommands.mjs";
import {attachTurnPersistence} from "../shared/turnPersistence.mjs";
import {
    buildWorkspaceScopeViolation,
    findOutOfBoundsPathArg,
    findOutOfBoundsShellReference,
} from "../shared/workspaceFence.mjs";

const WORKSPACE_ROOT = resolve(String(process.env.COPILOT_WORKING_DIRECTORY ?? process.cwd()));
let lastAdaptiveContextTaskId = null;

const REQUIREMENTS_BLOCKED_TOOL_NAMES = new Set([
    "bash",
    "create",
    "create_file",
    "delete",
    "delete_file",
    "edit",
    "powershell",
    "sql",
    "stop_powershell",
    "write_file",
    "write_powershell",
]);
const BACKLOG_TOOL_NAMES = [
    ...REQUIREMENTS_BACKLOG_TOOL_NAMES,
    ...CODING_BACKLOG_TOOL_NAMES,
];

function classifyHumanMessageType(content) {
    return isPipelineUserPrompt(content) ? "pipeline" : "user";
}

function parseTaskUpdateArgs(toolArgs) {
    if (!toolArgs || typeof toolArgs !== "object") {
        return {};
    }

    const taskId = typeof toolArgs.taskId === "string" ? toolArgs.taskId.trim() : undefined;
    const state = typeof toolArgs.state === "string" ? toolArgs.state.trim() : undefined;

    return {
        ...(taskId ? {taskId} : {}),
        ...(state ? {state} : {}),
    };
}

function loadConfiguredAgentContext() {
    return loadAgentContext(resolveAgentContextPath(WORKSPACE_ROOT));
}

const role = getAgentRole();
const memorySessionId = getSessionId(role);
const memoryManager = createMemoryManager();
memoryManager.initializeAgentContext(loadConfiguredAgentContext(), role);
const {mcpServers, setupError: mcpSetupError} = await buildMcpServersIfConfigured(role);
const headless = process.env.COPILOT_AGENT_HEADLESS === "true";

function isMemoryTool(toolName) {
    return matchesAnyQualifiedToolName(toolName, MEMORY_TOOL_NAMES);
}

function isBacklogTool(toolName) {
    return matchesAnyQualifiedToolName(toolName, BACKLOG_TOOL_NAMES);
}

function isAskUserTool(toolName) {
    return matchesQualifiedToolName(String(toolName ?? ""), "ask_user");
}

function isRequirementsBlockedTool(toolName) {
    return REQUIREMENTS_BLOCKED_TOOL_NAMES.has(String(toolName ?? "").trim().toLowerCase());
}

function buildMcpUnavailableContext() {
    if (mcpServers) {
        return "";
    }

    const required = [
        "AGENT_MEMORY_ID",
        "AGENT_MEMORY_SECRET",
    ];

    const enableFlags = [];
    if (!isMemoryEnabled() && !isBacklogEnabled()) {
        enableFlags.push("AGENT_MEMORY_ENABLED=true and/or AGENT_BACKLOG_ENABLED=true");
    }

    const instructions = enableFlags.length > 0
        ? ` (set ${enableFlags.join("; ")} plus ${required.join(" and ")})`
        : ` (set ${required.join(" and ")})`;

    return [
        "The agentic-memory MCP tools are unavailable in this session.",
        `Setup error: ${mcpSetupError ?? "agentic-memory MCP is not configured for this session."}${instructions}`,
        "Do not try to recreate the MCP calls with shell commands, helper scripts, or manual HTTP requests.",
        "If the task depends on these tools, explain the failure clearly and stop.",
    ].join(" ");
}

function buildWorkspaceScopeContext() {
    return [
        `The workspace root for this session is "${WORKSPACE_ROOT}".`,
        "Do not access parent directories or absolute paths outside this workspace.",
        "All file reads, edits, searches, and shell commands must stay within this workspace boundary.",
    ].join(" ");
}

async function handleRequirementsCommand(commandName) {
    await session.sendAndWait(
        {prompt: buildRequirementsCommandPrompt(commandName)},
        REQUIREMENTS_COMMAND_TIMEOUT_MS,
    );
}

function buildAdaptiveAdditionalContext(context) {
    const adaptiveBlock = formatAdaptiveContextBlock(context);
    const activeRules = formatAdaptiveRules(context);
    const parts = [];

    if (activeRules) {
        parts.push(`<adaptive_rules>\n${activeRules}\n</adaptive_rules>`);
    }

    if (adaptiveBlock) {
        parts.push(adaptiveBlock);
    }

    return parts.join("\n\n");
}

function storeAdaptiveContextInManager(context) {
    memoryManager.clearAdaptiveContext();

    if (!context || typeof context !== "object") {
        return "";
    }

    const adaptiveBlock = formatAdaptiveContextBlock(context);
    const activeRules = formatAdaptiveRules(context);

    if (adaptiveBlock) {
        memoryManager.setAdaptiveContext(adaptiveBlock);
    }

    if (activeRules) {
        memoryManager.setAdaptiveRules(activeRules);
    }

    return buildAdaptiveAdditionalContext(context);
}

async function refreshAdaptiveContextForTask(query, timestamp, {onUrl} = {}) {
    if (!isMemoryEnabled()) {
        return "";
    }

    const agentContext = memoryManager.refreshAgentContext(timestamp);
    const context = await fetchAdaptiveContext(memorySessionId, query, agentContext, {onUrl});
    return storeAdaptiveContextInManager(context);
}

function buildUserInputRequestHandler(turnPersistenceRef) {
    if (headless) {
        return async (request) => {
            const question = request.question ?? "";
            if (/blocked|blocker|stuck|cannot proceed|hit a wall/i.test(question)) {
                return "Continue to the next task via claim_next_task. Retry all blocked tasks after all to_do tasks are complete. Do not ask again about blocked tasks — handle them autonomously.";
            }
            throw new Error(
                `[headless] interactive input requested: ${request.question ?? "unknown question"}`,
            );
        };
    }

    if (role !== "requirements") {
        return undefined;
    }

    return async (request) => {
        const response = await promptForUserInput(request);
        turnPersistenceRef.current?.recordAskUserAnswer(
            request.question,
            response.answer,
            new Date().toISOString(),
        );
        return response;
    };
}

async function handleCodingTaskContextRefresh(input) {
    if (role !== "coding" || !isMemoryEnabled()) {
        return undefined;
    }

    if (String(input.toolResult?.resultType ?? "") !== "success") {
        return undefined;
    }

    const toolName = String(input.toolName ?? "");
    const timestamp = resolveAgentTimestamp(input.timestamp);
    let query = null;
    let taskId = null;

    if (matchesQualifiedToolName(toolName, "claim_next_task")) {
        const claimedTask = extractClaimedTaskContext(input.toolResult?.textResultForLlm);
        if (!claimedTask) {
            return undefined;
        }

        taskId = claimedTask.taskId;
        if (taskId && taskId === lastAdaptiveContextTaskId) {
            return undefined;
        }

        query = `Implement: ${claimedTask.task}`;
    } else if (matchesQualifiedToolName(toolName, "update_task")) {
        const {taskId: updatedTaskId, state} = parseTaskUpdateArgs(input.toolArgs);
        if (state !== "done" || !updatedTaskId) {
            return undefined;
        }

        taskId = updatedTaskId;
        query = `Completed task ${updatedTaskId}. Continue backlog implementation.`;
    } else {
        return undefined;
    }

    const adaptiveContext = await refreshAdaptiveContextForTask(query, timestamp, {
        onUrl: (msg) => session.log(msg, {ephemeral: true}),
    });

    if (taskId) {
        lastAdaptiveContextTaskId = taskId;
    }

    if (!adaptiveContext) {
        return undefined;
    }

    await session.log(
        `[adaptive-context] refreshed after ${matchesQualifiedToolName(toolName, "claim_next_task") ? "claim_next_task" : "update_task"}`,
        {ephemeral: true},
    );

    return {additionalContext: adaptiveContext};
}

function buildCommands() {
    const commands = [
        {
            name: "memory-help",
            description: "Describe how the adaptive-memory extension works",
            handler: async () => {
                await session.log(
                    [
                        "adaptive-memory extension:",
                        "  - Each prompt fetches context and injects it into the system prompt.",
                        "  - Completed turns persist to agentic-memory on assistant.turn_end.",
                        "  - Coding refreshes adaptive context after claim_next_task.",
                        "  - Roles: memory, requirements, coding.",
                        "  - Env: COPILOT_AGENT_ROLE, AGENT_MEMORY_ID, AGENT_MEMORY_SECRET.",
                        "  - Feature flags: AGENT_MEMORY_ENABLED (memory), AGENT_BACKLOG_ENABLED (backlog).",
                    ].join("\n"),
                );
            },
        },
    ];

    if (role === "requirements") {
        commands.push(
            {
                name: "preview",
                description: "Show the current task breakdown without creating a backlog",
                handler: async () => {
                    await handleRequirementsCommand("preview");
                },
            },
            {
                name: "finalize",
                description: "Create the approved backlog and tasks via MCP",
                handler: async () => {
                    await handleRequirementsCommand("finalize");
                },
            },
            {
                name: "handoff",
                description: "Finalize if needed and continue to implementation",
                handler: async () => {
                    await handleRequirementsCommand("handoff");
                    const pipelineStatePath = String(process.env.DELIVERY_PIPELINE_STATE_PATH ?? "").trim();

                    if (pipelineStatePath) {
                        await recordHandoffRequest(pipelineStatePath);
                    }

                    await session.log(
                        pipelineStatePath
                            ? "Handoff requested — the delivery runner will discover the backlog via Phase B and switch to implementation automatically."
                            : "Handoff complete. Exit this session to continue with implementation.",
                        {level: "info"},
                    );
                },
            },
        );
    }

    if (role === "coding") {
        commands.push({
            name: "implement",
            description: "Start autonomous backlog execution for the configured backlog",
            handler: async () => {
                const backlogId = String(process.env.DELIVERY_BACKLOG_ID ?? "").trim();
                const backlogName = String(process.env.DELIVERY_BACKLOG_NAME ?? "").trim();

                if (backlogId && backlogName) {
                    await session.send({
                        prompt: buildBacklogExecutionPrompt({
                            id: backlogId,
                            name: backlogName,
                        }),
                    });
                    return;
                }

                await session.send({
                    prompt:
                        "Run the backlog-driven task workflow now. If no backlogId was provided, use list_backlogs to resolve the backlog scope.",
                });
            },
        });
    }

    return commands;
}

const turnPersistenceRef = {current: null};
let initialUserPrompt = null;
let initialUserPromptTimestamp = null;
const userInputRequestHandler = buildUserInputRequestHandler(turnPersistenceRef);

const session = await joinSession({
    onPermissionRequest: approveAll,
    ...(userInputRequestHandler ? {onUserInputRequest: userInputRequestHandler} : {}),
    systemMessage: buildSystemMessage(role, memoryManager),

    commands: buildCommands(),

    hooks: {
        onSessionStart: async (input) => {
            turnPersistenceRef.current?.clear();
            lastAdaptiveContextTaskId = null;
            const prompt = String(input?.initialPrompt ?? "").trim();
            if (prompt) {
                initialUserPrompt = prompt;
                initialUserPromptTimestamp = new Date().toISOString();
            }

            memoryManager.initializeAgentContext(
                loadConfiguredAgentContext(),
                role,
            );
            const mcpNote = mcpServers
                ? `MCP tools registered (memory=${isMemoryEnabled()}, backlog=${isBacklogEnabled()}).`
                : `MCP tools unavailable${mcpSetupError ? `: ${mcpSetupError}` : " (set AGENT_MEMORY_ENABLED=true and/or AGENT_BACKLOG_ENABLED=true plus AGENT_MEMORY_ID and AGENT_MEMORY_SECRET)."}`;
            await session.log(
                `adaptive-memory extension active (role=${role}, memorySession=${memorySessionId}) - type /memory-help. ${mcpNote}`,
                {level: "info"},
            );

            return {
                additionalContext: [buildWorkspaceScopeContext(), buildMcpUnavailableContext()]
                    .filter(Boolean)
                    .join("\n\n"),
            };
        },

        onPreToolUse: async (input) => {
            const rawArgs =
                input.toolArgs && typeof input.toolArgs === "object" ? input.toolArgs : {};
            const outOfBoundsPathArg = findOutOfBoundsPathArg(rawArgs, WORKSPACE_ROOT);
            if (outOfBoundsPathArg) {
                return buildWorkspaceScopeViolation(input.toolName, outOfBoundsPathArg, WORKSPACE_ROOT);
            }

            if (
                (String(input.toolName ?? "").includes("bash") ||
                    String(input.toolName ?? "").includes("powershell")) &&
                typeof rawArgs.command === "string"
            ) {
                const outOfBoundsShellReference = findOutOfBoundsShellReference(rawArgs.command, WORKSPACE_ROOT);
                if (outOfBoundsShellReference) {
                    return buildWorkspaceScopeViolation(
                        input.toolName,
                        `command references ${outOfBoundsShellReference}`,
                        WORKSPACE_ROOT,
                    );
                }
            }

            if (isMemoryTool(String(input.toolName ?? ""))) {
                const toolName = String(input.toolName ?? "");
                const agentContext = memoryManager.refreshAgentContext(
                    resolveAgentTimestamp(input.timestamp),
                );
                return {
                    modifiedArgs: buildMemoryToolArgs(
                        toolName,
                        rawArgs,
                        agentContext,
                        memorySessionId,
                    ),
                };
            }

            if (headless && isAskUserTool(input.toolName)) {
                return {
                    permissionDecision: "deny",
                    permissionDecisionReason:
                        "Headless sessions cannot use ask_user or request interactive input.",
                    additionalContext:
                        "Continue autonomously. Use the conversation context already provided and make the smallest reasonable assumptions explicit instead of calling ask_user.",
                };
            }

            if (role === "requirements" && isRequirementsBlockedTool(input.toolName)) {
                return {
                    permissionDecision: "deny",
                    permissionDecisionReason:
                        "Requirements mode is read-only except for the registered MCP backlog tools.",
                    additionalContext:
                        "Requirements mode must not write files, run shell commands, or create helper scripts. Use the registered MCP tools or continue the requirements conversation.",
                };
            }

            return undefined;
        },

        onPostToolUse: async (input) => {
            const updated = applyAgentContextToolUpdate(memoryManager, input);
            if (updated) {
                const contextFile = memoryManager.getAgentContextFile();
                if (contextFile) {
                    const persisted = persistAgentContextFile(WORKSPACE_ROOT, contextFile);
                    if (persisted) {
                        await session.log(
                            `[agent-context] persisted updated task to agent-context.json`,
                            {ephemeral: true},
                        );
                    }
                }
            }

            // Capture ask_user Q&A pairs via onPostToolUse since the Copilot SDK
            // does not route ask_user through onUserInputRequest for this version.
            // Without this, ask_user questions and user answers are never persisted.
            const toolName = String(input.toolName ?? "");
            if (toolName === "ask_user" || toolName.endsWith("__ask_user")) {
                try {
                    const args = typeof input.toolArgs === "string"
                        ? JSON.parse(input.toolArgs)
                        : (input.toolArgs || {});
                    const question = String(args.message ?? "").trim();
                    const answer = String(input.toolResult?.textResultForLlm ?? "").trim();
                    if (question && answer) {
                        turnPersistenceRef.current?.recordAskUserAnswer(
                            question,
                            answer,
                            new Date().toISOString(),
                        );
                    }
                } catch (err) {
                    await session.log(
                        `[turn-persistence] failed to parse ask_user args: ${String(err)}`,
                        {ephemeral: true},
                    );
                }
            }

            return handleCodingTaskContextRefresh(input);
        },

        onPostToolUseFailure: async (input) => {
            if (isMemoryTool(String(input.toolName ?? "")) || isBacklogTool(String(input.toolName ?? ""))) {
                return {
                    additionalContext:
                        "A memory or backlog MCP tool failed. Do not create helper scripts or manual HTTP requests to work around MCP. Report the failure clearly and stop.",
                };
            }

            return undefined;
        },

        onUserPromptSubmitted: async (input, _invocation) => {
            const prompt = String(input.prompt ?? "").trim();
            if (!prompt) {
                return {modifiedPrompt: input.prompt};
            }

            const config = loadConfiguredAgentContext();
            const searchQuery = config?.contextQuery || prompt;
            const promptTimestamp = resolveAgentTimestamp(input.timestamp);
            const agentContext = memoryManager.refreshAgentContext(promptTimestamp);

            const context = await fetchAdaptiveContext(memorySessionId, searchQuery, agentContext, {
                onUrl: (msg) => session.log(msg, {ephemeral: true}),
            });
            const adaptiveContext = storeAdaptiveContextInManager(context);

            if (adaptiveContext) {
                await session.log("Injected adaptive memory context into system prompt", {ephemeral: true});
                await session.log(adaptiveContext, {ephemeral: true});
            }

            return {modifiedPrompt: input.prompt};
        },

        onErrorOccurred: async (input) => {
            if (input.recoverable && input.errorContext === "model_call") {
                return {errorHandling: "retry", retryCount: 2};
            }

            return {
                errorHandling: "abort",
                userNotification: `An error occurred: ${input.error}`,
            };
        },
    },

    ...(mcpServers ? {mcpServers} : {}),
});

const subTurnToolNames = role === "requirements"
    ? [...BACKLOG_TOOL_NAMES, "ask_user", ...MEMORY_TOOL_NAMES]
    : [...BACKLOG_TOOL_NAMES, ...MEMORY_TOOL_NAMES];

turnPersistenceRef.current = attachTurnPersistence(
    session,
    memorySessionId,
    (timestamp) => memoryManager.refreshAgentContext(timestamp),
    {
        classifyHumanMessageType,
        subTurnToolNames,
        initialUserPrompt: initialUserPrompt ?? undefined,
        debugLog: (msg) => session.log(`[turn-persistence] ${msg}`, {ephemeral: true}).catch(() => {
        }),
    },
);

// Inject the initial user prompt that was captured in onSessionStart.
// The session.on listener was registered too late to catch user.message.
if (initialUserPrompt) {
    await session.log(
        `[turn-persistence] initial user prompt provided via attachTurnPersistence (len=${initialUserPrompt.length})`,
        {ephemeral: true},
    );
    initialUserPrompt = null;
    initialUserPromptTimestamp = null;
}
