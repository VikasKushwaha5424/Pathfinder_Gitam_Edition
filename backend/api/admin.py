from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix='/admin')

@router.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def deprecated_admin(request: Request, path_name: str):
    raise HTTPException(status_code=410, detail="Deprecated — use GeoJSON directly. The map now uses GeoJSON data. Edits here will not take effect.")

@router.api_route("/", methods=["GET", "POST", "PUT", "DELETE"])
async def deprecated_admin_root(request: Request):
    raise HTTPException(status_code=410, detail="Deprecated — use GeoJSON directly. The map now uses GeoJSON data. Edits here will not take effect.")
