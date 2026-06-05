import { useEffect } from 'react';

export default function DesktopControls({ onRequestMic, isListening, isThinking }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && !isThinking) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        onRequestMic?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRequestMic, isThinking]);

  return (
    <div className="desktop-hint">
      <kbd>Space</kbd>
      <span>{isListening ? 'Release to stop' : 'Hold to speak'}</span>
    </div>
  );
}
