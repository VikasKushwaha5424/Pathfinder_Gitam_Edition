import { useState } from 'react';

export default function TrailUI({ activeTrailId, trailPoints, isRecording, savedTrails, stopTrail, loadTrail, clearTrail }) {
  const [loadInput, setLoadInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  const handleCopyId = async () => {
    if (!activeTrailId) return;
    try {
      await navigator.clipboard.writeText(activeTrailId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
    }
  };

  const handleLoad = () => {
    if (!loadInput.trim()) return;
    const loaded = loadTrail(loadInput.trim());
    if (loaded) setLoadInput('');
  };

  const trailCount = Object.keys(savedTrails).length;

  return (
    <>
      <button
        className="trail-toggle-btn"
        onClick={() => setShowPanel((v) => !v)}
        title={`Trails (${trailCount} saved)`}
      >
        {isRecording ? '🔴' : '👣'}
      </button>

      {showPanel && (
        <div className="trail-panel">
          <div className="trail-panel-header">
            <span>Phantom Trails</span>
            <button className="trail-close-btn" onClick={() => setShowPanel(false)}>✕</button>
          </div>

          <div className="trail-panel-body">
            {isRecording && (
              <div className="trail-status">
                <span className="trail-recording-dot" />
                Recording — {trailPoints.length} points
              </div>
            )}

            {activeTrailId && (
              <div className="trail-id-row">
                <span className="trail-id-label">Trail ID</span>
                <div className="trail-id-value">{activeTrailId}</div>
                <button className="trail-copy-btn" onClick={handleCopyId}>
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
            )}

            {isRecording && (
              <button className="trail-stop-btn" onClick={stopTrail}>
                ■ Stop & Save
              </button>
            )}

            {trailCount > 0 && (
              <>
                <div className="trail-section-title">Saved Trails ({trailCount})</div>
                <div className="trail-saved-list">
                  {Object.entries(savedTrails).slice(-5).reverse().map(([id, trail]) => (
                    <div key={id} className="trail-saved-item">
                      <span className="trail-saved-name" onClick={() => loadTrail(id)}>
                        {id.slice(0, 20)}…
                      </span>
                      <span className="trail-saved-pts">{trail.points.length} pts</span>
                      <button className="trail-del-btn" onClick={() => clearTrail(id)}>✕</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="trail-section-title">Load Shared Trail</div>
            <div className="trail-load-row">
              <input
                className="trail-load-input"
                value={loadInput}
                onChange={(e) => setLoadInput(e.target.value)}
                placeholder="Paste Trail ID..."
                onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
              />
              <button className="trail-load-btn" onClick={handleLoad}>Load</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
