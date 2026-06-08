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
  `<div style="width:16px;height:16px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`
);

const CURRENT_ICON = createIcon(
  `<div style="width:20px;height:20px;background:#2196F3;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 3px rgba(33,150,243,0.4),0 2px 8px rgba(0,0,0,0.4);"></div>`,
  'current-marker'
);

const DEST_ICON = createIcon(
  `<div style="width:20px;height:20px;background:#4CAF50;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 3px rgba(76,175,80,0.4),0 2px 8px rgba(0,0,0,0.4);"></div>`,
  'dest-marker'
);

const POI_ICON = createIcon(
  `<div style="width:8px;height:8px;background:#00BCD4;border:1px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`
);

export default function CampusMap({ currentId, destinationId, locations, pois, visible, onClose, trailPoints }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const currentMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const poiMarkersRef = useRef([]);
  const polylineRef = useRef(null);
  const trailPolylineRef = useRef(null);
  const trailMarkersRef = useRef([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([17.782, 83.377], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 300);

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
      const markers = pois.map((poi) => {
        const m = L.marker([poi.lat, poi.lng], { icon: POI_ICON }).addTo(map);
        m.bindTooltip(poi.name, { direction: 'top', offset: [0, -4] });
        return m;
      });
      poiMarkersRef.current = markers;
    }
  }, [pois]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};

    locations.forEach((loc) => {
      if (!loc.lat || !loc.lng || !loc.id) return;
      const m = L.marker([loc.lat, loc.lng], {
        icon: LOCATION_ICON('#9E9E9E'),
      }).addTo(map);
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

    if (currentId) {
      const loc = locations.find((l) => l.id === currentId);
      if (loc?.lat && loc?.lng) {
        currentMarkerRef.current = L.marker([loc.lat, loc.lng], {
          icon: CURRENT_ICON,
          zIndexOffset: 1000,
        }).addTo(map);
        currentMarkerRef.current.bindTooltip('You are here', { direction: 'top' });
        map.setView([loc.lat, loc.lng], map.getZoom(), { animate: true });
      }
    }
  }, [currentId, locations]);

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
          icon: DEST_ICON,
          zIndexOffset: 1000,
        }).addTo(map);
        destMarkerRef.current.bindTooltip(loc.name, { direction: 'top' });
      }
    }
  }, [destinationId, locations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    const current = locations.find((l) => l.id === currentId);
    const dest = locations.find((l) => l.id === destinationId);

    if (current?.lat && current?.lng && dest?.lat && dest?.lng) {
      polylineRef.current = L.polyline(
        [[current.lat, current.lng], [dest.lat, dest.lng]],
        {
          color: '#FF8C00',
          weight: 3,
          opacity: 0.7,
          dashArray: '8, 8',
        }
      ).addTo(map);

      const bounds = L.latLngBounds(
        [current.lat, current.lng],
        [dest.lat, dest.lng]
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    }
  }, [currentId, destinationId, locations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (trailPolylineRef.current) {
      map.removeLayer(trailPolylineRef.current);
      trailPolylineRef.current = null;
    }
    trailMarkersRef.current.forEach((m) => map.removeLayer(m));
    trailMarkersRef.current = [];

    if (trailPoints && trailPoints.length > 1) {
      const coords = trailPoints.map((p) => [p.lat, p.lng]);
      trailPolylineRef.current = L.polyline(coords, {
        color: '#00FFFF',
        weight: 4,
        opacity: 0.6,
      }).addTo(map);

      trailPoints.forEach((p) => {
        const m = L.circleMarker([p.lat, p.lng], {
          radius: 3,
          color: '#00FFFF',
          fillColor: '#00FFFF',
          fillOpacity: 0.8,
          weight: 1,
        }).addTo(map);
        trailMarkersRef.current.push(m);
      });
    }
  }, [trailPoints]);

  return (
    <div className={`campus-map ${visible ? 'visible' : ''}`}>
      <div className="map-header">
        <div className="map-drag-handle" />
        <span className="map-title">Campus Map</span>
        <button className="map-close-btn" onClick={onClose} aria-label="Close map">
          ✕
        </button>
      </div>
      <div ref={containerRef} className="map-body" />
    </div>
  );
}
