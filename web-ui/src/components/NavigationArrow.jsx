export default function NavigationArrow({ rotationY, visible, color = '#FF8C00' }) {
  return (
    <a-entity rotation={`0 ${rotationY} 0`} position="0 1.5 0" visible={visible}>
      <a-entity animation="property: position; dir: alternate; dur: 1000; easing: easeInOutSine; loop: true; to: 0 0.2 0">
        <a-cylinder color={color} height="0.6" radius="0.05" position="0 0 0" rotation="90 0 0" />
        <a-cone color={color} radius-bottom="0.2" height="0.4" position="0 0 -0.4" rotation="-90 0 0" />
      </a-entity>
    </a-entity>
  );
}
