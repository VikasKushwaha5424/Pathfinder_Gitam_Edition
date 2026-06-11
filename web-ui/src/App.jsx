import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import ChatOverlay from './components/ChatOverlay';
import ChatInput from './components/ChatInput';
import HoldToTalk from './components/HoldToTalk';
import CampusMap from './components/CampusMap';
import FloorPlanView from './components/FloorPlanView';
import SettingsPanel from './components/SettingsPanel';
import RoutePreview from './components/RoutePreview';
import ETAOverlay from './components/ETAOverlay';
import ClassStatus from './components/ClassStatus';
import useTimetable from './hooks/useTimetable';
import useGeolocation, { GeolocationProvider } from './hooks/useGeolocation';
import { API_BASE, CAMPUS_LOCATIONS, CAMPUS_POI } from './data/config';
import { hasFloorPlan } from './data/floorplans';
import './App.css';

function App() {
  const [chatHistory, setChatHistory] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [location, setLocation] = useState('');
  const [destination, setDestination] = useState(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [showFloorPlan, setShowFloorPlan] = useState(false);

  const [currentRoute, setCurrentRoute] = useState(null);
  const [routeStatus, setRouteStatus] = useState('idle');
  const [routeDistance, setRouteDistance] = useState(0);
  const [routeSteps, setRouteSteps] = useState([]);
  const [showRoutePreview, setShowRoutePreview] = useState(false);
  const [routeFilters, setRouteFilters] = useState({ noStairs: false, wheelchair: false, noKeycard: false });
  const [settingsVisible, setSettingsVisible] = useState(false);

  const [, setSpeechSupported] = useState(true);
  const gpsLocatedRef = useRef(false);

  const timetable = useTimetable();
  const { currentClass, nextClass, minsToNext, autoDestination } = timetable;
  const { latitude, longitude } = useGeolocation();

  const sessionIdRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SR);
    const init = async () => {
      try {
        const res = await axios.get(`${API_BASE}/init-session`, { timeout: 5000 });
        sessionIdRef.current = res.data.session_id;
      } catch {
        sessionIdRef.current = 'fallback_' + Date.now();
      }
    };
    init();
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
      } catch {}
    })();
  }, [latitude, longitude]);

  useEffect(() => {
    if (!autoDestination || routeStatus !== 'idle') return;
    setDestination(autoDestination);
    setMapVisible(true);
    requestRoute(location || '', autoDestination);
  }, [autoDestination]);

  const requestRoute = useCallback(async (fromNode, toNode) => {
    try {
      const res = await axios.post(`${API_BASE}/api/route`, {
        from_node: fromNode, to_node: toNode,
        from_lat: latitude, from_lng: longitude,
      }, { timeout: 10000 });
      const data = res.data;
      if (data.path?.length >= 2) {
        setCurrentRoute(data.path);
        setRouteDistance(data.distance || 0);
        setRouteSteps(data.steps || []);
        setRouteStatus('preview');
        setShowRoutePreview(true);
        setMapVisible(true);
        return data;
      }
    } catch (err) {
      console.error('Route fetch failed:', err);
    }
    return null;
  }, []);

  const handleSendText = useCallback(async (text) => {
    if (!text?.trim()) return;
    const userMsg = { id: Date.now(), sender: 'user', text };
    setChatHistory((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const res = await axios.post(`${API_BASE}/generate`, {
        text,
        session_id: sessionIdRef.current || 'default',
        location: location || '',
        user_lat: latitude,
        user_lng: longitude,
      }, { timeout: 15000 });

      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      const reply = data.text_response || data.text || '';

      setChatHistory((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: reply }]);

      if (reply && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.rate = 1.0;
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
      }

      if (data.route?.coordinates?.length >= 2) {
        const pathData = data.route.coordinates.map((c, i) => ({
          lat: c[0], lng: c[1],
          label: data.route.steps?.[i] || `Step ${i + 1}`,
          id: `wp_${i}`,
        }));
        setCurrentRoute(pathData);
        setRouteDistance(data.route.distance || 0);
        setRouteSteps(data.route.steps || []);
        setRouteStatus('preview');
        setMapVisible(true);
      }

      setIsThinking(false);
    } catch (err) {
      setIsThinking(false);
      const errMsg = err.response?.status === 429
        ? 'AI Quota Exhausted. Using offline mode.'
        : 'Connection error. Is the backend running?';
      setChatHistory((prev) => [...prev, { id: Date.now(), sender: 'ai', text: errMsg }]);
    }
  }, [location, latitude, longitude]);

  const handleVoiceResult = useCallback(async (result) => {
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
      console.error('Transcribe error:', err);
    }
  }, [handleSendText]);

  const handleStartNavigation = useCallback(() => {
    setRouteStatus('active');
    setShowRoutePreview(false);
  }, []);

  const handleCancelRoute = useCallback(() => {
    setCurrentRoute(null);
    setRouteDistance(0);
    setRouteSteps([]);
    setRouteStatus('idle');
    setShowRoutePreview(false);
    setDestination(null);
  }, []);

  const handleClassNavigate = useCallback((locId) => {
    setDestination(locId);
    setMapVisible(true);
    requestRoute(location || '', locId);
  }, [location, requestRoute]);

  return (
    <GeolocationProvider>
    <div className="app-container">
      <div className="top-bar">
        <select
          className="location-select"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        >
          {CAMPUS_LOCATIONS.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>

        {routeStatus !== 'idle' && (
          <button className="stop-nav-btn" onClick={handleCancelRoute}>✕ Nav</button>
        )}

        <button
          className="map-toggle"
          onClick={() => setMapVisible((v) => !v)}
          title="Toggle campus map"
        >🗺️</button>

        {hasFloorPlan(location) && (
          <button
            className={`floorplan-toggle ${showFloorPlan ? 'active' : ''}`}
            onClick={() => setShowFloorPlan((v) => !v)}
            title="Show floor plan"
          >🏛️</button>
        )}

        <button
          className="settings-toggle"
          onClick={() => setSettingsVisible((v) => !v)}
          title="Route preferences"
        >♿</button>
      </div>

      <CampusMap
        currentId={location}
        destinationId={destination}
        locations={CAMPUS_LOCATIONS}
        pois={CAMPUS_POI}
        visible={mapVisible}
        onClose={() => setMapVisible(false)}
        currentRoute={currentRoute}
      />

      <FloorPlanView
        locationId={location}
        visible={showFloorPlan}
        onClose={() => setShowFloorPlan(false)}
      />

      {routeStatus === 'active' && currentRoute && (
        <ETAOverlay visible currentRoute={currentRoute} />
      )}

      <ChatOverlay
        activeNpc="maya"
        npcDetails={{ maya: { name: 'Maya (Campus Guide)', color: '#4CAF50' } }}
        chatHistory={chatHistory}
        isThinking={isThinking}
        isPlaying={isPlaying}
        location={location}
      >
        <div className="input-row">
          <ChatInput onSendText={handleSendText} isThinking={isThinking} />
        </div>
        <HoldToTalk onVoiceResult={handleVoiceResult} />
      </ChatOverlay>

      {currentClass && (
        <ClassStatus
          currentClass={currentClass}
          nextClass={nextClass}
          minsToNext={minsToNext}
          onNavigate={handleClassNavigate}
          onDismiss={() => {}}
        />
      )}

      {showRoutePreview && currentRoute && (
        <RoutePreview
          currentRoute={currentRoute}
          totalDistance={routeDistance}
          steps={routeSteps}
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
    </div>
    </GeolocationProvider>
  );
}

export default App;
