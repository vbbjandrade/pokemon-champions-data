#!/usr/bin/env python3

#   Usage:
#   scripts/fetch_sources.sh                                Fetch input data into data/sources/
#   python3 scripts/update_from_showdown.py [--dry-run]
#   python3 scripts/validate.py                             Validate the consistency of the generated output

#   Data Sources:
#   smogon/pokemon-showdown (pokedex / mods/champions)

import argparse
import datetime
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from showdown_parser import (  # noqa: E402
    parse_abilities_entries, parse_abilities_descriptions, parse_blocks, parse_items, parse_learnsets,
    parse_legal_species, parse_move_mods, parse_moves_main,
    parse_pokedex, repo_form, to_repo_name,
)

ROOT = Path(__file__).parent.parent
SRC = ROOT / 'data/sources'

#   Forms that should be collapsed into a single entry
COLLAPSED_FORMS = {
    'aegislashblade', # Form change only happens during battle
    'castformrainy', 'castformsnowy', 'castformsunny', # Form change only happens during battle
    'meowsticf', # Only Meowstic M is allowed as of Reg M-B
}

#   Forms with no learnset on Showdown that should inherit moves from other entries
LEARNSET_FALLBACKS = {
    'gourgeistsmall': 'gourgeist',
    'gourgeistlarge': 'gourgeist',
    'gourgeistsuper': 'gourgeist',
    'floettemega': 'floetteeternal',
    'meowsticmmega': 'meowstic',
}

#   Mapping table for Showdown forms maintained under unique names in the repository
#   The repository follows a "one selectable Pokémon = one entry" policy, consolidating them into a representative form
SHOWDOWN_ALIASES = {
    'meowsticmmega': 'Mega Meowstic',
    'taurospaldeacombat': 'Paldean Tauros',
}

SHOWDOWN_SOURCE = "smogon/pokemon-showdown"

def load(path):
    return json.loads((ROOT / path).read_text())

def save(path, data, dry):
    text = json.dumps(data, indent=2, ensure_ascii=False) + '\n'
    if dry:
        print(f'  [dry-run] would write {path}')
    else:
        (ROOT / path).write_text(text)
        print(f'  wrote {path}')

