import { calculateBearing, calculateDistance } from '../utils/navigation';

export default function ARTrail({ points, originLat, originLng, originHeading = 0, maxRadius = 30 }) {
  if (!points || points.length === 0 || originLat == null) return null;

  const toRad = (deg) => deg * Math.PI / 180;

  const localPositions = points
    .map((pt) => {
      const dist = calculateDistance(originLat, originLng, pt.lat, pt.lng);
      if (dist > maxRadius) return null;
      const bearing = calculateBearing(originLat, originLng, pt.lat, pt.lng);
      const rel = ((bearing - originHeading) % 360 + 360) % 360;
      const relRad = toRad(rel);
      const x = Math.sin(relRad) * dist;
      const z = -Math.cos(relRad) * dist;
      return { x, z, y: 0.1 };
    })
    .filter(Boolean);

  if (localPositions.length === 0) return null;

  return (
    <a-entity>
      {localPositions.map((pos, i) => (
        <a-sphere
          key={i}
          position={`${pos.x} ${pos.y} ${pos.z}`}
          radius="0.15"
          color="#00FFFF"
          emissive="#00FFFF"
          emissive-intensity="0.5"
          opacity="0.7"
        >
          <a-animation
            attribute="scale"
            from="1 1 1"
            to="1.3 1.3 1.3"
            dur="1200"
            direction="alternate"
            repeat="indefinite"
          />
        </a-sphere>
      ))}
    </a-entity>
  );
}
