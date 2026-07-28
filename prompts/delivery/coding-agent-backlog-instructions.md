## Backlog-Driven Task Workflow

You have access to a remote backlog system via MCP tools. When the user types `/implement`, or explicitly asks you to
work from the backlog, follow this workflow precisely.

### Priority System

- Each task has a **positive integer priority**. Lower numbers = higher priority (claimed first).
- Tasks with the **same priority** are parallel and independent — they must not depend on each other.
- Sequential/dependent tasks use **strictly increasing priorities** (e.g., 10, 20, 30).
- `claim_next_task` always picks the lowest-priority-numbered `to_do` task first. Same-priority ties break by creation
  order.
- Respect this ordering — never skip a lower-priority task to work on a higher-numbered (less urgent) one.

### Step 1 — Resolve backlog scope

- If the user or CLI prompt already provides a `backlogId`, stay within that backlog for the entire `/implement` run.
- If no `backlogId` is provided, call `list_backlogs` to discover the available backlogs.
- If **no backlogs exist**, inform the user: "No backlog found. Please run the requirements agent and use `/finalize` to
  create one."
- If **exactly one backlog exists**, proceed with it automatically and announce the project name.
- If **multiple backlogs exist**, present the list to the user and ask which one to work from.

### Step 2 — Claim the next task

Call `claim_next_task` with the chosen backlog ID.

`claim_next_task` does two things before claiming:

1. It checks for any `in_progress` or `blocked` tasks still unresolved.
2. If the backlog is clean (no `in_progress` and no `blocked`), it atomically claims the highest-priority
   `to_do` task and marks it `in_progress`.

**If `claim_next_task` reports blocking tasks:**

- **`in_progress` tasks present:** finish each one and mark it `done` via `update_task`, or mark it
  `blocked` if it cannot be completed safely. Do NOT skip past these — every in_progress task must be
  resolved before claiming new work.
- **`blocked` tasks present:** check the scratchpad for each blocked task's retry count.
    - If under 3 retries: set it back to `in_progress` with `update_task`, implement, verify, and mark `done`.
    - If 3 retries exhausted: leave it `blocked` and skip it permanently.
- Once all in_progress and retryable blocked tasks are resolved, call `claim_next_task` again.

You do NOT need to call `get_tasks` to find blocked or in_progress tasks — `claim_next_task` surfaces them
for you automatically every time you attempt to claim.

### Step 3 — Execute the claimed task

For each claimed task:

1. Call `get_scratchpad` to check for notes left by previous tasks in this session.
2. Surface the task title and the task description as the current acceptance criteria or implementation context.
3. Treat the task as `in_progress` before you begin implementation work. `claim_next_task` already sets this for new
   claims, and retries must explicitly set the task back to `in_progress` before work resumes.
4. Implement the task fully and verify the result before changing the final task state.
5. After implementation is complete and verified, call `update_task` to set the task status to `done`.
6. Call `update_scratchpad` with concise carry-forward notes about what changed, decisions made, and anything the next
   task should know. Always record the retry count for any task you mark `blocked`, keyed by `taskId`.
7. Immediately call `claim_next_task` again — it will surface any in_progress/blocked stragglers before
   handing out the next `to_do` task.

### Step 4 — Handle blocked tasks

If you cannot finish a claimed task safely because information is missing, a dependency is unmet, or verification fails:

1. Call `update_task` to set the task status to `blocked`.
2. Record the retry count in the scratchpad, keyed by `taskId`.
3. Call `claim_next_task` — it will show you any remaining in_progress tasks AND the newly blocked task.
   Resolve in_progress tasks first, then retry blocked tasks according to their retry counts (max 3).
4. Do not stop — continue resolving and retrying until `claim_next_task` reports a clean slate and hands out
   the next `to_do` task.

### Step 5 — Final backlog verification

When `claim_next_task` reports no more claimable `to_do` tasks:

1. Call `get_tasks` for the backlog (no state filter) to get the full picture.
2. Verify that no task remains in `to_do`, `in_progress`, or `blocked`.
3. If `to_do` tasks remain, continue implementing them.
4. If `in_progress` or `blocked` tasks remain, inform the user which tasks are still unresolved and whether they failed
   because of blockers or exhausted retries.
5. Only report the implementation as complete when the final `get_tasks` check confirms there are no remaining tasks in
   `to_do`, `in_progress`, or `blocked`.

### Allowed task statuses

Use the following status values when calling `update_task`. Prefer the exact strings the server accepts — if the server
returns a validation error, report it and ask the user how to proceed:

- `to_do` — not yet started; this is not the normal state transition during `/implement` because `claim_next_task`
  claims work for you
- `in_progress` — currently being implemented; `claim_next_task` sets this automatically when it claims work, and
  retries must set it again before work resumes
- `done` — fully implemented and verified
- `blocked` — implementation failed or cannot be completed safely with the current information or dependencies

### Important rules

- Never silently skip a claimed task.
- Do not call `claim_next_task` for a different backlog once the run has started.
- Do not claim another task until the current claimed task is either completed or explicitly marked `blocked`.
- Do not retry a blocked task more than 3 times.
- Do not create new tasks in the backlog on your own — that is the requirements agent's responsibility.
- You do NOT need to call `get_tasks` to find blocked tasks — `claim_next_task` surfaces them every time.
- If `claim_next_task` reports no task, do the final `get_tasks` verification before declaring the backlog complete.
- Treat the task description as the acceptance criteria/context unless the user gives newer instructions.