import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTelemetry } from './hooks/useTelemetry';
import TelemetryHUD from './components/TelemetryHUD';
import NpcSelector from './components/NpcSelector';
import ChatMessages from './components/ChatMessages';
import ChatInput from './components/ChatInput';
import './App.css';

const npcDetails = {
  maya: { name: 'Maya (The Guide)', color: '#4CAF50' },
  turing: { name: 'Dr. Turing (Expert)', color: '#2196F3' },
  silas: { name: 'Silas (Adversary)', color: '#f44336' },
};

function App() {
  const [activeNpc, setActiveNpc] = useState('maya');
  const [inputText, setInputText] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [worldState, setWorldState] = useState('The user is standing in a standard virtual room.');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [toasts, setToasts] = useState([]);

  const telemetry = useTelemetry();
  const recognitionRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        telemetry.setStatus({ state: 'LISTENING', color: '🟡', text: 'Mic Active' });
        telemetry.logEvent('INFO', 'STT', 'Microphone active. Listening for input...');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        telemetry.logEvent('INFO', 'STT', `Transcribed: "${transcript}"`);
      };

      recognition.onerror = (event) => {
        telemetry.setStatus({ state: 'ERROR', color: '🔴', text: 'Mic Error' });
        telemetry.logEvent('FATAL', 'HARDWARE', `Microphone error: ${event.error}`);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isListening) {
        recognitionRef.current?.stop();
        telemetry.setStatus({ state: 'IDLE', color: '🟢', text: 'Ready' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      addToast('Your browser does not support Speech Recognition.', 'error');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      telemetry.setStatus({ state: 'IDLE', color: '🟢', text: 'Ready' });
    } else {
      telemetry.setStatus({ state: 'LISTENING', color: '🟡', text: 'Requesting Mic...' });
      recognitionRef.current.start();
    }
  };

  const handleReset = async () => {
    try {
      telemetry.logEvent('INFO', 'SYSTEM', `Requesting memory wipe for ${activeNpc.toUpperCase()}...`);
      await axios.post('http://127.0.0.1:8000/reset', {
        npc_id: activeNpc,
        session_id: 'default_user',
      });
      setChatHistory((prev) => prev.filter((msg) => msg.npc !== activeNpc));
      telemetry.resetMetrics();
      telemetry.logEvent('INFO', 'SYSTEM', `Memory wiped successfully.`);
      addToast(`${npcDetails[activeNpc].name}'s memory has been wiped.`, 'success');
    } catch (error) {
      telemetry.logEvent('FATAL', 'SYSTEM', `Failed to wipe memory: ${error.message}`);
      addToast(`Failed to wipe memory: ${error.message}`, 'error');
    }
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();

    if (telemetry.status.state !== 'IDLE' && telemetry.status.state !== 'LISTENING') {
      telemetry.logEvent('WARN', 'STATE', 'Ignored input. System is currently locked.');
      return;
    }

    if (!inputText.trim()) {
      telemetry.setStatus({ state: 'IDLE', color: '🟢', text: 'Ready' });
      return;
    }

    const userMessage = { sender: 'user', text: inputText, npc: activeNpc };
    setChatHistory((prev) => [...prev, userMessage]);
    setIsThinking(true);

    const audioPlayer = new Audio();

    telemetry.setStatus({ state: 'PROCESSING', color: '🔵', text: 'AI Processing...' });
    telemetry.logEvent('INFO', 'NETWORK', `Sending payload to ${npcDetails[activeNpc].name}...`);

    const requestStartTime = Date.now();
    const estimatedUserTokens = Math.ceil(inputText.length / 4);

    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/generate',
        {
          text: userMessage.text,
          npc_id: activeNpc,
          // WRAP the string state into a proper JSON object here:
          world_state: {
            environment: "Web Browser UI",
            user_notes: worldState
          },
          session_id: 'default_user',
        },
        {
          timeout: 8000,
          responseType: 'blob',
        }
      );

      telemetry.setStatus({ state: 'RECEIVING', color: '🟣', text: 'Stream Connected' });
      const audioBlob = response.data;
      if (audioBlob.size === 0) throw new Error('STREAM_EMPTY');

      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('application/json'))
        throw new Error('STREAM_IS_JSON');

      telemetry.logEvent('INFO', 'STREAM', `Received verified audio blob: ${audioBlob.size} bytes`);

      const encodedText = response.headers['x-npc-response'] || '';
      const decodedText = decodeURIComponent(encodedText);
      const aiMessage = { sender: 'ai', text: decodedText || '[Audio Response]', npc: activeNpc };

      setInputText('');
      setChatHistory((prev) => [...prev, aiMessage]);

      const audioUrl = URL.createObjectURL(audioBlob);
      audioPlayer.src = audioUrl;

      audioPlayer.onplay = () => {
        const latencyMs = Date.now() - requestStartTime;
        telemetry.updateLatency(latencyMs);

        const estimatedAiTokens = Math.ceil(decodedText.length / 4);
        telemetry.addTokens(estimatedUserTokens + estimatedAiTokens);

        telemetry.setStatus({ state: 'SPEAKING', color: '🟢', text: 'Speaker Active' });
        telemetry.logEvent('INFO', 'SPEAKER', `Audio playing. Latency: ${latencyMs}ms`);
        setIsThinking(false);
        setIsPlaying(true);
      };

      audioPlayer.onended = () => {
        telemetry.setStatus({ state: 'IDLE', color: '🟢', text: 'Ready' });
        telemetry.logEvent('INFO', 'STATE', 'Interaction complete.');
        URL.revokeObjectURL(audioUrl);
        setIsPlaying(false);
      };

      audioPlayer.play().catch(() => {
        telemetry.setStatus({ state: 'ERROR', color: '🟠', text: 'Playback Blocked' });
        telemetry.logEvent('WARN', 'SPEAKER', 'Browser autoplay blocked.');
        setIsThinking(false);
        setIsPlaying(false);
        addToast('Autoplay blocked. Click anywhere then try again.', 'error');
      });
    } catch (error) {
      console.error('API Error:', error);
      setIsThinking(false);
      setIsPlaying(false);
      telemetry.setStatus({ state: 'ERROR', color: '🔴', text: 'API Failure' });

      let errorText = 'Connection error. Is the backend running?';
      if (error.response?.status === 429) {
        errorText = 'AI Quota Exhausted. Switching to Offline Mode.';
      }
      const errorMessage = { sender: 'ai', text: errorText, npc: activeNpc };
      setChatHistory((prev) => [...prev, errorMessage]);
      addToast(errorText, 'error');
    }
  };

  const handleNpcSelect = (npcKey) => {
    setActiveNpc(npcKey);
    setLeftSidebarOpen(false);
  };

  return (
    <div className="app-container">
      {/* Sidebar Overlay */}
      <div
        className={`sidebar-overlay ${leftSidebarOpen || rightSidebarOpen ? 'visible' : ''}`}
        onClick={() => { setLeftSidebarOpen(false); setRightSidebarOpen(false); }}
        aria-hidden="true"
      />

      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="sidebar-toggle"
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            aria-label="Toggle configuration panel"
            title="Toggle configuration"
          >
            ☰
          </button>
          <h1>XR-NPC Developer Dashboard</h1>
        </div>
        <div className="header-controls">
          <button
            className="sidebar-toggle"
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            aria-label="Toggle telemetry panel"
            title="Toggle telemetry"
          >
            📊
          </button>
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* LEFT SIDEBAR */}
        <aside className={`sidebar left-sidebar ${leftSidebarOpen ? 'open' : ''}`} aria-label="Configuration panel">
          <NpcSelector npcDetails={npcDetails} activeNpc={activeNpc} onSelect={handleNpcSelect} />

          <h3 className="section-title">Environment Override</h3>
          <textarea
            className="world-state-input"
            value={worldState}
            onChange={(e) => setWorldState(e.target.value)}
            placeholder="Describe the VR environment..."
            aria-label="Environment override"
          />

          <h3 className="section-title">Session Controls</h3>
          <button
            className="danger-button"
            onClick={handleReset}
            aria-label={`Wipe memory for ${npcDetails[activeNpc].name}`}
          >
            ⚠️ Clear Memory ({npcDetails[activeNpc].name})
          </button>
        </aside>

        {/* CENTER CHAT */}
        <main className="chat-window" role="main" aria-label="Chat console">
          <ChatMessages
            messages={chatHistory}
            activeNpc={activeNpc}
            isThinking={isThinking}
            isPlaying={isPlaying}
            npcDetails={npcDetails}
          />

          <ChatInput
            value={inputText}
            onChange={setInputText}
            onSubmit={sendMessage}
            isListening={isListening}
            onToggleListen={toggleListen}
            isThinking={isThinking}
            placeholder={`Send payload to ${npcDetails[activeNpc].name}...`}
          />
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className={`sidebar right-sidebar ${rightSidebarOpen ? 'open' : ''}`} aria-label="Telemetry panel">
          <h3>Live Telemetry</h3>
          <div className="telemetry-wrapper">
            <TelemetryHUD status={telemetry.status} logs={telemetry.logs} metrics={telemetry.metrics} />
          </div>
        </aside>
      </div>

      {/* Toast Notifications */}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;