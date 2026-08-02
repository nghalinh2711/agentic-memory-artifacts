import {readFile, writeFile} from "node:fs/promises";

async function readStateFile(statePath) {
    const raw = await readFile(statePath, "utf8");
    return JSON.parse(raw);
}

async function writeStateFile(statePath, state) {
    state.updatedAt = new Date().toISOString();
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

/**
 * Marks the interactive requirements session for handoff.
 * Called by the /handoff slash command. The delivery runner polls
 * hasRequirementsHandoff and exits the copilot process on detection.
 */
export async function recordHandoffRequest(statePath) {
    const state = await readStateFile(statePath);
    state.handoffRequestedAt = new Date().toISOString();
    await writeStateFile(statePath, state);
}
