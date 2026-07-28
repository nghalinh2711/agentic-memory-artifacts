<coding_guidelines>
Language and naming:

* Write all code exclusively in English (variable names, methods, classes, comments).
* Use meaningful, descriptive names — take the time to find the right one.
* camelCase for variables, packages, methods, classes, React Function-Based Components, and file names (except frontend
  files).
* UPPER_CASE_WITH_UNDERSCORE for constants, enums, and environment variables.
* Avoid the use of `any` as much as possible.
* Use `interface` for behavioural contracts / API boundaries; use `type` for plain data structures and objects.

Size and complexity limits:

* Class or file size: < 150 lines.
* Function size: < 25 lines.
* Function parameters: < 3.
* Maximum indentation level: 1 — no nested control statements (no `if` inside a `for`, no nested `if`s, etc.).

React / Frontend:

* Always use Function-Based Components. Export an interface per component that explicitly declares its props where
  needed.
* No plain CSS anywhere.
* Style using (in order of preference): built-in MUI component props, MUI Theme, Styled Components, scoped `sx={{}}` —
  not inline styles.
* For all visual decisions (colors, typography, spacing, layout, components) follow `design-guidelines.md`.

Prompts:

* Write prompts in English, but ensure user-facing output is localized to the user's language.

Mindset:

* After implementing a feature, consider and handle possible error cases beyond the happy path.
* Once a feature works, actively try to break it to surface edge cases.
* Boy Scout Rule: if you encounter messy code, clean up at least a little before moving on.
  </coding_guidelines>