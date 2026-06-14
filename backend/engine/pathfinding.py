import heapq
from engine.graph import get_adjacency, get_node_map, get_node_by_id

def haversine(lat1, lng1, lat2, lng2):
    import math
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def heuristic(node_id, goal_id, node_map):
    a = node_map.get(node_id)
    b = node_map.get(goal_id)
    if not a or not b:
        return 0
    return haversine(a['lat'], a['lng'], b['lat'], b['lng'])

def find_path(start_id, end_id, filters=None):
    adj = get_adjacency()
    node_map = get_node_map()

    if start_id not in adj or end_id not in adj:
        return {'path': [], 'distance': 0, 'steps': [], 'error': 'No_path_available', 'message': "The destination you're looking for isn't connected by pathways. Please try a different location."}

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
        prev = node_map.get(path_ids[i-1], {})
        curr = node_map.get(path_ids[i], {})
        prev_label = prev.get('label', path_ids[i-1])
        curr_label = curr.get('label', path_ids[i])
        steps.append(f"Walk from {prev_label} to {curr_label}")
    return steps

def find_path_with_snapping(start_lat, start_lng, end_lat, end_lng, to_node_id=None, filters=None):
    from engine.snapping import snap_to_road
    adj = get_adjacency()
    node_map = get_node_map()
    
    start_snap = snap_to_road(start_lat, start_lng, [])
    if not start_snap:
        return {'path': [], 'distance': 0, 'steps': [], 'error': 'No_path_available', 'message': "Couldn't snap start location to road."}
        
    start_id = "temp_start"
    node_map[start_id] = {'id': start_id, 'lat': start_snap['lat'], 'lng': start_snap['lng'], 'label': 'Start'}
    
    # Inject start node edges
    adj[start_id] = [
        {'node': start_snap['node1_id'], 'distance': start_snap['dist_to_node1'], 'isStairs': False, 'hasRamp': True, 'hasElevator': True},
        {'node': start_snap['node2_id'], 'distance': start_snap['dist_to_node2'], 'isStairs': False, 'hasRamp': True, 'hasElevator': True}
    ]
    adj.setdefault(start_snap['node1_id'], []).append({'node': start_id, 'distance': start_snap['dist_to_node1'], 'isStairs': False, 'hasRamp': True, 'hasElevator': True})
    adj.setdefault(start_snap['node2_id'], []).append({'node': start_id, 'distance': start_snap['dist_to_node2'], 'isStairs': False, 'hasRamp': True, 'hasElevator': True})

    end_id = to_node_id
    end_snap = None
    if not end_id and end_lat and end_lng:
        end_snap = snap_to_road(end_lat, end_lng, [])
        if end_snap:
            end_id = "temp_end"
            node_map[end_id] = {'id': end_id, 'lat': end_snap['lat'], 'lng': end_snap['lng'], 'label': 'Destination'}
            adj[end_id] = [
                {'node': end_snap['node1_id'], 'distance': end_snap['dist_to_node1'], 'isStairs': False, 'hasRamp': True, 'hasElevator': True},
                {'node': end_snap['node2_id'], 'distance': end_snap['dist_to_node2'], 'isStairs': False, 'hasRamp': True, 'hasElevator': True}
            ]
            adj.setdefault(end_snap['node1_id'], []).append({'node': end_id, 'distance': end_snap['dist_to_node1'], 'isStairs': False, 'hasRamp': True, 'hasElevator': True})
            adj.setdefault(end_snap['node2_id'], []).append({'node': end_id, 'distance': end_snap['dist_to_node2'], 'isStairs': False, 'hasRamp': True, 'hasElevator': True})

    try:
        if not end_id:
            return {'path': [], 'distance': 0, 'steps': [], 'error': 'No_path_available', 'message': "No destination provided."}
        
        result = find_path(start_id, end_id, filters)
        result['start_heading'] = start_snap['heading']
        result['snapped_start'] = {'lat': start_snap['lat'], 'lng': start_snap['lng']}
        if end_snap:
            result['snapped_end'] = {'lat': end_snap['lat'], 'lng': end_snap['lng']}
        return result
    finally:
        # Cleanup
        del node_map[start_id]
        del adj[start_id]
        adj[start_snap['node1_id']] = [e for e in adj[start_snap['node1_id']] if e['node'] != start_id]
        adj[start_snap['node2_id']] = [e for e in adj[start_snap['node2_id']] if e['node'] != start_id]
        
        if end_snap and end_id == "temp_end":
            del node_map[end_id]
            del adj[end_id]
            adj[end_snap['node1_id']] = [e for e in adj[end_snap['node1_id']] if e['node'] != end_id]
            adj[end_snap['node2_id']] = [e for e in adj[end_snap['node2_id']] if e['node'] != end_id]
