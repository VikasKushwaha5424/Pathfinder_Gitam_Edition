import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { snapToRoute } from '../hooks/useRouteRecalculation';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const glowLayerStyle = {
  id: 'route-glow',
  type: 'line',
  paint: {
    'line-color': '#4CAF50',
    'line-width': 8,
    'line-blur': 6,
    'line-opacity': 0.8
  }
};

const coreLayerStyle = {
  id: 'route-core',
  type: 'line',
  paint: {
    'line-color': '#4CAF50',
    'line-width': 3,
    'line-dasharray': [2, 2]
  }
};

// Helper: classify a location as "major" for low-zoom visibility
function isMajorLocation(loc) {
  const name = (loc.name || '').toLowerCase();
  const category = (loc.category || '').toLowerCase();
  return ['gate', 'building', 'entrance', 'hall', 'library', 'hospital', 'stadium', 'auditorium']
    .some(keyword => name.includes(keyword) || category.includes(keyword));
}

export default function CampusMap({ currentId, destinationId, locations, pois, currentRoute, currentCoords, filters }) {
  const mapRef = useRef(null);
  const [zoom, setZoom] = useState(15.5);

  // Item 10c: Compass heading from DeviceOrientation
  const [heading, setHeading] = useState(0);
  useEffect(() => {
    const handler = (e) => {
      if (e.alpha !== null) setHeading(e.alpha);
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  // Item 10b: Smooth GPS interpolation
  const displayPosRef = useRef(null);
  const [displayPos, setDisplayPos] = useState(null);
  const glideRef = useRef(null);

  useEffect(() => {
    if (currentCoords?.latitude == null || currentCoords?.longitude == null) return;

    const target = { latitude: currentCoords.latitude, longitude: currentCoords.longitude };

    if (!displayPosRef.current) {
      displayPosRef.current = target;
      setDisplayPos(target);
      return;
    }

    const start = { ...displayPosRef.current };
    const startTime = performance.now();
    const duration = 1000;

    const animate = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = t * (2 - t); // ease-out quadratic
      const pos = {
        latitude: start.latitude + (target.latitude - start.latitude) * eased,
        longitude: start.longitude + (target.longitude - start.longitude) * eased,
      };
      displayPosRef.current = pos;
      setDisplayPos({ ...pos });
      if (t < 1) {
        glideRef.current = requestAnimationFrame(animate);
      }
    };
    glideRef.current = requestAnimationFrame(animate);
    return () => { if (glideRef.current) cancelAnimationFrame(glideRef.current); };
  }, [currentCoords?.latitude, currentCoords?.longitude]);

  // Item 10a: Snap GPS to route when navigating
  const snappedPos = useMemo(() => {
    if (!displayPos?.latitude || !currentRoute || currentRoute.length < 2) return displayPos;
    return snapToRoute(displayPos.latitude, displayPos.longitude, currentRoute);
  }, [displayPos, currentRoute]);

  // Effective GPS position: snapped when route active, raw otherwise
  const effectiveGps = useMemo(() => {
    if (currentRoute && currentRoute.length >= 2 && snappedPos?.lat) {
      return { latitude: snappedPos.lat, longitude: snappedPos.lng };
    }
    return displayPos;
  }, [snappedPos, displayPos, currentRoute]);

  const initialViewState = useMemo(() => ({
    longitude: 83.377,
    latitude: 17.782,
    zoom: 15.5,
    pitch: 0,
    bearing: 0
  }), []);

  // Calculate route GeoJSON
  const routeGeoJson = useMemo(() => {
    if (!currentRoute || currentRoute.length < 2) return null;
    const coordinates = currentRoute
      .filter((n) => n.lat && n.lng)
      .map((n) => [n.lng, n.lat]);
      
    if (coordinates.length < 2) return null;
      
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates
      }
    };
  }, [currentRoute]);

  const prevDestRef = useRef(null);

  // Item 3: Fit bounds with asymmetrical padding
  useEffect(() => {
    if (currentRoute && currentRoute.length >= 2 && mapRef.current) {
      const destNode = currentRoute[currentRoute.length - 1];
      // Bug #17: Include route length so recalculated routes (same dest, diff path) re-trigger fitBounds
      const destId = `${destNode?.id || `${destNode?.lat},${destNode?.lng}`}_${currentRoute.length}`;
      
      if (prevDestRef.current !== destId) {
        prevDestRef.current = destId;
        const map = mapRef.current.getMap();
        const coordinates = currentRoute
          .filter((n) => n.lat && n.lng)
          .map((n) => [n.lng, n.lat]);
        
      if (coordinates.length >= 2) {
        const bounds = coordinates.reduce((acc, coord) => {
          return [
            [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
            [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
          ];
        }, [[coordinates[0][0], coordinates[0][1]], [coordinates[0][0], coordinates[0][1]]]);
        
        if (bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]) {
          bounds[0][0] -= 0.001;
          bounds[0][1] -= 0.001;
          bounds[1][0] += 0.001;
          bounds[1][1] += 0.001;
        }
        
        // Asymmetrical padding: more bottom space for ChatOverlay/HoldToTalk
        map.fitBounds(bounds, {
          padding: { top: 80, bottom: 250, left: 50, right: 50 },
          maxZoom: 17,
          duration: 1000
        });
      }
      }
    }
  }, [currentRoute]);

  // Item 2: Marching ants animation — cycle through dasharray patterns
  useEffect(() => {
    if (!routeGeoJson || !mapRef.current) return;
    const map = mapRef.current.getMap();

    // Pre-computed dash patterns that create a marching effect when cycled
    // Each pattern shifts the dash/gap boundary forward by half a unit
    const dashSeq = [
      [0, 4, 3],
      [0.5, 4, 2.5],
      [1, 4, 2],
      [1.5, 4, 1.5],
      [2, 4, 1],
      [2.5, 4, 0.5],
      [3, 4, 0],
      [0, 0.5, 3, 3.5],
      [0, 1, 3, 3],
      [0, 1.5, 3, 2.5],
      [0, 2, 3, 2],
      [0, 2.5, 3, 1.5],
      [0, 3, 3, 1],
      [0, 3.5, 3, 0.5],
    ];

    let step = 0;
    let intervalId = null;

    // Small delay to let layers mount, then start cycling
    const timeout = setTimeout(() => {
      intervalId = setInterval(() => {
        try {
          if (map.getLayer('route-core')) {
            map.setPaintProperty('route-core', 'line-dasharray', dashSeq[step % dashSeq.length]);
            step++;
          }
        } catch { /* layer not ready */ }
      }, 80); // ~12fps is smooth enough for marching ants
    }, 500);

    return () => {
      clearTimeout(timeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [routeGeoJson]);

  // Item 5: Zoom-dependent POI/location filtering
  const visiblePois = useMemo(() => {
    if (!pois) return [];
    if (zoom >= 16) return pois;
    return []; // hide POI dots when zoomed out
  }, [pois, zoom]);

  const visibleLocations = useMemo(() => {
    if (!locations) return [];
    if (zoom >= 15.5) return locations;
    // At low zoom, only show major locations
    return locations.filter(l => isMajorLocation(l));
  }, [locations, zoom]);

  // Item 8: Accessibility filter indicator text
  const accessibilityLabel = useMemo(() => {
    if (!filters) return null;
    const parts = [];
    if (filters.noStairs) parts.push('stairs excluded');
    if (filters.wheelchair) parts.push('wheelchair mode');
    if (filters.noKeycard) parts.push('no keycard areas');
    return parts.length > 0 ? `♿ ${parts.join(' · ')}` : null;
  }, [filters]);

  return (
    <div className="campus-map">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/mapbox/satellite-v9"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        minZoom={14}
        maxZoom={20}
        attributionControl={true}
        onZoom={(e) => setZoom(e.target.getZoom())}
      >
        {/* Render POIs (zoom-filtered) */}
        {visiblePois.map((poi, index) => (
          <Marker key={`poi-${index}`} longitude={poi.lng} latitude={poi.lat} anchor="bottom">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
              <div 
                style={{
                  width: '6px', height: '6px', background: '#00BCD4', 
                  border: '1px solid rgba(255,255,255,0.4)', borderRadius: '50%', 
                  boxShadow: '0 0 4px #00BCD480'
                }} 
                title={poi.name} 
              />
              {zoom >= 16.5 && <span style={{
                fontSize: '9px', color: '#b2ebf2', marginTop: '2px',
                textShadow: '0 0 3px #000, 0 1px 2px #000', whiteSpace: 'nowrap',
                fontWeight: 500, letterSpacing: '0.3px'
              }}>{poi.name}</span>}
            </div>
          </Marker>
        ))}

        {/* Render Locations (zoom-filtered) */}
        {visibleLocations.map((loc) => {
          if (!loc.lat || !loc.lng || !loc.id) return null;
          // Skip grey dot if this location is the active start, destination, or overlaps live GPS
          const isAtGps = currentCoords?.latitude != null && currentCoords?.longitude != null &&
            Math.abs(loc.lat - currentCoords.latitude) < 0.0001 &&
            Math.abs(loc.lng - currentCoords.longitude) < 0.0001;
          if (loc.id === currentId || loc.id === destinationId || isAtGps) return null;
          return (
            <Marker key={`loc-${loc.id}`} longitude={loc.lng} latitude={loc.lat} anchor="bottom">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
                <div 
                  style={{
                    width: '14px', height: '14px', background: '#666', 
                    border: '2px solid rgba(255,255,255,0.6)', borderRadius: '50%', 
                    boxShadow: '0 0 6px rgba(102,102,102,0.25)'
                  }} 
                  title={loc.name} 
                />
                {zoom >= 16.5 && <span style={{
                  fontSize: '10px', color: '#fff', marginTop: '2px',
                  textShadow: '0 0 4px #000, 0 1px 3px #000', whiteSpace: 'nowrap',
                  fontWeight: 600, letterSpacing: '0.3px'
                }}>{loc.name}</span>}
              </div>
            </Marker>
          );
        })}

        {/* Render Current Location Node (manual, no GPS) */}
        {currentId && currentCoords?.latitude == null && locations.find(l => l.id === currentId) && (
          (() => {
            const loc = locations.find(l => l.id === currentId);
            return (
              <Marker longitude={loc.lng} latitude={loc.lat} anchor="center" style={{zIndex: 1000}}>
                <div style={{ position: 'relative' }}>
                  <div 
                    style={{
                      width: '18px', height: '18px', background: '#2196F3', 
                      border: '3px solid #fff', borderRadius: '50%', 
                      boxShadow: '0 0 0 3px rgba(33,150,243,0.4),0 0 12px rgba(33,150,243,0.3)'
                    }} 
                    title="You are here" 
                  />
                  {/* Item 9: Origin pulse ring when route is active */}
                  {currentRoute && <div className="origin-ring" />}
                </div>
              </Marker>
            );
          })()
        )}

        {/* Render Live GPS Location — Item 10: Smooth gliding + compass arrow + route snapping */}
        {effectiveGps?.latitude != null && effectiveGps?.longitude != null && (
          <Marker longitude={effectiveGps.longitude} latitude={effectiveGps.latitude} anchor="center" style={{zIndex: 1000}}>
            <div style={{ position: 'relative' }}>
              <div 
                style={{
                  width: '14px', height: '14px', background: '#2196F3', 
                  border: '3px solid #fff', borderRadius: '50%', 
                  boxShadow: '0 0 0 4px rgba(33,150,243,0.3),0 0 0 8px rgba(33,150,243,0.1),0 0 16px #2196F380',
                  animation: 'livePulse 2s infinite',
                  position: 'relative', zIndex: 2
                }} 
                title="You are here (Live)" 
              />
              {/* Item 10c: Compass direction arrow */}
              <div style={{
                position: 'absolute', top: '-10px', left: '50%',
                transform: `translateX(-50%) rotate(${heading}deg)`,
                transformOrigin: 'center 17px',
                width: 0, height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderBottom: '12px solid #2196F3',
                filter: 'drop-shadow(0 0 3px rgba(33,150,243,0.8))',
                transition: 'transform 0.3s ease-out',
                zIndex: 3
              }} />
              {/* Item 9: Origin pulse ring when route is active */}
              {currentRoute && <div className="origin-ring" />}
            </div>
          </Marker>
        )}

        {/* Render Destination Node */}
        {destinationId && (locations.find(l => l.id === destinationId) || pois?.find(p => p.node_id === destinationId)) && (
          (() => {
            const loc = locations.find(l => l.id === destinationId);
            const poi = pois?.find(p => p.node_id === destinationId);
            const found = loc || poi;
            if (!found?.lat || !found?.lng) return null;
            return (
              <Marker longitude={found.lng} latitude={found.lat} anchor="bottom" style={{zIndex: 1000}}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ position: 'relative', width: '18px', height: '18px' }}>
                    <div style={{
                      width: '18px', height: '18px', background: '#4CAF50', 
                      border: '3px solid #fff', borderRadius: '50%', 
                      boxShadow: '0 0 0 3px rgba(76,175,80,0.4),0 0 12px #4CAF5060',
                      position: 'relative', zIndex: 2
                    }}></div>
                    <div className="ping-ring"></div>
                  </div>
                  {zoom >= 16.5 && <span style={{
                    fontSize: '11px', color: '#a5d6a7', marginTop: '3px',
                    textShadow: '0 0 4px #000, 0 1px 3px #000', whiteSpace: 'nowrap',
                    fontWeight: 700, letterSpacing: '0.3px'
                  }}>{found.name || 'Destination'}</span>}
                </div>
              </Marker>
            );
          })()
        )}

        {/* Render Route (if available) */}
        {routeGeoJson && (
          <Source id="route-source" type="geojson" data={routeGeoJson}>
            <Layer {...glowLayerStyle} />
            <Layer {...coreLayerStyle} />
          </Source>
        )}
      </Map>

      {/* Item 8: Accessibility filter indicator */}
      {accessibilityLabel && (
        <div style={{
          position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
          padding: '6px 14px', borderRadius: '20px',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(76,175,80,0.3)',
          color: '#a5d6a7', fontSize: '11px', fontWeight: 600,
          whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10
        }}>
          {accessibilityLabel}
        </div>
      )}
    </div>
  );
}
