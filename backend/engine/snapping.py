import math

def calculate_heading(lat1, lng1, lat2, lng2):
    """Returns bearing in degrees (0-360) from point 1 to point 2."""
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    lng_diff = math.radians(lng2 - lng1)
    
    x = math.sin(lng_diff) * math.cos(lat2_rad)
    y = math.cos(lat1_rad) * math.sin(lat2_rad) - (math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(lng_diff))
    
    initial_bearing = math.atan2(x, y)
    initial_bearing = math.degrees(initial_bearing)
    compass_bearing = (initial_bearing + 360) % 360
    return compass_bearing

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

def perpendicular_distance(lat, lng, lat1, lng1, lat2, lng2):
    # Vector projection to find perpendicular distance and closest point on segment
    # Returns (distance_meters, snap_lat, snap_lng)
    # Convert lat/lng to approximate meters (using small angle approx relative to a local origin)
    # Origin = (lat1, lng1)
    kx = math.cos(math.radians(lat1)) * 111319.9
    ky = 111319.9
    
    dx = (lng - lng1) * kx
    dy = (lat - lat1) * ky
    
    seg_dx = (lng2 - lng1) * kx
    seg_dy = (lat2 - lat1) * ky
    
    seg_len_sq = seg_dx*seg_dx + seg_dy*seg_dy
    if seg_len_sq == 0:
        return haversine_distance(lat, lng, lat1, lng1), lat1, lng1
        
    t = max(0, min(1, (dx*seg_dx + dy*seg_dy) / seg_len_sq))
    
    snap_lng = lng1 + t * (lng2 - lng1)
    snap_lat = lat1 + t * (lat2 - lat1)
    
    dist = haversine_distance(lat, lng, snap_lat, snap_lng)
    return dist, snap_lat, snap_lng

def snap_to_road(lat, lng, active_route=None):
    """
    Finds the closest road segment to the given point using perpendicular projection.
    Returns {lat, lng, road_id, distance, heading, node1_id, node2_id}
    (node1_id and node2_id help attach it to the graph)
    """
    best_dist = float('inf')
    best_snap = None
    
    # We need to find the specific segment in the graph or roads.
    # We can iterate through the graph's adjacency list to find the closest segment.
    from engine.graph import get_adjacency, get_nodes, get_node_map
    adj = get_adjacency()
    node_map = get_node_map()
    
    seen_edges = set()
    
    for u_id, edges in adj.items():
        u = node_map.get(u_id)
        if not u: continue
        for e in edges:
            v_id = e['node']
            v = node_map.get(v_id)
            if not v: continue
            
            # Avoid duplicate undirected edges
            edge_key = tuple(sorted([u_id, v_id]))
            if edge_key in seen_edges:
                continue
            seen_edges.add(edge_key)
            
            dist, snap_lat, snap_lng = perpendicular_distance(lat, lng, u['lat'], u['lng'], v['lat'], v['lng'])
            
            effective_dist = dist
            if active_route and (u_id in active_route or v_id in active_route):
                effective_dist = max(0, dist - 15.0)

            if effective_dist < best_dist:
                best_dist = effective_dist
                heading = calculate_heading(snap_lat, snap_lng, v['lat'], v['lng'])
                best_snap = {
                    'lat': snap_lat,
                    'lng': snap_lng,
                    'distance': dist,
                    'heading': heading,
                    'node1_id': u_id,
                    'node2_id': v_id,
                    'dist_to_node1': haversine_distance(snap_lat, snap_lng, u['lat'], u['lng']),
                    'dist_to_node2': haversine_distance(snap_lat, snap_lng, v['lat'], v['lng']),
                    'road_id': e.get('road_id', 'unknown'),
                    'edge_data': e
                }
                
    if best_dist > 50 and best_snap:
        # Fallback to nearest endpoint if perpendicular distance > 50m
        best_snap['lat'] = node_map[best_snap['node1_id']]['lat']
        best_snap['lng'] = node_map[best_snap['node1_id']]['lng']
        best_snap['distance'] = haversine_distance(lat, lng, best_snap['lat'], best_snap['lng'])
        best_snap['dist_to_node1'] = 0
    
    return best_snap
