import React from 'react';
import ReactMarkdown from 'react-markdown';

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const MessageBubble = ({ message }) => {
  if (!message) {
    return null;
  }

  return (
    <div className={`floating-chat-row ${message.role}`}>
      <div className="floating-chat-bubble-wrap">
        <div className="floating-chat-bubble">
          {message.role === 'assistant' ? (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          ) : (
            message.content
          )}
        </div>
        <span className="floating-chat-time">{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
};

export default React.memo(MessageBubble);

