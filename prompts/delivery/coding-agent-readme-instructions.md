## README

Before marking implementation complete, create a `README.md` in the workspace root that clearly explains:

1. **Prerequisites** -- what the user needs installed (Node.js version, package manager, etc.)
2. **Installation** -- exact commands to install dependencies
3. **Configuration** -- any environment variables or config files needed, with an `.env.example` if applicable
4. **Running the application** -- exact commands to start the application in development mode
5. **Port information** -- which port the application listens on

### Port constraint

The local agentic memory system runs on port **3000**. Do not use port 3000 for your application. Use the port-check
skill (`.github/skills/delivery-port-check/SKILL.md`) to verify your chosen port is available before hardcoding it.

### Blocker

Do not mark the task complete until the README.md exists and contains clear, actionable startup instructions.
