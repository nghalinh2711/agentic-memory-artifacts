import {createHmac} from "node:crypto";
import {getRequiredMemoryIdentity} from "./config.mjs";

const REFRESH_BUFFER_MS = 5_000;
const MIN_SECRET_BYTES = 32;

let apiCache = null;
let mcpCache = null;

function base64url(data) {
    return Buffer.from(data)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

function signJwt(payload, secret) {
    const header = {alg: "HS256", typ: "JWT"};
    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
    const signature = createHmac("sha256", secret)
        .update(signingInput)
        .digest("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    return `${signingInput}.${signature}`;
}

function buildToken(durationMs) {
    const {agentId, secret: rawSecret} = getRequiredMemoryIdentity();
    const secret = Buffer.from(rawSecret, "hex");

    if (secret.length < MIN_SECRET_BYTES) {
        throw new Error(
            "AGENT_MEMORY_SECRET must decode to at least 32 bytes for HS256 signing.",
        );
    }

    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(
        {
            sub: agentId,
            iat: now,
            exp: now + Math.floor(durationMs / 1000),
        },
        secret,
    );

    return {token, expiresAt: Date.now() + durationMs};
}

function getCachedToken(cache, durationMs) {
    if (cache !== null && cache.expiresAt - REFRESH_BUFFER_MS > Date.now()) {
        return cache;
    }

    return buildToken(durationMs);
}

export async function getToken() {
    apiCache = getCachedToken(apiCache, 5 * 60 * 1_000);
    return apiCache.token;
}

export async function getMcpToken() {
    mcpCache = getCachedToken(mcpCache, 60 * 60 * 1_000);
    return mcpCache.token;
}
