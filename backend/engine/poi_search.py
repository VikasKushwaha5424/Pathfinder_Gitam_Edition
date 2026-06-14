import re
import difflib

from engine.graph import get_pois

def load_pois():
    return get_pois()

import difflib

def search(query):
    if not query:
        return []
    q = query.lower().strip()
    results = []
    
    # Exact and fuzzy matching
    for poi in load_pois():
        # Exact match
        if q == poi['name'].lower():
            return [poi]
            
        # Substring or high similarity
        name_ratio = difflib.SequenceMatcher(None, q, poi['name'].lower()).ratio()
        if q in poi['name'].lower() or name_ratio > 0.8:
            results.append(poi)
            continue
            
        # Check aliases
        for alias in poi.get('aliases', []):
            alias_ratio = difflib.SequenceMatcher(None, q, alias.lower()).ratio()
            if q in alias.lower() or alias_ratio > 0.8:
                results.append(poi)
                break
                
    return results

def find_by_name(name):
    if not name:
        return None
    q = name.lower().strip()
    best_match = None
    best_ratio = 0
    
    for poi in load_pois():
        if poi['name'].lower() == q:
            return poi
            
        name_ratio = difflib.SequenceMatcher(None, q, poi['name'].lower()).ratio()
        if name_ratio > best_ratio:
            best_ratio = name_ratio
            best_match = poi
            
        for alias in poi.get('aliases', []):
            if alias.lower() == q:
                return poi
            alias_ratio = difflib.SequenceMatcher(None, q, alias.lower()).ratio()
            if alias_ratio > best_ratio:
                best_ratio = alias_ratio
                best_match = poi
                
    if best_ratio > 0.8:
        return best_match
    return None

def find_node_id(name):
    poi = find_by_name(name)
    if poi:
        return poi['node_id']
    return None

def get_all_names():
    return [poi['name'] for poi in load_pois()]
