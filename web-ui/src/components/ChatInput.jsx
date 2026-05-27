import { useRef, useEffect } from 'react';
import MicWaveform from './MicWaveform';

export default function ChatInput({ value, onChange, onSubmit, isListening, onToggleListen, isThinking, placeholder }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isThinking && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isThinking]);

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      onSubmit(e);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <form className="input-area" onSubmit={handleSubmit}>
      <button
        type="button"
        className={`mic-button ${isListening ? 'listening' : ''}`}
        onClick={onToggleListen}
        disabled={isThinking}
        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        title="Click to speak (Escape to stop)"
      >
        {isListening ? <MicWaveform isListening={isListening} /> : '🎤'}
      </button>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={isThinking}
        onKeyDown={handleKeyDown}
        aria-label="Message input"
      />

      <button
        type="submit"
        disabled={isThinking || !value.trim()}
        aria-label="Send message"
      >
        TRANSMIT
      </button>
    </form>
  );
}
