#!/usr/bin/env bash
#	Download data update sources into the `sources/` directory.
#	- smogon/pokemon-showdown master	Source
#	- data/pokedex.ts									Stats/types/abilities for all species (including new Mega Evolutions from Champions)
#	- data/mods/champions/						Mod for current regulations (roster/learnsets/items/move changes)

set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/sources

SD=https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

echo "Fetching Showdown data..."
curl -sf "$SD/pokedex.ts"   		-o data/sources/pokedex.ts
curl -sf "$SD/moves.ts"     		-o data/sources/moves-main.ts
curl -sf "$SD/items.ts"     		-o data/sources/items-main.ts
curl -sf "$SD/abilities.ts" 		-o data/sources/abilities-main.ts
curl -sf "$SD/text/abilities.ts" 	-o data/sources/abilities-text.ts
curl -sf "$SD/text/moves.ts" 		-o data/sources/moves-text.ts
curl -sf "$SD/text/items.ts" 		-o data/sources/items-text.ts

for f in formats-data learnsets items moves abilities; do
	curl -sf "$SD/mods/champions/$f.ts" -o "data/sources/champions-$f.ts"
done

for f in data/sources/*.ts; do
	if [ -f "$f" ] && ! head -n 1 "$f" | grep -q "^// @ts-nocheck"; then
		sed -i '1s/^/\/\/ @ts-nocheck\n/' "$f"
	fi
done

echo "Done. Files in data/sources/:"
ls -la data/sources/ | tail -n +2
