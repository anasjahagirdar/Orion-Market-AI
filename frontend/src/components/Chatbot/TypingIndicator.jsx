import React from 'react';

const TypingIndicator = () => (
  <div className="floating-chat-row assistant">
    <div className="floating-chat-bubble-wrap">
      <div className="floating-chat-bubble floating-chat-thinking" aria-live="polite">
        <span className="floating-chat-thinking-text">Orion is thinking</span>
        <span className="floating-chat-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  </div>
);

export default React.memo(TypingIndicator);

