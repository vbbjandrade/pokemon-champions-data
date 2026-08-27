#!/usr/bin/env bash
#	Download data update sources into the `sources/` directory.
#	- smogon/pokemon-showdown master	Source
#	- data/pokedex.ts									Stats/types/abilities for all species (including new Mega Evolutions from Champions)
#	- data/mods/champions/						Mod for current regulations (roster/learnsets/items/move changes)

set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p sources

SD=https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

echo "Fetching Showdown data..."
curl -sf "$SD/pokedex.ts"   -o sources/pokedex.ts
curl -sf "$SD/moves.ts"     -o sources/moves-main.ts
curl -sf "$SD/items.ts"     -o sources/items-main.ts
curl -sf "$SD/abilities.ts" -o sources/abilities-main.ts

for f in formats-data learnsets items moves abilities; do
	curl -sf "$SD/mods/champions/$f.ts" -o "sources/champions-$f.ts"
done

echo "Done. Files in sources/:"
ls -la sources/ | tail -n +2
