import json
import os
import math

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

_geojson_cache = None

def load_geojson():
    global _geojson_cache
    if _geojson_cache is None:
        path = os.path.join(DATA_DIR, 'map.geojson')
        try:
            with open(path, 'r', encoding='utf-8') as f:
                _geojson_cache = json.load(f)
        except FileNotFoundError:
            _geojson_cache = {"type": "FeatureCollection", "features": []}
    return _geojson_cache

def reload():
    global _geojson_cache
    _geojson_cache = None

def extract_pois():
    data = load_geojson()
    pois = []
    
    for feature in data.get('features', []):
        if feature.get('geometry', {}).get('type') == 'Point':
            coords = feature['geometry']['coordinates']
            lng, lat = coords[0], coords[1]
            props = feature.get('properties', {})
            
            # Use 'name' or 'title' or 'Name' etc.
            name = props.get('name') or props.get('Name') or props.get('title') or 'Unknown POI'
            category = props.get('category') or props.get('Category') or 'general'
            
            # Auto-generate aliases
            parts = [p.lower() for p in name.split()]
            aliases = [name.lower()] + parts
            
            pois.append({
                'name': name,
                'category': category,
                'lat': lat,
                'lng': lng,
                'aliases': list(set(aliases)),
                # We will assign node_id below based on nearest road node
                'node_id': None,
                'properties': props
            })
    return pois

def extract_roads():
    data = load_geojson()
    roads = []
    idx = 0
    
    for feature in data.get('features', []):
        if feature.get('geometry', {}).get('type') == 'LineString':
            coords = feature['geometry']['coordinates']
            road_coords = [{'lat': c[1], 'lng': c[0]} for c in coords]
            props = feature.get('properties', {})
            roads.append({
                'id': f"road_{idx}",
                'name': props.get('name') or props.get('Name') or 'road',
                'category': props.get('category') or props.get('Category') or 'road',
                'coordinates': road_coords,
                'properties': props
            })
            idx += 1
    return roads

def build_graph_from_roads():
    roads = extract_roads()
    
    # 1. Collect unique coordinate vertices
    # We use a rounded coordinate string to prevent float precision issues
    def coord_key(lat, lng):
        return f"{lat:.6f},{lng:.6f}"
    
    vertex_map = {} # key -> node_id
    nodes_list = []
    
    node_counter = 0
    for road in roads:
        for c in road['coordinates']:
            key = coord_key(c['lat'], c['lng'])
            if key not in vertex_map:
                node_id = f"n_{node_counter}"
                vertex_map[key] = node_id
                nodes_list.append({
                    'id': node_id,
                    'lat': c['lat'],
                    'lng': c['lng'],
                    'type': 'road_vertex',
                    'label': ''
                })
                node_counter += 1
                
    # Build adjacency
    adjacency_dict = {}
    
    for road in roads:
        coords = road['coordinates']
        props = road['properties']
        
        is_stairs = props.get('isStairs', False)
        req_keycard = props.get('requiresKeycard', False)
        has_ramp = props.get('hasRamp', False)
        has_elevator = props.get('hasElevator', False)
        
        for i in range(len(coords) - 1):
            c1 = coords[i]
            c2 = coords[i+1]
            
            k1 = coord_key(c1['lat'], c1['lng'])
            k2 = coord_key(c2['lat'], c2['lng'])
            
            id1 = vertex_map[k1]
            id2 = vertex_map[k2]
            
            dist = haversine_distance(c1['lat'], c1['lng'], c2['lat'], c2['lng'])
            if dist < 0.5:
                # Skip very small segments
                continue
                
            edge_data1 = {
                'node': id2,
                'distance': round(dist, 1),
                'isStairs': is_stairs,
                'requiresKeycard': req_keycard,
                'hasRamp': has_ramp or not is_stairs,
                'hasElevator': has_elevator,
                'road_id': road['id']
            }
            
            edge_data2 = {
                'node': id1,
                'distance': round(dist, 1),
                'isStairs': is_stairs,
                'requiresKeycard': req_keycard,
                'hasRamp': has_ramp or not is_stairs,
                'hasElevator': has_elevator,
                'road_id': road['id']
            }
            
            adjacency_dict.setdefault(id1, []).append(edge_data1)
            adjacency_dict.setdefault(id2, []).append(edge_data2)
            
    # Snap POIs to nearest nodes to populate node_id and node label
    pois = extract_pois()
    for poi in pois:
        best_node = None
        best_dist = float('inf')
        for n in nodes_list:
            dist = haversine_distance(poi['lat'], poi['lng'], n['lat'], n['lng'])
            if dist < best_dist:
                best_dist = dist
                best_node = n
        
        if best_node:
            poi['node_id'] = best_node['id']
            best_node['label'] = poi['name']
            
    return nodes_list, adjacency_dict, pois
