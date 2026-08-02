#!/usr/bin/env bash
set -euo pipefail

readonly RESERVED_PORTS=(3000)

usage() {
    echo "Usage: $0 <port>" >&2
    echo "       PORT=<port> $0" >&2
    exit 2
}

if [[ $# -ge 1 ]]; then
    port="$1"
elif [[ -n "${PORT:-}" ]]; then
    port="$PORT"
else
    usage
fi

if ! [[ "$port" =~ ^[0-9]+$ ]] || ((port < 1 || port > 65535)); then
    echo "Invalid port: $port" >&2
    exit 2
fi

for reserved in "${RESERVED_PORTS[@]}"; do
    if ((port == reserved)); then
        echo "Port $port is reserved (agentic memory system)" >&2
        exit 1
    fi
done

if lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Port $port is already in use"
    exit 1
fi

echo "Port $port is available"
