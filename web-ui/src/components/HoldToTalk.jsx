import { useCallback, useRef, useEffect } from 'react';
import { useMediaRecorder } from '../hooks/useMediaRecorder';

export default function HoldToTalk({ onVoiceResult }) {
  const { startRecording, stopRecording } = useMediaRecorder();
  const recognitionRef = useRef(null);
  const cbRef = useRef(onVoiceResult);

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
      const text = e.results[0][0].transcript;
      if (text) cbRef.current?.(text);
    };

    recognition.onerror = () => {
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const handleStart = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        return;
      } catch {}
    }
    startRecording({
      onData: (blob) => cbRef.current?.(blob),
      onError: () => {},
    });
  }, [startRecording]);

  const handleStop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    } else {
      stopRecording();
    }
  }, [stopRecording]);

  return (
    <button
      className="hold-to-talk"
      onTouchStart={(e) => { e.preventDefault(); handleStart(); }}
      onTouchEnd={(e) => { e.preventDefault(); handleStop(); }}
      onMouseDown={handleStart}
      onMouseUp={handleStop}
      onMouseLeave={handleStop}
      aria-label="Hold to talk"
    >
      <span className="ht-icon">🎙️</span>
      <span className="ht-label">Hold to Talk</span>
    </button>
  );
}
