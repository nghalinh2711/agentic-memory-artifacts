/**
 * Transient per-turn holder for adaptive memory injected into the system prompt.
 * Mirrors src/copilot-sdk/memory/manager.ts — updated in onUserPromptSubmitted,
 * read by system-message section transforms before each model call.
 */
import {buildResolvedAgentContext, formatAgentContextBlock,} from "./agentContext.mjs";

export function createMemoryManager() {
    let adaptiveContext = "";
    let adaptiveRules = "";
    let agentContext = "";
    let agentContextConfig = null;
    let agentRole = "";
    let agentTaskOverride = null;

    return {
        initializeAgentContext(config, role) {
            agentContextConfig = config ? {...config} : null;
            agentRole = String(role ?? "").trim();
            agentTaskOverride = null;
            agentContext = "";
        },
        clearAdaptiveContext() {
            adaptiveContext = "";
            adaptiveRules = "";
        },
        clearTurnContext() {
            adaptiveContext = "";
            adaptiveRules = "";
            agentContext = "";
        },
        setAdaptiveContext(ctx) {
            adaptiveContext = ctx;
        },
        setAdaptiveRules(rules) {
            adaptiveRules = rules;
        },
        getAdaptiveContext() {
            return adaptiveContext;
        },
        getAdaptiveRules() {
            return adaptiveRules;
        },
        refreshAgentContext(timestamp) {
            const taskId = agentTaskOverride?.taskId;
            const resolved = buildResolvedAgentContext(
                agentContextConfig
                    ? {
                        ...agentContextConfig,
                        task: agentTaskOverride?.task ?? agentContextConfig.task,
                    }
                    : null,
                agentRole,
                timestamp,
                undefined,
                taskId,
            );
            agentContext = formatAgentContextBlock(resolved);
            return resolved;
        },
        getAgentContext() {
            return agentContext;
        },
        getAgentContextFile() {
            if (!agentContextConfig) {
                return null;
            }

            const taskId = agentTaskOverride?.taskId ?? agentContextConfig.taskId;

            return {
                project: agentContextConfig.project,
                task: agentTaskOverride?.task ?? agentContextConfig.task,
                ...(agentContextConfig.domain
                    ? {domain: agentContextConfig.domain}
                    : {}),
                ...(taskId ? {taskId} : {}),
            };
        },
        setAgentTaskOverride(task, taskId) {
            const normalizedTask = String(task ?? "").trim();
            if (!normalizedTask) {
                return;
            }

            agentTaskOverride = {
                task: normalizedTask,
                ...(String(taskId ?? "").trim() ? {taskId: String(taskId).trim()} : {}),
            };
        },
        clearAgentTaskOverride(taskId) {
            if (!agentTaskOverride) {
                return;
            }

            const normalizedTaskId = String(taskId ?? "").trim();
            if (
                normalizedTaskId &&
                agentTaskOverride.taskId &&
                agentTaskOverride.taskId !== normalizedTaskId
            ) {
                return;
            }

            agentTaskOverride = null;
        },
        clearAgentContext() {
            agentContext = "";
            agentContextConfig = null;
            agentRole = "";
            agentTaskOverride = null;
        },
    };
}
