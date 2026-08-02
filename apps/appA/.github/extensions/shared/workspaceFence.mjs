/**
 * Workspace boundary fence.
 *
 * Pure functions that enforce the eval workspace boundary for tool calls.
 * All functions receive the workspace root as a parameter so they can be
 * used in any context without module-level side effects.
 */

const PATH_ARG_KEY_PATTERN = /(?:path|paths|directory|directories|dir|dirs|cwd|root)$/i;
const ABSOLUTE_PATH_TOKEN_PATTERN = /(^|[\s"'`(=])((?:~[\\/]|\/)[^\s"'`;&|<>)]*)/g;
const PARENT_PATH_TOKEN_PATTERN = /(^|[\s"'`(=])\.\.(?:[\\/]|$)/;

import {relative, resolve} from "node:path";

/**
 * Returns true when `candidatePath` is within `workspaceRoot`, or when it
 * is a URL (which is not a filesystem path).
 */
export function isWithinWorkspace(candidatePath, workspaceRoot) {
    const trimmed = String(candidatePath ?? "").trim();
    if (!trimmed) {
        return true;
    }

    if (/^[a-z]+:\/\//i.test(trimmed) || trimmed.startsWith("file://")) {
        return true;
    }

    if (trimmed.startsWith("~")) {
        return false;
    }

    const resolvedPath = resolve(workspaceRoot, trimmed);
    const relativePath = relative(workspaceRoot, resolvedPath);
    return relativePath === "" || (!relativePath.startsWith("..") && relativePath !== "..");
}

/**
 * Recursively walks `value` and returns the first out-of-bounds path argument
 * key=value string, or null if all paths are within `workspaceRoot`.
 */
export function findOutOfBoundsPathArg(value, workspaceRoot, ancestry = []) {
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const outOfBounds = findOutOfBoundsPathArg(value[index], workspaceRoot, [...ancestry, String(index)]);
            if (outOfBounds) {
                return outOfBounds;
            }
        }
        return null;
    }

    if (value && typeof value === "object") {
        for (const [key, nestedValue] of Object.entries(value)) {
            const outOfBounds = findOutOfBoundsPathArg(nestedValue, workspaceRoot, [...ancestry, key]);
            if (outOfBounds) {
                return outOfBounds;
            }
        }
        return null;
    }

    if (typeof value !== "string") {
        return null;
    }

    const key = ancestry.at(-1) ?? "";
    if (!PATH_ARG_KEY_PATTERN.test(key)) {
        return null;
    }

    return isWithinWorkspace(value, workspaceRoot)
        ? null
        : `${ancestry.join(".")}="${value}"`;
}

/**
 * Scans a shell command string for absolute paths or parent traversals that
 * escape `workspaceRoot`. Returns the offending token or null.
 */
export function findOutOfBoundsShellReference(command, workspaceRoot) {
    const normalized = String(command ?? "");
    if (!normalized.trim()) {
        return null;
    }

    if (PARENT_PATH_TOKEN_PATTERN.test(normalized)) {
        return "parent-directory traversal";
    }

    for (const match of normalized.matchAll(ABSOLUTE_PATH_TOKEN_PATTERN)) {
        const token = match[2];
        if (token && !isWithinWorkspace(token, workspaceRoot)) {
            return token;
        }
    }

    return null;
}

/**
 * Builds a deny decision for a workspace scope violation.
 */
export function buildWorkspaceScopeViolation(toolName, detail, workspaceRoot) {
    return {
        permissionDecision: "deny",
        permissionDecisionReason:
            `Workspace boundary violation for ${toolName}: ${detail}. Stay inside ${workspaceRoot}.`,
        additionalContext:
            `You are restricted to the eval workspace at "${workspaceRoot}". Do not read, list, edit, or run commands against parent directories or absolute paths outside this workspace.`,
    };
}
