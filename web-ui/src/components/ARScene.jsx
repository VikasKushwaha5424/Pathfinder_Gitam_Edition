import { useEffect, useRef, useMemo } from 'react';
import MayaCharacter from './MayaCharacter';
import NavigationArrow from './NavigationArrow';
import ARTrail from './ARTrail';
import { CAMPUS_LOCATIONS, CAMPUS_NODES } from '../data/config';
import { calculateBearing, calculateDistance, computeTurnAngle, getDirectionLabel, getVerticalDirection } from '../utils/navigation';
import { getNodeById } from '../utils/pathfinding';

export default function ARScene({
  onCharacterClick, isSpeaking, destination, location, trailPoints,
  currentRoute, nextWaypointIndex, routeStatus, currentNodeId,
  userLatitude, userLongitude,
}) {
  const sceneRef = useRef(null);

  const getLocData = (id) => CAMPUS_LOCATIONS.find((l) => l.id === id);
  const destLoc = destination ? CAMPUS_LOCATIONS.find((l) => l.id === destination) : null;
  const currLoc = getLocData(location);

  const waypointData = useMemo(() => {
    if (!currentRoute || !currentRoute.length || nextWaypointIndex < 1 || nextWaypointIndex >= currentRoute.length) {
      return null;
    }
    const nextNodeId = currentRoute[nextWaypointIndex];
    const nextNode = getNodeById(nextNodeId, CAMPUS_NODES);
    if (!nextNode) return null;

    const currIdx = nextWaypointIndex - 1;
    const currNodeId = currentRoute[currIdx];
    const currNode = getNodeById(currIdx >= 0 ? currNodeId : null, CAMPUS_NODES);
    const prevNodeId = currIdx >= 1 ? currentRoute[currIdx - 1] : null;
    const prevNode = getNodeById(prevNodeId, CAMPUS_NODES);
    const originNode = currNode || prevNode;
    if (!originNode) return null;

    const bearing = calculateBearing(
      originNode.lat, originNode.lng,
      nextNode.lat, nextNode.lng
    );

    const dist = calculateDistance(
      userLatitude || originNode.lat, userLongitude || originNode.lng,
      nextNode.lat, nextNode.lng
    );

    let directionLabel = '';
    if (currNode && nextNode) {
      const vertical = getVerticalDirection(currNode.floor, nextNode.floor);
      if (vertical) {
        directionLabel = vertical;
      } else if (prevNode && currNode) {
        const turnAngle = computeTurnAngle(
          prevNode.lat, prevNode.lng,
          currNode.lat, currNode.lng,
          nextNode.lat, nextNode.lng
        );
        directionLabel = getDirectionLabel(turnAngle);
      }
    }

    return { nextNode, bearing, distance: dist, directionLabel };
  }, [currentRoute, nextWaypointIndex, userLatitude, userLongitude]);

  const arrowBearing = useMemo(() => {
    if (currLoc && waypointData) {
      return waypointData.bearing - (currLoc.posterHeading || 0);
    }
    if (currLoc && destLoc) {
      return calculateBearing(currLoc.lat, currLoc.lng, destLoc.lat, destLoc.lng) - (currLoc.posterHeading || 0);
    }
    return 0;
  }, [currLoc, destLoc, waypointData]);

  const arrowDistance = waypointData?.distance || 0;
  const renderArrow = destination && (routeStatus === 'active' || routeStatus === 'arrived' || routeStatus === 'off_route');

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
    <>
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

        {renderArrow && (
          <NavigationArrow
            rotationY={arrowBearing}
            visible={true}
            color={routeStatus === 'arrived' ? '#4CAF50' : (routeStatus === 'off_route' ? '#f44336' : '#FF8C00')}
            directionLabel={waypointData?.directionLabel || ''}
            distanceToNext={arrowDistance}
            isOffRoute={routeStatus === 'off_route'}
          />
        )}

        {trailPoints && trailPoints.length > 1 && (
          <a-entity>
            {trailPoints.map((pt, i) => {
              const relBearing = currLoc
                ? (calculateBearing(currLoc.lat, currLoc.lng, pt.lat, pt.lng) - (currLoc.posterHeading || 0)) * Math.PI / 180
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

      {routeStatus === 'off_route' && (
        <div className="off-route-banner">
          You may have wandered off the path! Scan the nearest campus poster.
        </div>
      )}
      {routeStatus === 'arrived' && (
        <div className="arrived-banner">
          You have arrived at your destination!
        </div>
      )}

      {renderArrow && waypointData && (
        <div className="waypoint-hud">
          <span className="waypoint-direction">{waypointData.directionLabel}</span>
          <span className="waypoint-distance">{Math.round(arrowDistance)}m</span>
          {currentRoute && (
            <span className="waypoint-progress">
              Step {nextWaypointIndex}/{currentRoute.length - 1}
            </span>
          )}
        </div>
      )}
    </>
  );
}
