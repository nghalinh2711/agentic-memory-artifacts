import {getMemoryApiUrl, getRequiredMemoryIdentity, isMemoryEnabled, isRemoteMemory,} from "./config.mjs";
import {
    appendAgentContextSearchParams,
    appendStoreAgentContextSearchParams,
    toStoreAgentContext,
} from "./agentContext.mjs";
import {getToken} from "./jwt.mjs";

const DEFAULT_TIMEOUT_MS = 5000;

function getTimeoutMs() {
    const parsed = Number.parseInt(
        String(process.env.MEMORY_CONTEXT_TIMEOUT_MS ?? "").trim(),
        10,
    );

    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? getTimeoutMs(),
    );

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                ...(options.headers ?? {}),
            },
        });
        const text = await response.text();
        let body = null;

        if (text.trim().length > 0) {
            try {
                body = JSON.parse(text);
            } catch {
                body = text;
            }
        }

        return {ok: response.ok, status: response.status, body};
    } finally {
        clearTimeout(timeoutHandle);
    }
}

function formatBulletList(items) {
    return items.map((item) => `  - ${item}`).join("\n");
}

function formatEntityPaths(entityPaths) {
    const lines = [];

    for (const entity of entityPaths) {
        const relationships = Array.isArray(entity.relationships)
            ? entity.relationships
            : [];

        for (const rel of relationships) {
            const facts = Array.isArray(rel.factDescriptions)
                ? rel.factDescriptions.join("; ")
                : "";
            const desc = typeof rel.description === "string" && rel.description.trim()
                ? ` (${rel.description})`
                : "";
            lines.push(`  - ${rel.source} ${rel.type} ${rel.target}${desc}: ${facts}`);
        }
    }

    return lines.join("\n");
}

function formatEntityMatches(entityMatches) {
    const lines = [];

    for (const match of entityMatches) {
        const score = typeof match.score === "number"
            ? match.score.toFixed(2)
            : "0.00";
        const desc = typeof match.description === "string" && match.description.trim()
            ? ` — ${match.description}`
            : "";
        lines.push(`  - ${match.name} (score: ${score})${desc}`);
    }

    return lines.join("\n");
}

function listValues(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

export function formatAdaptiveRules(context) {
    const rules = listValues(context?.rules);
    return rules.length > 0 ? rules.map((rule) => `- ${rule}`).join("\n") : "";
}

export function formatAdaptiveContextBlock(context) {
    if (!context || typeof context !== "object") {
        return "";
    }

    const parts = [];
    const memories = listValues(context.memories);
    const knowledge = listValues(context.knowledge);
    const entityPaths = Array.isArray(context.entityPaths) ? context.entityPaths : [];
    const entityMatches = Array.isArray(context.entityMatches) ? context.entityMatches : [];
    const insights = listValues(context.insights);

    if (memories.length > 0) {
        parts.push(`<memories>\n${formatBulletList(memories)}\n</memories>`);
    }

    if (knowledge.length > 0) {
        parts.push(`<knowledge>\n${formatBulletList(knowledge)}\n</knowledge>`);
    }

    if (entityPaths.length > 0) {
        const entityPathText = formatEntityPaths(entityPaths);
        if (entityPathText) {
            parts.push(`<entity_paths>\n${entityPathText}\n</entity_paths>`);
        }
    }

    if (entityMatches.length > 0) {
        const entityMatchText = formatEntityMatches(entityMatches);
        if (entityMatchText) {
            parts.push(`<entity_matches>\n${entityMatchText}\n</entity_matches>`);
        }
    }

    if (insights.length > 0) {
        parts.push(`<insights>\n${formatBulletList(insights)}\n</insights>`);
    }

    return parts.length > 0 ? parts.join("\n") : "";
}

export async function fetchAdaptiveContext(sessionId, query, agentContext, { onUrl } = {}) {
    const trimmed = String(query ?? "").trim();
    if (!isMemoryEnabled() || !trimmed) {
        return null;
    }

    try {
        const {agentId} = getRequiredMemoryIdentity();
        const token = await getToken();
        const url = new URL(
            `${getMemoryApiUrl()}/agents/${agentId}/sessions/${sessionId}/context`,
        );
        url.searchParams.set("input", trimmed);
        appendAgentContextSearchParams(url, agentContext);

        if (isRemoteMemory()) {
            const bypass = String(process.env.X_VERCEL_PROTECTION_BYPASS ?? "").trim();
            if (bypass) {
                url.searchParams.set("x-vercel-protection-bypass", bypass);
            }
        }

        if (onUrl) {
            onUrl(`[adaptive-context] GET ${url.toString()}`);
        }

        const {ok, body} = await fetchJson(url.toString(), {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
        });

        return ok && body && typeof body === "object" ? body : null;
    } catch {
        return null;
    }
}

export async function appendJournalEntries(sessionId, messages, agentContext) {
    if (!isMemoryEnabled() || !Array.isArray(messages) || messages.length === 0) {
        return false;
    }

    const entries = messages
        .map((message) => {
            const content = String(message.content ?? "").trim();
            if (!content) {
                return null;
            }

            const source = message.source === "ai" ? "ai" : "human";
            const role = source;
            const messageType = String(message.messageType ?? (source === "ai" ? "ai_final" : "user"));
            const timestamp =
                typeof message.timestamp === "string" && message.timestamp.trim()
                    ? message.timestamp.trim()
                    : new Date().toISOString();

            return {
                role,
                content,
                messageType,
                timestamp,
            };
        })
        .filter(Boolean);

    if (entries.length === 0) {
        return false;
    }

    try {
        const {agentId} = getRequiredMemoryIdentity();
        const token = await getToken();
        const url = new URL(
            `${getMemoryApiUrl()}/agents/${agentId}/sessions/${sessionId}/journal/entries`,
        );
        appendStoreAgentContextSearchParams(url, toStoreAgentContext(agentContext));

        if (isRemoteMemory()) {
            const bypass = String(process.env.X_VERCEL_PROTECTION_BYPASS ?? "").trim();
            if (bypass) {
                url.searchParams.set("x-vercel-protection-bypass", bypass);
            }
        }

        const {ok, status} = await fetchJson(url.toString(), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(entries),
        });

        return ok && (status === 200 || status === 202);
    } catch {
        return false;
    }
}
