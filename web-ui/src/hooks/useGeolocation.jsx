import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

const GeolocationContext = createContext(null);

export function GeolocationProvider({ children, enableHighAccuracy = true, maxInterval = 5000, distanceFilter = 3, lowPowerMode = false }) {
  const [coords, setCoords] = useState({ latitude: null, longitude: null, accuracy: null, heading: null, speed: null, timestamp: null });
  const [error, setError] = useState(null);
  const [isWatching, setIsWatching] = useState(false);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not available');
      return;
    }

    const options = {
      enableHighAccuracy: lowPowerMode ? false : enableHighAccuracy,
      maximumInterval: lowPowerMode ? 30000 : maxInterval,
      distanceFilter: lowPowerMode ? 20 : distanceFilter,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
        setError(null);
        setIsWatching(true);
      },
      (err) => {
        setError(err.message);
        setIsWatching(false);
      },
      options
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enableHighAccuracy, maxInterval, distanceFilter, lowPowerMode]);

  const value = { ...coords, error, isWatching };

  return (
    <GeolocationContext.Provider value={value}>
      {children}
    </GeolocationContext.Provider>
  );
}

export function useGeolocation() {
  const ctx = useContext(GeolocationContext);
  if (!ctx) {
    return { latitude: null, longitude: null, accuracy: null, heading: null, speed: null, timestamp: null, error: 'GeolocationProvider not mounted', isWatching: false };
  }
  return ctx;
}

export default useGeolocation;
