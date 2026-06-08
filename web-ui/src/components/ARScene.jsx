import { useEffect, useRef } from 'react';
import MayaCharacter from './MayaCharacter';
import NavigationArrow from './NavigationArrow';
import ARTrail from './ARTrail';
import { CAMPUS_LOCATIONS } from '../data/config';
import { calculateBearing } from '../utils/navigation';

export default function ARScene({ onCharacterClick, isSpeaking, destination, location, trailPoints }) {
  const sceneRef = useRef(null);

  const getLocData = (id) => CAMPUS_LOCATIONS.find((l) => l.id === id);
  const originData = getLocData(location);
  const destData = getLocData(destination);
  const arrowBearing = originData && destData
    ? calculateBearing(originData.lat, originData.lng, destData.lat, destData.lng) - (originData.posterHeading || 0)
    : 0;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const handleClick = (e) => {
      if (e.target.closest('#maya-desktop')) {
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
    <a-scene
      ref={sceneRef}
      embedded
      vr-mode-ui="enabled: false"
      ar-mode-ui="enabled: false"
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%', zIndex: 0,
      }}
    >
      <a-entity
        environment="preset: forest; dressingAmount: 3; groundColor: #5a7a3a; grid: none"
      />

      <a-circle
        position="0 -0.01 0" radius="8"
        rotation="-90 0 0" color="#6B8E23"
        shadow="receive: true"
      />

      <MayaCharacter
        id="maya-desktop"
        position="0 0 -4"
        color="maya"
        name="Maya"
        isSpeaking={isSpeaking}
      />

      {destination && (
        <NavigationArrow
          rotationY={arrowBearing}
          visible={true}
          color="#FF8C00"
        />
      )}

      {trailPoints && trailPoints.length > 1 && (
        <a-entity>
          {trailPoints.map((pt, i) => {
            const relBearing = originData && destData
              ? (calculateBearing(originData.lat, originData.lng, pt.lat, pt.lng) - (originData.posterHeading || 0)) * Math.PI / 180
              : 0;
            const dist = i * 0.8;
            const x = Math.sin(relBearing) * dist;
            const z = -Math.cos(relBearing) * dist - 4;
            return (
              <a-sphere
                key={i}
                position={`${x} 0.1 ${z}`}
                radius="0.12"
                color="#00FFFF"
                emissive="#00FFFF"
                emissive-intensity="0.4"
                opacity="0.6"
              />
            );
          })}
        </a-entity>
      )}

      <a-light type="ambient" color="#889" intensity="0.6" />
      <a-light
        type="directional" intensity="0.8"
        position="5 8 -3" cast-shadow="true"
      />

      <a-camera
        position="0 1.6 2"
        look-controls="enabled: true"
        wasd-controls="enabled: true"
      />
    </a-scene>
  );
}
