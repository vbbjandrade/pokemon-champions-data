#!/usr/bin/env bash
#	Download data update sources into the `sources/` directory.
#	- smogon/pokemon-showdown master	Source
#	- data/pokedex.ts									Stats/types/abilities for all species (including new Mega Evolutions from Champions)
#	- data/mods/<regulation>/				Regulation deltas (roster/learnsets/items/move/ability changes)

set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/sources

SD=https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data

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
}

echo "Fetching Showdown data..."
fetch_source "$SD/pokedex.ts" data/sources/pokedex.ts
fetch_source "$SD/moves.ts" data/sources/moves-main.ts
fetch_source "$SD/items.ts" data/sources/items-main.ts
fetch_source "$SD/abilities.ts" data/sources/abilities-main.ts
fetch_source "$SD/text/abilities.ts" data/sources/abilities-text.ts
fetch_source "$SD/text/moves.ts" data/sources/moves-text.ts
fetch_source "$SD/text/items.ts" data/sources/items-text.ts

# Regulations are newest first. Pokemon Showdown calls the latest regulation
# "champions" until it rotates, so only the first entry uses that source mod.
REGULATIONS=(championsregmb championsregma)
RESOURCES=(formats-data learnsets items moves abilities)

for i in "${!REGULATIONS[@]}"; do
	regulation_id="${REGULATIONS[$i]}"
	source_mod="$regulation_id"
	if [[ "$i" -eq 0 ]]; then
		source_mod="champions"
	fi

	mkdir -p "data/sources/$regulation_id"
	for f in "${RESOURCES[@]}"; do
		destination="data/sources/$regulation_id/$f.ts"
		if ! fetch_source "$SD/mods/$source_mod/$f.ts" "$destination"; then
			if [[ "$i" -eq 0 ]]; then
				exit 1
			fi

			echo "WARN: ${regulation_id}/${f}.ts is unavailable; falling back to champions/${f}.ts" >&2
			fetch_source "$SD/mods/champions/$f.ts" "$destination"
		fi
	done
done

while IFS= read -r -d '' f; do
	if [ -f "$f" ] && ! head -n 1 "$f" | grep -q "^// @ts-nocheck"; then
		sed -i '1s/^/\/\/ @ts-nocheck\n/' "$f"
	fi
done < <(find data/sources -type f -name '*.ts' -print0)

echo "Done. Files in data/sources/:"
ls -la data/sources/ | tail -n +2
