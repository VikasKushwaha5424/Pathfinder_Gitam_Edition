import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useTelemetry } from './hooks/useTelemetry';
import useTrail from './hooks/useTrail';
import TelemetryHUD from './components/TelemetryHUD';
import ARScene from './components/ARScene';
import MindARScene from './components/MindARScene';
import WebXRScene from './components/WebXRScene';
import ChatOverlay from './components/ChatOverlay';
import HoldToTalk from './components/HoldToTalk';
import DesktopControls from './components/DesktopControls';
import CampusMap from './components/CampusMap';
import TrailUI from './components/TrailUI';
import ClassStatus from './components/ClassStatus';
import ETAOverlay from './components/ETAOverlay';
import FloorPlanView from './components/FloorPlanView';
import { hasFloorPlan } from './data/floorplans';
import useTimetable from './hooks/useTimetable';
import { API_BASE, NPC_LIST, CAMPUS_LOCATIONS, CAMPUS_POI } from './data/config';
import './App.css';

function App() {
  const [activeNpc, setActiveNpc] = useState('maya');
  const [inputText, setInputText] = useState('');
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

  const telemetry = useTelemetry();
  const { setStatus: setTelemetryStatus, logEvent: logTelemetryEvent, updateLatency: updateTelemetryLatency } = telemetry;

  const trail = useTrail();
  const { trailPoints, isRecording, startTrail, recordPoint, stopTrail, clearActiveTrail: clearTrail } = trail;

  const timetable = useTimetable();
  const { currentClass, nextClass, minsToNext, autoDestination } = timetable;

  const recordPointFromLoc = useCallback((locId) => {
    if (!locId) return;
    const loc = CAMPUS_LOCATIONS.find((l) => l.id === locId);
    if (loc?.lat) recordPoint(loc.lat, loc.lng);
  }, [recordPoint]);

  // Auto-navigate when class is imminent and no destination is set
  useEffect(() => {
    if (autoDestination && !destination) {
      setDestination(autoDestination);
      setMapVisible(true);
      startTrail();
      const loc = CAMPUS_LOCATIONS.find((l) => l.id === autoDestination);
      if (loc?.lat) recordPoint(loc.lat, loc.lng);
    }
  }, [autoDestination]);

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
    recordPointFromLoc(location || locId);
  }, [location, startTrail, recordPointFromLoc]);

  const handleClassDismiss = useCallback(() => {
    setClassDismissed(true);
  }, []);

  const recognitionRef = useRef(null);
  const audioPlayerRef = useRef(new Audio());
  const lastSendRef = useRef(0);
  const blobUrlRef = useRef(null);
  const nextMsgIdRef = useRef(Date.now());
  const activeNpcRef = useRef(activeNpc);
  const locationRef = useRef(location);
  const sessionIdRef = useRef(
    'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)
  );

  activeNpcRef.current = activeNpc;
  locationRef.current = location;

  const isDesktop = renderMode === 'desktop';

  useEffect(() => {
    async function detectCapabilities() {
      setRenderMode('loading');
      const hasCamera = !!navigator.mediaDevices?.getUserMedia;
      let webxr = false;
      try {
        webxr = navigator.xr
          ? await navigator.xr.isSessionSupported('immersive-ar')
          : false;
      } catch { webxr = false; }

      if (webxr) setRenderMode('webxr');
      else if (hasCamera && /Mobi|Android|iPhone/i.test(navigator.userAgent))
        setRenderMode('mobile-ar');
      else
        setRenderMode('desktop');
    }
    detectCapabilities();
  }, []);

  const handleSendText = useCallback(
    async (text) => {
      if (!text?.trim()) return;

      const now = Date.now();
      if (now - lastSendRef.current < 1000) return;
      lastSendRef.current = now;

      const currentNpc = activeNpcRef.current;
      const currentLocation = locationRef.current;

      const userMsg = { id: ++nextMsgIdRef.current, sender: 'user', text, npc: currentNpc };
      setChatHistory((prev) => [...prev, userMsg]);
      setIsThinking(true);
      setInputText('');
      setTelemetryStatus({ state: 'PROCESSING', color: '🔵', text: 'AI Processing...' });

      const startTime = Date.now();

      try {
        const res = await axios.post(
          `${API_BASE}/generate`,
          {
            text,
            npc_id: currentNpc,
            location: currentLocation,
            world_state: { environment: 'campus-ar', user_notes: '' },
            session_id: sessionIdRef.current,
          },
          { timeout: 10000, responseType: 'blob' }
        );

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
          const trailId = startTrail();
          recordPointFromLoc(currentLocation);
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
        const msg = error.response?.status === 429
          ? 'AI Quota Exhausted. Switching to Offline Mode.'
          : 'Connection error. Is the backend running?';
        setChatHistory((prev) => [...prev, { id: ++nextMsgIdRef.current, sender: 'ai', text: msg, npc: currentNpc }]);
      }
    },
    [setTelemetryStatus, logTelemetryEvent, updateTelemetryLatency]
  );

  const resumePlayback = useCallback(() => {
    if (!pendingPlayback) return;
    const player = audioPlayerRef.current;
    if (player.src !== pendingPlayback) return;
    player.play().catch(() => {
      setPendingPlayback(null);
    });
  }, [pendingPlayback]);

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
      setInputText(transcript);
      handleSendText(transcript);
    };

    recognition.onerror = (e) => {
      setTelemetryStatus({ state: 'ERROR', color: '🔴', text: 'Mic Error' });
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => recognition.abort();
  }, [handleSendText, setTelemetryStatus, logTelemetryEvent]);

  const toggleListen = useCallback(() => {
    if (!speechSupported) {
      setTelemetryStatus({ state: 'ERROR', color: '🟠', text: 'Voice not supported in this browser' });
      return;
    }
    const r = recognitionRef.current;
    if (!r) return;
    if (isListening) {
      r.stop();
      setTelemetryStatus({ state: 'IDLE', color: '🟢', text: 'Ready' });
    } else {
      setTelemetryStatus({ state: 'LISTENING', color: '🟡', text: 'Requesting Mic...' });
      r.start();
    }
  }, [isListening, setTelemetryStatus, speechSupported]);

  const handleAudioBlob = useCallback(
    async (blob) => {
      setTelemetryStatus({ state: 'LISTENING', color: '🟡', text: 'Transcribing...' });
      try {
        const fd = new FormData();
        fd.append('file', blob, 'recording.webm');
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
      </div>
    );
  }

  return (
    <div className="app-container ar-mode">
      {renderMode === 'webxr' ? (
        <WebXRScene
          onCharacterClick={toggleListen}
          isSpeaking={isPlaying}
          onReady={() => logTelemetryEvent('INFO', 'XR', 'WebXR immersive AR active')}
        />
      ) : renderMode === 'mobile-ar' ? (
        <MindARScene
          onTargetDetected={(loc) => {
            setLocation(loc);
            recordPointFromLoc(loc);
            if (loc === destination) setDestination(null);
          }}
          onTargetLost={() => {}}
          isSpeaking={isPlaying}
          destination={destination}
          location={location}
          trailPoints={trailPoints}
          onReady={() => logTelemetryEvent('INFO', 'AR', 'MindAR initialized')}
        />
      ) : (
        <ARScene onCharacterClick={toggleListen} isSpeaking={isPlaying} destination={destination} location={location} trailPoints={trailPoints} />
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
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isThinking) handleSendText(inputText);
                }}
                placeholder="Type a message or hold Space to speak..."
                disabled={isThinking}
              />
              <button
                onClick={() => handleSendText(inputText)}
                disabled={isThinking || !inputText.trim()}
              >
                Send
              </button>
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
          <HoldToTalk onAudioBlob={handleAudioBlob} location={location} />
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

      <ETAOverlay destination={destination} visible={!!destination} />

      <CampusMap
        currentId={location}
        destinationId={destination}
        locations={CAMPUS_LOCATIONS}
        pois={CAMPUS_POI}
        visible={mapVisible}
        onClose={() => setMapVisible(false)}
        trailPoints={trailPoints}
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
            onClick={() => { setDestination(null); setMapVisible(false); clearTrail(); }}
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
          className="debug-toggle"
          onClick={() => setShowDebug((v) => !v)}
          title="Toggle debug panel"
        >
          🛠️
        </button>
      </div>

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
  );
}

export default App;
