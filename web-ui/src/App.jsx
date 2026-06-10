import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useTelemetry } from './hooks/useTelemetry';
import useTrail from './hooks/useTrail';
import TelemetryHUD from './components/TelemetryHUD';
import ARScene from './components/ARScene';
import MindARScene from './components/MindARScene';
import WebXRScene from './components/WebXRScene';
import ChatOverlay from './components/ChatOverlay';
import ChatInput from './components/ChatInput';
import HoldToTalk from './components/HoldToTalk';
import DesktopControls from './components/DesktopControls';
import CampusMap from './components/CampusMap';
import TrailUI from './components/TrailUI';
import ClassStatus from './components/ClassStatus';
import ETAOverlay from './components/ETAOverlay';
import FloorPlanView from './components/FloorPlanView';
import SettingsPanel from './components/SettingsPanel';
import RoutePreview from './components/RoutePreview';
import { hasFloorPlan } from './data/floorplans';
import useTimetable from './hooks/useTimetable';
import usePreloader from './hooks/usePreloader';
import useBattery from './hooks/useBattery';
import useGeolocation, { GeolocationProvider } from './hooks/useGeolocation';
import { API_BASE, NPC_LIST, CAMPUS_LOCATIONS, CAMPUS_POI, CAMPUS_NODES, CAMPUS_EDGES } from './data/config';
import { AR_TARGETS } from './data/targets';
import { findPath, ARRIVAL_THRESHOLD, getNodeById } from './utils/pathfinding';
import { calculateDistance, computeTurnAngle, getDirectionLabel } from './utils/navigation';
import './App.css';

