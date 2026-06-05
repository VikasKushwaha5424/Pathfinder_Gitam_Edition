import { useEffect, useRef, useState } from 'react';

const TARGET_LOCATIONS = [
  { index: 0, id: 'library', name: 'Library' },
  { index: 1, id: 'canteen', name: 'Canteen' },
  { index: 2, id: 'csdept', name: 'CS Department' },
  { index: 3, id: 'admin_block', name: 'Admin Block' },
  { index: 4, id: 'sports_complex', name: 'Sports Complex' },
  { index: 5, id: 'auditorium', name: 'Auditorium' },
  { index: 6, id: 'hostel_block', name: 'Hostels' },
  { index: 7, id: 'parking', name: 'Parking' },
];

export default function MindARScene({ onTargetDetected, onTargetLost, isSpeaking, onReady }) {
  const sceneRef = useRef(null);
  const [arReady, setArReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const handleTargetFound = (e) => {
      const el = e.target.closest('[mindar-image-target]');
      if (!el) return;
      const raw = el.getAttribute('mindar-image-target') || '';
      const match = raw.match(/targetIndex:\s*(\d+)/);
      if (!match) return;
      const idx = parseInt(match[1]);
      const loc = TARGET_LOCATIONS.find((t) => t.index === idx);
      if (loc) onTargetDetected?.(loc.id);
    };

    const handleTargetLost = () => {
      onTargetLost?.();
    };

    const attachTargetListeners = () => {
      const targets = scene.querySelectorAll('[mindar-image-target]');
      targets.forEach((el) => {
        el.addEventListener('targetFound', handleTargetFound);
        el.addEventListener('targetLost', handleTargetLost);
      });
      return targets;
    };

    const initTimer = setTimeout(() => {
      const targets = attachTargetListeners();
      if (targets.length > 0) {
        setArReady(true);
        onReady?.();
      } else {
        const retryTimer = setTimeout(() => {
          const retry = attachTargetListeners();
          if (retry.length > 0) {
            setArReady(true);
            onReady?.();
          } else {
            setError('AR targets not found. MindAR may not have loaded.');
          }
        }, 3000);
        return () => clearTimeout(retryTimer);
      }
    }, 1500);

    return () => {
      clearTimeout(initTimer);
      const targets = scene?.querySelectorAll('[mindar-image-target]');
      targets?.forEach((el) => {
        el.removeEventListener('targetFound', handleTargetFound);
        el.removeEventListener('targetLost', handleTargetLost);
      });
    };
  }, []);

  return (
    <>
      {!arReady && !error && (
        <div className="ar-loading-overlay">
          <div className="loading-spinner"></div>
          <p>{error || 'Starting AR Camera...'}</p>
        </div>
      )}
      {error && (
        <div className="ar-loading-overlay">
          <p style={{ color: '#f44336', fontSize: '14px' }}>{error}</p>
          <p style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>
            Make sure campus-targets.mind is in public/targets/
          </p>
        </div>
      )}
      <a-scene
        ref={sceneRef}
        mindar-image="imageTargetSrc: /targets/campus-targets.mind; showStats: false; autoStart: true;"
        embedded
        vr-mode-ui="enabled: false"
        renderer="colorManagement: true;"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      >
        <a-camera position="0 0 0" look-controls="enabled: false" far="100"></a-camera>

        {TARGET_LOCATIONS.map((loc) => (
          <a-entity
            key={loc.index}
            mindar-image-target={`targetIndex: ${loc.index}`}
          >
            <a-entity position="0 0 0" scale="0.7 0.7 0.7">
              <a-box
                position="0 0.5 0"
                width="0.5"
                height="0.65"
                depth="0.3"
                color="#4CAF50"
                shadow="cast: true"
              ></a-box>
              <a-sphere
                position="0 1.15 0"
                radius="0.22"
                color="#FFCC80"
                shadow="cast: true"
              ></a-sphere>
              <a-sphere position="-0.08 1.2 0.2" radius="0.035" color="#333"></a-sphere>
              <a-sphere position="0.08 1.2 0.2" radius="0.035" color="#333"></a-sphere>
              <a-torus
                position="0 1.08 0.2"
                radius="0.05"
                radius-tubular="0.012"
                color="#E57373"
                rotation="-10 0 0"
                segments-tubular="16"
                segments-radial="8"
              ></a-torus>
              <a-text
                value="Maya"
                position="0 1.5 0"
                align="center"
                color="#FFF"
                width="1.5"
              ></a-text>
              {isSpeaking && (
                <a-ring
                  position="0 0.05 0"
                  radius-inner="1.0"
                  radius-outer="1.3"
                  color="#4CAF50"
                  rotation="-90 0 0"
                  animation="property: material.opacity; to: 0.3; dur: 800; dir: alternate; loop: true"
                ></a-ring>
              )}
            </a-entity>
          </a-entity>
        ))}
      </a-scene>
    </>
  );
}
