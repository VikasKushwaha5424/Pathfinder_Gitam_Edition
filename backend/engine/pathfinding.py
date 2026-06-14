import heapq
from engine.graph import get_adjacency, get_node_map

def haversine(lat1, lng1, lat2, lng2):
    import math
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(max(0, 1-a)))

def heuristic(node_id, goal_id, node_map):
    a = node_map.get(node_id)
    b = node_map.get(goal_id)
    if not a or not b:
        return 0
    return haversine(a['lat'], a['lng'], b['lat'], b['lng'])

def find_path(start_id, end_id, filters=None, node_map=None, adj=None):
    if node_map is None:
        node_map = get_node_map()
    if adj is None:
        adj = get_adjacency()

    if start_id not in adj or end_id not in adj:
        return {'path': [], 'distance': 0, 'steps': [], 'error': 'No_path_available', 'message': "The destination you're looking for isn't connected by pathways. Please try a different location."}

    start_node = node_map.get(start_id, {})
    end_node = node_map.get(end_id, {})
    
    # Check connected components (zones) to prevent Isolated Island CPU spikes
    if start_node.get('zone', 0) != end_node.get('zone', 0):
        return {'path': [], 'distance': 0, 'steps': [], 'error': 'No_path_available', 'message': "There is no connected path between these two locations."}

    if filters is None:
        filters = {}

    open_set = []
    heapq.heappush(open_set, (0, start_id))

    g_score = {start_id: 0}
    came_from = {}

    visited = set()

    while open_set:
        _, current = heapq.heappop(open_set)

        if current == end_id:
            break

        if current in visited:
            continue
        visited.add(current)

        for edge in adj.get(current, []):
            if filters.get('noStairs') and edge.get('isStairs'):
                continue
            if filters.get('wheelchair') and not edge.get('hasRamp') and not edge.get('hasElevator'):
                continue
            if filters.get('noKeycard') and edge.get('requiresKeycard'):
                continue

            neighbor = edge['node']
            tentative_g = g_score[current] + edge['distance']

            if tentative_g < g_score.get(neighbor, float('inf')):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f = tentative_g + heuristic(neighbor, end_id, node_map)
                heapq.heappush(open_set, (f, neighbor))

    if end_id not in came_from and start_id != end_id:
        return {'path': [], 'distance': 0, 'steps': [], 'error': 'No_path_available', 'message': "The destination you're looking for isn't connected by pathways. Please try a different location."}

    path_ids = []
    current = end_id
    while current in came_from:
        path_ids.append(current)
        current = came_from[current]
    path_ids.append(start_id)
    path_ids.reverse()

    path = []
    for pid in path_ids:
        node = node_map.get(pid)
        if node:
            path.append({'lat': node['lat'], 'lng': node['lng'], 'label': node.get('label', ''), 'id': pid})

    steps = _generate_steps(path_ids, node_map)

    return {
        'path': path,
        'distance': round(g_score.get(end_id, 0)),
        'steps': steps,
    }

def _generate_steps(path_ids, node_map):
    if len(path_ids) < 2:
        return []
    steps = []
    
    for i in range(1, len(path_ids)):
        curr = node_map.get(path_ids[i], {})
        curr_label = curr.get('label', '')
        
        # Only output a step if we hit a named location, not an internal node (n_*)
        if curr_label and not curr_label.startswith('n_'):
            steps.append(f"Walk towards {curr_label}")
            
    # Ensure final destination step exists
    end_label = node_map.get(path_ids[-1], {}).get('label', '')
    if end_label and not end_label.startswith('n_'):
        final_step = f"Arrive at {end_label}"
        if not steps or steps[-1] != final_step:
            steps.append(final_step)
            
    return steps

def find_path_with_snapping(start_lat, start_lng, end_lat, end_lng, to_node_id=None, filters=None, active_route=None):
    from engine.snapping import snap_to_road
    global_adj = get_adjacency()
    global_node_map = get_node_map()
    
    # Create thread-safe shallow overlays
    adj = dict(global_adj)
    node_map = dict(global_node_map)
    
    start_snap = snap_to_road(start_lat, start_lng, active_route)
    if not start_snap:
        return {'path': [], 'distance': 0, 'steps': [], 'error': 'No_path_available', 'message': "Couldn't snap start location to road."}
        
    start_id = "temp_start"
    node_map[start_id] = {
        'id': start_id, 'lat': start_snap['lat'], 'lng': start_snap['lng'], 
        'label': 'Start', 'zone': node_map.get(start_snap['node1_id'], {}).get('zone', 0)
    }
    
    # Inject start node edges cleanly into overlay
    def add_safe_edge(u, v, dist):
        existing = adj.get(u, [])
        filtered = [e for e in existing if e['node'] != v]
        adj[u] = filtered + [{'node': v, 'distance': dist, 'isStairs': False, 'hasRamp': True, 'hasElevator': True}]

    adj[start_id] = []
    add_safe_edge(start_id, start_snap['node1_id'], start_snap['dist_to_node1'])
    if start_snap['node1_id'] != start_snap['node2_id']:
        add_safe_edge(start_id, start_snap['node2_id'], start_snap['dist_to_node2'])
    add_safe_edge(start_snap['node1_id'], start_id, start_snap['dist_to_node1'])
    if start_snap['node1_id'] != start_snap['node2_id']:
        add_safe_edge(start_snap['node2_id'], start_id, start_snap['dist_to_node2'])

    end_id = to_node_id
    end_snap = None
    if not end_id and end_lat and end_lng:
        end_snap = snap_to_road(end_lat, end_lng, active_route)
        if end_snap:
            end_id = "temp_end"
            node_map[end_id] = {
                'id': end_id, 'lat': end_snap['lat'], 'lng': end_snap['lng'], 
                'label': 'Destination', 'zone': node_map.get(end_snap['node1_id'], {}).get('zone', 0)
            }
            adj[end_id] = []
            add_safe_edge(end_id, end_snap['node1_id'], end_snap['dist_to_node1'])
            if end_snap['node1_id'] != end_snap['node2_id']:
                add_safe_edge(end_id, end_snap['node2_id'], end_snap['dist_to_node2'])
            add_safe_edge(end_snap['node1_id'], end_id, end_snap['dist_to_node1'])
            if end_snap['node1_id'] != end_snap['node2_id']:
                add_safe_edge(end_snap['node2_id'], end_id, end_snap['dist_to_node2'])

            # Same-Segment Walk of Shame Shortcut
            if set([start_snap['node1_id'], start_snap['node2_id']]) == set([end_snap['node1_id'], end_snap['node2_id']]):
                dist = haversine(start_snap['lat'], start_snap['lng'], end_snap['lat'], end_snap['lng'])
                adj[start_id].append({'node': end_id, 'distance': dist, 'isStairs': False, 'hasRamp': True, 'hasElevator': True})
                adj[end_id].append({'node': start_id, 'distance': dist, 'isStairs': False, 'hasRamp': True, 'hasElevator': True})

    if not end_id:
        return {'path': [], 'distance': 0, 'steps': [], 'error': 'No_path_available', 'message': "No destination provided."}
    
    result = find_path(start_id, end_id, filters, node_map, adj)
    result['start_heading'] = start_snap['heading']
    result['snapped_start'] = {'lat': start_snap['lat'], 'lng': start_snap['lng']}
    if end_snap:
        result['snapped_end'] = {'lat': end_snap['lat'], 'lng': end_snap['lng']}
    return result
