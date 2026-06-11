import { useState, useEffect, useRef } from 'react';

export default function ChatOverlay({
  activeNpc, npcDetails, chatHistory,
  isThinking, isPlaying,
}) {
  const [dismissed, setDismissed] = useState(false);
  const fadeTimer = useRef(null);
  const activeName = npcDetails[activeNpc]?.name || activeNpc;

  const lastAi = chatHistory.filter((m) => m.sender === 'ai' && m.npc === activeNpc).at(-1);

  useEffect(() => {
    if (lastAi && !isThinking && !isPlaying) {
      setDismissed(false);
      clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => setDismissed(true), 3000);
    }
    if (isPlaying) {
      clearTimeout(fadeTimer.current);
      setDismissed(false);
    }
    return () => clearTimeout(fadeTimer.current);
  }, [lastAi?.text, isThinking, isPlaying]);

  if (!lastAi && !isThinking) return null;

  const showText = lastAi && !dismissed;
  const isStreaming = isThinking || isPlaying;

  return (
    <div className={`subtitle-toast ${showText || isStreaming ? 'visible' : ''}`}>
      {isThinking && (
        <span className="subtitle-text thinking">Processing...</span>
      )}
      {showText && !isThinking && (
        <span className="subtitle-text">{lastAi.text}</span>
      )}
    </div>
  );
}
