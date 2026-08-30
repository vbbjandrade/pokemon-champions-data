#!/usr/bin/env bash
# sync_showdown_types.sh
#
# Downloads Showdown type definition files from the pokemon-showdown GitHub repo
# and saves cleaned, self-contained copies to data/sources/types/.
#
# Post-processing is handled by scripts/process_showdown_types.ts (run with bun),
# which strips runtime-only types and adds stubs so the output files are
# importable without the full Showdown codebase.
#
# Usage:
#   ./scripts/sync_showdown_types.sh [--branch <branch>]
#
# Options:
#   --branch <branch>   Showdown branch to sync from (default: master)

set -euo pipefail

BRANCH="master"
BASE_URL="https://raw.githubusercontent.com/smogon/pokemon-showdown"
DEST_DIR="data/sources/types"

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DEST_ABS="${ROOT_DIR}/${DEST_DIR}"
PROCESSOR="${SCRIPT_DIR}/process_showdown_types.ts"

mkdir -p "$DEST_ABS"

# ---------------------------------------------------------------------------
# Files to sync: <remote path relative to repo root> <local filename>
# ---------------------------------------------------------------------------
declare -A FILES
FILES["sim/dex-moves.ts"]="dex-moves.ts"
FILES["sim/dex-abilities.ts"]="dex-abilities.ts"
FILES["sim/dex-items.ts"]="dex-items.ts"

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "Syncing Showdown type definitions (branch: ${BRANCH})..."
echo ""

for remote_path in "${!FILES[@]}"; do
  local_name="${FILES[$remote_path]}"
  url="${BASE_URL}/${BRANCH}/${remote_path}"
  dest_file="${DEST_ABS}/${local_name}"

  echo "  Fetching ${remote_path}..."

  tmp=$(mktemp --suffix=.ts)
  if ! curl -fsSL "$url" -o "$tmp"; then
    echo "  ERROR: Failed to fetch ${url}" >&2
    rm -f "$tmp"
    exit 1
  fi

  bun run "$PROCESSOR" "$tmp" "$url" "$BRANCH" > "$dest_file"
  rm -f "$tmp"

  echo "  → saved to ${DEST_DIR}/${local_name}"
done

echo ""
echo "Done. Type definitions saved to ${DEST_DIR}/"
echo "Remember to commit the updated files if types have changed."
