export function calculateBearing(lat1, lng1, lat2, lng2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeTurnAngle(prevLat, prevLng, currLat, currLng, nextLat, nextLng) {
  const incoming = calculateBearing(prevLat, prevLng, currLat, currLng);
  const outgoing = calculateBearing(currLat, currLng, nextLat, nextLng);
  const angle = ((outgoing - incoming + 540) % 360) - 180;
  return angle;
}

export function getDirectionLabel(angleDeg) {
  if (angleDeg >= 150 || angleDeg <= -150) return 'Turn Around';
  if (angleDeg > 30) return 'Turn Right';
  if (angleDeg < -30) return 'Turn Left';
  return 'Go Straight';
}

export function getTurnIntensity(angleDeg) {
  const abs = Math.abs(angleDeg);
  if (abs >= 120) return 'sharp';
  if (abs >= 60) return 'moderate';
  if (abs >= 30) return 'gentle';
  return 'straight';
}

export function getVerticalDirection(fromFloor, toFloor) {
  if (fromFloor === undefined || toFloor === undefined) return null;
  if (toFloor > fromFloor) return 'Go Upstairs';
  if (toFloor < fromFloor) return 'Go Downstairs';
  return null;
}


