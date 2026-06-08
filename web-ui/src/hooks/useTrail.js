import { useState, useRef, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'maya_trails';

function loadTrails() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveTrails(trails) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trails));
  } catch {
    /* quota exceeded — silently fail */
  }
}

export default function useTrail() {
  const [activeTrailId, setActiveTrailId] = useState(null);
  const [trailPoints, setTrailPoints] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [savedTrails, setSavedTrails] = useState(loadTrails);
  const watchIdRef = useRef(null);
  const lastPointRef = useRef(null);

  const startTrail = useCallback((trailId) => {
    const id = trailId || 'trail_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    setActiveTrailId(id);
    setTrailPoints([]);
    setIsRecording(true);
    lastPointRef.current = null;

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() };
          const last = lastPointRef.current;
          if (!last || haversine(last.lat, last.lng, pt.lat, pt.lng) >= 3) {
            lastPointRef.current = pt;
            setTrailPoints((prev) => [...prev, pt]);
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumInterval: 5000, distanceFilter: 3 }
      );
    }

    return id;
  }, []);

  const recordPoint = useCallback((lat, lng) => {
    if (!isRecording) return;
    const pt = { lat, lng, timestamp: Date.now() };
    const last = lastPointRef.current;
    if (!last || haversine(last.lat, last.lng, lat, lng) >= 3) {
      lastPointRef.current = pt;
      setTrailPoints((prev) => [...prev, pt]);
    }
  }, [isRecording]);

  const stopTrail = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsRecording(false);

    const id = activeTrailId;
    if (id && trailPoints.length > 0) {
      setSavedTrails((prev) => {
        const next = { ...prev, [id]: { id, points: trailPoints, created: Date.now() } };
        saveTrails(next);
        return next;
      });
    }
  }, [activeTrailId, trailPoints]);

  const loadTrail = useCallback((trailId) => {
    const trail = savedTrails[trailId];
    if (trail) {
      setActiveTrailId(trailId);
      setTrailPoints(trail.points);
      setIsRecording(false);
      return trail.points;
    }
    return null;
  }, [savedTrails]);

  const clearTrail = useCallback((trailId) => {
    setSavedTrails((prev) => {
      const next = { ...prev };
      delete next[trailId];
      saveTrails(next);
      return next;
    });
    if (activeTrailId === trailId) {
      setActiveTrailId(null);
      setTrailPoints([]);
      setIsRecording(false);
    }
  }, [activeTrailId]);

  const clearActiveTrail = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setActiveTrailId(null);
    setTrailPoints([]);
    setIsRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    activeTrailId,
    trailPoints,
    isRecording,
    savedTrails,
    startTrail,
    recordPoint,
    stopTrail,
    loadTrail,
    clearTrail,
    clearActiveTrail,
  };
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