def die(msg):
    print(f'\nERROR: {msg}', file=sys.stderr)
    sys.exit(1)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    for f in [
        'pokedex.ts', 
        'champions-formats-data.ts',
        'champions-learnsets.ts',
        'moves-main.ts',
        'champions-moves.ts',
        'items-main.ts',
        'champions-items.ts',
        'abilities-main.ts',
        'champions-abilities.ts']:
        if not (SRC / f).exists():
            die(f'data/sources/{f} is missing. Please run scripts/fetch_sources.sh first.')

    sd_dex = parse_pokedex((SRC / 'pokedex.ts').read_text())
    repo_roster = load('data/pokemon/roster.json')
    
    # Showdown's learnsets for champions are all contained in the mod file 
    learnsets_mod = parse_learnsets((SRC / 'champions-learnsets.ts').read_text())
    repo_learnsets = load('data/pokemon/learnsets.json')

    moves_main = parse_moves_main((SRC / 'moves-main.ts').read_text())
    move_mods = parse_move_mods((SRC / 'champions-moves.ts').read_text())

    items_main = parse_items((SRC / 'items-main.ts').read_text())
    items_mod = parse_items((SRC / 'champions-items.ts').read_text())
    
    repo_abilities = load('data/abilities/abilities.json')
    abilities_main = parse_abilities_entries((SRC / 'abilities-main.ts').read_text())
    abilities_descriptions = parse_abilities_descriptions((SRC / 'abilities-text.ts').read_text())
    abilities_mod = parse_abilities_entries((SRC / 'champions-abilities.ts').read_text())

    #   Roster
    champions_legal_roster_ids = parse_legal_species((SRC / 'champions-formats-data.ts').read_text())
    unique_roster_ids = {k for k in champions_legal_roster_ids if k not in COLLAPSED_FORMS}
    unknown = [i for i in unique_roster_ids if i not in sd_dex]

    if unknown:
        die(f'species missing from showdown pokedex: {unknown}')

    sd_unique_dex = {k: v for k, v in sd_dex.items() if k in unique_roster_ids}
    
    def repo_name_for(mon_id):
        return SHOWDOWN_ALIASES.get(mon_id) or to_repo_name(sd_unique_dex[mon_id]['name'])

    def order_key(mon_id):
        e = sd_unique_dex[mon_id]
        form = repo_form(e['name'])
        rank = {'Mega': 0, 'Regional': 1}.get(form, 2)
        xyz = 0 if e['name'].endswith('-X') else 1 if e['name'].endswith('-Y') else 2 if e['name'].endswith('-Z') else 3
        return (e['dexNumber'], rank, xyz)

    updated_roster = repo_roster

    for repo_mon_id, repo_mon in repo_roster.items():
        if not sd_unique_dex.get(repo_mon_id):
            print(f'missing showdown champions dex entry for: {repo_mon['name']}.\nPlease check for removal')
            repo_mon['verified'] = False

    for sd_mon_id, sd_mon in sd_unique_dex.items():
        new = sd_mon_id not in repo_roster
        sd_mon['name'] = repo_name_for(sd_mon_id)

        if new:
            print(f"new showdown champions dex entry for: {sd_mon['name']}.\nPlease check for authenticity.")
            sd_mon['source'] = SHOWDOWN_SOURCE
            sd_mon['verified'] = False
        else: 
            repo_mon = repo_roster[sd_mon_id]
            repo_mon_source = repo_mon.pop('source')
            repo_mon_verified = repo_mon.pop('verified')

            different = repo_mon != sd_mon
            if different:
                if repo_mon_source == SHOWDOWN_SOURCE:
                    print(f'updated showdown champions dex entry for: {sd_mon['name']}')
                    sd_mon['source'] = SHOWDOWN_SOURCE
                else:
                    print(f'divergent values found on showdown champions dex entry for: {sd_mon['name']}.\nRequires manual checking of provided source: "{repo_mon_source}".')
                    sd_mon['source'] = repo_mon_source
                sd_mon['verified'] = False
            else:
                sd_mon['source'] = repo_mon_source
                sd_mon['verified'] = bool(repo_mon_verified)

        updated_roster[sd_mon_id] = sd_mon

    #   Moves
    def base_species_id(sid):
        if sid in LEARNSET_FALLBACKS:
            return LEARNSET_FALLBACKS[sid]
        for suffix in ('megax', 'megay', 'megaz', 'mega', 'gmax'):
            if sid.endswith(suffix) and learnsets_mod.get(sid[:-len(suffix)]):
                return sid[:-len(suffix)]
        return sid
    
    sd_champions_movedex = moves_main
    for mid, move in move_mods.items():
        if move.get('inherit') == True:
            sd_champions_movedex[mid] = {**sd_champions_movedex[mid], **move}
        else:
            sd_champions_movedex[mid] = move
    sd_champions_movedex = {k: v for k, v in sd_champions_movedex.items() if v.get('isNonstandard') == None}

    learnsets = {}
    used_moves = {}

    for pid, pk in updated_roster.items():
        mapped_species_id = base_species_id(pid)
        
        if not learnsets_mod.get(mapped_species_id):
            print(f'missing showdown champions learnset for: {pid} (base: {mapped_species_id})\nPlease check for removal.')
            repo_matching_learnset = repo_learnsets.get(pid)
            if not repo_matching_learnset:
                print(f'learnset match not found in repo for: {pid}')
                continue
            else:
                repo_matching_learnset['verified'] = False
                learnsets[pid] = repo_matching_learnset
                continue

        for mid in learnsets_mod[mapped_species_id]:
            if mid not in sd_champions_movedex:
                die(f'moves-main.ts missing move: {mid} ({pid})')            
            learnsets[pid] = {
                'dexNumber': pk['dexNumber'],
                'form': pk['form'],
                'moves': [m for m in learnsets_mod[mapped_species_id]],
                'source': 'showdown-champions',
                'verified': False,
            }

            if mid not in used_moves:
                used_moves[mid] = sd_champions_movedex[mid]

    used_moves = dict(sorted(used_moves.items()))

    #   Abilities
    sd_champions_abilitydex = abilities_main
    for aid, ability in abilities_mod.items():
        if ability.get('inherit') == True:
            sd_champions_abilitydex[aid] = {**sd_champions_abilitydex[aid], **ability}
        else:
            sd_champions_abilitydex[aid] = ability
    sd_champions_abilitydex = {k: v for k, v in sd_champions_abilitydex.items() if v.get('isNonstandard') == None}

    abilities_name_to_id = {}
    full_abilitydex = {}

    for repo_abl_id, repo_abl in repo_abilities.items():
        if not sd_champions_abilitydex.get(repo_abl_id):
            print(f'missing showdown champions ability entry for: {repo_abl['name']}.\nPlease check for removal')
            repo_abl['verified'] = False

    for sd_abl_id, sd_abl in sd_champions_abilitydex.items():
        new = sd_abl_id not in repo_abilities

        if new:
            print(f"new showdown champions ability entry for: {sd_abl['name']}.\nPlease check for authenticity.")
            sd_abl['source'] = SHOWDOWN_SOURCE
            sd_abl['verified'] = False
        else: 
            repo_abl = repo_roster[sd_abl_id]
            repo_abl_source = repo_mon.pop('source')
            repo_abl_verified = repo_mon.pop('verified')

            different = repo_abl != sd_abl
            if different:
                if repo_abl_source == SHOWDOWN_SOURCE:
                    print(f'updated showdown champions ability entry for: {sd_abl['name']}')
                    sd_abl['source'] = SHOWDOWN_SOURCE
                else:
                    print(f'divergent values found on showdown for: {sd_abl['name']}.\nRequires manual checking of provided source: "{repo_abl_source}".')
                    sd_abl['source'] = repo_abl_source
                sd_abl['verified'] = False
            else:
                sd_abl['source'] = repo_mon_source
                sd_abl['verified'] = bool(repo_mon_verified)

        full_abilitydex[sd_abl_id] = sd_abl
        abilities_name_to_id[sd_abl['name']] = sd_abl_id

    used_abilities = full_abilitydex

    #   Items
    items = {}

    version = load('data/meta/version.json')
    version['version'] = '1.4.0'
    version['lastUpdated'] = datetime.date.today().isoformat()
    version['regulation'] = 'M-B'
    version['sources'] = [
        'Pokemon Showdown data/pokedex.ts + data/mods/champions (roster, learnsets, items, move changes)',
    ]
    version['counts'] = {
        'pokemon': len(updated_roster),
        'moves': sum(1 for m in used_moves),
        'abilities': len(used_abilities),
        'items': len(items),
        'natures': version['counts'].get('natures', 25),
        'types': 18,
    }

    save('data/pokemon/roster.json', updated_roster, args.dry_run)
    save('data/pokemon/learnsets.json', learnsets, args.dry_run)
    save('data/moves/moves.json', used_moves, args.dry_run)
    save('data/items/items.json', items, args.dry_run)
    save('data/abilities/abilities.json', used_abilities, args.dry_run)
    print('\nDone. Next, please run `python3 scripts/validate.py`.')

if __name__ == '__main__':
    main()
