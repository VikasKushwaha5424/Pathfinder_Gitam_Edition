import { useCallback, useRef, useEffect, useState } from 'react';

export default function HoldToTalk({ onVoiceResult }) {
  const recognitionRef = useRef(null);
  const cbRef = useRef(onVoiceResult);
  const [listening, setListening] = useState(false);
  
  // 0.1s silent base64 audio to unlock iOS Safari audio context
  const silentAudio = useMemo(() => new Audio('data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'), []);

  useEffect(() => {
    cbRef.current = onVoiceResult;
  }, [onVoiceResult]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
      // Extract the final transcript if available, otherwise latest interim
      const text = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      
      if (text && e.results[0].isFinal) {
          setListening(false);
          cbRef.current?.(text);
      }
    };

    recognition.onerror = () => {
      setListening(false);
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
    // Play silent audio immediately to satisfy Safari's user-initiated audio rule
    try { silentAudio.play().catch(()=>{}); } catch(e) {}
    
    if (!recognitionRef.current) {
        alert("Speech recognition not supported on this browser.");
        return;
    }
    setListening(true);
    try {
      recognitionRef.current.start();
    } catch { /* ignore */ }
  }, [silentAudio]);

  const handleStop = useCallback(() => {
    setListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
  }, []);

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
