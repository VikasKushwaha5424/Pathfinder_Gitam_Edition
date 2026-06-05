import { useCallback } from 'react';
import { useMediaRecorder } from '../hooks/useMediaRecorder';

export default function HoldToTalk({ onAudioBlob }) {
  const { startRecording, stopRecording } = useMediaRecorder();

  const handleStart = useCallback(() => {
    startRecording({
      onData: (blob) => onAudioBlob?.(blob),
      onError: (err) => console.error('Recording error:', err),
    });
  }, [startRecording, onAudioBlob]);

  const handleStop = useCallback(() => {
    stopRecording();
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
