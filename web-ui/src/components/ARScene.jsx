import { useEffect, useRef } from 'react';

export default function ARScene({ onCharacterClick, isSpeaking }) {
  const sceneRef = useRef(null);
  const glowRef = useRef(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const handleClick = (e) => {
      if (e.target.closest('#maya-character') || e.target.closest('#maya-model')) {
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

  useEffect(() => {
    if (glowRef.current) {
      glowRef.current.setAttribute('visible', isSpeaking ? 'true' : 'false');
    }
  }, [isSpeaking]);

  return (
    <a-scene
      ref={sceneRef}
      embedded
      vr-mode-ui="enabled: false"
      ar-mode-ui="enabled: false"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}
    >
      <a-entity
        environment="preset: forest; dressingAmount: 3; groundColor: #5a7a3a; grid: none"
      ></a-entity>

      <a-circle
        position="0 -0.01 0"
        radius="8"
        rotation="-90 0 0"
        color="#6B8E23"
        shadow="receive: true"
      ></a-circle>

      {/* Placeholder Maya — primitive character */}
      <a-entity
        id="maya-character"
        position="0 0 -4"
        animation="property: position; to: 0 0.08 -4; dur: 2500; dir: alternate; loop: true; easing: easeInOutSine"
      >
        <a-box
          position="0 0.6 0"
          width="0.6"
          height="0.8"
          depth="0.35"
          color="#4CAF50"
          shadow="cast: true"
        ></a-box>

        <a-sphere
          position="0 1.35 0"
          radius="0.28"
          color="#FFCC80"
          shadow="cast: true"
        ></a-sphere>

        <a-sphere position="-0.1 1.45 0.24" radius="0.04" color="#333"></a-sphere>
        <a-sphere position="0.1 1.45 0.24" radius="0.04" color="#333"></a-sphere>

        <a-torus
          position="0 1.28 0.24"
          radius="0.06"
          radius-tubular="0.015"
          color="#E57373"
          rotation="-10 0 0"
          segments-tubular="16"
          segments-radial="8"
        ></a-torus>

        <a-cylinder
          position="-0.45 0.7 0"
          radius="0.04"
          height="0.5"
          color="#4CAF50"
          rotation="0 0 20"
        ></a-cylinder>
        <a-cylinder
          position="0.45 0.7 0"
          radius="0.04"
          height="0.5"
          color="#4CAF50"
          rotation="0 0 -20"
        ></a-cylinder>

        <a-text
          value="Maya"
          position="0 1.8 0"
          align="center"
          color="#FFF"
          width="2"
        ></a-text>

        {/* Speaking glow ring */}
        <a-ring
          ref={glowRef}
          position="0 0.05 0"
          radius-inner="1.2"
          radius-outer="1.5"
          color="#4CAF50"
          rotation="-90 0 0"
          visible="false"
          animation="property: material.opacity; to: 0.3; dur: 800; dir: alternate; loop: true"
        ></a-ring>
      </a-entity>

      {/* GLB model slot — place a maya.glb in public/models/ to use */}
      {/* <a-entity id="maya-model" gltf-model="url(/models/maya.glb)" position="0 -0.5 -4" scale="0.8 0.8 0.8"></a-entity> */}

      <a-light type="ambient" color="#889" intensity="0.6"></a-light>
      <a-light
        type="directional"
        intensity="0.8"
        position="5 8 -3"
        cast-shadow="true"
      ></a-light>

      <a-camera
        position="0 1.6 2"
        look-controls="enabled: true"
        wasd-controls="enabled: true"
      ></a-camera>
    </a-scene>
  );
}
