#!/usr/bin/env bash
#	Download data update sources into the `sources/` directory.
#	- smogon/pokemon-showdown master	Source
#	- data/pokedex.ts									Stats/types/abilities for all species (including new Mega Evolutions from Champions)
#	- data/mods/<regulation>/				Regulation deltas (roster/learnsets/items/move/ability changes)

set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/sources

load_dotenv() {
	[[ -f .env ]] || return

	# Preserve explicitly supplied shell variables so a one-off invocation such
	# as `SHOWDOWN_REF=<sha> bun run fetch-sd` overrides the local .env file.
	local had_ref=false had_current=false had_previous=false saved_ref='' saved_current='' saved_previous=''
	if [[ -v SHOWDOWN_REF ]]; then had_ref=true; saved_ref="$SHOWDOWN_REF"; fi
	if [[ -v SHOWDOWN_CURRENT_REGULATION ]]; then had_current=true; saved_current="$SHOWDOWN_CURRENT_REGULATION"; fi
	if [[ -v SHOWDOWN_PREVIOUS_REGULATION ]]; then had_previous=true; saved_previous="$SHOWDOWN_PREVIOUS_REGULATION"; fi

	# .env is intentionally treated as a shell-compatible local configuration
	# file. It must contain assignments such as SHOWDOWN_REF=<commit-sha>.
	# shellcheck source=/dev/null
	source .env

	if "$had_ref"; then SHOWDOWN_REF="$saved_ref"; fi
	if "$had_current"; then SHOWDOWN_CURRENT_REGULATION="$saved_current"; fi
	if "$had_previous"; then SHOWDOWN_PREVIOUS_REGULATION="$saved_previous"; fi
}

load_dotenv

# Set SHOWDOWN_REF to a commit SHA (or a branch/tag) to retrieve a historical snapshot.
SHOWDOWN_REF="${SHOWDOWN_REF:-master}"

# These are repository regulation IDs, not Showdown source-mod names. The
# current ID maps to Showdown's `champions` folder; the optional previous ID
# maps to Showdown's named regulation folder.
SHOWDOWN_CURRENT_REGULATION="${SHOWDOWN_CURRENT_REGULATION:-championsregmc}"
SHOWDOWN_PREVIOUS_REGULATION="${SHOWDOWN_PREVIOUS_REGULATION:-championsregmb}"
SD="https://raw.githubusercontent.com/smogon/pokemon-showdown/${SHOWDOWN_REF}/data"

fetch_source() {
	local url="$1"
	local destination="$2"
	local temporary="${destination}.tmp"

	if ! curl -fsSL "$url" -o "$temporary"; then
		rm -f "$temporary"
		echo "ERROR: failed to fetch ${url}" >&2
		return 1
	fi

	mv "$temporary" "$destination"
	if ! head -n 1 "$destination" | grep -q "^// @ts-nocheck"; then
		sed -i '1s/^/\/\/ @ts-nocheck\n/' "$destination"
	fi
}

if [[ -v SHOWDOWN_REGULATIONS ]]; then
	echo "ERROR: SHOWDOWN_REGULATIONS is no longer supported. Use SHOWDOWN_CURRENT_REGULATION and SHOWDOWN_PREVIOUS_REGULATION instead." >&2
	exit 1
fi

REGULATIONS=("$SHOWDOWN_CURRENT_REGULATION")
if [[ -n "$SHOWDOWN_PREVIOUS_REGULATION" ]]; then REGULATIONS+=("$SHOWDOWN_PREVIOUS_REGULATION"); fi
if [[ "$SHOWDOWN_CURRENT_REGULATION" == "$SHOWDOWN_PREVIOUS_REGULATION" ]]; then
	echo "ERROR: SHOWDOWN_CURRENT_REGULATION and SHOWDOWN_PREVIOUS_REGULATION must be different." >&2
	exit 1
