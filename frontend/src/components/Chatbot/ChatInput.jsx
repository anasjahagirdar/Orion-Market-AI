import React, { useCallback } from 'react';

const ChatInput = ({ value, onChange, onSend, disabled }) => {
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onSend();
      }
    },
    [onSend]
  );

  return (
    <div className="floating-chat-input">
      <textarea
        value={value}
        rows={1}
        placeholder="Ask Orion about stocks, sentiment, or platform features..."
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button
        type="button"
        className="btn-press"
        onClick={() => onSend()}
        disabled={disabled || !String(value || '').trim()}
      >
        Send
      </button>
    </div>
  );
};

export default React.memo(ChatInput);

