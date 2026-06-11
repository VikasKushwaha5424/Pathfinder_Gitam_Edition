import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function createIcon(html, className = '') {
  return L.divIcon({
    html,
    className: `custom-marker ${className}`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

const LOCATION_ICON = (color) => createIcon(
  `<div style="width:14px;height:14px;background:${color};border:2px solid rgba(255,255,255,0.6);border-radius:50%;box-shadow:0 0 6px ${color}40;"></div>`
);

const CURRENT_ICON = createIcon(
  `<div style="width:18px;height:18px;background:#2196F3;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 3px rgba(33,150,243,0.4),0 0 12px rgba(33,150,243,0.3);"></div>`,
  'current-marker'
);

const LIVE_ICON = createIcon(
  `<div style="width:14px;height:14px;background:#2196F3;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(33,150,243,0.3),0 0 0 8px rgba(33,150,243,0.1),0 0 16px #2196F380;animation:livePulse 2s infinite;"></div>`,
  'live-marker'
);

const DEST_ICON = createIcon(
  `<div style="position:relative;width:18px;height:18px;"><div style="width:18px;height:18px;background:#4CAF50;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 3px rgba(76,175,80,0.4),0 0 12px #4CAF5060;position:relative;z-index:2;"></div><div class="ping-ring"></div></div>`,
  'dest-marker'
);

const POI_ICON = createIcon(
  `<div style="width:6px;height:6px;background:#00BCD4;border:1px solid rgba(255,255,255,0.4);border-radius:50%;box-shadow:0 0 4px #00BCD480;"></div>`
);

export default function CampusMap({ currentId, destinationId, locations, pois, currentRoute, currentCoords }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const currentMarkerRef = useRef(null);
  const liveMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const poiMarkersRef = useRef([]);
  const routePolylineRef = useRef(null);
  const routeMarkersRef = useRef([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 15,
      maxZoom: 19,
      maxBounds: [[17.770, 83.358], [17.794, 83.395]],
      maxBoundsViscosity: 1.0,
    }).setView([17.782, 83.377], 16);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19,
      className: 'tactical-satellite',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    poiMarkersRef.current.forEach((m) => map.removeLayer(m));
    poiMarkersRef.current = [];

    if (pois) {
      poiMarkersRef.current = pois.map((poi) => {
        const m = L.marker([poi.lat, poi.lng], { icon: POI_ICON }).addTo(map);
        m.bindTooltip(poi.name, { direction: 'top', offset: [0, -4] });
        return m;
      });
    }
  }, [pois]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};

    locations.forEach((loc) => {
      if (!loc.lat || !loc.lng || !loc.id) return;
      const m = L.marker([loc.lat, loc.lng], { icon: LOCATION_ICON('#666') }).addTo(map);
      m.bindTooltip(loc.name, { direction: 'top', offset: [0, -4] });
      markersRef.current[loc.id] = m;
    });
  }, [locations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (currentMarkerRef.current) {
      map.removeLayer(currentMarkerRef.current);
      currentMarkerRef.current = null;
    }

    if (currentCoords?.latitude && currentCoords?.longitude) return;

    if (currentId) {
      const loc = locations.find((l) => l.id === currentId);
      if (loc?.lat && loc?.lng) {
        currentMarkerRef.current = L.marker([loc.lat, loc.lng], {
          icon: CURRENT_ICON, zIndexOffset: 1000,
        }).addTo(map);
        currentMarkerRef.current.bindTooltip('You are here', { direction: 'top' });
      }
    }
  }, [currentId, locations, currentCoords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (liveMarkerRef.current) {
      map.removeLayer(liveMarkerRef.current);
      liveMarkerRef.current = null;
    }

    if (currentCoords?.latitude && currentCoords?.longitude) {
      liveMarkerRef.current = L.marker([currentCoords.latitude, currentCoords.longitude], {
        icon: LIVE_ICON, zIndexOffset: 1000,
      }).addTo(map);
      liveMarkerRef.current.bindTooltip('You are here', { direction: 'top' });
    }
  }, [currentCoords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (destMarkerRef.current) {
      map.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }

    if (destinationId) {
      const loc = locations.find((l) => l.id === destinationId);
      if (loc?.lat && loc?.lng) {
        destMarkerRef.current = L.marker([loc.lat, loc.lng], {
          icon: DEST_ICON, zIndexOffset: 1000,
        }).addTo(map);
        destMarkerRef.current.bindTooltip(loc.name, { direction: 'top' });
        map.setView([loc.lat, loc.lng], map.getZoom(), { animate: true });
      }
    }
  }, [destinationId, locations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
    routeMarkersRef.current.forEach((m) => map.removeLayer(m));
    routeMarkersRef.current = [];

    if (currentRoute && currentRoute.length >= 2) {
      const coords = currentRoute
        .filter((n) => n.lat && n.lng)
        .map((n) => [n.lat, n.lng]);

      if (coords.length >= 2) {
        routePolylineRef.current = L.polyline(coords, {
          color: '#4CAF50', weight: 5, opacity: 0.9,
          className: 'route-glow',
        }).addTo(map);

        currentRoute.forEach((node, i) => {
          if (!node.lat || !node.lng) return;
          const m = L.circleMarker([node.lat, node.lng], {
            radius: i === 0 || i === currentRoute.length - 1 ? 5 : 3,
            color: '#4CAF50',
            fillColor: i === currentRoute.length - 1 ? '#4CAF50' : '#4CAF50',
            fillOpacity: 0.9, weight: 2,
            className: 'route-glow',
          }).addTo(map);
          if (node.label) m.bindTooltip(node.label, { direction: 'top', offset: [0, -4] });
          routeMarkersRef.current.push(m);
        });

        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
      }
    }
  }, [currentRoute]);

  return <div ref={containerRef} className="campus-map" />;
}
