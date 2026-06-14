// Offline JavaScript A* Pathfinder Fallback

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function runOfflineAStar(startId, endId, nodeMap, adj, currentCoords = null) {
  if (!startId && currentCoords) {
    // Basic snapping logic could go here, but for now we require node IDs
    // Offline snapping is complex without full road geometry
  }

  if (!startId || !endId || !nodeMap[startId] || !nodeMap[endId]) return null;

  const openSet = new Set([startId]);
  const cameFrom = {};
  const gScore = { [startId]: 0 };
  const fScore = { [startId]: haversineDistance(nodeMap[startId].lat, nodeMap[startId].lng, nodeMap[endId].lat, nodeMap[endId].lng) };

  while (openSet.size > 0) {
    let current = null;
    let minF = Infinity;
    for (const node of openSet) {
      if ((fScore[node] || Infinity) < minF) {
        minF = fScore[node];
        current = node;
      }
    }

    if (current === endId) {
      const pathIds = [current];
      while (cameFrom[current]) {
        current = cameFrom[current];
        pathIds.push(current);
      }
      pathIds.reverse();
      
      const path = pathIds.map(id => ({
        id,
        lat: nodeMap[id].lat,
        lng: nodeMap[id].lng,
        label: nodeMap[id].label || ''
      }));

      return {
        path,
        distance: Math.round(gScore[endId]),
        steps: ["Offline Mode: Navigate using the green line on your map."],
        error: null
      };
    }

    openSet.delete(current);

    const edges = adj[current] || [];
    for (const edge of edges) {
      const neighbor = edge.node;
      const tentativeG = gScore[current] + edge.distance;
      
      if (tentativeG < (gScore[neighbor] || Infinity)) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentativeG;
        fScore[neighbor] = tentativeG + haversineDistance(nodeMap[neighbor].lat, nodeMap[neighbor].lng, nodeMap[endId].lat, nodeMap[endId].lng);
        openSet.add(neighbor);
      }
    }
  }

  return null;
}
