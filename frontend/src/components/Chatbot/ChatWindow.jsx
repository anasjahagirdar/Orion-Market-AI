import React, { useEffect, useRef } from 'react';
import { QUICK_REPLIES } from './constants';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import QuickReplies from './QuickReplies';
import TypingIndicator from './TypingIndicator';

const ChatWindow = ({
  isOpen,
  isTyping,
  isFallbackMode,
  messages,
  hasUserMessages,
  input,
  onInputChange,
  onSend,
  onReset,
  onClose,
}) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, isTyping, messages]);

  return (
    <div className={`floating-chat-panel ${isOpen ? 'open' : ''}`} role="dialog" aria-label="Orion AI Assistant">
      <div className="floating-chat-header">
        <div className="floating-chat-title-wrap">
          <h4>Orion AI Assistant</h4>
          <div className="floating-chat-status-row">
            <span className="floating-chat-status-dot" aria-hidden="true" />
            <p>{isFallbackMode ? 'Fallback mode active' : 'Online'}</p>
          </div>
        </div>
        <div className="floating-chat-actions">
          <button type="button" className="btn-press" onClick={onReset}>
            Clear
          </button>
          <button type="button" className="btn-press" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="floating-chat-messages">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isTyping ? <TypingIndicator /> : null}
        <div ref={bottomRef} />
      </div>

      {!hasUserMessages ? <QuickReplies options={QUICK_REPLIES} onSelect={onSend} /> : null}

      <ChatInput value={input} onChange={onInputChange} onSend={onSend} disabled={isTyping} />
    </div>
  );
};

export default React.memo(ChatWindow);

