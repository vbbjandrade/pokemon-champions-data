#   Utility for parsing `data/*.ts` files from smogon/pokemon-showdown

import re

def parse_blocks(src: str) -> dict:
    blocks = {}
    for m in re.finditer(r'\n\s*(\w+)\s*:\s*\{', src):
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

# def field_str(body: str, name: str) -> str | None:
#     m = re.search(rf'\b{name}\s*:\s*["\']([^"\']*)["\']', body)
#     return m.group(1) if m else None

def has_object(body: str, name: str) -> bool:
    return bool(re.search(rf'\b{re.escape(name)}\s*:\s*\{{', body))

def field_str(body: str, key_path: str) -> str | None:
    parts = key_path.split('.')
    current_body = body

    for parent_key in parts[:-1]:
        match = re.search(rf'\b{re.escape(parent_key)}\s*:\s*\{{', current_body)
        if not match:
            return None
        
        start_idx = match.end() - 1
        depth = 0
        end_idx = -1
        
        for i in range(start_idx, len(current_body)):
            c = current_body[i]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    end_idx = i
                    break
                    
        if end_idx == -1:
            return None
            
        current_body = current_body[start_idx + 1:end_idx]

    target_key = parts[-1]
    match = re.search(rf'\b{re.escape(target_key)}\s*:\s*["\']([^"\']*)["\']', current_body)
    return match.group(1) if match else None

def field_num(body: str, name: str) -> int | None:
    m = re.search(rf'\b{name}\s*:\s*(-?\d+)\b', body)
    return int(m.group(1)) if m else None

def parse_types(body: str) -> list[str] | None:
    m = re.search(r'types\s*:\s*\[([^\]]*)\]', body)
    if not m:
        return None
    return re.findall(r'["\']([^"\']+)["\']', m.group(1))

def parse_base_stats(body: str) -> dict[str, int] | None:
    m = re.search(r'baseStats\s*:\s*\{([^}]+)\}', body, re.DOTALL)
    if not m:
        return None
    stats_body = m.group(1)
    stats = {}
    for stat in ['hp', 'atk', 'def', 'spa', 'spd', 'spe']:
        val = field_num(stats_body, stat)
    return stats if len(stats) == 6 else None

def parse_abilities(body: str) -> dict[str, str] | None:
    m = re.search(r'abilities\s*:\s*\{([^}]*)\}', body, re.DOTALL)
    if not m:
        return None
    
    out = {}
    for slot, name in re.findall(r'["\']?(\w+)["\']?\s*:\s*["\']([^"\']+)["\']', m.group(1)):
        out[slot] = name
        
    return out if out else None

def parse_genders(body: str) -> list[str]:
    gender_match = re.search(r'\bgender\s*:\s*["\']([MFN])["\']', body)
    if gender_match:
        return [gender_match.group(1)]

    ratio_match = re.search(r'\bgenderRatio\s*:\s*\{([^}]+)\}', body)
    if ratio_match:
        ratio_body = ratio_match.group(1)
        # Extract keys (e.g., M, F) regardless of quotes or spacing
        keys = re.findall(r'["\']?([MFN])["\']?\s*:', ratio_body)
        if keys:
            return keys

    return ["M", "F"]

def parse_required_move_direct(body: str) -> str | None:
    return field_str(body, "requiredMove")

def parse_can_gigantamax(body: str) -> str | None:
    return field_str(body, "canGigantamax")

def parse_can_evolve(body: str) -> bool:
    match = re.search(r'evos\s*:\s*\[([^\]]*)\]', body)
    if not match:
        return False
    
    content = match.group(1).strip()
    return len(content) > 0

def parse_pokedex(src: str) -> dict:
    raw_blocks = parse_blocks(src)
    pokedex = {}
    name_to_key = {}

    for key, body in raw_blocks.items():
        name = field_str(body, 'name')
        if name:
            name_to_key[name] = key

        pokedex[key] = {
            'dexNumber': field_num(body, 'num'),
            'name': name,
            'types': parse_types(body),
            'form': field_str(body, 'forme'),
            'abilities': parse_abilities(body),
            'weightKg': field_num(body, 'weightkg'),
            'requiredItem': field_str(body, 'requiredItem'),
            'requiredMove': parse_required_move_direct(body),
            'canEvolve': parse_can_evolve(body),
            'genders': parse_genders(body),
            'baseStats': parse_base_stats(body),

            '_baseSpecies': field_str(body, 'baseSpecies'),
            '_canGigantamax': parse_can_gigantamax(body),
        }

    for mon in pokedex.values():
        if not mon['requiredMove'] and mon['form'] == 'Gmax':
            base_name = mon['_baseSpecies']
            if base_name in name_to_key:
                base_key = name_to_key[base_name]
                base_entry = pokedex[base_key]
                mon['requiredMove'] = base_entry.get('_canGigantamax')

    for mon in pokedex.values():
        mon.pop('_baseSpecies', None)
        mon.pop('_canGigantamax', None)

    return pokedex

