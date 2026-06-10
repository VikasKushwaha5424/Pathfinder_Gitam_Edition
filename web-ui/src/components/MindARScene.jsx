import { useEffect, useRef, useState, useMemo } from 'react';
import MayaCharacter from './MayaCharacter';
import NavigationArrow from './NavigationArrow';
import ARTrail from './ARTrail';
import { CAMPUS_LOCATIONS, CAMPUS_NODES } from '../data/config';
import { AR_TARGETS } from '../data/targets';
import { calculateBearing, calculateDistance, computeTurnAngle, getDirectionLabel, getVerticalDirection } from '../utils/navigation';
import { getNodeById, ARRIVAL_THRESHOLD } from '../utils/pathfinding';

const TARGETS_URL = `${import.meta.env.BASE_URL}targets/campus-targets.mind`;

export default function MindARScene({
  onTargetDetected, onTargetLost, isSpeaking, onReady,
  destination, location, trailPoints,
  currentRoute, nextWaypointIndex, routeStatus, currentNodeId,
  userLatitude, userLongitude,
}) {
  const sceneRef = useRef(null);
  const t2Ref = useRef(null);
  const onTargetDetectedRef = useRef(onTargetDetected);
  const [arReady, setArReady] = useState(false);
  const [error, setError] = useState(null);

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

    let turnAngle = 0;
    let directionLabel = '';
    if (currNode && nextNode) {
      const vertical = getVerticalDirection(currNode.floor, nextNode.floor);
      if (vertical) {
        directionLabel = vertical;
      } else if (prevNode && currNode) {
        turnAngle = computeTurnAngle(
          prevNode.lat, prevNode.lng,
          currNode.lat, currNode.lng,
          nextNode.lat, nextNode.lng
        );
        directionLabel = getDirectionLabel(turnAngle);
      }
    }

    return { nextNode, bearing, distance: dist, turnAngle, directionLabel };
  }, [currentRoute, nextWaypointIndex, userLatitude, userLongitude]);

  useEffect(() => {
    onTargetDetectedRef.current = onTargetDetected;
  }, [onTargetDetected]);

  const getLocData = (id) => CAMPUS_LOCATIONS.find((l) => l.id === id);
  const destLoc = destination ? CAMPUS_LOCATIONS.find((l) => l.id === destination) : null;

  const arrowBearing = useMemo(() => {
    const currLoc = getLocData(location);
    if (waypointData) {
      return waypointData.bearing - (currLoc?.posterHeading || 0);
    }
    if (currLoc && destLoc) {
      return calculateBearing(currLoc.lat, currLoc.lng, destLoc.lat, destLoc.lng) - (currLoc.posterHeading || 0);
    }
    return 0;
  }, [location, waypointData, destLoc]);

  const arrowDistance = waypointData?.distance || 0;

  const renderArrow = destination && (routeStatus === 'active' || routeStatus === 'arrived' || routeStatus === 'off_route');

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
      const loc = AR_TARGETS.find((t) => t.index === idx);
      if (loc) onTargetDetectedRef.current?.(loc.id);
    };

    const handleTargetLost = () => onTargetLost?.();

    const attach = () => {
      const targets = scene.querySelectorAll('[mindar-image-target]');
      targets.forEach((el) => {
        el.addEventListener('targetFound', handleTargetFound);
        el.addEventListener('targetLost', handleTargetLost);
      });
      return targets;
    };

    const t1 = setTimeout(() => {
      const targets = attach();
      if (targets.length > 0) {
        setArReady(true);
        onReady?.();
      } else {
        t2Ref.current = setTimeout(() => {
          const retry = attach();
          if (retry.length > 0) {
            setArReady(true);
            onReady?.();
          } else {
            setError('AR targets not found. MindAR may not have loaded.');
          }
        }, 3000);
      }
    }, 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2Ref.current);
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
          <div className="loading-spinner" />
          <p>{error || 'Starting AR Camera...'}</p>
        </div>
      )}
      {error && (
        <div className="ar-loading-overlay">
          <p style={{ color: '#f44336', fontSize: 14 }}>{error}</p>
          <p style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
            Make sure campus-targets.mind is in <code>public/targets/</code>
          </p>
          <p style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
            See <code>public/targets/COMPILE.md</code> to generate it from the SVG posters
          </p>
          <p style={{ color: '#555', fontSize: 11, marginTop: 12 }}>
            Tip: Use the ARScene (desktop mode) to test without MindAR targets
          </p>
        </div>
      )}
      {routeStatus === 'off_route' && arReady && (
        <div className="off-route-banner">
          You may have wandered off the path! Scan the nearest campus poster.
        </div>
      )}
      {routeStatus === 'arrived' && arReady && (
        <div className="arrived-banner">
          You have arrived at your destination!
        </div>
      )}
      <a-scene
        ref={sceneRef}
        mindar-image={`imageTargetSrc: ${TARGETS_URL}; showStats: false; autoStart: true;`}
        embedded
        vr-mode-ui="enabled: false"
        renderer="colorManagement: true;"
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '100%', height: '100%', zIndex: 0,
        }}
      >
        <a-camera position="0 0 0" look-controls="enabled: false" far="100" />

        {AR_TARGETS.map((loc) => (
          <a-entity
            key={loc.index}
            mindar-image-target={`targetIndex: ${loc.index}`}
          >
            <MayaCharacter
              id={`mindar-${loc.id}`}
              position="0 0 0"
              scale="0.7 0.7 0.7"
              color="maya"
              name="Maya"
              isSpeaking={isSpeaking}
              showLabel={false}
              bobAnimation={false}
              disableShadows
            />
            {location === loc.id && renderArrow && (
              <NavigationArrow
                rotationY={arrowBearing}
                visible={true}
                color={routeStatus === 'arrived' ? '#4CAF50' : (routeStatus === 'off_route' ? '#f44336' : '#FF8C00')}
                directionLabel={waypointData?.directionLabel || ''}
                distanceToNext={arrowDistance}
                isOffRoute={routeStatus === 'off_route'}
              />
            )}
          </a-entity>
        ))}
        {location && (
          <ARTrail
            points={trailPoints}
            originLat={getLocData(location)?.lat || 0}
            originLng={getLocData(location)?.lng || 0}
            originHeading={getLocData(location)?.posterHeading || 0}
            maxRadius={30}
          />
        )}
      </a-scene>

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
