import { useEffect, useRef } from 'react';
import './TelemetryHUD.css';

export default function TelemetryHUD({ status, logs, metrics }) {
  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="telemetry-hud" role="region" aria-label="System telemetry">
      <div className="telemetry-header">
        <span className="telemetry-color" aria-hidden="true">{status.color}</span>
        <span className="telemetry-text">SYSTEM STATE: {status.text}</span>
      </div>

      {metrics && (
        <div className="telemetry-metrics-panel" aria-label="Performance metrics">
          <div className="metric-box">
            <span className="metric-label">Latency</span>
            <span className="metric-value" style={{ color: metrics.latency > 3000 ? '#f44336' : '#4CAF50' }}>
              {metrics.latency > 0 ? `${metrics.latency}ms` : '—'}
            </span>
          </div>
          <div className="metric-divider" />
          <div className="metric-box">
            <span className="metric-label">Tokens</span>
            <span className="metric-value" style={{ color: '#2196F3' }}>
              {metrics.tokens > 0 ? metrics.tokens : '—'}
            </span>
          </div>
          <div className="metric-divider" />
          <div className="metric-box">
            <span className="metric-label">Session</span>
            <span className="metric-value" style={{ color: '#888' }}>
              {logs.length}
            </span>
          </div>
        </div>
      )}

      <div className="telemetry-logs">
        {logs.length === 0 && <span className="log-placeholder">Awaiting telemetry data...</span>}
        {logs.map((log, index) => {
          let logClass = 'log-info';
          if (log.includes('[WARN]')) logClass = 'log-warn';
          if (log.includes('[FATAL]')) logClass = 'log-fatal';

          return (
            <div key={index} className={`log-line ${logClass}`}>
              {log}
            </div>
          );
        })}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
