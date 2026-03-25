#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
MAPPING_FILE="${BACKEND_DIR}/data/sector_mapping.json"
OUTPUT_DIR="${BACKEND_DIR}/data/portfolio_outputs"
PY_SCRIPT="${ROOT_DIR}/scripts/generate_portfolios.py"

mkdir -p "${OUTPUT_DIR}"

if [[ -x "${ROOT_DIR}/venv/Scripts/python.exe" ]]; then
  PYTHON_BIN="${ROOT_DIR}/venv/Scripts/python.exe"
elif [[ -x "${ROOT_DIR}/venv/bin/python" ]]; then
  PYTHON_BIN="${ROOT_DIR}/venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python)"
else
  echo "Error: Python runtime not found."
  exit 1
fi

echo "Using Python: ${PYTHON_BIN}"
echo "Sector mapping: ${MAPPING_FILE}"
echo "Output directory: ${OUTPUT_DIR}"

if [[ ! -f "${MAPPING_FILE}" ]]; then
  echo "Error: sector mapping file missing at ${MAPPING_FILE}"
  exit 1
fi

export PORTFOLIO_OUTPUT_DIR="${OUTPUT_DIR}"

if [[ -f "${PY_SCRIPT}" ]]; then
  echo "Running portfolio generator script..."
  "${PYTHON_BIN}" "${PY_SCRIPT}" --mapping "${MAPPING_FILE}" --output "${OUTPUT_DIR}" "$@"
elif [[ -f "${BACKEND_DIR}/manage.py" ]] && "${PYTHON_BIN}" "${BACKEND_DIR}/manage.py" help 2>/dev/null | grep -q "generate_portfolios"; then
  echo "Running Django management command..."
  (
    cd "${BACKEND_DIR}"
    "${PYTHON_BIN}" manage.py generate_portfolios --mapping "${MAPPING_FILE}" --output "${OUTPUT_DIR}" "$@"
  )
else
  echo "Error: No portfolio generator available."
  echo "Expected one of:"
  echo "  - ${PY_SCRIPT}"
  echo "  - manage.py generate_portfolios"
  exit 1
fi

echo "Portfolio generation completed."
