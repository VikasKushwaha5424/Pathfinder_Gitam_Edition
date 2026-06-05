import { useEffect, useRef, useState } from 'react';

export default function WebXRScene({ onCharacterClick, isSpeaking, onReady }) {
  const sceneRef = useRef(null);
  const [arActive, setArActive] = useState(false);
  const [error, setError] = useState(null);
  const enteredRef = useRef(false);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || enteredRef.current) return;

    let retries = 0;

    async function tryEnterAR() {
      if (enteredRef.current) return;
      try {
        if (typeof scene.enterAR === 'function') {
          await scene.enterAR();
        } else {
          const session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['local-floor'],
            optionalFeatures: ['hit-test', 'hand-tracking'],
          });
          enteredRef.current = true;
          session.addEventListener('end', () => {
            enteredRef.current = false;
            setArActive(false);
          });
        }
        enteredRef.current = true;
        setArActive(true);
        onReady?.();
      } catch (err) {
        console.warn('WebXR AR entry failed:', err);
        if (retries < 2) {
          retries++;
          setTimeout(tryEnterAR, 1000);
        } else {
          setError('Could not enter AR: ' + err.message);
        }
      }
    }

    scene.addEventListener('loaded', () => setTimeout(tryEnterAR, 800));

    return () => {
      enteredRef.current = false;
    };
  }, [onReady]);

  return (
    <>
      {!arActive && !error && (
        <div className="ar-loading-overlay">
          <div className="loading-spinner"></div>
          <p>Entering AR Mode...</p>
        </div>
      )}
      {error && (
        <div className="ar-loading-overlay">
          <p style={{ color: '#f44336', fontSize: '14px' }}>{error}</p>
          <p style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>
            Try using a WebXR-compatible browser on Quest or Android
          </p>
        </div>
      )}
      <a-scene
        ref={sceneRef}
        embedded
        xr-mode-ui="enabled: true"
        renderer="colorManagement: true; antialias: true;"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      >
        <a-camera position="0 1.6 0" look-controls="enabled: true"></a-camera>

        <a-entity
          id="maya-character"
          position="0 0 -2.5"
          scale="0.7 0.7 0.7"
          animation="property: position; to: 0 0.05 -2.5; dur: 3000; dir: alternate; loop: true; easing: easeInOutSine"
        >
          <a-box
            position="0 0.5 0"
            width="0.5"
            height="0.65"
            depth="0.3"
            color="#4CAF50"
          ></a-box>
          <a-sphere
            position="0 1.15 0"
            radius="0.22"
            color="#FFCC80"
          ></a-sphere>
          <a-sphere position="-0.08 1.2 0.2" radius="0.035" color="#333"></a-sphere>
          <a-sphere position="0.08 1.2 0.2" radius="0.035" color="#333"></a-sphere>
          <a-torus
            position="0 1.08 0.2"
            radius="0.05"
            radius-tubular="0.012"
            color="#E57373"
            rotation="-10 0 0"
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

        {/* Floating AI response panel */}
        <a-entity
          id="ai-response-panel"
          position="-0.6 1.2 -1.2"
          rotation="0 10 0"
        >
          <a-plane
            width="0.8"
            height="0.3"
            color="#000"
            opacity="0.5"
            position="0 0 0"
          ></a-plane>
          <a-text
            id="ai-text-display"
            value="Ask me anything!"
            position="0 0 0.01"
            align="center"
            color="#FFF"
            width="0.7"
            wrap-count="20"
            font-size="0.04"
          ></a-text>
        </a-entity>

        {/* Floating mic button */}
        <a-entity
          id="mic-button-3d"
          geometry="primitive: circle; radius: 0.1"
          material="color: #4CAF50; shader: flat"
          position="0.6 1.0 -1.2"
          rotation="0 -10 0"
          animation="property: scale; to: 1.1 1.1 1.1; dur: 1500; dir: alternate; loop: true; easing: easeInOutSine"
          events="click: onCharacterClick"
        >
          <a-text
            value="🎤"
            position="0 0 0.01"
            align="center"
            color="#FFF"
            width="0.2"
          ></a-text>
        </a-entity>

        <a-light type="ambient" color="#fff" intensity="0.5"></a-light>
        <a-light type="directional" intensity="0.6" position="1 2 -1"></a-light>
      </a-scene>
    </>
  );
}
