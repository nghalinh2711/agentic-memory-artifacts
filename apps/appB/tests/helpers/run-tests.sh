#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/tests/artifacts"
LOG_FILE="$ARTIFACTS_DIR/test-run.log"
SUMMARY_FILE="$ARTIFACTS_DIR/summary.txt"
FAILURES_DIR="$ARTIFACTS_DIR/failures"
TIMESTAMP=$(date +%Y-%m-%dT%H:%M:%S)

mkdir -p "$ARTIFACTS_DIR" "$FAILURES_DIR"

echo "=== Test Run: $TIMESTAMP ===" | tee "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Run integration tests first (sequential)
echo "--- Running integration tests ---" | tee -a "$LOG_FILE"
INTEGRATION_EXIT=0
npx vitest run \
  --config "$ROOT_DIR/vitest.config.ts" \
  --reporter=verbose \
  tests/integration/ \
  2>&1 | tee -a "$LOG_FILE" || INTEGRATION_EXIT=$?

echo "" | tee -a "$LOG_FILE"
echo "--- Running unit tests ---" | tee -a "$LOG_FILE"
UNIT_EXIT=0
npx vitest run \
  --config "$ROOT_DIR/vitest.config.ts" \
  --reporter=verbose \
  --coverage \
  tests/api/ tests/lib/ tests/app/ tests/components/ \
  2>&1 | tee -a "$LOG_FILE" || UNIT_EXIT=$?

# Extract coverage summary
echo "" | tee -a "$LOG_FILE"
echo "--- Coverage Summary ---" | tee -a "$LOG_FILE"
if [ -f "$ARTIFACTS_DIR/coverage/coverage-summary.json" ]; then
  cat "$ARTIFACTS_DIR/coverage/coverage-summary.json" | tee -a "$LOG_FILE"
fi

# Extract failure details
echo "" | tee -a "$LOG_FILE"
echo "--- Failure Summary ---" | tee -a "$LOG_FILE"
FAILED_TESTS=$(grep -E 'FAIL|✗|×' "$LOG_FILE" || true)
if [ -n "$FAILED_TESTS" ]; then
  echo "$FAILED_TESTS" > "$FAILURES_DIR/failures-$TIMESTAMP.txt"
  echo "$FAILED_TESTS" | tee -a "$LOG_FILE"
else
  echo "All tests passed." | tee -a "$LOG_FILE"
fi

# Write summary
{
  echo "Test Run: $TIMESTAMP"
  echo "Integration tests exit code: $INTEGRATION_EXIT"
  echo "Unit tests exit code: $UNIT_EXIT"
  if [ -n "$FAILED_TESTS" ]; then
    echo "FAILURES DETECTED — see $FAILURES_DIR/failures-$TIMESTAMP.txt"
  else
    echo "RESULT: ALL TESTS PASSED"
  fi
} | tee "$SUMMARY_FILE"

# Exit with combined status
if [ "$INTEGRATION_EXIT" -ne 0 ] || [ "$UNIT_EXIT" -ne 0 ]; then
  exit 1
fi
