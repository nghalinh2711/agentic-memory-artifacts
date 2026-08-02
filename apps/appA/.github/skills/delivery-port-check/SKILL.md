---
name: delivery-port-check
description: Check whether a TCP port is free before using it for local development. Use when choosing an application port, configuring dev servers, or writing README port instructions during delivery runs.
---

# Port Availability Check

## Reserved ports

| Port | Used by                                                |
|------|--------------------------------------------------------|
| 3000 | Agentic memory system (always running during delivery) |

Never bind your application to port 3000.

## Check port

Run from the workspace root:

```bash
.github/skills/delivery-port-check/scripts/check-port.sh 3001
```

Or with an environment variable:

```bash
PORT=4000 .github/skills/delivery-port-check/scripts/check-port.sh
```

**Exit codes:** `0` = available, `1` = reserved or in use, `2` = usage error

Pick a port (e.g. 3001, 4000, 5173, 8080) that is not in the reserved list above, verify it is free, then use it in your
application configuration and README.
