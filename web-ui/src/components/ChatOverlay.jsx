import ChatMessages from './ChatMessages';

export default function ChatOverlay({
  activeNpc,
  npcDetails,
  chatHistory,
  isThinking,
  isPlaying,
  location,
  children,
}) {
  return (
    <div className="chat-overlay">
      {location && (
        <div className="location-badge">
          📍 {location.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </div>
      )}

      <div className="chat-overlay-messages">
        <ChatMessages
          messages={chatHistory}
          activeNpc={activeNpc}
          isThinking={isThinking}
          isPlaying={isPlaying}
          npcDetails={npcDetails}
        />
      </div>

      <div className="chat-overlay-controls">
        {children}
      </div>
    </div>
  );
}
