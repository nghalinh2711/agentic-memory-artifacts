import {isMemoryEnabled} from "./config.mjs";
import {appendJournalEntries} from "./memoryClient.mjs";

/**
 * Strip the "User responded: " prefix that the Copilot SDK prepends to
 * ask_user tool result text. Also handles the "User responded:\n" variant.
 */
function cleanAskUserAnswer(raw) {
    const text = String(raw ?? "").trim();
    return text.replace(/^User responded:\s*/i, "").trim();
}

function formatAskUserAnswerContent(question, answer) {
    const normalizedQuestion = String(question ?? "").trim();
    const normalizedAnswer = String(answer ?? "").trim();
    return [
        `Agent question: ${normalizedQuestion}`,
        `User answer: ${normalizedAnswer}`,
    ].join("\n");
}

async function persistHumanEntry(sessionId, content, timestamp, messageType, resolveAgentContext, log) {
    const text = String(content ?? "").trim();
    if (!text) {
        log("[turn-persistence] persistHuman SKIPPED: empty content");
        return false;
    }

    const agentContext = resolveAgentContext?.(timestamp) ?? null;
    return await appendJournalEntries(sessionId, [{
        source: "human",
        content: text,
        timestamp,
        messageType,
    }], agentContext);
}

async function persistAiEntry(sessionId, content, timestamp, messageType, resolveAgentContext, log) {
    const text = String(content ?? "").trim();
    const agentContext = resolveAgentContext?.(timestamp) ?? null;
    return await appendJournalEntries(sessionId, [{
        source: "ai",
        content: text,
        timestamp,
        messageType,
    }], agentContext);
}

export function attachTurnPersistence(
    session,
    sessionId,
    resolveAgentContext,
    {classifyHumanMessageType, debugLog, initialUserPrompt} = {},
) {
    if (!isMemoryEnabled()) {
        return {
            unsubscribe: () => {},
            flush: async () => false,
            recordAskUserAnswer: () => {},
            setPendingUserMessage: () => {
            },
            clear: () => {},
        };
    }

    const log = typeof debugLog === "function" ? debugLog : () => {
    };

    let pendingAssistantMessages = [];

    function clearBuffer() {
        pendingAssistantMessages = [];
    }

    function resolveHumanMessageType(content) {
        const classified = classifyHumanMessageType?.(content);
        return classified === "pipeline" ? "pipeline" : "user";
    }

    if (typeof initialUserPrompt === "string" && initialUserPrompt.trim()) {
        const msgType = resolveHumanMessageType(initialUserPrompt);
        void persistHumanEntry(
            sessionId,
            initialUserPrompt,
            new Date().toISOString(),
            msgType,
            resolveAgentContext,
            log,
        );
    }

    function recordAskUserAnswer(question, answer, timestamp) {
        const normalizedQuestion = String(question ?? "").trim();
        const normalizedAnswer = cleanAskUserAnswer(answer);
        if (!normalizedQuestion && !normalizedAnswer) {
            log("[turn-persistence] recordAskUserAnswer SKIPPED: empty question and answer");
            return;
        }

        const content = formatAskUserAnswerContent(normalizedQuestion, normalizedAnswer);
        const ts = String(timestamp ?? new Date().toISOString());
        void persistHumanEntry(sessionId, content, ts, "ask_user_interaction", resolveAgentContext, log);
    }

    function setPendingUserMessage(content, timestamp) {
        const text = String(content ?? "").trim();
        if (!text) {
            return;
        }

        const msgType = resolveHumanMessageType(text);
        const ts = String(timestamp ?? new Date().toISOString());
        void persistHumanEntry(sessionId, text, ts, msgType, resolveAgentContext, log);
    }

    const unsubscribe = session.on((event) => {
        switch (event.type) {
            case "user.message":
                if (!event.data?.source) {
                    const msgType = resolveHumanMessageType(event.data.content);
                    void persistHumanEntry(
                        sessionId,
                        event.data.content,
                        event.timestamp,
                        msgType,
                        resolveAgentContext,
                        log,
                    );
                } else {
                    void persistHumanEntry(
                        sessionId,
                        event.data.content,
                        event.timestamp,
                        "skill",
                        resolveAgentContext,
                        log,
                    );
                }
                pendingAssistantMessages = [];
                break;

            case "assistant.turn_start":
                pendingAssistantMessages = [];
                break;

            case "assistant.message": {
                const isIntermediate = (event.data?.toolRequests?.length ?? 0) > 0;
                pendingAssistantMessages.push({
                    content: event.data?.content ?? "",
                    timestamp: event.timestamp,
                    isIntermediate,
                });
                break;
            }

            case "tool.execution_complete":
                break;

            case "assistant.turn_end": {
                const finalMessage = [...pendingAssistantMessages]
                    .reverse()
                    .find((m) => m.content.trim().length > 0);

                if (finalMessage) {
                    const msgType = finalMessage.isIntermediate ? "ai_intermediate" : "ai_final";
                    void persistAiEntry(
                        sessionId,
                        finalMessage.content,
                        finalMessage.timestamp,
                        msgType,
                        resolveAgentContext,
                        log,
                    );
                } else {
                    log("[turn-persistence] turn_end SKIPPED ai: no assistant message with content");
                }

                pendingAssistantMessages = [];
                break;
            }

            default:
                break;
        }
    });

    return {
        unsubscribe,
        flush: async () => true,
        recordAskUserAnswer,
        setPendingUserMessage,
        clear: clearBuffer,
    };
}
