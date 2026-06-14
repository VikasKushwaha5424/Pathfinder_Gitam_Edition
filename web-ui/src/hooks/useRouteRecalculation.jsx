import { useEffect, useRef } from 'react';

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));
}

function toMeters(lat, lng, refLat, refLng) {
  const R = 6371000;
  const dLat = (lat - refLat) * Math.PI / 180;
  const dLng = (lng - refLng) * Math.PI / 180;
  const midLat = (lat + refLat) / 2 * Math.PI / 180;
  return { x: R * dLng * Math.cos(midLat), y: R * dLat };
}

function distanceToRoute(lat, lng, route) {
  if (!route || route.length < 2) return Infinity;
  let minDist = Infinity;
  for (let i = 1; i < route.length; i++) {
    const p1 = route[i - 1];
    const p2 = route[i];
    if (!p1?.lat || !p1?.lng || !p2?.lat || !p2?.lng) continue;
    const d = haversine(lat, lng, p1.lat, p1.lng);
    if (d < minDist) minDist = d;
    const d2 = haversine(lat, lng, p2.lat, p2.lng);
    if (d2 < minDist) minDist = d2;
    const segDist = haversine(p1.lat, p1.lng, p2.lat, p2.lng);
    if (segDist < 0.5) continue;
    const refLat = (lat + p1.lat + p2.lat) / 3;
    const refLng = (lng + p1.lng + p2.lng) / 3;
    const A = toMeters(p1.lat, p1.lng, refLat, refLng);
    const B = toMeters(p2.lat, p2.lng, refLat, refLng);
    const P = toMeters(lat, lng, refLat, refLng);
    const ABx = B.x - A.x, ABy = B.y - A.y;
    const APx = P.x - A.x, APy = P.y - A.y;
    const t = (APx * ABx + APy * ABy) / (ABx * ABx + ABy * ABy);
    if (t > 0 && t < 1) {
      const projX = A.x + t * ABx;
      const projY = A.y + t * ABy;
      const dx = P.x - projX, dy = P.y - projY;
      const d3 = Math.sqrt(dx * dx + dy * dy);
      if (d3 < minDist) minDist = d3;
    }
  }
  return minDist;
}

export default function useRouteRecalculation({ currentRoute, currentCoords, routeStatus, onRecalculate }) {
  const intervalRef = useRef(null);
  const lastCoordsRef = useRef(null);

  useEffect(() => {
    if (routeStatus !== 'active' || !currentCoords?.latitude) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      const { latitude, longitude } = currentCoords;
      if (!latitude || !longitude) return;

      const dist = distanceToRoute(latitude, longitude, currentRoute);
      if (dist > 20 && onRecalculate) {
        onRecalculate(dist);
      }

      lastCoordsRef.current = { latitude, longitude };
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [routeStatus, currentCoords?.latitude, currentCoords?.longitude, currentRoute, onRecalculate]);
}
