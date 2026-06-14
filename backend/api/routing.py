from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from engine.pathfinding import find_path
from engine.poi_search import search, find_by_name, find_node_id, get_all_names

router = APIRouter(prefix='/api')

class RouteRequest(BaseModel):
    from_node: Optional[str] = None
    to_node: Optional[str] = None
    from_lat: Optional[float] = None
    from_lng: Optional[float] = None
    to_lat: Optional[float] = None
    to_lng: Optional[float] = None
    filters: dict = {}

class POIQuery(BaseModel):
    q: str

class NearestRequest(BaseModel):
    lat: float
    lng: float

@router.post('/route')
async def get_route(req: RouteRequest):
    from engine.pathfinding import find_path_with_snapping

    to_id = find_node_id(req.to_node) if req.to_node else None

    # Snapping logic
    if req.from_lat is not None and req.from_lng is not None:
        result = find_path_with_snapping(req.from_lat, req.from_lng, req.to_lat, req.to_lng, to_node_id=to_id, filters=req.filters)
    else:
        from_id = find_node_id(req.from_node) or req.from_node
        if not from_id:
            return {"found": False, "message": "from_node or from_lat/from_lng is required"}
        if not to_id and not (req.to_lat and req.to_lng):
            return {"found": False, "message": "to_node or to_lat/to_lng is required"}
        
        result = find_path(from_id, to_id, req.filters)

    if result.get('error'):
        return {
            "found": False,
            "message": result.get('message', "No path available")
        }
        
    return {
        "found": True,
        **result
    }

@router.post('/poi/search')
async def search_poi(query: POIQuery):
    results = search(query.q)
    return {'results': results}

@router.get('/poi/list')
async def list_poi():
    return {'names': get_all_names()}

@router.post('/nearest')
async def nearest_location(req: NearestRequest):
    from engine.graph import find_nearest_node
    from engine.poi_search import load_pois
    node = find_nearest_node(req.lat, req.lng)
    if not node:
        raise HTTPException(404, 'No nearby node found')
    pois = load_pois()
    poi = next((p for p in pois if p['node_id'] == node['id']), None)
    return {
        'node_id': node['id'],
        'label': node.get('label', ''),
        'lat': node['lat'],
        'lng': node['lng'],
        'poi_name': poi['name'] if poi else None,
    }
