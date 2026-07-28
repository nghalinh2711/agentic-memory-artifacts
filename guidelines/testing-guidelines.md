### Test Runner & Infrastructure:
* **Core Framework:** Use `vitest` exclusively for all TypeScript and React testing.
* **Coverage Target:** Maintain a strict minimum of **90% code coverage** (lines, functions, and branches). 
* **Execution Mode:** Always run tests in non-interactive `run` mode (e.g., `vitest run`). Never use watch or interactive mode in CI pipelines or deployment scripts to ensure clean exits.
* **Environment Strategy:** Default to `jsdom` for frontend component and hook testing. Use per-file environment overrides (via `@vitest-environment node` pragmas) to opt individual backend or integration files into the Native Node.js environment.

### Test Architecture & Isolation:
* **Dedicated Test Directory:** Keep all tests in a top-level `tests/` directory — never co-locate test files next to source. This cleanly separates production code from test code and keeps build, bundler, and coverage configuration straightforward.
* **Mirrored Directory Structure:** Mirror the source tree under `tests/` so every test file maps predictably to its source module. The relative path and filename (minus the `.test` suffix) must match the source file exactly.
Use `.test.ts` for modules and `.test.tsx` for React components. Bug regression tests go in `tests/bugs/<descriptive-name>.test.ts`.
* **Separation by Test Type:** Within `tests/`, separate integration tests from unit tests into distinct subdirectories. Unit tests mirror the source tree directly under `tests/` (e.g., `tests/copilot-sdk/...`). Integration tests live under `tests/integration/<feature>/` and interact with real infrastructure; unit tests must mock all external systems.
* **Shared Test Utilities:** Place reusable helpers, fixtures, and test doubles in `tests/helpers/` (or `tests/fixtures/`). Do not scatter shared utilities across mirrored subdirectories.
* **Test Scope:** Keep test files highly focused. A single test file must cover exactly one module, one component, or one distinct scenario. Avoid monolithic test suites.
* **Skip Convention:** Exclude skipped tests by appending `.skip` to the filename (e.g., `manager.test.ts.skip`) instead of using inline `.skip()` or `xit()` modifiers, ensuring they are skipped during test discovery.

### Execution Control & CI Integration:
* **Structured Verification Layer:** Wrap all test executions in a custom script rather than running raw test commands. The script must capture output, write structured artifacts (logs, summaries, failure extracts), and provide granular grouping for highly actionable CI logs.
* **Ordered Grouping:** Group tests by type and enforce execution order. Multi-phase integration tests dependent on shared infrastructure (like MongoDB) must always execute and pass before isolated unit tests run.
* **Concurrency Management:** Run integration tests sequentially within a single-process/single-fork execution model if they share stateful infrastructure (databases, file systems) to completely prevent race conditions and isolation leaks.

### Mocking & State Management:
* **Boundary Mocking:** Mock at the application boundary (e.g., repository or service layers), not at the transport wire (e.g., database drivers or HTTP clients). 
* **Partial Mocking:** Prefer partial mocks using `vi.importActual`. Only mock the specific functions required for the test scenario; let all other code pass through to the real implementation.
* **Hoisted Factories:** Use hoisted mocks (`vi.mock()`) for module factory functions when mocking modules that export components or functions used as JSX elements, ensuring availability before the module graph resolves.
* **State Reset:** Reset all mocks, timers, and global stores inside a `beforeEach` block. Every single test must run from a completely clean, isolated, and predictable state.

### Testing Mindset & Patterns:
* **Edge Cases & Unhappy Paths:** Test the happy path, but rigorously validate error cases and edge conditions. Explicitly test for `null`/`undefined` inputs, empty collections, loading states, network dropouts, and authorization failures.
* **Pure Logic Separation:** Test pure utility functions separately from React hooks or state stores. Pure functions should rely on fast, simple input/output assertions without spinning up any rendering infrastructure.
* **Regression Testing:** For every fixed bug, write a dedicated regression test. Document the bug description, reproduction steps, expected vs. actual behavior, root cause, and the fix directly inside the test file as a living record.