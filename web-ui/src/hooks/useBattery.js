import { useState, useEffect } from 'react';

export default function useBattery() {
  const [level, setLevel] = useState(1);
  const [charging, setCharging] = useState(true);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!navigator.getBattery) {
      setSupported(false);
      return;
    }

    const onLevelChange = (b) => {
      setLevel(b.level);
      setSupported(true);
    };

    const onChargingChange = (b) => {
      setCharging(b.charging);
      setSupported(true);
    };

    navigator.getBattery().then((battery) => {
      setLevel(battery.level);
      setCharging(battery.charging);
      setSupported(true);
      battery.addEventListener('levelchange', () => onLevelChange(battery));
      battery.addEventListener('chargingchange', () => onChargingChange(battery));
    });
  }, []);

  return { level, charging, isLow: level < 0.2 && !charging, supported };
}
