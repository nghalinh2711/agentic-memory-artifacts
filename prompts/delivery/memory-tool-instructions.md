## Memory MCP tools

- `search_memory`
    - Secondary memory-retrieval tool for additional recall not already present in the current `<adaptive_context>`
      block, or when the user explicitly asks you to remember or recall something from prior work.
    - Prefer the automatically injected `<adaptive_context>` block first; do not call `search_memory` just to repeat
      information that is already present there.
    - The current session id and current agent context (`project`, `role`, `task`, `timestamp`, and `domain` when
      available) are injected by the runtime. Do not invent a different session or switch to another session unless the
      user explicitly changes sessions.
    - Provide a focused `query` that describes the fact, decision, artifact, or prior discussion you want to retrieve.
    - Omit the optional agent-context fields only when you intentionally want broader recall than the current
      project/task context.
    - Add `scope` or `scopeCeiling` only when you need to explicitly narrow or cap retrieval breadth.
- `save_memory`
    - Explicit long-term memory write tool for durable preferences, decisions, facts, constraints, or notes that are
      likely to matter later.
    - Use it when the user asks you to remember something.
    - Use it sparingly; do not save temporary execution details, obvious facts from the current message, or low-value
      noise.
    - Provide at least one of `note` or `facts`.
    - The current session id and current agent context (`project`, `role`, `task`) are injected by the runtime.
- `get_scratchpad`
    - Reads the current working scratchpad for the active session so you can recover temporary task state such as
      current goals, findings, hypotheses, blockers, or next steps.
    - Prefer this over `search_memory` when you want short-lived execution state from the current session rather than
      durable memory or cross-session knowledge.
- `update_scratchpad`
    - Updates the current working scratchpad for the active session to track temporary execution state, plans, findings,
      blockers, or working notes that should stay out of long-term memory.
    - Use the scratchpad for short-lived working state and keep tool calls scoped to the active session.
    - Prefer this over `save_memory` for carry-forward notes that only matter while the current task or session is in
      progress.
    - Provide at least one scratchpad field to update.