import { useMemo } from 'react';
import { createTextSprite } from '../utils/textSprite';

export default function NavigationArrow({
  rotationY, visible, color = '#FF8C00',
  directionLabel = '', distanceToNext = 0, isOffRoute = false,
}) {
  const arrowColor = isOffRoute ? '#f44336' : color;
  const dirSprite = useMemo(
    () => directionLabel ? createTextSprite(directionLabel, { color: arrowColor, fontSize: 48 }) : null,
    [directionLabel, arrowColor]
  );
  const distSprite = useMemo(
    () => distanceToNext > 0 ? createTextSprite(`${Math.round(distanceToNext)}m`, { color: '#ffffff', fontSize: 36 }) : null,
    [distanceToNext]
  );
  return (
    <a-entity rotation={`0 ${rotationY} 0`} position="0 0.8 0.8" visible={visible}>
      <a-entity animation="property: position; dir: alternate; dur: 1000; easing: easeInOutSine; loop: true; to: 0 0.2 0">
        <a-cylinder color={arrowColor} height="0.6" radius="0.05" position="0 0 0" rotation="90 0 0" />
        <a-cone color={arrowColor} radius-bottom="0.2" height="0.4" position="0 0 -0.4" rotation="-90 0 0" />
      </a-entity>
      {dirSprite && (
        <a-image
          src={dirSprite}
          position="0 -0.6 0"
          width="1.2"
          height="0.4"
          opacity={0.95}
        />
      )}
      {distSprite && (
        <a-image
          src={distSprite}
          position="0 -1.1 0"
          width="0.8"
          height="0.3"
          opacity={0.75}
        />
      )}
    </a-entity>
  );
}
