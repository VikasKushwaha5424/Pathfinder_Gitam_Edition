from fastapi import APIRouter
from engine.graph import get_nodes, get_pois

router = APIRouter()

@router.get('/locations')
async def get_locations():
    pois = get_pois()
    locs = [{'id': p['node_id'], 'name': p['name'], 'lat': p['lat'], 'lng': p['lng'], 'description': p.get('category', '')} for p in pois]
    
    return {
        'locations': locs,
        'nodes': get_nodes(),
        'pois': pois,
    }