function App() {
  const [activeNpc, setActiveNpc] = useState('maya');
  const [chatHistory, setChatHistory] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [location, setLocation] = useState('');
  const [destination, setDestination] = useState(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [showFloorPlan, setShowFloorPlan] = useState(false);
  const [renderMode, setRenderMode] = useState('loading');
  const [showDebug, setShowDebug] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [pendingPlayback, setPendingPlayback] = useState(null);
  const [insecureWarning, setInsecureWarning] = useState(null);
  const [currentRoute, setCurrentRoute] = useState(() => {
    try {
      const raw = sessionStorage.getItem('maya_route');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.routeStatus === 'active') return saved.currentRoute;
      }
    } catch {}
    return null;
  });
  const [nextWaypointIndex, setNextWaypointIndex] = useState(() => {
    try {
      const raw = sessionStorage.getItem('maya_route');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.routeStatus === 'active') return saved.nextWaypointIndex || 1;
      }
    } catch {}
    return 0;
  });
  const [routeStatus, setRouteStatus] = useState(() => {
    try {
      const raw = sessionStorage.getItem('maya_route');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.routeStatus === 'active') return saved.routeStatus;
      }
    } catch {}
    return 'idle';
  });
  const [currentNodeId, setCurrentNodeId] = useState(() => {
    try {
      const raw = sessionStorage.getItem('maya_route');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.routeStatus === 'active') return saved.currentNodeId || null;
      }
    } catch {}
    return null;
  });
  const [routeFilters, setRouteFilters] = useState({ noStairs: false, wheelchair: false, noKeycard: false });
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [showRoutePreview, setShowRoutePreview] = useState(false);
  const [routeTotalDistance, setRouteTotalDistance] = useState(0);
  const [routeQueue, setRouteQueue] = useState([]);

  const telemetry = useTelemetry();
  const { setStatus: setTelemetryStatus, logEvent: logTelemetryEvent, updateLatency: updateTelemetryLatency } = telemetry;

  const trail = useTrail();
  const { trailPoints, isRecording, startTrail, recordPoint, stopTrail, clearActiveTrail: clearTrail } = trail;

  const timetable = useTimetable();
  const { currentClass, nextClass, minsToNext, autoDestination } = timetable;
  const preloader = usePreloader();
  const battery = useBattery();
  const { latitude, longitude, accuracy } = useGeolocation();
  const [lowPowerMode, setLowPowerMode] = useState(false);
  useEffect(() => {
    setLowPowerMode(battery.isLow);
    if (battery.isLow && battery.supported) {
      logTelemetryEvent('INFO', 'POWER', `Battery low: ${Math.round(battery.level * 100)}%`);
    }
  }, [battery.isLow, battery.level, battery.supported, logTelemetryEvent]);

  useEffect(() => {
    if (routeStatus !== 'active' || !latitude || !longitude || !currentRoute || nextWaypointIndex < 1) return;
    const nextNodeId = currentRoute[nextWaypointIndex];
    const nextNode = getNodeById(nextNodeId, CAMPUS_NODES);
    if (!nextNode) return;
    const dist = calculateDistance(latitude, longitude, nextNode.lat, nextNode.lng);
    if (dist <= ARRIVAL_THRESHOLD && accuracy < 10) {
      logTelemetryEvent('INFO', 'ROUTE', `GPS soft check passed at ${nextNode.label} (${Math.round(dist)}m)`);
    }
  }, [latitude, longitude, accuracy, routeStatus, currentRoute, nextWaypointIndex, logTelemetryEvent]);

  const recordPointFromLoc = useCallback((locId) => {
    if (!locId) return;
    const loc = CAMPUS_LOCATIONS.find((l) => l.id === locId);
    if (loc?.lat) recordPoint(loc.lat, loc.lng);
  }, [recordPoint]);

  const resolveNodeId = useCallback((locId) => {
    if (!locId) return null;
    const target = AR_TARGETS.find((t) => t.id === locId);
    if (target?.nodeId) return target.nodeId;
    const node = CAMPUS_NODES.find((n) => n.id === locId);
    return node?.id || null;
  }, []);

  const clearRouteTimer = useCallback(() => {
    if (routeTimeoutRef.current !== null) {
      clearTimeout(routeTimeoutRef.current);
      routeTimeoutRef.current = null;
    }
  }, []);

  const startRouteTimer = useCallback((seconds) => {
    clearRouteTimer();
    if (seconds <= 0) return;
    routeTimeoutRef.current = setTimeout(() => {
      if (routeStatusRef.current !== 'active') return;
      setRouteStatus('off_route');
      logTelemetryEvent('WARN', 'ROUTE', 'User may be off-route — timeout expired');
      routeTimeoutRef.current = null;
    }, seconds * 1000);
  }, [clearRouteTimer, logTelemetryEvent]);

  const clearRoute = useCallback(() => {
    clearRouteTimer();
    setCurrentRoute(null);
    setNextWaypointIndex(0);
    setRouteStatus('idle');
    setCurrentNodeId(null);
    try { sessionStorage.removeItem('maya_route'); } catch {}
  }, [clearRouteTimer]);

  const ensureAudioUnlocked = useCallback(() => {
    if (audioUnlockedRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
      ctx.close();
      audioUnlockedRef.current = true;
    } catch {}
  }, []);

  const requestAnnouncement = useCallback(async (text) => {
    if (!text) return;
    try {
      const res = await axios.post(`${API_BASE}/announce`, {
        text,
        voice: 'en-US-AriaNeural',
      }, { timeout: 15000, responseType: 'blob' });
      const blob = res.data;
      if (blob.size > 0) {
        const url = URL.createObjectURL(blob);
        const player = systemAudioPlayerRef.current;
        player.src = url;
        player.onended = () => URL.revokeObjectURL(url);
        ensureAudioUnlocked();
        const playPromise = player.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
    } catch (err) {
      logTelemetryEvent?.('ERROR', 'ANNOUNCE', err.message);
    }
  }, [logTelemetryEvent, ensureAudioUnlocked]);

  const computeAndSetRoute = useCallback((fromNodeId, toNodeId) => {
    if (!fromNodeId || !toNodeId) {
      clearRoute();
      return;
    }
    const f = routeFiltersRef.current;
    const hasFilter = f.noStairs || f.wheelchair || f.noKeycard;
    const filterFn = hasFilter
      ? (e) => {
          if (f.noStairs && e.isStairs) return false;
          if (f.wheelchair && !e.hasRamp && !e.hasElevator) return false;
          if (f.noKeycard && e.requiresKeycard) return false;
          return true;
        }
      : null;
    const result = findPath(fromNodeId, toNodeId, CAMPUS_EDGES, filterFn || undefined);
    if (result.path.length < 2) {
      clearRoute();
      requestAnnouncement("I couldn't find an accessible route to that destination with your current filters.");
      return;
    }
    setCurrentRoute(result.path);
    setNextWaypointIndex(1);
    setRouteTotalDistance(result.totalDistance);
    setRouteStatus('idle');
    setShowRoutePreview(true);
    logTelemetryEvent('INFO', 'ROUTE', `${fromNodeId} → ${toNodeId} (${result.totalDistance}m, ${result.path.length} steps)`);
    const walkSpeed = 1.4;
    const legDist = result.path.length > 1
      ? CAMPUS_EDGES.find(
          (e) =>
            (e.source === result.path[0] && e.target === result.path[1]) ||
            (e.target === result.path[0] && e.source === result.path[1])
        )?.distance || 0
      : 0;
    startRouteTimer(((legDist / walkSpeed) + 10) * 2);
  }, [clearRoute, startRouteTimer, logTelemetryEvent, requestAnnouncement]);

  useEffect(() => {
    currentRouteRef.current = currentRoute;
    nextWaypointIndexRef.current = nextWaypointIndex;
    routeStatusRef.current = routeStatus;
    routeFiltersRef.current = routeFilters;
  }, [currentRoute, nextWaypointIndex, routeStatus, routeFilters]);

  useEffect(() => {
    if (!currentRoute || routeStatus === 'idle') {
      sessionStorage.removeItem('maya_route');
      return;
    }
    const data = { currentRoute, nextWaypointIndex, routeStatus, currentNodeId };
    try {
      sessionStorage.setItem('maya_route', JSON.stringify(data));
    } catch {}
  }, [currentRoute, nextWaypointIndex, routeStatus, currentNodeId]);

  // Restart off-route timer after session hydration
  useEffect(() => {
    if (routeStatus !== 'active' || !currentRoute || nextWaypointIndex < 1) return;
    const legEdge = CAMPUS_EDGES.find(
      (e) =>
        (e.source === currentRoute[nextWaypointIndex - 1] && e.target === currentRoute[nextWaypointIndex]) ||
        (e.target === currentRoute[nextWaypointIndex - 1] && e.source === currentRoute[nextWaypointIndex])
    );
    const walkSpeed = 1.4;
    const legDist = legEdge?.distance || 0;
    startRouteTimer(((legDist / walkSpeed) + 10) * 2);
  }, []);

  const prevWaypointIndexRef = useRef(0);
  const lastAnnouncementRef = useRef('');
  useEffect(() => {
    let text = '';
    if (routeStatus === 'active' && nextWaypointIndex > 0 && currentRoute) {
      const prev = prevWaypointIndexRef.current;
      if (nextWaypointIndex !== prev) {
        prevWaypointIndexRef.current = nextWaypointIndex;
        const nextNode = getNodeById(currentRoute[nextWaypointIndex], CAMPUS_NODES);
        if (nextNode) text = `Next step: walk toward the ${nextNode.label}.`;
      }
    } else if (routeStatus === 'off_route') {
      text = 'You may have wandered off the path. Please scan the nearest campus poster so I can find you.';
    } else if (routeStatus === 'arrived') {
      text = 'You have arrived at your destination.';
    }
    if (text && text !== lastAnnouncementRef.current) {
      lastAnnouncementRef.current = text;
      requestAnnouncement(text);
    }
  }, [routeStatus, nextWaypointIndex, currentRoute, requestAnnouncement]);

  useEffect(() => {
    if (routeStatus === 'arrived' && routeQueue.length > 0) {
      const [nextDest, ...rest] = routeQueue;
      setRouteQueue(rest);
      setShowRoutePreview(false);
      const fromNode = resolveNodeId(currentNodeId);
      const toNode = resolveNodeId(nextDest);
      if (fromNode && toNode) {
        computeAndSetRoute(fromNode, toNode);
        setRouteStatus('active');
        setShowRoutePreview(false);
      }
    }
  }, [routeStatus, routeQueue, resolveNodeId, computeAndSetRoute]);

  useEffect(() => {
    if (routeStatusRef.current === 'active' && currentRouteRef.current && currentNodeId) {
      const toNode = currentRouteRef.current[currentRouteRef.current.length - 1];
      computeAndSetRoute(currentNodeId, toNode);
    }
  }, [routeFilters, computeAndSetRoute, currentNodeId]);

  const handleTargetDetected = useCallback((locId) => {
    const nodeId = resolveNodeId(locId);
    setLocation(locId);
    setCurrentNodeId(nodeId);
    recordPointFromLoc(locId);

    const rs = routeStatusRef.current;
    const route = currentRouteRef.current;
    const wpIdx = nextWaypointIndexRef.current;
    if ((rs !== 'active' && rs !== 'off_route') || !route || wpIdx <= 0) return;

    const expectedNodeId = route[wpIdx];
    if (nodeId === expectedNodeId) {
      setRouteStatus('active');
      const nextIdx = wpIdx + 1;
      setNextWaypointIndex(nextIdx);
      if (nextIdx >= route.length) {
        setRouteStatus('arrived');
        clearRouteTimer();
        logTelemetryEvent('INFO', 'ROUTE', 'Destination reached');
      } else {
        const nextEdge = CAMPUS_EDGES.find(
          (e) =>
            (e.source === route[nextIdx - 1] && e.target === route[nextIdx]) ||
            (e.target === route[nextIdx - 1] && e.source === route[nextIdx])
        );
        const walkSpeed = 1.4;
        const legDist = nextEdge?.distance || 0;
        startRouteTimer(((legDist / walkSpeed) + 10) * 2);
        logTelemetryEvent('INFO', 'ROUTE', `Advanced to waypoint ${nextIdx}/${route.length - 1}`);
      }
    } else if (route.includes(nodeId)) {
      const foundIdx = route.lastIndexOf(nodeId);
      if (foundIdx > wpIdx) {
        setRouteStatus('active');
        clearRouteTimer();
        const nextIdx = foundIdx + 1;
        setNextWaypointIndex(nextIdx);
        if (nextIdx < route.length) {
          const nextEdge = CAMPUS_EDGES.find(
            (e) =>
              (e.source === route[nextIdx - 1] && e.target === route[nextIdx]) ||
              (e.target === route[nextIdx - 1] && e.source === route[nextIdx])
          );
          const walkSpeed = 1.4;
          const legDist = nextEdge?.distance || 0;
          startRouteTimer(((legDist / walkSpeed) + 10) * 2);
        }
        logTelemetryEvent('INFO', 'ROUTE', `Skipped ahead to waypoint ${foundIdx}`);
      } else if (foundIdx < wpIdx - 1 && foundIdx >= 0) {
        setRouteStatus('active');
        clearRouteTimer();
        const nextIdx = foundIdx + 1;
        setNextWaypointIndex(nextIdx);
        const nextEdge = CAMPUS_EDGES.find(
          (e) =>
            (e.source === route[nextIdx - 1] && e.target === route[nextIdx]) ||
            (e.target === route[nextIdx - 1] && e.source === route[nextIdx])
        );
        const walkSpeed = 1.4;
        const legDist = nextEdge?.distance || 0;
        startRouteTimer(((legDist / walkSpeed) + 10) * 2);
        logTelemetryEvent('INFO', 'ROUTE', `Rolled back to waypoint ${foundIdx}`);
      }
    } else if (nodeId) {
      const destNode = route[route.length - 1];
      logTelemetryEvent('INFO', 'ROUTE', `Off path — recalculating from ${nodeId} to ${destNode}`);
      computeAndSetRoute(nodeId, destNode);
    }
  }, [resolveNodeId, recordPointFromLoc, computeAndSetRoute, clearRouteTimer, logTelemetryEvent]);

  // Auto-navigate when class is imminent and destination changes
  useEffect(() => {
    if (autoDestination && autoDestination !== handledAutoDestRef.current) {
      handledAutoDestRef.current = autoDestination;
      setDestination(autoDestination);
      setMapVisible(true);
      startTrail();
      const loc = CAMPUS_LOCATIONS.find((l) => l.id === autoDestination);
      if (loc?.lat) recordPoint(loc.lat, loc.lng);
      const fromNode = resolveNodeId(locationRef.current);
      const toNode = resolveNodeId(autoDestination);
      if (fromNode && toNode) computeAndSetRoute(fromNode, toNode);
    }
  }, [autoDestination, startTrail, recordPoint, resolveNodeId, computeAndSetRoute]);

  useEffect(() => {
    setClassDismissed(false);
  }, [currentClass?.id, nextClass?.id]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        logTelemetryEvent('INFO', 'UI', 'App resumed from background');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [logTelemetryEvent]);

  // Auto-show floor plan when scanning a building that has one
  useEffect(() => {
    if (location && hasFloorPlan(location)) {
      setShowFloorPlan(true);
    }
  }, [location]);

  const [classDismissed, setClassDismissed] = useState(false);

  const handleClassNavigate = useCallback((locId) => {
    setDestination(locId);
    setMapVisible(true);
    setClassDismissed(false);
    startTrail();
    recordPointFromLoc(locationRef.current || locId);
    const fromNode = resolveNodeId(locationRef.current);
    const toNode = resolveNodeId(locId);
    if (fromNode && toNode) computeAndSetRoute(fromNode, toNode);
  }, [startTrail, recordPointFromLoc, resolveNodeId, computeAndSetRoute]);

  const enqueueDestination = useCallback((locId) => {
    if (!locId) return;
    setRouteQueue((prev) => {
      if (prev.includes(locId)) return prev;
      return [...prev, locId];
    });
  }, []);

  const handleStartNavigation = useCallback(() => {
    setRouteStatus('active');
    setShowRoutePreview(false);
  }, []);

  const handleCancelRoute = useCallback(() => {
    clearRoute();
    setShowRoutePreview(false);
  }, [clearRoute]);

  const handleClassDismiss = useCallback(() => {
    setClassDismissed(true);
  }, []);

  const recognitionRef = useRef(null);
  const handleSendTextRef = useRef(null);
  const audioPlayerRef = useRef(new Audio());
  const systemAudioPlayerRef = useRef(new Audio());
  const lastSendRef = useRef(0);
  const blobUrlRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const destinationRef = useRef(destination);
  const handledAutoDestRef = useRef(null);
  const nextMsgIdRef = useRef(Date.now());
  const activeNpcRef = useRef(activeNpc);
  const locationRef = useRef(location);
  const sessionIdRef = useRef(null);
  const routeTimeoutRef = useRef(null);
  const currentRouteRef = useRef(null);
  const nextWaypointIndexRef = useRef(0);
  const routeStatusRef = useRef('idle');
  const routeFiltersRef = useRef({ noStairs: false, wheelchair: false, noKeycard: false });

  activeNpcRef.current = activeNpc;
  locationRef.current = location;
  destinationRef.current = destination;

  const isDesktop = renderMode === 'desktop';

  useEffect(() => {
    async function detectCapabilities() {
      setRenderMode('loading');
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

      if (!isSecure && isMobile) {
        setInsecureWarning('Camera requires HTTPS. Use ngrok or deploy to test AR on your phone. Add ?mode=desktop to bypass.');
      }

      if (isMobile && !import.meta.env.VITE_API_BASE) {
        logTelemetryEvent('WARN', 'NET', 'VITE_API_BASE not set — mobile requests may fail without Vite proxy');
      }

      const urlParams = new URLSearchParams(window.location.search);
      const modeOverride = urlParams.get('mode');
      if (modeOverride && ['desktop', 'mobile-ar', 'webxr'].includes(modeOverride)) {
        setRenderMode(modeOverride);
        if (modeOverride !== 'mobile-ar') setInsecureWarning(null);
        return;
      }

      let webxr = false;
      try {
        webxr = navigator.xr
          ? await navigator.xr.isSessionSupported('immersive-ar')
          : false;
      } catch { webxr = false; }
      if (webxr) { setRenderMode('webxr'); return; }

      if (isMobile) {
        let hasCamera = false;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          stream.getTracks().forEach(t => t.stop());
          hasCamera = true;
        } catch { /* no camera or blocked */ }
        if (hasCamera) { setRenderMode('mobile-ar'); return; }
      }

      setRenderMode('desktop');

      try {
        const res = await axios.get(`${API_BASE}/init-session`, { timeout: 5000 });
        sessionIdRef.current = res.data.session_id;
      } catch {
        sessionIdRef.current = 'fallback_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      }

      const targetsUrl = `${import.meta.env.BASE_URL}targets/campus-targets.mind`;
      preloader.preload([targetsUrl]);
    }
    detectCapabilities();
  }, []);

  const handleSendText = useCallback(
    async (text) => {
      if (!text?.trim()) return;
      ensureAudioUnlocked();

      const now = Date.now();
      if (now - lastSendRef.current < 1000) return;
      lastSendRef.current = now;

      const currentNpc = activeNpcRef.current;
      const currentLocation = locationRef.current;

      const userMsg = { id: ++nextMsgIdRef.current, sender: 'user', text, npc: currentNpc };
      setChatHistory((prev) => [...prev, userMsg]);
      setIsThinking(true);
      setTelemetryStatus({ state: 'PROCESSING', color: '🔵', text: 'AI Processing...' });

      const startTime = Date.now();

      const controller = new AbortController();
      const abortTimeout = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await axios.post(
          `${API_BASE}/generate`,
          {
            text,
            npc_id: currentNpc,
            location: currentLocation || '',
            session_id: sessionIdRef.current || 'default_user',
            world_state: {
              environment: 'campus-ar',
              user_notes: '',
              ...(routeStatusRef.current === 'active' && currentRouteRef.current ? (() => {
                const route = currentRouteRef.current;
                const wpIdx = nextWaypointIndexRef.current;
                const nextNode = getNodeById(route[wpIdx], CAMPUS_NODES);
                const currNode = wpIdx >= 1 ? getNodeById(route[wpIdx - 1], CAMPUS_NODES) : null;
                const prevNode = wpIdx >= 2 ? getNodeById(route[wpIdx - 2], CAMPUS_NODES) : null;
                let stepDesc = `Walk to ${nextNode?.label || 'next point'}`;
                if (prevNode && currNode && nextNode) {
                  const angle = computeTurnAngle(prevNode.lat, prevNode.lng, currNode.lat, currNode.lng, nextNode.lat, nextNode.lng);
                  stepDesc = `${getDirectionLabel(angle)} at ${currNode.label}, then walk to ${nextNode.label}`;
                }
                return { route: { next_step: stepDesc, destination_status: 'active' } };
              })() : routeStatusRef.current === 'off_route' || routeStatusRef.current === 'arrived' ? {
                route: { destination_status: routeStatusRef.current },
              } : {}),
            },
          },
          { timeout: 30000, responseType: 'blob', signal: controller.signal }
        );
        clearTimeout(abortTimeout);

        setTelemetryStatus({ state: 'RECEIVING', color: '🟣', text: 'Stream Connected' });

        const raw = res.headers['x-npc-response'] || '';
        const decoded = decodeURIComponent(raw);
        const aiText = decoded || '[Audio Response]';
        const aiMsg = { id: ++nextMsgIdRef.current, sender: 'ai', text: aiText, npc: currentNpc };
        setChatHistory((prev) => [...prev, aiMsg]);

        const navDest = res.headers['x-navigation-destination'] || '';
        if (navDest) {
          setDestination(navDest);
          setMapVisible(true);
          startTrail();
          recordPointFromLoc(currentLocation);
          const fromNode = resolveNodeId(currentLocation);
          const toNode = resolveNodeId(navDest);
          if (fromNode && toNode) computeAndSetRoute(fromNode, toNode);
        }

        const blob = res.data;
        if (blob.size > 0) {
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;

          const player = audioPlayerRef.current;
          player.src = url;

          player.onplay = () => {
            updateTelemetryLatency(Date.now() - startTime);
            setTelemetryStatus({ state: 'SPEAKING', color: '🟢', text: 'Speaker Active' });
            setIsThinking(false);
            setIsPlaying(true);
            setPendingPlayback(null);
          };

          player.onended = () => {
            setTelemetryStatus({ state: 'IDLE', color: '🟢', text: 'Ready' });
            if (blobUrlRef.current === url) {
              URL.revokeObjectURL(url);
              blobUrlRef.current = null;
            }
            setIsPlaying(false);
          };

          const playPromise = player.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              setTelemetryStatus({ state: 'IDLE', color: '🟠', text: 'Tap to hear response' });
              setIsThinking(false);
              setPendingPlayback(url);
            });
          }
        } else {
          setTelemetryStatus({ state: 'IDLE', color: '🟢', text: 'Ready' });
          setIsThinking(false);
        }
      } catch (error) {
        setIsThinking(false);
        setIsPlaying(false);
        setTelemetryStatus({ state: 'ERROR', color: '🔴', text: 'API Error' });
        clearTimeout(abortTimeout);
        const msg = error.name === 'AbortError' || error.code === 'ECONNABORTED'
          ? 'Network connection lost. Please try again.'
          : error.response?.status === 429
            ? 'AI Quota Exhausted. Switching to Offline Mode.'
            : error.response?.status === 422
              ? "I didn't catch that — could you say it again?"
              : 'Connection error. Is the backend running?';
        setChatHistory((prev) => [...prev, { id: ++nextMsgIdRef.current, sender: 'ai', text: msg, npc: currentNpc }]);
      }
    },
    [setTelemetryStatus, updateTelemetryLatency, ensureAudioUnlocked, startTrail, recordPointFromLoc, resolveNodeId, computeAndSetRoute]
  );

  const resumePlayback = useCallback(() => {
    if (!pendingPlayback) return;
    ensureAudioUnlocked();
    const player = audioPlayerRef.current;
    if (player.src !== pendingPlayback) return;
    player.play().catch(() => {
      setPendingPlayback(null);
    });
  }, [pendingPlayback, ensureAudioUnlocked]);

  useEffect(() => { handleSendTextRef.current = handleSendText; }, [handleSendText]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSpeechSupported(false);
      logTelemetryEvent('WARN', 'STT', 'SpeechRecognition unavailable (use Chrome/Edge)');
      return;
    }
    setSpeechSupported(true);

    recognitionRef.current?.abort();

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setTelemetryStatus({ state: 'LISTENING', color: '🟡', text: 'Mic Active' });
    };

    recognition.onend = () => setIsListening(false);

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      handleSendTextRef.current?.(transcript);
    };

    recognition.onerror = (e) => {
      setTelemetryStatus({ state: 'ERROR', color: '🔴', text: 'Mic Error' });
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => recognition.abort();
  }, [setTelemetryStatus, logTelemetryEvent]);

  const toggleListen = useCallback(() => {
    ensureAudioUnlocked();
    if (!speechSupported) {
      setTelemetryStatus({ state: 'ERROR', color: '🟠', text: 'Voice not supported in this browser' });
      return;
    }
    const r = recognitionRef.current;
    if (!r) return;
    if (isListening) {
      try { r.stop(); } catch {}
      setTelemetryStatus({ state: 'IDLE', color: '🟢', text: 'Ready' });
    } else {
      setTelemetryStatus({ state: 'LISTENING', color: '🟡', text: 'Requesting Mic...' });
      try { r.start(); } catch {}
    }
  }, [isListening, setTelemetryStatus, speechSupported, ensureAudioUnlocked]);

  const handleAudioBlob = useCallback(
    async (blob) => {
      setTelemetryStatus({ state: 'LISTENING', color: '🟡', text: 'Transcribing...' });
      try {
        const fd = new FormData();
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        fd.append('file', blob, `recording.${ext}`);
        fd.append('location', location);

        const res = await axios.post(`${API_BASE}/transcribe`, fd, { timeout: 15000 });
        const transcript = res.data.transcript;
        if (transcript && transcript !== '[Error transcribing audio]') {
          handleSendText(transcript);
        }
      } catch (err) {
        setTelemetryStatus({ state: 'ERROR', color: '🔴', text: 'Transcribe Error' });
        setIsThinking(false);
      }
    },
    [location, handleSendText, setTelemetryStatus]
  );

  if (renderMode === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Initializing Maya...</p>
        {insecureWarning && (
          <p style={{ color: '#ff9800', fontSize: 12, marginTop: 12, textAlign: 'center', maxWidth: 300 }}>
            {insecureWarning}
          </p>
        )}
      </div>
    );
  }

  return (
    <GeolocationProvider lowPowerMode={lowPowerMode}>
    <div className="app-container ar-mode">
      {insecureWarning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
          background: '#ff9800', color: '#000', textAlign: 'center',
          padding: '6px 12px', fontSize: 12, fontWeight: 500,
        }}>
          {insecureWarning}
        </div>
      )}
      {renderMode === 'webxr' ? (
        <WebXRScene
          onCharacterClick={toggleListen}
          isSpeaking={isPlaying}
          onReady={() => logTelemetryEvent('INFO', 'XR', 'WebXR immersive AR active')}
          onError={() => { logTelemetryEvent('WARN', 'XR', 'WebXR failed — falling back to MindAR'); setRenderMode('mobile-ar'); }}
        />
      ) : renderMode === 'mobile-ar' ? (
        <MindARScene
          onTargetDetected={handleTargetDetected}
          onTargetLost={() => {}}
          isSpeaking={isPlaying}
          destination={destination}
          location={location}
          trailPoints={trailPoints}
          onReady={() => logTelemetryEvent('INFO', 'AR', 'MindAR initialized')}
          currentRoute={currentRoute}
          nextWaypointIndex={nextWaypointIndex}
          routeStatus={routeStatus}
          currentNodeId={currentNodeId}
          userLatitude={latitude}
          userLongitude={longitude}
        />
      ) : (
        <ARScene
          onCharacterClick={toggleListen}
          isSpeaking={isPlaying}
          destination={destination}
          location={location}
          trailPoints={trailPoints}
          currentRoute={currentRoute}
          nextWaypointIndex={nextWaypointIndex}
          routeStatus={routeStatus}
          currentNodeId={currentNodeId}
          userLatitude={latitude}
          userLongitude={longitude}
        />
      )}

      <ChatOverlay
        activeNpc={activeNpc}
        npcDetails={NPC_LIST}
        chatHistory={chatHistory}
        isThinking={isThinking}
        isPlaying={isPlaying}
        location={location}
      >
        {isDesktop ? (
          <>
            <div className="input-row">
              <button
                className={`mic-button ${isListening ? 'listening' : ''}`}
                onClick={toggleListen}
                disabled={isThinking || !speechSupported}
                aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                title={!speechSupported ? 'Voice input requires Chrome/Edge' : ''}
              >
                {!speechSupported ? '⚠️' : isListening ? '🔴' : '🎤'}
              </button>
              <ChatInput onSendText={handleSendText} isThinking={isThinking} />
            </div>
            {!speechSupported && (
              <div className="browser-warning">
                Voice input requires Chrome or Microsoft Edge
              </div>
            )}
            <DesktopControls
              onRequestMic={toggleListen}
              isListening={isListening}
              isThinking={isThinking}
            />
          </>
        ) : (
          <HoldToTalk onAudioBlob={handleAudioBlob} />
        )}
      </ChatOverlay>

      {!classDismissed && currentClass && (
        <ClassStatus
          currentClass={currentClass}
          nextClass={nextClass}
          minsToNext={minsToNext}
          onNavigate={handleClassNavigate}
          onDismiss={handleClassDismiss}
        />
      )}

      {!classDismissed && !currentClass && nextClass && minsToNext <= 30 && (
        <ClassStatus
          currentClass={null}
          nextClass={nextClass}
          minsToNext={minsToNext}
          onNavigate={handleClassNavigate}
          onDismiss={handleClassDismiss}
        />
      )}

      <ETAOverlay
        destination={destination}
        visible={!!destination}
        currentRoute={currentRoute}
        nextWaypointIndex={nextWaypointIndex}
      />

      <CampusMap
        currentId={location}
        destinationId={destination}
        locations={CAMPUS_LOCATIONS}
        pois={CAMPUS_POI}
        visible={mapVisible}
        onClose={() => setMapVisible(false)}
        trailPoints={trailPoints}
        currentRoute={currentRoute}
        nextWaypointIndex={nextWaypointIndex}
      />

      <FloorPlanView
        locationId={location}
        visible={showFloorPlan}
        onClose={() => setShowFloorPlan(false)}
      />

      {pendingPlayback && (
        <div className="playback-overlay" onClick={resumePlayback}>
          <button className="playback-button">🔊 Tap to hear response</button>
        </div>
      )}

      <div className="ar-top-bar">
        <select
          className="npc-select"
          value={activeNpc}
          onChange={(e) => setActiveNpc(e.target.value)}
        >
          {Object.entries(NPC_LIST).map(([key, npc]) => (
            <option key={key} value={key}>{npc.name}</option>
          ))}
        </select>

        <select
          className="location-select"
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            setCurrentNodeId(resolveNodeId(e.target.value));
            recordPointFromLoc(e.target.value);
          }}
        >
          {CAMPUS_LOCATIONS.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>

        {destination && (
          <button
            className="stop-nav-btn"
            onClick={() => { setDestination(null); setMapVisible(false); clearTrail(); clearRoute(); }}
            title="Stop navigation"
          >
            ✕ Nav
          </button>
        )}

        <button
          className="map-toggle"
          onClick={() => setMapVisible((v) => !v)}
          title="Toggle campus map"
        >
          🗺️
        </button>

        {hasFloorPlan(location) && (
          <button
            className={`floorplan-toggle ${showFloorPlan ? 'active' : ''}`}
            onClick={() => setShowFloorPlan((v) => !v)}
            title="Show floor plan"
          >
            🏛️
          </button>
        )}

        <TrailUI
          activeTrailId={trail.activeTrailId}
          trailPoints={trailPoints}
          isRecording={isRecording}
          savedTrails={trail.savedTrails}
          stopTrail={stopTrail}
          loadTrail={trail.loadTrail}
          clearTrail={trail.clearTrail}
        />

        <button
          className="settings-toggle"
          onClick={() => setSettingsVisible((v) => !v)}
          title="Route preferences"
        >
          ♿
        </button>

        <button
          className="debug-toggle"
          onClick={() => setShowDebug((v) => !v)}
          title="Toggle debug panel"
        >
          🛠️
        </button>
      </div>

      {showRoutePreview && currentRoute && (
        <RoutePreview
          currentRoute={currentRoute}
          totalDistance={routeTotalDistance}
          onStart={handleStartNavigation}
          onCancel={handleCancelRoute}
        />
      )}

      {settingsVisible && (
        <SettingsPanel
          filters={routeFilters}
          onToggle={(key) => setRouteFilters((prev) => ({ ...prev, [key]: !prev[key] }))}
          onClose={() => setSettingsVisible(false)}
        />
      )}

      {showDebug && (
        <div className="debug-panel">
          <TelemetryHUD
            status={telemetry.status}
            logs={telemetry.logs}
            metrics={telemetry.metrics}
          />
        </div>
      )}
    </div>
    </GeolocationProvider>
  );
}

export default App;
