import { useCallback, useRef, useEffect, useState } from 'react';
import { useMediaRecorder } from '../hooks/useMediaRecorder';

export default function HoldToTalk({ onVoiceResult }) {
  const { startRecording, stopRecording } = useMediaRecorder();
  const recognitionRef = useRef(null);
  const cbRef = useRef(onVoiceResult);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    cbRef.current = onVoiceResult;
  }, [onVoiceResult]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
      setListening(false);
      const text = e.results?.[0]?.[0]?.transcript || '';
      if (text) cbRef.current?.(text);
    };

    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      setListening(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
    };
  }, []);

  const handleStart = useCallback(() => {
    setListening(true);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        return;
      } catch { /* ignore */ }
    }
    startRecording({
      onData: (blob) => cbRef.current?.(blob),
      onError: () => setListening(false),
    });
  }, [startRecording]);

  const handleStop = useCallback(() => {
    setListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    } else {
      stopRecording();
    }
  }, [stopRecording]);

  return (
    <button
      className={`voice-orb ${listening ? 'listening' : ''}`}
      onTouchStart={(e) => { e.preventDefault(); handleStart(); }}
      onTouchEnd={(e) => { e.preventDefault(); handleStop(); }}
      onMouseDown={handleStart}
      onMouseUp={handleStop}
      onMouseLeave={handleStop}
      aria-label="Hold to talk"
    >
      <span className="vo-icon">🎙️</span>
    </button>
  );
}
