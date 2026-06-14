import { useRef, useMemo, useEffect } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

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
    'line-dasharray': [2, 2] // Dashed line effect
  }
};

export default function CampusMap({ currentId, destinationId, locations, pois, currentRoute, currentCoords }) {
  const mapRef = useRef(null);

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
      .map((n) => [n.lng, n.lat]); // Mapbox uses [lng, lat]
      
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

  // Fit bounds when route changes
  useEffect(() => {
    if (currentRoute && currentRoute.length >= 2 && mapRef.current) {
      const map = mapRef.current.getMap();
      const coordinates = currentRoute
        .filter((n) => n.lat && n.lng)
        .map((n) => [n.lng, n.lat]);
        
      if (coordinates.length >= 2) {
        // Calculate bounds
        const bounds = coordinates.reduce((acc, coord) => {
          return [
            [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
            [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
          ];
        }, [[coordinates[0][0], coordinates[0][1]], [coordinates[0][0], coordinates[0][1]]]);
        
        // Prevent zero-size bounding box crash
        if (bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]) {
          bounds[0][0] -= 0.001;
          bounds[0][1] -= 0.001;
          bounds[1][0] += 0.001;
          bounds[1][1] += 0.001;
        }
        
        map.fitBounds(bounds, {
          padding: 50,
          maxZoom: 17,
          duration: 1000
        });
      }
    }
  }, [currentRoute]);

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
      >
        {/* Render POIs */}
        {pois && pois.map((poi, index) => (
          <Marker key={`poi-${index}`} longitude={poi.lng} latitude={poi.lat} anchor="center">
            <div 
              style={{
                width: '6px', height: '6px', background: '#00BCD4', 
                border: '1px solid rgba(255,255,255,0.4)', borderRadius: '50%', 
                boxShadow: '0 0 4px #00BCD480'
              }} 
              title={poi.name} 
            />
          </Marker>
        ))}

        {/* Render Locations */}
        {locations && locations.map((loc) => {
          if (!loc.lat || !loc.lng || !loc.id) return null;
          return (
            <Marker key={`loc-${loc.id}`} longitude={loc.lng} latitude={loc.lat} anchor="center">
              <div 
                style={{
                  width: '14px', height: '14px', background: '#666', 
                  border: '2px solid rgba(255,255,255,0.6)', borderRadius: '50%', 
                  boxShadow: '0 0 6px rgba(102,102,102,0.25)'
                }} 
                title={loc.name} 
              />
            </Marker>
          );
        })}

        {/* Render Current Location Node */}
        {currentId && !currentCoords?.latitude && locations.find(l => l.id === currentId) && (
          (() => {
            const loc = locations.find(l => l.id === currentId);
            return (
              <Marker longitude={loc.lng} latitude={loc.lat} anchor="center" style={{zIndex: 1000}}>
                <div 
                  style={{
                    width: '18px', height: '18px', background: '#2196F3', 
                    border: '3px solid #fff', borderRadius: '50%', 
                    boxShadow: '0 0 0 3px rgba(33,150,243,0.4),0 0 12px rgba(33,150,243,0.3)'
                  }} 
                  title="You are here" 
                />
              </Marker>
            );
          })()
        )}

        {/* Render Live GPS Location */}
        {currentCoords?.latitude && currentCoords?.longitude && (
          <Marker longitude={currentCoords.longitude} latitude={currentCoords.latitude} anchor="center" style={{zIndex: 1000}}>
            <div 
              style={{
                width: '14px', height: '14px', background: '#2196F3', 
                border: '3px solid #fff', borderRadius: '50%', 
                boxShadow: '0 0 0 4px rgba(33,150,243,0.3),0 0 0 8px rgba(33,150,243,0.1),0 0 16px #2196F380',
                animation: 'livePulse 2s infinite'
              }} 
              title="You are here (Live)" 
            />
          </Marker>
        )}

        {/* Render Destination Node */}
        {destinationId && locations.find(l => l.id === destinationId) && (
          (() => {
            const loc = locations.find(l => l.id === destinationId);
            return (
              <Marker longitude={loc.lng} latitude={loc.lat} anchor="center" style={{zIndex: 1000}}>
                <div style={{ position: 'relative', width: '18px', height: '18px' }}>
                  <div style={{
                    width: '18px', height: '18px', background: '#4CAF50', 
                    border: '3px solid #fff', borderRadius: '50%', 
                    boxShadow: '0 0 0 3px rgba(76,175,80,0.4),0 0 12px #4CAF5060',
                    position: 'relative', zIndex: 2
                  }}></div>
                  <div className="ping-ring"></div>
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
    </div>
  );
}
