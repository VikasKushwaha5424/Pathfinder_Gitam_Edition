import { useState, useEffect, useRef } from 'react';

export default function ChatMessages({ messages, activeNpc, isThinking, isPlaying, npcDetails }) {
  const filteredMessages = messages.filter((msg) => msg.npc === activeNpc);
  const [streamedText, setStreamedText] = useState({});
  const streamTimersRef = useRef([]);

  const lastAiMsg = filteredMessages
    .filter((m) => m.sender === 'ai')
    .at(-1);

  useEffect(() => {
    streamTimersRef.current.forEach(clearTimeout);
    streamTimersRef.current = [];

    if (!lastAiMsg || !isPlaying) {
      if (lastAiMsg) {
        setStreamedText((prev) => ({
          ...prev,
          [lastAiMsg.text]: lastAiMsg.text,
        }));
      }
      return;
    }

    const words = lastAiMsg.text.split(' ');
    let currentIndex = 0;

    setStreamedText((prev) => ({
      ...prev,
      [lastAiMsg.text]: '',
    }));

    const typeNextWord = () => {
      if (currentIndex <= words.length) {
        setStreamedText((prev) => ({
          ...prev,
          [lastAiMsg.text]: words.slice(0, currentIndex).join(' '),
        }));
        currentIndex++;
        if (currentIndex <= words.length) {
          const delay = words[currentIndex - 1]?.length > 7 ? 80 : 40;
          streamTimersRef.current.push(setTimeout(typeNextWord, delay));
        }
      }
    };

    typeNextWord();

    return () => {
      streamTimersRef.current.forEach(clearTimeout);
    };
  }, [lastAiMsg?.text, isPlaying]);

  if (filteredMessages.length === 0 && !isThinking) {
    return (
      <div className="messages-container" role="log" aria-label="Chat messages">
        <div className="empty-state">
          System ready. Awaiting input for {npcDetails[activeNpc].name}...
        </div>
      </div>
    );
  }

  return (
    <div className="messages-container" role="log" aria-label="Chat messages">
      {filteredMessages.map((msg, index, arr) => {
        const isLastAiMessage = msg.sender === 'ai' && index === arr.length - 1;
        const displayText =
          isLastAiMessage && streamedText[msg.text] !== undefined
            ? streamedText[msg.text]
            : msg.text;

        return (
          <div key={index} className={`message-bubble ${msg.sender}`}>
            <strong>
              {msg.sender === 'user' ? 'You' : npcDetails[activeNpc].name}
            </strong>
            <span>{displayText}</span>
            {isLastAiMessage && isPlaying && (
              <span
                className="equalizer"
                style={{ '--eq-color': npcDetails[activeNpc].color }}
                aria-hidden="true"
              >
                <span className="equalizer-bar" />
                <span className="equalizer-bar" />
                <span className="equalizer-bar" />
              </span>
            )}
          </div>
        );
      })}
      {isThinking && (
        <div
          className="message-bubble ai thinking"
          role="status"
          aria-label="Processing response"
        >
          Processing neural response...
        </div>
      )}
    </div>
  );
}
