import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { getFloorPlan } from '../data/floorplans';
import { CAMPUS_LOCATIONS } from '../data/config';

function createRoomIcon(name, color = '#00FFFF') {
  return L.divIcon({
    html: `<div style="
      width:10px;height:10px;background:${color};
      border:2px solid #fff;border-radius:50%;
      box-shadow:0 0 8px ${color}40,0 2px 8px rgba(0,0,0,0.5);
    "></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function FloorPlanView({ locationId, visible, onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const initializedRef = useRef(false);

  const plan = locationId ? getFloorPlan(locationId) : null;

  useEffect(() => {
    if (!visible || !plan || !containerRef.current) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
      return;
    }

    if (initializedRef.current) return;
    initializedRef.current = true;

    const { width, height, src, rooms } = plan;

    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -1,
      maxZoom: 3,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      doubleClickZoom: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const bounds = [[0, 0], [height, width]];
    L.imageOverlay(src, bounds).addTo(map);

    map.fitBounds(bounds);

    markersRef.current = rooms.map((room) => {
      const marker = L.marker([room.y, room.x], {
        icon: createRoomIcon(room.name, '#00FFFF'),
      }).addTo(map);

      marker.bindTooltip(
        `<strong>${room.name}</strong><br/><span style="color:#aaa">${room.desc}</span>`,
        {
          direction: 'top',
          offset: [0, -6],
          className: 'floorplan-tooltip',
        }
      );

      marker.on('click', () => {
        map.setView([room.y, room.x], map.getZoom() + 1, { animate: true });
      });

      return marker;
    });

    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };
  }, [visible, plan]);

  const locName = locationId
    ? CAMPUS_LOCATIONS.find((l) => l.id === locationId)?.name || locationId
    : '';

  return (
    <div className={`floorplan-panel ${visible && plan ? 'visible' : ''}`}>
      <div className="floorplan-header">
        <span className="floorplan-title">{plan?.label || locName}</span>
        <button className="floorplan-close" onClick={onClose}>✕</button>
      </div>
      <div className="floorplan-legend">
        <span className="legend-dot" /> Tap a marker for room info
      </div>
      <div ref={containerRef} className="floorplan-map" />
    </div>
  );
}
