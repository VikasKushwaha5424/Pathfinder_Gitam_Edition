

export default function ChatMessages({ messages, activeNpc, isThinking, isPlaying, npcDetails }) {
  const filteredMessages = messages.filter((msg) => msg.npc === activeNpc);

  if (filteredMessages.length === 0 && !isThinking) {
    return (
      <div className="messages-container" role="log" aria-label="Chat messages">
        <div className="empty-state">System ready. Awaiting input for {npcDetails[activeNpc].name}...</div>
      </div>
    );
  }

  return (
    <div className="messages-container" role="log" aria-label="Chat messages">
      {filteredMessages.map((msg, index, arr) => {
        const isLastAiMessage = msg.sender === 'ai' && index === arr.length - 1;
        return (
          <div key={index} className={`message-bubble ${msg.sender}`}>
            <strong>{msg.sender === 'user' ? 'You' : npcDetails[activeNpc].name}</strong>
            <span>{msg.text}</span>
            {isLastAiMessage && isPlaying && (
              <span className="equalizer" style={{ '--eq-color': npcDetails[activeNpc].color }} aria-hidden="true">
                <span className="equalizer-bar" />
                <span className="equalizer-bar" />
                <span className="equalizer-bar" />
              </span>
            )}
          </div>
        );
      })}
      {isThinking && (
        <div className="message-bubble ai thinking" role="status" aria-label="Processing response">
          Processing neural response...
        </div>
      )}
    </div>
  );
}