def parse_legal_species(formats_src: str) -> set:
    legal = set()
    for key, body in parse_blocks(formats_src).items():
        if 'isNonstandard' in body:
            continue
        legal.add(key)
    return legal

def parse_learnsets(src: str) -> dict:
    out = {}
    for key, body in parse_blocks(src).items():
        out[key] = re.findall(r'\n\t\t\t(\w+): \[', body)
    return out

def parse_move_mods(mod_src: str) -> dict:
    out = {}
    for key, body in parse_blocks(mod_src).items():
        entry = {
            'inherit': 'inherit: true' in body,
        }

        if 'isNonstandard' in body:
            entry['isNonstandard'] = field_str(body, 'isNonstandard')

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

def parse_flags(body: str) -> dict[str, int]:
    match = re.search(r'\bflags\s*:\s*\{([^}]*)\}', body)
    if not match:
        return {}
    
    flags_body = match.group(1)
    # Matches keys like `protect: 1` or `'protect': 1`
    matches = re.findall(r'["\']?(\w+)["\']?\s*:\s*(\d+)', flags_body)
    return {key: int(val) for key, val in matches}

def parse_secondary(body: str) -> dict | None:
    match = re.search(r'\bsecondary\s*:\s*\{', body)
    if not match:
        return None
    
    start_idx = match.end() - 1
    depth = 0
    end_idx = -1
    
    for i in range(start_idx, len(body)):
        if body[i] == '{':
            depth += 1
        elif body[i] == '}':
            depth -= 1
            if depth == 0:
                end_idx = i + 1
                break
                
    if end_idx == -1:
        return None

    sec_body = body[start_idx:end_idx]
    
    return {
        'chance': field_num(sec_body, 'chance'),
        'status': field_str(sec_body, 'status'),
        'volatileStatus': field_str(sec_body, 'volatileStatus'),
        'boosts': parse_base_stats(sec_body)
    }

def parse_moves_main(src: str) -> dict:
    out = {}
    for key, body in parse_blocks(src).items():
        if field_str(body, 'isNonstandard') == "CAP": continue
        out[key] = {
            'name': field_str(body, 'name'),
            'type': field_str(body, 'type'),
            'category': field_str(body, 'category'),
            'power': field_num(body, 'basePower'),
            'accuracy': field_num(body, 'accuracy'),
            'pp': field_num(body, 'pp'),
            'priority': field_num(body, 'priority') or 0,
            'target': field_str(body, 'target'),
            'desc': field_str(body, 'desc') or field_str(body, 'shortDesc'),
            'isNonstandard': field_str(body, 'isNonstandard'),
            # 'secondary': parse_secondary(body),
            # 'flags': field_flags(body),
        }
    return out

def parse_items(src: str) -> dict:
    out = {}
    for key, body in parse_blocks(src).items():
        out[key] = {
            'name': field_str(body, 'name'),
            'desc': field_str(body, 'desc') or field_str(body, 'shortDesc'),
            'inherit': 'inherit: true' in body,
        }
    return out

def parse_abilities_entries(src: str) -> dict:
    out = {}
    for key, body in parse_blocks(src).items():
        if field_str(body, 'isNonstandard') == "CAP": continue
        out[key] = {
            'name': field_str(body, 'name'),
        }
    return out

def parse_abilities_descriptions(src: str) -> dict:
    out = {}
    for key, body in parse_blocks(src).items():
        has_champions = has_object(body, 'champions')
        
        out[key] = {
            'name': field_str(body, 'name'),
            'desc': field_str(body, 'champions.desc' if has_champions else 'desc'),
            'shortDesc': field_str(body, 'champions.shortDesc' if has_champions else 'shortDesc'),
        }

_REGIONAL = {
    'Alola': 'Alolan', 
    'Galar': 'Galarian', 
    'Hisui': 'Hisuian', 
    'Paldea': 'Paldean'
}

def to_repo_name(sd_name: str) -> str:
    m = re.match(r'^(.+)-Mega-([XYZ])$', sd_name)
    if m:
        return f'Mega {m.group(1)} {m.group(2)}'
    m = re.match(r'^(.+)-Mega$', sd_name)
    if m:
        return f'Mega {m.group(1)}'
    m = re.match(r'^(.+)-Gmax$', sd_name)
    if m:
        return f'Gmax {m.group(1)}'
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
