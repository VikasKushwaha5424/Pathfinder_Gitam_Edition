import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';

axios.defaults.headers.common['x-api-key'] = 'maya_secret_token';
import ChatOverlay from './components/ChatOverlay';
import HoldToTalk from './components/HoldToTalk';
import CampusMap from './components/CampusMap';
import SettingsPanel from './components/SettingsPanel';
import ETAOverlay from './components/ETAOverlay';
import ClassStatus from './components/ClassStatus';
import FloorPlanView from './components/FloorPlanView';
import PermissionsModal from './components/PermissionsModal';
import { runOfflineAStar } from './utils/pathfinding';
import useTimetable from './hooks/useTimetable';
import useGeolocation from './hooks/useGeolocation';
import useRouteRecalculation from './hooks/useRouteRecalculation';
import { API_BASE, CAMPUS_LOCATIONS as INITIAL_LOCATIONS, CAMPUS_POI as INITIAL_POI } from './data/config';
import { hasFloorPlan } from './data/floorplans';
import './App.css';

function App() {
  const [chatHistory, setChatHistory] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [location, setLocation] = useState('');
  const [destination, setDestination] = useState(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [permissionsDenied, setPermissionsDenied] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimeout = useRef(null);
  const [showFloorPlan, setShowFloorPlan] = useState(false);

  const [campusLocations, setCampusLocations] = useState(INITIAL_LOCATIONS);
  const [campusPoi, setCampusPoi] = useState(INITIAL_POI);

  const [currentRoute, setCurrentRoute] = useState(null);
  const [routeStatus, setRouteStatus] = useState('idle');
  const [routeDistance, setRouteDistance] = useState(0);
  const [routeSteps, setRouteSteps] = useState([]);
  const [routeFilters, setRouteFilters] = useState({ noStairs: false, wheelchair: false, noKeycard: false });
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const gpsLocatedRef = useRef(false);
  const recoveredRef = useRef(false);

  const timetable = useTimetable();
  const { currentClass, nextClass, minsToNext, autoDestination } = timetable;
  const { latitude, longitude, permissionDenied } = useGeolocation();
  const currentCoords = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);

  const sessionIdRef = useRef(null);

  const currentRouteRef = useRef(null);
  useEffect(() => {
    currentRouteRef.current = currentRoute;
  }, [currentRoute]);

  const requestRoute = useCallback(async (fromNode, toNode) => {
    try {
      const activeRouteNodes = currentRouteRef.current ? currentRouteRef.current.map(n => n.id).filter(Boolean) : [];
      const res = await axios.post(`${API_BASE}/api/route`, {
        from_node: fromNode, to_node: toNode,
        from_lat: latitude, from_lng: longitude,
        active_route: activeRouteNodes,
      }, { timeout: 10000 });
      const data = res.data;
      if (data.path?.length >= 2) {
        setCurrentRoute(data.path);
        setRouteDistance(data.distance || 0);
        setRouteSteps(data.steps || []);
        setRouteStatus('active');
        setMapVisible(true);
        return data;
      }
    } catch (err) {
      console.warn('Backend route fetch failed, falling back to offline JS pathfinder...', err);
      try {
         const offlineGraphStr = localStorage.getItem('campus_graph');
         if (offlineGraphStr) {
             const offlineGraph = JSON.parse(offlineGraphStr);
             const result = runOfflineAStar(fromNode, toNode, offlineGraph.nodes, offlineGraph.adj);
             if (result && result.path?.length >= 2) {
                setCurrentRoute(result.path);
                setRouteDistance(result.distance || 0);
                setRouteSteps(result.steps || []);
                setRouteStatus('active');
                setMapVisible(true);
                return result;
             }
         }
      } catch (offlineErr) { console.error('Offline pathfinding failed', offlineErr); }
    }
    return null;
  }, [latitude, longitude]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await axios.get(`${API_BASE}/init-session`, { timeout: 5000 });
        sessionIdRef.current = res.data.session_id;
      } catch {
        sessionIdRef.current = 'fallback_' + Date.now();
      }
      try {
        const resGraph = await axios.get(`${API_BASE}/api/graph`, { timeout: 5000 });
        if (resGraph.data) {
          localStorage.setItem('campus_graph', JSON.stringify(resGraph.data));
        }
      } catch (e) { console.warn('Could not cache offline graph'); }
      try {
        const resLocations = await axios.get(`${API_BASE}/locations`, { timeout: 5000 });
        if (resLocations.data.locations) {
            setCampusLocations([{ id: '', name: '📍 Auto Detect' }, ...resLocations.data.locations]);
            setCampusPois(resLocations.data.pois || []);
        }
      } catch (err) {
        console.error('Failed to load locations', err);
      }
    };
    init();

    // Check permissions
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' }).then(res => {
        if (res.state === 'denied') setPermissionsDenied(true);
        res.onchange = () => {
          if (res.state === 'denied') setPermissionsDenied(true);
        };
      }).catch(()=>{});
    }

    // Ghost map cache check
    axios.get(`${API_BASE}/api/version`).then(res => {
      const serverVersion = res.data.version;
      const localVersion = localStorage.getItem('map_version');
      if (localVersion && serverVersion !== localVersion) {
        if ('caches' in window) {
           caches.keys().then(keys => {
             Promise.all(keys.map(k => caches.delete(k))).then(() => {
                localStorage.setItem('map_version', serverVersion);
                window.location.reload();
             });
           });
        } else {
           localStorage.setItem('map_version', serverVersion);
        }
      } else if (!localVersion) {
        localStorage.setItem('map_version', serverVersion);
      }
    }).catch(()=>{});

    // Idle detector for thermal throttling
    const resetIdle = () => {
      setIsIdle(false);
      clearTimeout(idleTimeout.current);
      idleTimeout.current = setTimeout(() => setIsIdle(true), 10000);
    };
    window.addEventListener('touchstart', resetIdle);
    window.addEventListener('mousemove', resetIdle);
    resetIdle();
    
    return () => {
      window.removeEventListener('touchstart', resetIdle);
      window.removeEventListener('mousemove', resetIdle);
      clearTimeout(idleTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (latitude === null || longitude === null || gpsLocatedRef.current) return;
    gpsLocatedRef.current = true;
    (async () => {
      try {
        const res = await axios.post(`${API_BASE}/api/nearest`, { lat: latitude, lng: longitude }, { timeout: 5000 });
        const data = res.data;
        if (data.poi_name) {
          setLocation(data.node_id);
        }
      } catch {
        // GPS auto-detect failed; user can select manually
      }
    })();
  }, [latitude, longitude]);

  useEffect(() => {
    if (recoveredRef.current) return;
    recoveredRef.current = true;
    try {
      const saved = localStorage.getItem('maya_nav_state');
      if (saved) {
        const state = JSON.parse(saved);
        const age = Date.now() - state.timestamp;
        if (age < 30 * 60 * 1000 && state.routeStatus === 'active' && state.currentRoute) {
          setDestination(state.destination);
          setCurrentRoute(state.currentRoute);
          setRouteDistance(state.routeDistance);
          setRouteSteps(state.routeSteps);
          setRouteStatus('active');
          setMapVisible(true);
        } else {
          localStorage.removeItem('maya_nav_state');
        }
      }
    } catch {
      // Corrupted localStorage entry; ignore
    }
  }, []);

  useEffect(() => {
    if (!autoDestination || routeStatus !== 'idle') return;
    setDestination(autoDestination);
    setMapVisible(true);
    requestRoute(location || '', autoDestination);
  }, [autoDestination, location, routeStatus, requestRoute]);

  const handleSendText = useCallback(async (text) => {
    if (!text?.trim()) return;

    if ('speechSynthesis' in window) {
      const unlock = new SpeechSynthesisUtterance('');
      unlock.volume = 0;
      window.speechSynthesis.speak(unlock);
    }

    const userMsg = { id: Date.now(), sender: 'user', text, npc: 'maya' };
    setChatHistory((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const msgId = Date.now() + 1;
      setChatHistory((prev) => [...prev, { id: msgId, sender: 'ai', text: '', npc: 'maya' }]);
      
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'maya_secret_token' },
        body: JSON.stringify({
          text,
          session_id: sessionIdRef.current || 'default',
          location: location || '',
          user_lat: latitude,
          user_lng: longitude,
        })
      });

      if (!res.ok) {
        throw new Error('Connection error');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      setIsThinking(false);
      let fullText = '';
      let speechBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]' || !dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                fullText += data.text;
                speechBuffer += data.text;
                setChatHistory((prev) => prev.map(msg => 
                  msg.id === msgId ? { ...msg, text: fullText } : msg
                ));
                
                // Trigger speech on sentence boundaries
                if (speechBuffer.match(/[.!?]\s/)) {
                  if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(speechBuffer);
                    utterance.rate = 1.0;
                    utterance.onstart = () => setIsPlaying(true);
                    utterance.onend = () => setIsPlaying(false);
                    window.speechSynthesis.speak(utterance);
                  }
                  speechBuffer = '';
                }
              }
              if (data.route && data.route.coordinates?.length >= 2) {
                const pathData = data.route.coordinates.map((c, i) => ({
                  lat: c[0], lng: c[1],
                  label: data.route.steps?.[i] || `Step ${i + 1}`,
                  id: `wp_${i}`,
                }));
                setCurrentRoute(pathData);
                setRouteDistance(data.route.distance || 0);
                setRouteSteps(data.route.steps || []);
                setRouteStatus('active');
                setMapVisible(true);
              }
            } catch (e) { /* ignore parse errors for partial chunks */ }
          }
        }
      }
      
      if (speechBuffer.trim() && 'speechSynthesis' in window) {
         const utterance = new SpeechSynthesisUtterance(speechBuffer);
         utterance.rate = 1.0;
         utterance.onstart = () => setIsPlaying(true);
         utterance.onend = () => setIsPlaying(false);
         window.speechSynthesis.speak(utterance);
      }

    } catch (err) {
      setIsThinking(false);
      const errMsg = 'Connection error. Is the backend running?';
      setChatHistory((prev) => [...prev, { id: Date.now(), sender: 'ai', text: errMsg, npc: 'maya' }]);
    }
  }, [location, latitude, longitude]);

  const handleVoiceResult = useCallback(async (result) => {
    if ('speechSynthesis' in window) {
      const unlock = new SpeechSynthesisUtterance('');
      unlock.volume = 0;
      window.speechSynthesis.speak(unlock);
    }

    if (typeof result === 'string') {
      handleSendText(result);
      return;
    }
    try {
      const fd = new FormData();
      fd.append('file', result, 'recording.webm');
      const res = await axios.post(`${API_BASE}/transcribe`, fd, { timeout: 15000 });
      const transcript = res.data.transcript;
      if (transcript && transcript !== '[Error transcribing audio]') {
        handleSendText(transcript);
      }
    } catch (err) {
      console.warn('Transcribe error:', err);
    }
  }, [handleSendText]);

  const handleCancelRoute = useCallback(() => {
    setCurrentRoute(null);
    setRouteDistance(0);
    setRouteSteps([]);
    setRouteStatus('idle');
    setDestination(null);
    try { localStorage.removeItem('maya_nav_state'); } catch { /* localStorage unavailable */ }
  }, []);

  const handleCalibrateCompass = useCallback(async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          alert('Compass calibrated successfully!');
        } else {
          alert('Compass access denied.');
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      alert('Calibration not needed or unsupported on this device.');
    }
  }, []);

  const handleClassNavigate = useCallback((locId) => {
    setDestination(locId);
    setMapVisible(true);
    requestRoute(location || '', locId);
  }, [location, requestRoute]);

  const handleRecalculate = useCallback(async (dist) => {
    if (!destination) return;
    setIsRecalculating(true);
    setTimeout(() => setIsRecalculating(false), 4000);
    const msg = {
      id: Date.now(),
      sender: 'ai',
      text: `You've wandered ${Math.round(dist)}m off the route. I've recalculated directions from your current position.`,
      npc: 'maya',
    };
    setChatHistory((prev) => [...prev, msg]);
    const result = await requestRoute(location || '', destination);
    if (result) {
      setRouteStatus('active');
      const state = { destination, currentRoute: result.path, routeDistance: result.distance, routeSteps: result.steps, routeStatus: 'active', timestamp: Date.now() };
      try { localStorage.setItem('maya_nav_state', JSON.stringify(state)); } catch { /* localStorage unavailable */ }
    }
  }, [location, destination, requestRoute]);

  useRouteRecalculation({
    currentRoute,
    currentCoords,
    routeStatus,
    onRecalculate: handleRecalculate,
  });

  useEffect(() => {
    if (routeStatus === 'active' && destination && currentRoute) {
      const state = { destination, currentRoute, routeDistance, routeSteps, routeStatus, timestamp: Date.now() };
      try { localStorage.setItem('maya_nav_state', JSON.stringify(state)); } catch { /* localStorage unavailable */ }
    }
  }, [routeStatus, destination, currentRoute, routeDistance, routeSteps]);

  const currentLocName = campusLocations.find((l) => l.id === location)?.name || (location ? location.replace(/_/g, ' ') : '');

  return (
    <div className="app-container dark-mode">
      <PermissionsModal open={permissionsDenied} onClose={() => setPermissionsDenied(false)} />

      {permissionsDenied && (
        <div className="gps-permission-banner">
          <span>📍 Location access denied.</span>
          <span>Please select your starting point manually.</span>
        </div>
      )}

      <div className="hud-top">
        <select
          className="location-pill"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          title="Current location"
        >
          {campusLocations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>

        <div className="hud-actions">
          {routeStatus !== 'idle' && (
            <button className="hud-btn cancel-nav" onClick={handleCancelRoute} title="Cancel navigation">✕</button>
          )}

          <button className="hud-btn" onClick={handleCalibrateCompass} title="Calibrate Compass">🧭</button>

          {hasFloorPlan(location) && (
            <button
              className={`hud-btn ${showFloorPlan ? 'active' : ''}`}
              onClick={() => setShowFloorPlan((v) => !v)}
              title="Floor plan"
            >🏛️</button>
          )}

          <button
            className={`hud-btn ${settingsVisible ? 'active' : ''}`}
            onClick={() => setSettingsVisible((v) => !v)}
            title="Route preferences"
          >♿</button>
        </div>

        {isRecalculating && (
          <div className="recalc-toast">
            ⚠️ OFF ROUTE: RECALCULATING...
          </div>
        )}
      </div>

      <CampusMap
        currentId={location}
        destinationId={destination}
        locations={campusLocations}
        pois={campusPoi}
        currentRoute={currentRoute}
        currentCoords={currentCoords}
      />

      <FloorPlanView
        locationId={location}
        visible={showFloorPlan}
        onClose={() => setShowFloorPlan(false)}
      />

      {routeStatus === 'active' && (
        <ETAOverlay
          visible
          currentRoute={currentRoute}
          onCancel={handleCancelRoute}
        />
      )}

      <ChatOverlay
        activeNpc="maya"
        npcDetails={{ maya: { name: 'Maya (Campus Guide)', color: '#4CAF50' } }}
        chatHistory={chatHistory}
        isThinking={isThinking}
        isPlaying={isPlaying}
      />

      <HoldToTalk onVoiceResult={handleVoiceResult} />

      {currentClass && (
        <ClassStatus
          currentClass={currentClass}
          nextClass={nextClass}
          minsToNext={minsToNext}
          onNavigate={handleClassNavigate}
          onDismiss={() => {}}
        />
      )}

      {settingsVisible && (
        <SettingsPanel
          filters={routeFilters}
          onToggle={(key) => setRouteFilters((prev) => ({ ...prev, [key]: !prev[key] }))}
          onClose={() => setSettingsVisible(false)}
        />
      )}
    </div>
  );
}

export default App;
