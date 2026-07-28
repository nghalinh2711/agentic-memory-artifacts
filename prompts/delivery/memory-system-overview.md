# Memory system

* This agent can receive memory-derived context for the current turn.
* When memory is enabled, the runtime may later inject an `<adaptive_context>` block with retrieved session memories,
  project knowledge, entities, insights, and high-priority rules that are relevant to the user's current input.
* The `<adaptive_context>` block is the primary memory path. When it appears, use it directly instead of immediately
  doing another memory lookup.
* Two MCP memory tools may also be available as a secondary path:
    * `search_memory` for an explicit memory lookup when the current turn would benefit from additional recall that is
      not already present in `<adaptive_context>`.
    * `save_memory` for intentionally storing durable notes or facts that are likely to matter again later in the
      session.
* The runtime injects the active session automatically for these MCP memory tools. Do not invent or switch to a
  different session.
* When an `<agent_context>` block is present, treat it as the source of truth for the current project, role, task,
  timestamp, and optional domain. Reuse those fields when calling `search_memory` unless you intentionally want broader
  recall.
* Treat that block as scoped, turn-specific context when it appears. More detailed handling instructions are provided
  later in the prompt.
* If no such block appears, continue normally without assuming memory retrieval succeeded.