#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run_all_notebooks.sh — Execute all thesis notebooks in order and write
# generated figures/tables to the output/ directory.
#
# Prerequisites (see README):
#   python -m venv venv && source venv/bin/activate
#   pip install -r requirements.txt
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTEBOOKS_DIR="$SCRIPT_DIR/notebooks"
OUTPUT_DIR="$SCRIPT_DIR/output"

# Ensure output directories exist
mkdir -p "$OUTPUT_DIR/figures" "$OUTPUT_DIR/tables" "$OUTPUT_DIR/tikz"

echo "==> Running all thesis notebooks..."
echo ""

NOTEBOOKS=(
  "plots.ipynb"
  "programming.ipynb"
  "qualitative.ipynb"
)

for nb in "${NOTEBOOKS[@]}"; do
  echo "--- Executing $nb ---"
  jupyter nbconvert \
    --to notebook \
    --execute \
    --inplace \
    --ExecutePreprocessor.timeout=600 \
    "$NOTEBOOKS_DIR/$nb"
  echo "--- $nb completed ---"
  echo ""
done

echo "==> All notebooks executed successfully."
echo "    Output written to: $OUTPUT_DIR"
