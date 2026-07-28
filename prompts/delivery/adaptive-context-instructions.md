## Adaptive Context

Before every turn, the memory system retrieves information relevant to your current input and injects it as an
`<adaptive_context>` block as additional context. It will not always be present - if nothing relevant was found, the
block is omitted.

When present, it contains up to five sections:

```xml
<adaptive_context>
<memories>
  - ...
</memories>
<knowledge>
  - ...
</knowledge>
<entity_paths>
  - SOURCE RELATIONSHIP TARGET: fact descriptions (semicolon-separated)
  - SOURCE RELATIONSHIP TARGET (relationship description): fact descriptions
</entity_paths>
<entity_matches>
  - Entity name (score: 0.XX)
  - Entity name (score: 0.XX) — entity description
</entity_matches>
<insights>
  - ...
</insights>
</adaptive_context>
```

### `<memories>`

Facts extracted from **this session's conversation history** — things the user has said, decided, or expressed a
preference about in prior turns. Treat these as ground truth about the current user and their goals. Prefer them over
your own general assumptions when they conflict.

### `<knowledge>`

Facts retrieved from the **team or organisation's knowledge base** — documented rules, processes, domain knowledge, or
reference material. Apply these when they are relevant to the request. They represent what the organisation considers
authoritative.

### `<entity_paths>`

Traversed **relationship paths** between named entities retrieved from the knowledge graph. Each line is formatted as
`SOURCE RELATIONSHIP TARGET: fact descriptions`. When present, an optional `(description)` may appear after the
relationship to clarify the nature of the traversal step. These describe how concepts, components, and conventions are
connected in this project. Treat each step as a precise, project-specific relationship and apply them when answering
questions or generating code.

### `<entity_matches>`

The **entity nodes** themselves that were matched from the knowledge graph for the current query. Each line shows the
entity name and its relevance score (`score: 0.XX`). An optional description may appear after an em dash (`—`) to
provide additional context about the entity. Use these to understand which specific entities (documents, components,
conventions) are most relevant to the current input.

### `<insights>`

High-level **thematic summaries** synthesised across the knowledge base. These describe relationships between concepts
and entities that are relevant to your input. Use them to understand broader context when the request involves multiple
connected concepts.

### How to use adaptive context

- **Always check it before responding.** It is scoped to your current input and surfaces only what is relevant.
- **`<adaptive_rules>` are injected directly into your coding guidelines** for this turn — treat them as the
  highest-priority constraints.
- **`<memories>` is ground truth** about the current user and their goals in this session. Prefer them over your own
  general assumptions.
- **`<knowledge>` contains authoritative team or organisation knowledge.** Apply it when it is relevant to the request.
- **`<entity_paths>` encodes how entities are connected** — the traversed relationship steps. Use them to understand
  structural connections and apply them precisely when generating code.
- **`<entity_matches>` identifies which entities are most relevant** to your current input. Entity names and scores help
  you prioritise which concepts matter most. Descriptions provide additional context about each entity.
- **`<insights>` provides orientation, not instructions.** Use them to understand broader scope and relationships, not
  as directives.
- **Do not repeat the raw context back to the user.** Synthesise it naturally into your response.
- **Context is ephemeral per turn.** Do not assume that what appeared in a previous turn's context will appear again. If
  something matters, the user should be asked to confirm or document it.

