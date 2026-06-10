import { useEffect, useRef, useState } from 'react';
import MayaCharacter from './MayaCharacter';

export default function WebXRScene({ onCharacterClick, isSpeaking, onReady, onError }) {
  const sceneRef = useRef(null);
  const [arActive, setArActive] = useState(false);
  const [error, setError] = useState(null);
  const enteredRef = useRef(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || enteredRef.current) return;

    let retries = 0;

    async function tryEnter() {
      if (enteredRef.current) return;
      try {
        if (typeof scene.enterAR === 'function') {
          await scene.enterAR();
        } else {
          const session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['local'],
            optionalFeatures: ['hit-test', 'hand-tracking', 'local-floor'],
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
        console.warn('WebXR entry failed:', err);
        if (retries < 2) {
          retries++;
          timeoutRef.current = setTimeout(tryEnter, 1000);
        } else {
          onError?.();
          setError('Could not enter AR: ' + err.message);
        }
      }
    }

    timeoutRef.current = setTimeout(tryEnter, 800);

    return () => {
      clearTimeout(timeoutRef.current);
      enteredRef.current = false;
    };
  }, [onReady]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const handleClick = (e) => {
      if (e.target.closest('#maya-webxr')) {
        onCharacterClick?.();
      }
    };

    scene.addEventListener('click', handleClick);
    scene.addEventListener('touchstart', handleClick);
    return () => {
      scene.removeEventListener('click', handleClick);
      scene.removeEventListener('touchstart', handleClick);
    };
  }, [onCharacterClick]);

  return (
    <>
      {!arActive && !error && (
        <div className="ar-loading-overlay">
          <div className="loading-spinner" />
          <p>Entering AR Mode...</p>
        </div>
      )}
      {error && (
        <div className="ar-loading-overlay">
          <p style={{ color: '#f44336', fontSize: 14 }}>{error}</p>
          <p style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
            Try using a WebXR-compatible browser on Quest or Android
          </p>
        </div>
      )}
      <a-scene
        ref={sceneRef}
        embedded
        xr-mode-ui="enabled: true"
        renderer="colorManagement: true; antialias: false;"
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '100%', height: '100%', zIndex: 0,
        }}
      >
        <a-camera position="0 1.6 0" look-controls="enabled: true" />

        <MayaCharacter
          id="maya-webxr"
          position="0 0 -2.5"
          scale="0.7 0.7 0.7"
          color="maya"
          name="Maya"
          isSpeaking={isSpeaking}
          bobAnimation={false}
          disableShadows
        />

        {/* Floating AI response panel */}
        <a-entity id="ai-response-panel" position="-0.6 1.2 -1.2" rotation="0 10 0">
          <a-plane width="0.8" height="0.3" color="#000" opacity="0.5" position="0 0 0" />
          <a-text
            id="ai-text-display" value="Ask me anything!"
            position="0 0 0.01" align="center" color="#FFF"
            width="0.7" wrap-count="20"
          />
        </a-entity>

        {/* Floating mic button */}
        <a-entity
          geometry="primitive: circle; radius: 0.1"
          material="color: #4CAF50; shader: flat"
          position="0.6 1.0 -1.2" rotation="0 -10 0"
          animation="property: scale; to: 1.1 1.1 1.1; dur: 1500; dir: alternate; loop: true; easing: easeInOutSine"
        >
          <a-text value="🎤" position="0 0 0.01" align="center" color="#FFF" width="0.2" />
        </a-entity>

        <a-light type="ambient" color="#fff" intensity="0.5" />
        <a-light type="directional" intensity="0.6" position="1 2 -1" />
      </a-scene>
    </>
  );
}
