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
    c = 2 * math.atan2(math.sqrt(max(0, a)), math.sqrt(max(0, 1 - a)))

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

def extract_pois():
    data = load_geojson()
    pois = []
    
    for feature in data.get('features', []):
        geom_type = feature.get('geometry', {}).get('type')
        coords = feature.get('geometry', {}).get('coordinates', [])
        
        # Handle both Points and Polygons (calculate centroid for polygons)
        if geom_type == 'Point':
            lng, lat = coords[0], coords[1]
        elif geom_type == 'Polygon' and len(coords) > 0 and len(coords[0]) > 0:
            poly_coords = coords[0]
            lng = sum(c[0] for c in poly_coords) / len(poly_coords)
            lat = sum(c[1] for c in poly_coords) / len(poly_coords)
        else:
            continue
            
        props = feature.get('properties', {})
        name = props.get('name') or props.get('Name') or props.get('title') or props.get('building_name') or props.get('label') or props.get('id') or 'Unknown POI'
        category = props.get('category') or props.get('Category') or 'general'
        
        parts = [p.lower() for p in name.split()]
        aliases = [name.lower()] + parts
        
        pois.append({
            'name': name,
            'category': category,
            'lat': lat,
            'lng': lng,
            'aliases': list(set(aliases)),
            'node_id': None,
            'properties': props
        })
    return pois

def extract_roads():
    data = load_geojson()
    roads = []
    idx = 0
    
    for feature in data.get('features', []):
        geom_type = feature.get('geometry', {}).get('type')
        coords = feature.get('geometry', {}).get('coordinates', [])
        props = feature.get('properties', {})
        name = props.get('name') or props.get('Name') or 'road'
        category = props.get('category') or props.get('Category') or 'road'

        if geom_type == 'LineString':
            road_coords = [{'lat': c[1], 'lng': c[0]} for c in coords]
            roads.append({'id': f"road_{idx}", 'name': name, 'category': category, 'coordinates': road_coords, 'properties': props})
            idx += 1
        elif geom_type == 'MultiLineString':
            for line in coords:
                road_coords = [{'lat': c[1], 'lng': c[0]} for c in line]
                roads.append({'id': f"road_{idx}", 'name': name, 'category': category, 'coordinates': road_coords, 'properties': props})
                idx += 1
    return roads

def build_graph_from_roads():
    roads = extract_roads()
    
    # 1. Collect unique coordinate vertices
    # We use a rounded coordinate string to prevent float precision issues
    def coord_key(lat, lng, level):
        return f"{lat:.6f},{lng:.6f},{level}"
    
    vertex_map = {} # key -> node_id
    nodes_list = []
    
    node_counter = 0
    for road in roads:
        level = road['properties'].get('level', 0)
        for c in road['coordinates']:
            key = coord_key(c['lat'], c['lng'], level)
            if key not in vertex_map:
                node_id = f"n_{node_counter}"
                vertex_map[key] = node_id
                nodes_list.append({
                    'id': node_id,
                    'lat': c['lat'],
                    'lng': c['lng'],
                    'level': level,
                    'type': 'road_vertex',
                    'label': ''
                })
                node_counter += 1
                
    # Build adjacency
    adjacency_dict = {}
    
    for road in roads:
        coords = road['coordinates']
        props = road['properties']
        level = props.get('level', 0)
        
        is_stairs = props.get('isStairs', False)
        req_keycard = props.get('requiresKeycard', False)
        has_ramp = props.get('hasRamp', False)
        has_elevator = props.get('hasElevator', False)
        
        for i in range(len(coords) - 1):
            c1 = coords[i]
            c2 = coords[i+1]
            
            k1 = coord_key(c1['lat'], c1['lng'], level)
            k2 = coord_key(c2['lat'], c2['lng'], level)
            
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
            
    # Calculate connected components (Zones)
    zone_map = {}
    current_zone = 0
    visited = set()
    for node in nodes_list:
        if node['id'] not in visited:
            current_zone += 1
            queue = [node['id']]
            while queue:
                curr = queue.pop(0)
                if curr not in visited:
                    visited.add(curr)
                    zone_map[curr] = current_zone
                    for edge in adjacency_dict.get(curr, []):
                        if edge['node'] not in visited:
                            queue.append(edge['node'])
    
    for n in nodes_list:
        n['zone'] = zone_map.get(n['id'], 0)
            
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
        
        if best_node and best_dist <= 150:
            poi['node_id'] = best_node['id']
            best_node['label'] = poi['name']
        elif best_node:
            print(f"Warning: POI {poi['name']} is {best_dist}m away from nearest road. Marked disconnected.")
            
    return nodes_list, adjacency_dict, pois

_nodes = None
_edges = None
_adj = None
_node_map = None
_pois_from_geojson = None

def _ensure_geojson_loaded():
    global _nodes, _adj, _pois_from_geojson, _node_map, _edges
    if _nodes is None or _adj is None:
        _nodes, _adj, _pois_from_geojson = build_graph_from_roads()
        _node_map = None
        _edges = None

def get_pois():
    _ensure_geojson_loaded()
    return _pois_from_geojson

def get_nodes():
    _ensure_geojson_loaded()
    return _nodes

def get_edges():
    global _edges
    _ensure_geojson_loaded()
    if _edges is None:
        _edges = []
        seen = set()
        for source, targets in _adj.items():
            for t in targets:
                target = t['node']
                k1, k2 = (source, target) if source < target else (target, source)
                if (k1, k2) not in seen:
                    seen.add((k1, k2))
                    _edges.append({
                        'source': source,
                        'target': target,
                        'distance': t['distance'],
                        'isStairs': t.get('isStairs', False),
                        'requiresKeycard': t.get('requiresKeycard', False),
                        'hasRamp': t.get('hasRamp', False),
                        'hasElevator': t.get('hasElevator', False)
                    })
    return _edges

def get_node_map():
    global _node_map
    _ensure_geojson_loaded()
    if _node_map is None:
        _node_map = {}
        for n in get_nodes():
            _node_map[n['id']] = n
    return _node_map

def get_adjacency():
    _ensure_geojson_loaded()
    return _adj

def get_node_by_id(node_id):
    return get_node_map().get(node_id)

def find_nearest_node(lat, lng):
    best = None
    best_dist = float('inf')
    for n in get_nodes():
        dlat = math.radians(n['lat'] - lat)
        dlng = math.radians(n['lng'] - lng)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat)) * math.cos(math.radians(n['lat'])) * math.sin(dlng/2)**2
        d = 6371000 * 2 * math.atan2(math.sqrt(max(0, a)), math.sqrt(max(0, 1-a)))
        if d < best_dist:
            best_dist = d
            best = n
    return best
