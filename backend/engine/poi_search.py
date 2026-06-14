import json, os
import re

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

_pois = None

def load_pois():
    global _pois
    if _pois is None:
        from engine.graph import GEOJSON_MODE
        if GEOJSON_MODE:
            from engine.graph import get_pois
            _pois = get_pois()
        else:
            path = os.path.join(DATA_DIR, 'poi.json')
            with open(path, 'r', encoding='utf-8') as f:
                _pois = json.load(f)
    return _pois

def search(query):
    if not query:
        return []
    q = query.lower().strip()
    results = []
    for poi in load_pois():
        if q == poi['name'].lower():
            return [poi]
        if q in poi['name'].lower():
            results.append(poi)
            continue
        for alias in poi.get('aliases', []):
            if q in alias.lower():
                results.append(poi)
                break
    return results

def find_by_name(name):
    if not name:
        return None
    q = name.lower().strip()
    for poi in load_pois():
        if poi['name'].lower() == q:
            return poi
        for alias in poi.get('aliases', []):
            if alias.lower() == q:
                return poi
    return None

def find_node_id(name):
    poi = find_by_name(name)
    if poi:
        return poi['node_id']
    return None

def get_all_names():
    return [poi['name'] for poi in load_pois()]

def reload():
    global _pois
    _pois = None
