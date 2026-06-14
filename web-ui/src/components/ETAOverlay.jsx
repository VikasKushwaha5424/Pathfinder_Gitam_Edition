import { useState, useEffect, useRef, useMemo } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ETAOverlay({ visible, currentRoute, onCancel }) {
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  const lastPosRef = useRef(null);
  const lastTimeRef = useRef(null);
  const speedRef = useRef(1.4);

  const { latitude, longitude } = useGeolocation();

  const dest = useMemo(() => currentRoute?.[currentRoute.length - 1], [currentRoute]);
  const destLabel = dest?.label || 'Destination';

  useEffect(() => {
    if (!visible || !dest?.lat) {
      setEta(null);
      setDistance(null);
      return;
    }

    if (latitude === null || longitude === null) return;

    const dist = haversine(latitude, longitude, dest.lat, dest.lng);
    setDistance(dist);

    const now = Date.now();
    const lastPos = lastPosRef.current;
    const lastTime = lastTimeRef.current;

    if (lastPos && lastTime && now - lastTime > 3000) {
      const moved = haversine(lastPos.lat, lastPos.lng, latitude, longitude);
      const dt = (now - lastTime) / 1000;
      if (moved > 1 && dt > 0) speedRef.current = moved / dt;
    }

    lastPosRef.current = { lat: latitude, lng: longitude };
    lastTimeRef.current = now;

    const speed = speedRef.current;
    if (speed > 0.1 && dist > 1) {
      setEta(Math.round(dist / speed / 60));
    } else {
      setEta(null);
    }
  }, [latitude, longitude, visible, dest]);

  if (!visible || (eta === null && distance === null && currentRoute?.length < 2)) return null;

  const displayDist = distance || 0;
  const distStr = displayDist >= 1000
    ? `${(displayDist / 1000).toFixed(1)} km`
    : `${Math.round(displayDist)} m`;

  return (
    <div className="hud-card">
      <div className="hud-card-body">
        <span className="hud-dest">{destLabel.replace(/^Walk from /, '')}</span>
        <span className="hud-divider">·</span>
        <span className="hud-dist">{distStr}</span>
        {eta !== null && (
          <>
            <span className="hud-divider">·</span>
            <span className="hud-eta">~{eta} min</span>
          </>
        )}
      </div>
      <button className="hud-cancel" onClick={onCancel} aria-label="Cancel route">✕</button>
    </div>
  );
}
