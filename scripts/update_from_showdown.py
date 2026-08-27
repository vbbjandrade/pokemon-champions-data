#!/usr/bin/env python3

#   Usage:
#   scripts/fetch_sources.sh                                Fetch input data into sources/
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
    parse_abilities_ts, parse_blocks, parse_items, parse_learnsets,
    parse_legal_species, parse_move_overrides, parse_moves_main,
    parse_pokedex, repo_form, to_repo_name,
)

ROOT = Path(__file__).parent.parent
SRC = ROOT / 'sources'

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
            die(f'sources/{f} is missing. Please run scripts/fetch_sources.sh first.')

    dex = parse_pokedex((SRC / 'pokedex.ts').read_text())
    learnsets_mod = parse_learnsets((SRC / 'champions-learnsets.ts').read_text())
    moves_main = parse_moves_main((SRC / 'moves-main.ts').read_text())
    move_overrides = parse_move_overrides((SRC / 'champions-moves.ts').read_text())
    items_main = parse_items((SRC / 'items-main.ts').read_text())
    items_mod = parse_items((SRC / 'champions-items.ts').read_text())
    abilities_main = parse_abilities_ts((SRC / 'abilities-main.ts').read_text())
    abilities_mod = parse_abilities_ts((SRC / 'champions-abilities.ts').read_text())

    roster = load('pokemon/roster.json')
    base_stats = load('pokemon/base-stats.json')
    learnsets = load('learnsets/learnsets.json')
    moves = load('moves/moves.json')
    items = load('items/items.json')
    abilities = load('abilities/abilities.json')

    #   1. Roster
    legal_roster = parse_legal_species((SRC / 'champions-formats-data.ts').read_text())
    new_roster = []
    new_base_stats = []

    target_ids = sorted(i for i in legal_roster if i not in COLLAPSED_FORMS)
    unknown = [i for i in target_ids if i not in dex]
    if unknown:
        die(f'species missing from pokedex: {unknown}')

    def repo_name_for(sid):
        return SHOWDOWN_ALIASES.get(sid) or to_repo_name(dex[sid]['name'])

    def order_key(sid):
        e = dex[sid]
        form = repo_form(e['name'])
        rank = {'Mega': 0, 'Regional': 1}.get(form, 2)
        xyz = 0 if e['name'].endswith('-X') else 1 if e['name'].endswith('-Y') else 2 if e['name'].endswith('-Z') else 3
        return (e['num'], rank, xyz)

    for sid in target_ids:
        print(f"  {dex[sid]['num']:>4} {to_repo_name(dex[sid]['name'])}")

    for sid in target_ids:
        e = dex[sid]
        name = to_repo_name(e['name'])
        new_roster.append({
            'name': name,
            'dexNumber': e['num'],
            'types': e['types'],
            'form': repo_form(e['name']),
            'abilities': e['abilities'],
            'championsVerified': True,
        })
        stats = e['baseStats']
        new_base_stats.append({
            'name': name,
            'dexNumber': e['num'],
            'form': repo_form(e['name']),
            'hp': stats['hp'], 'atk': stats['atk'], 'def': stats['def'],
            'spa': stats['spa'], 'spd': stats['spd'], 'spe': stats['spe'],
            'total': sum(stats.values()),
            'championsVerified': True,
        })

    def base_species_id(sid):
        if sid in LEARNSET_FALLBACKS:
            return LEARNSET_FALLBACKS[sid]
        for suffix in ('megax', 'megay', 'megaz', 'mega'):
            if sid.endswith(suffix) and learnsets_mod.get(sid[:-len(suffix)]):
                return sid[:-len(suffix)]
        return sid

    #   2. Moves
    move_name_by_id = {mid: m['name'] for mid, m in moves_main.items()}
    for sid in target_ids:
        e = dex[sid]
        name = to_repo_name(e['name'])
        src_id = base_species_id(sid)
        if not learnsets_mod.get(src_id):
            die(f'missing learnset for: {sid} (base: {src_id})')
        move_names = []
        for mid in learnsets_mod[src_id]:
            if mid not in move_name_by_id:
                die(f'moves.ts missing move: {mid} ({sid})')
            move_names.append(move_name_by_id[mid])
        learnsets[name] = {
            'dexNumber': e['num'],
            'form': repo_form(e['name']),
            'championsVerified': True,
            'source': 'showdown-champions',
            'moves': [{'name': n} for n in sorted(set(move_names))],
        }

    moves_by_name = {m['name']: m for m in moves}

    for mid, ov in move_overrides.items():
        name = move_name_by_id.get(mid)
        if not name or name not in moves_by_name:
            continue
        entry = moves_by_name[name]
        for field in ('power', 'accuracy', 'pp', 'priority', 'type', 'category'):
            if field in ov:
                new_val = ov[field].lower() if field in ('type', 'category') and isinstance(ov[field], str) else ov[field]
                cur_val = entry.get(field)
                if field in ('type', 'category'):
                    new_val = ov[field]
                if cur_val != new_val and not (field == 'power' and cur_val is None and new_val == 0):
                    entry[field] = new_val
        if ov['unlocked'] and not entry.get('inChampions'):
            entry['inChampions'] = True

    used_move_ids = {mid for mvs in learnsets_mod.values() for mid in mvs}

    for mid, ov in move_overrides.items():
        if not ov.get('removed') or mid in used_move_ids:
            continue
        name = move_name_by_id.get(mid)
        if name and name in moves_by_name and moves_by_name[name].get('inChampions'):
            moves_by_name[name]['inChampions'] = False
    flipped = 0
    missing_moves = []
    for mid in sorted(used_move_ids):
        name = move_name_by_id.get(mid)
        if name is None:
            die(f'moves.ts missing move: {mid}')
        if name in moves_by_name:
            if not moves_by_name[name].get('inChampions'):
                moves_by_name[name]['inChampions'] = True
                flipped += 1
        else:
            missing_moves.append(mid)

    for mid in sorted(missing_moves):
        m = moves_main[mid]
        moves.append({
            'name': m['name'],
            'type': m['type'],
            'category': m['category'],
            'description': m['desc'] or '',
            'target': m['target'] or 'normal',
            'inChampions': True,
            'championsVerified': True,
            'power': m['power'] or 0,
            'accuracy': m['accuracy'] if m['accuracy'] is not None else 0,
            'pp': m['pp'] or 10,
            'priority': m['priority'],
            'secondary': m['secondary'],
            'flags': m['flags'],
        })

    #   3. Items
    item_names = {i['name'] for i in items}
    new_items = []
    for iid, it in sorted(items_mod.items()):
        name = it['name'] or (items_main.get(iid) or {}).get('name')
        if not name:
            continue
        if name in item_names:
            continue
        desc = it['desc'] or (items_main.get(iid) or {}).get('desc') or ''
        new_items.append({'name': name, 'description': desc})
    for it in sorted(new_items, key=lambda x: x['name']):
        items.append(it)

    #   4. Abilities
    ability_names = {a['name'] for a in abilities}
    needed = set()
    new_abilities = []
    for sid in target_ids:
        needed.update(dex[sid]['abilities'].values())
    for aid, ab in abilities_mod.items():
        if ab['unlocked']:
            main_ab = abilities_main.get(aid) or {}
            needed.add(main_ab.get('name') or (ab['name'] or ''))
    for name in sorted(n for n in needed if n and n not in ability_names):
        aid = name.lower().replace(' ', '').replace('-', '').replace("'", '')
        desc = (abilities_main.get(aid) or {}).get('desc') or ''
        new_abilities.append({'name': name, 'description': desc, 'championsVerified': True})

    version = load('meta/version.json')
    version['version'] = '1.4.0'
    version['lastUpdated'] = datetime.date.today().isoformat()
    version['regulation'] = 'M-B'
    version['sources'] = [
        'Pokemon Showdown data/pokedex.ts + data/mods/champions (roster, stats, learnsets, items, move changes)',
    ]
    version['counts'] = {
        'pokemon': len(roster),
        'movesInChampions': sum(1 for m in moves if m.get('inChampions')),
        'movesTotal': len(moves),
        'abilities': len(abilities),
        'items': len(items),
        'natures': version['counts'].get('natures', 25),
        'types': 18,
    }

    save('pokemon/roster.json', roster, args.dry_run)
    save('pokemon/base-stats.json', base_stats, args.dry_run)
    save('learnsets/learnsets.json', learnsets, args.dry_run)
    save('moves/moves.json', moves, args.dry_run)
    save('items/items.json', items, args.dry_run)
    save('abilities/abilities.json', abilities, args.dry_run)
    save('meta/version.json', version, args.dry_run)
    print('\nDone. Next, please run `python3 scripts/validate.py`.')

if __name__ == '__main__':
    main()
