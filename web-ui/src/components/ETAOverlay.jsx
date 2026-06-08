import { useState, useEffect, useRef } from 'react';
import { calculateDistance } from '../utils/navigation';
import { CAMPUS_LOCATIONS } from '../data/config';

export default function ETAOverlay({ destination, visible }) {
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  const lastPosRef = useRef(null);
  const lastTimeRef = useRef(null);
  const speedRef = useRef(1.4);

  useEffect(() => {
    if (!destination || !visible) {
      setEta(null);
      setDistance(null);
      return;
    }

    const dest = CAMPUS_LOCATIONS.find((l) => l.id === destination);
    if (!dest?.lat) {
      setEta(null);
      setDistance(null);
      return;
    }

    let watchId;

    const startWatching = () => {
      if (!navigator.geolocation) return;

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          const dist = calculateDistance(lat, lng, dest.lat, dest.lng);
          setDistance(dist);

          const now = Date.now();
          const lastPos = lastPosRef.current;
          const lastTime = lastTimeRef.current;

          if (lastPos && lastTime && now - lastTime > 3000) {
            const moved = calculateDistance(
              lastPos.lat, lastPos.lng, lat, lng
            );
            const dt = (now - lastTime) / 1000;
            if (moved > 1 && dt > 0) {
              speedRef.current = moved / dt;
            }
          }

          lastPosRef.current = { lat, lng };
          lastTimeRef.current = now;

          const speed = speedRef.current;
          if (speed > 0.1 && dist > 1) {
            setEta(Math.round(dist / speed / 60));
          } else {
            setEta(null);
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumInterval: 5000, distanceFilter: 3 }
      );
    };

    startWatching();

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [destination, visible]);

  if (!visible || (!eta && !distance)) return null;

  const miles = distance >= 1000
    ? `${(distance / 1000).toFixed(1)} km`
    : `${Math.round(distance)} m`;

  return (
    <div className="eta-overlay">
      <span className="eta-distance">{miles}</span>
      {eta !== null && (
        <span className="eta-time">~{eta} min</span>
      )}
    </div>
  );
}
