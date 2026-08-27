#!/usr/bin/env python3
#   Post-generation master data integrity validation

#   Validation checks:
#   1. Referential integrity: roster ⇔ base-stats ⇔ learnsets ⇔ moves ⇔ abilities
#   2. Value validity: Type names, stat ranges, duplicate names
#   3. Consistency: `counts` in `meta/version.json` match actual values

#   Usage:
#   python3 scripts/validate.py [--base <git-ref>]   # Default: HEAD

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent

VALID_TYPES = {
    'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison',
    'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark',
    'Steel', 'Fairy',
}

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def load(path):
    return json.loads((ROOT / path).read_text())


def load_at(ref, path):
    out = subprocess.run(['git', 'show', f'{ref}:{path}'],
                         capture_output=True, text=True, cwd=ROOT)
    if out.returncode != 0:
        return None
    return json.loads(out.stdout)

def check_referential():
    roster = load('pokemon/roster.json')
    base_stats = load('pokemon/base-stats.json')
    learnsets = load('learnsets/learnsets.json')
    moves = load('moves/moves.json')
    items = load('items/items.json')
    abilities = load('abilities/abilities.json')

    names = [p['name'] for p in roster]
    dupes = {n for n in names if names.count(n) > 1}
    if dupes:
        err(f'roster duplicates: {sorted(dupes)}')

    stats_keys = {(e['name']) for e in base_stats}
    move_names = {m['name'] for m in moves}
    champ_moves = {m['name'] for m in moves if m.get('inChampions')}
    ability_names = {a['name'] for a in abilities}
    item_names = [i['name'] for i in items]
    if len(item_names) != len(set(item_names)):
        err('duplicate items')

    for p in roster:
        if p['name'] not in stats_keys:
            err(f"missing base-stats for: {p['name']}")
        if p['name'] not in learnsets:
            err(f"missing learnset for: {p['name']}")
        for t in p['types']:
            if t not in VALID_TYPES:
                err(f"invalid type: {p['name']} {t}")
        for slot, ab in p['abilities'].items():
            if ab not in ability_names:
                err(f"missing abilities: {p['name']} -> {ab}")

    for e in base_stats:
        for k in ('hp', 'atk', 'def', 'spa', 'spd', 'spe'):
            if not (1 <= e[k] <= 255):
                err(f"base stats outside range for: {e['name']} {k}={e[k]}")
        if e['total'] != sum(e[k] for k in ('hp', 'atk', 'def', 'spa', 'spd', 'spe')):
            err(f"base stat total mismatch for: {e['name']}")

    for name, entry in learnsets.items():
        if not entry['moves']:
            warn(f'empty learnset: {name}')
        for mv in entry['moves']:
            if mv['name'] not in move_names:
                err(f"missing moves from learnset: {name} -> {mv['name']}")
            elif mv['name'] not in champ_moves:
                err(f"learnset moves not in champions: {name} -> {mv['name']}")

    print(f'referential integrity: roster {len(roster)} / learnsets {len(learnsets)} / '
          f'moves {len(moves)} (champions {len(champ_moves)}) / '
          f'items {len(items)} / abilities {len(abilities)}')


def check_version_counts():
    version = load('meta/version.json')
    actual = {
        'pokemon': len(load('pokemon/roster.json')),
        'movesTotal': len(load('moves/moves.json')),
        'movesInChampions': sum(1 for m in load('moves/moves.json') if m.get('inChampions')),
        'abilities': len(load('abilities/abilities.json')),
        'items': len(load('items/items.json')),
    }
    for k, v in actual.items():
        if version['counts'].get(k) != v:
            err(f"version.json counts.{k}={version['counts'].get(k)} while data counts {v}")
    print(f"version: v{version['version']} regulation={version.get('regulation', '?')} counts OK")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='HEAD', help='追記チェックの基準 git リビジョン')
    args = ap.parse_args()

    print('1) referential integrity check')
    check_referential()
    print('\n2) version count check')
    check_version_counts()

    if warnings:
        print('\nWARNINGS:')
        for w in warnings:
            print(f'  {w}')
    if errors:
        print('\nERRORS:', file=sys.stderr)
        for e in errors:
            print(f'  {e}', file=sys.stderr)
        sys.exit(1)
    print('\n✅ OK')


if __name__ == '__main__':
    main()
