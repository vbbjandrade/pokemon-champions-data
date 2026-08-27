#   Utility for parsing `data/*.ts` files from smogon/pokemon-showdown

import re

def parse_blocks(src: str) -> dict:
    blocks = {}
    for m in re.finditer(r'\n\t(\w+): \{', src):
        key = m.group(1)
        i = m.end() - 1
        depth = 0
        for j in range(i, len(src)):
            c = src[j]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    blocks[key] = src[i + 1:j]
                    break
    return blocks


def field_str(body: str, name: str):
    m = re.search(rf'\b{name}: "([^"]*)"', body)
    return m.group(1) if m else None

def field_num(body: str, name: str):
    m = re.search(rf'\b{name}: (-?\d+)[,\n]', body)
    return int(m.group(1)) if m else None

def field_object(body: str, name: str) -> str | None:
    pattern = r'\b{}\s*:\s*(\{{.*?)(?:,|\n\s*\}}|\n\s*[a-zA-Z_$]|$)'.format(re.escape(name))
    m = re.search(pattern, body, re.DOTALL)
    return m.group(1).strip() if m else None

def parse_types(body: str):
    m = re.search(r'types: \[([^\]]*)\]', body)
    if not m:
        return None
    return re.findall(r'"([^"]+)"', m.group(1))


def parse_base_stats(body: str):
    m = re.search(
        r'baseStats: \{\s*hp: (\d+),\s*atk: (\d+),\s*def: (\d+),'
        r'\s*spa: (\d+),\s*spd: (\d+),\s*spe: (\d+)\s*\}', body)
    if not m:
        return None
    keys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
    return dict(zip(keys, map(int, m.groups())))


def parse_abilities(body: str):
    m = re.search(r'abilities: \{([^}]*)\}', body)
    if not m:
        return None
    out = {}
    for slot, name in re.findall(r'(\w+): "([^"]+)"', m.group(1)):
        out[slot] = name
    return out


def parse_pokedex(src: str) -> dict:
    out = {}
    for key, body in parse_blocks(src).items():
        out[key] = {
            'num': field_num(body, 'num'),
            'name': field_str(body, 'name'),
            'types': parse_types(body),
            'baseStats': parse_base_stats(body),
            'abilities': parse_abilities(body),
        }
    return out


def parse_legal_species(formats_src: str) -> set:
    legal = set()
    for key, body in parse_blocks(formats_src).items():
        if 'isNonstandard' in body:
            continue
        if re.search(r'tier: "Illegal"', body):
            continue
        legal.add(key)
    return legal


def parse_learnsets(src: str) -> dict:
    out = {}
    for key, body in parse_blocks(src).items():
        out[key] = re.findall(r'\n\t\t\t(\w+): \[', body)
    return out


def parse_move_overrides(mod_src: str) -> dict:
    out = {}
    for key, body in parse_blocks(mod_src).items():
        entry = {
            'inherit': 'inherit: true' in body,
            'unlocked': re.search(r'isNonstandard: null', body) is not None,
            'removed': re.search(r'isNonstandard: "Past"', body) is not None,
        }
        for src_field, dst in [
        ('basePower', 'power'), 
        ('accuracy', 'accuracy'),
        ('pp', 'pp'),
        ('priority', 'priority')]:
            v = field_num(body, src_field)
            if v is not None:
                entry[dst] = v
        t = field_str(body, 'type')
        if t:
            entry['type'] = t
        c = field_str(body, 'category')
        if c:
            entry['category'] = c
        out[key] = entry
    return out

def parse_moves_main(src: str) -> dict:
    out = {}
    for key, body in parse_blocks(src).items():
        out[key] = {
            'name': field_str(body, 'name'),
            'type': field_str(body, 'type'),
            'category': field_str(body, 'category'),
            'power': field_num(body, 'basePower'),
            'accuracy': field_num(body, 'accuracy'),
            'pp': field_num(body, 'pp'),
            'priority': field_num(body, 'priority') or 0,
            'target': field_str(body, 'target'),
            'secondary': field_object(body, 'secondary'),
            'flags': field_object(body, 'flags'),
            'desc': field_str(body, 'desc') or field_str(body, 'shortDesc'),
        }
    return out

def parse_items(src: str) -> dict:
    out = {}
    for key, body in parse_blocks(src).items():
        out[key] = {
            'name': field_str(body, 'name'),
            'desc': field_str(body, 'desc') or field_str(body, 'shortDesc'),
            'unlocked': re.search(r'isNonstandard: null', body) is not None,
            'inherit': 'inherit: true' in body,
        }
    return out


def parse_abilities_ts(src: str) -> dict:
    out = {}
    for key, body in parse_blocks(src).items():
        out[key] = {
            'name': field_str(body, 'name'),
            'desc': field_str(body, 'shortDesc') or field_str(body, 'desc'),
            'unlocked': re.search(r'isNonstandard: null', body) is not None,
        }
    return out

_REGIONAL = {
    'Alola': 'Alolan', 
    'Galar': 'Galarian', 
    'Hisui': 'Hisuian', 
    'Paldea': 'Paldean'
}

def to_repo_name(sd_name: str) -> str:
    m = re.match(r'^(.+)-Mega-([XY])$', sd_name)
    if m:
        return f'Mega {m.group(1)} {m.group(2)}'
    m = re.match(r'^(.+)-Mega$', sd_name)
    if m:
        return f'Mega {m.group(1)}'
    for suffix, prefix in _REGIONAL.items():
        if sd_name.endswith(f'-{suffix}'):
            return f"{prefix} {sd_name[:-len(suffix) - 1]}"
    return sd_name

_FORM_SUFFIXES = {
    'Heat', 'Wash', 'Frost', 'Fan', 'Mow',   # Rotom forms
    'Midnight', 'Dusk',                      # Lycanroc forms
    'Small', 'Large', 'Super',               # Size-based forms (e.g. Gourgeist)
    'F',                                     # Gender-based forms (e.g. Basculegion, Indeedee)
    'Blaze', 'Aqua',                         # Paldean Tauros breeds
}

def repo_form(sd_name: str) -> str:
    if re.search(r'-Mega(-[XY])?$', sd_name):
        return 'Mega'
    for suffix in _REGIONAL:
        if sd_name.endswith(f'-{suffix}'):
            return 'Regional'
    suffix = sd_name.rsplit('-', 1)[-1]
    if suffix in _FORM_SUFFIXES:
        return suffix
    return 'Base'