fi
for regulation_id in "${REGULATIONS[@]}"; do
	if [[ "$regulation_id" == 'champions' ]]; then
		echo "ERROR: regulation variables must use this repository's IDs (for example, championsregmb), not Showdown's \"champions\" source-mod name." >&2
		exit 1
	fi
done

echo "Fetching Showdown data from ref: ${SHOWDOWN_REF}"
echo "Requested regulation snapshots: current=${SHOWDOWN_CURRENT_REGULATION}, previous=${SHOWDOWN_PREVIOUS_REGULATION:-none}"
fetch_source "$SD/pokedex.ts" data/sources/pokedex.ts
fetch_source "$SD/moves.ts" data/sources/moves-main.ts
fetch_source "$SD/items.ts" data/sources/items-main.ts
fetch_source "$SD/abilities.ts" data/sources/abilities-main.ts
fetch_source "$SD/formats-data.ts" data/sources/formats-data-main.ts
fetch_source "$SD/learnsets.ts" data/sources/learnsets-main.ts
fetch_source "$SD/text/abilities.ts" data/sources/abilities-text.ts
fetch_source "$SD/text/moves.ts" data/sources/moves-text.ts
fetch_source "$SD/text/items.ts" data/sources/items-text.ts

# Pokemon Showdown calls the latest requested regulation "champions". Its
# immediate predecessor uses its regulation ID. We retain only these source
# files; committed deltas provide the rest of this repository's history.
RESOURCES=(formats-data learnsets items moves abilities)
FOUND_REGULATIONS=()

empty_overlay() {
	local resource="$1"
	case "$resource" in
		formats-data) echo 'export const FormatsData = {};' ;;
		learnsets) echo 'export const Learnsets = {};' ;;
		moves) echo 'export const Moves = {};' ;;
		items) echo 'export const Items = {};' ;;
		abilities) echo 'export const Abilities = {};' ;;
		*) return 1 ;;
	esac
}

for i in "${!REGULATIONS[@]}"; do
	regulation_id="${REGULATIONS[$i]}"
	source_mod="$regulation_id"
	if [[ "$i" -eq 0 ]]; then
		source_mod="champions"
	fi

	mkdir -p "data/sources/$regulation_id"
	for f in "${RESOURCES[@]}"; do
		destination="data/sources/$regulation_id/$f.ts"
		if ! fetch_source "$SD/mods/$source_mod/$f.ts" "$destination" 2>/dev/null; then
			empty_overlay "$f" > "$destination"
			if [[ "$i" -eq 0 ]]; then
				echo "INFO: ${source_mod}/${f}.ts has no direct override; using an empty overlay inherited from Showdown base data."
			else
				echo "INFO: ${source_mod}/${f}.ts has no direct override; using an empty overlay inherited from champions."
			fi
		fi
	done
	FOUND_REGULATIONS+=("$regulation_id:$source_mod")
done

{
	printf '{\n  "showdownRef": "%s",\n  "regulations": [\n' "$SHOWDOWN_REF"
	for i in "${!FOUND_REGULATIONS[@]}"; do
		IFS=: read -r regulation_id source_mod <<< "${FOUND_REGULATIONS[$i]}"
		comma=','; [[ "$i" -eq $((${#FOUND_REGULATIONS[@]} - 1)) ]] && comma=''
		printf '    {"regulationId": "%s", "sourceModId": "%s"}%s\n' "$regulation_id" "$source_mod" "$comma"
	done
	printf '  ]\n}\n'
} > data/sources/fetch-manifest.json

while IFS= read -r -d '' f; do
	if [ -f "$f" ] && ! head -n 1 "$f" | grep -q "^// @ts-nocheck"; then
		sed -i '1s/^/\/\/ @ts-nocheck\n/' "$f"
	fi
done < <(find data/sources -type f -name '*.ts' -print0)

echo "Found Showdown regulation snapshots: ${FOUND_REGULATIONS[*]}"
echo "Done. Source manifest: data/sources/fetch-manifest.json"
