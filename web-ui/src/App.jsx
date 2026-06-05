import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useTelemetry } from './hooks/useTelemetry';
import TelemetryHUD from './components/TelemetryHUD';
import ARScene from './components/ARScene';
import MindARScene from './components/MindARScene';
import WebXRScene from './components/WebXRScene';
import ChatOverlay from './components/ChatOverlay';
import HoldToTalk from './components/HoldToTalk';
import DesktopControls from './components/DesktopControls';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

const npcDetails = {
  maya: { name: 'Maya (Campus Guide)', color: '#4CAF50' },
  professor: { name: 'Professor Mehta', color: '#2196F3' },
  silas: { name: 'Silas (Facilities)', color: '#f44336' },
};

function App() {
  const [activeNpc, setActiveNpc] = useState('maya');
  const [inputText, setInputText] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [location, setLocation] = useState('');
  const [renderMode, setRenderMode] = useState('loading');
  const [showDebug, setShowDebug] = useState(false);

  const telemetry = useTelemetry();
  const recognitionRef = useRef(null);
  const audioPlayerRef = useRef(new Audio());

  const isDesktop = renderMode === 'desktop';
  const [permission, setPermission] = useState('prompt');

  useEffect(() => {
    async function detectCapabilities() {
      setRenderMode('loading');
      const hasMediaDevices = !!navigator.mediaDevices?.getUserMedia;
      let webxrSupported = false;
      try {
        webxrSupported = navigator.xr
          ? await navigator.xr.isSessionSupported('immersive-ar')
          : false;
      } catch {
        webxrSupported = false;
      }

      if (webxrSupported) {
        setRenderMode('webxr');
      } else if (hasMediaDevices && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        setRenderMode('mobile-ar');
      } else {
        setRenderMode('desktop');
      }
    }
    detectCapabilities();
  }, []);

  useEffect(() => {
    if (renderMode === 'loading' || renderMode === 'desktop') return;
    async function requestPermissions() {
      try {
        await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: 'environment', width: { ideal: 640 } },
        });
        setPermission('granted');
      } catch {
        setPermission('denied');
      }
    }
    const timer = setTimeout(requestPermissions, 300);
    return () => clearTimeout(timer);
  }, [renderMode]);

  const handleSendText = useCallback(
    async (text) => {
      if (!text?.trim()) return;

      const userMessage = { sender: 'user', text, npc: activeNpc };
      setChatHistory((prev) => [...prev, userMessage]);
      setIsThinking(true);
      setInputText('');

      telemetry.setStatus({
        state: 'PROCESSING',
        color: '🔵',
        text: 'AI Processing...',
      });
      telemetry.logEvent('INFO', 'NETWORK', `Sending to ${npcDetails[activeNpc].name}...`);

      const startTime = Date.now();
      const estimatedUserTokens = Math.ceil(text.length / 4);

      try {
        const response = await axios.post(
          `${API_BASE}/generate`,
          {
            text,
            npc_id: activeNpc,
            location,
            world_state: { environment: 'campus-ar', user_notes: '' },
            session_id: 'default_user',
          },
          { timeout: 10000, responseType: 'blob' }
        );

        telemetry.setStatus({
          state: 'RECEIVING',
          color: '🟣',
          text: 'Stream Connected',
        });

        const audioBlob = response.data;
        if (audioBlob.size === 0) throw new Error('STREAM_EMPTY');

        const encodedText =
          response.headers['x-npc-response'] || '';
        const decodedText = decodeURIComponent(encodedText);
        const aiMessage = {
          sender: 'ai',
          text: decodedText || '[Audio Response]',
          npc: activeNpc,
        };

        setChatHistory((prev) => [...prev, aiMessage]);

        const audioUrl = URL.createObjectURL(audioBlob);
        const player = audioPlayerRef.current;
        player.src = audioUrl;

        player.onplay = () => {
          const latency = Date.now() - startTime;
          telemetry.updateLatency(latency);
          telemetry.addTokens(
            estimatedUserTokens + Math.ceil((decodedText.length || 0) / 4)
          );
          telemetry.setStatus({
            state: 'SPEAKING',
            color: '🟢',
            text: 'Speaker Active',
          });
          setIsThinking(false);
          setIsPlaying(true);
        };

        player.onended = () => {
          telemetry.setStatus({ state: 'IDLE', color: '🟢', text: 'Ready' });
          URL.revokeObjectURL(audioUrl);
          setIsPlaying(false);
        };

        player.play().catch(() => {
          telemetry.setStatus({
            state: 'ERROR',
            color: '🟠',
            text: 'Playback Blocked',
          });
          setIsThinking(false);
          setIsPlaying(false);
        });
      } catch (error) {
        setIsThinking(false);
        setIsPlaying(false);
        telemetry.setStatus({ state: 'ERROR', color: '🔴', text: 'API Error' });
        let errorText = 'Connection error. Is the backend running?';
        if (error.response?.status === 429)
          errorText = 'AI Quota Exhausted. Switching to Offline Mode.';
        setChatHistory((prev) => [
          ...prev,
          { sender: 'ai', text: errorText, npc: activeNpc },
        ]);
      }
    },
    [activeNpc, location, telemetry]
  );

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      telemetry.setStatus({
        state: 'LISTENING',
        color: '🟡',
        text: 'Mic Active',
      });
      telemetry.logEvent('INFO', 'STT', 'Microphone active.');
    };

    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      telemetry.logEvent('INFO', 'STT', `Transcript: "${transcript}"`);
      handleSendText(transcript);
    };

    recognition.onerror = (event) => {
      telemetry.setStatus({
        state: 'ERROR',
        color: '🔴',
        text: 'Mic Error',
      });
      telemetry.logEvent('FATAL', 'HARDWARE', `Mic error: ${event.error}`);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [handleSendText, telemetry]);

  const toggleListen = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      telemetry.setStatus({ state: 'IDLE', color: '🟢', text: 'Ready' });
    } else {
      telemetry.setStatus({
        state: 'LISTENING',
        color: '🟡',
        text: 'Requesting Mic...',
      });
      recognitionRef.current.start();
    }
  }, [isListening, telemetry]);

  const handleAudioBlob = useCallback(
    async (blob) => {
      telemetry.setStatus({
        state: 'LISTENING',
        color: '🟡',
        text: 'Transcribing...',
      });
      telemetry.logEvent('INFO', 'STT', 'Sending audio to transcribe...');

      try {
        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');
        formData.append('location', location);

        const transcribeRes = await axios.post(
          `${API_BASE}/transcribe`,
          formData,
          { timeout: 15000 }
        );

        const transcript = transcribeRes.data.transcript;
        telemetry.logEvent('INFO', 'STT', `Transcribed: "${transcript}"`);
        if (transcript && transcript !== '[Error transcribing audio]') {
          handleSendText(transcript);
        }
      } catch (err) {
        telemetry.logEvent('FATAL', 'STT', `Transcribe error: ${err.message}`);
        setIsThinking(false);
      }
    },
    [location, handleSendText, telemetry]
  );

  if (renderMode === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
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
          onReady={() => telemetry.logEvent('INFO', 'XR', 'WebXR immersive AR active')}
        />
      ) : renderMode === 'mobile-ar' ? (
        <MindARScene
          onTargetDetected={(loc) => setLocation(loc)}
          onTargetLost={() => {}}
          isSpeaking={isPlaying}
          onReady={() => telemetry.logEvent('INFO', 'AR', 'MindAR initialized')}
        />
      ) : (
        <ARScene onCharacterClick={toggleListen} isSpeaking={isPlaying} />
      )}

      <ChatOverlay
        activeNpc={activeNpc}
        npcDetails={npcDetails}
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
                disabled={isThinking}
                aria-label={isListening ? 'Stop listening' : 'Start voice input'}
              >
                {isListening ? '🔴' : '🎤'}
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

      <div className="ar-top-bar">
        <select
          className="npc-select"
          value={activeNpc}
          onChange={(e) => setActiveNpc(e.target.value)}
        >
          {Object.entries(npcDetails).map(([key, npc]) => (
            <option key={key} value={key}>
              {npc.name}
            </option>
          ))}
        </select>

        <select
          className="location-select"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        >
          <option value="">📍 Auto Detect</option>
          <option value="library">Library</option>
          <option value="admin_block">Admin Block</option>
          <option value="cse_department">CS Department</option>
          <option value="canteen">Canteen</option>
          <option value="sports_complex">Sports Complex</option>
          <option value="auditorium">Auditorium</option>
          <option value="hostel_block">Hostels</option>
          <option value="parking">Parking</option>
        </select>

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
