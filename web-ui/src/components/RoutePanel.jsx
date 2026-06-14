import { useState, useMemo } from 'react';

export default function RoutePanel({ from, onFromChange, onToChange, locations, onNavigate, onClose }) {
  const [to, setTo] = useState('');

  const navLocations = useMemo(
    () => locations.filter((l) => l.id && l.lat && l.lng),
    [locations]
  );

  const handleGo = () => {
    if (!to) return;
    onToChange(to);
    onNavigate(from || '', to);
    onClose();
  };

  return (
    <div className="route-panel">
      <button className="route-panel-close" onClick={onClose} title="Close">✕</button>

      <div className="route-panel-row">
        <label className="route-panel-label">From</label>
        <select
          className="route-panel-select"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
        >
          {locations.map((loc) => (
            <option key={`from-${loc.id}`} value={loc.id}>
              {loc.name || loc.id}
            </option>
          ))}
        </select>
      </div>

      <div className="route-panel-row">
        <label className="route-panel-label">To</label>
        <select
          className="route-panel-select"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        >
          <option value="">Select destination…</option>
          {navLocations.map((loc) => (
            <option key={`to-${loc.id}`} value={loc.id}>
              {loc.name || loc.id}
            </option>
          ))}
        </select>
      </div>

      <button
        className={`route-panel-go ${to ? '' : 'disabled'}`}
        disabled={!to}
        onClick={handleGo}
      >
        Navigate
      </button>
    </div>
  );
}
