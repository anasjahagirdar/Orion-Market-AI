import React, { useEffect, useRef, useState } from 'react';
import { chatbotAPI } from '../../services/api';
import '../../styles/components/floating-chatbot.css';

const SUGGESTED = [
  'What is the price of AAPL?',
  'Show top sectors in India',
  'Tell me about TCS stock',
  'Is TSLA bullish today?',
];

const FloatingChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Welcome to Orion AI. Ask about any stock or market trend.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(focusTimer);
  }, [isOpen, messages]);

  const resetChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Welcome to Orion AI. Ask about any stock or market trend.',
      },
    ]);
    setSessionId(null);
    setInput('');
  };

  const sendMessage = async (candidateText = null) => {
    const text = candidateText || input.trim();
    if (!text || loading) {
      return;
    }

    setInput('');
    setMessages((previous) => [...previous, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const response = await chatbotAPI.sendMessage(text, sessionId);
      setSessionId(response.data.session_id);
      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: response.data.message,
        },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: 'I could not fetch a response. Please try again.',
        },
      ]);
    }

    setLoading(false);
  };

  return (
    <>
      {isOpen ? <div className="floating-chat-backdrop" onClick={() => setIsOpen(false)} /> : null}

      <div className={`floating-chat-panel ${isOpen ? 'open' : ''}`}>
        <div className="floating-chat-header">
          <div>
            <h4>Orion AI</h4>
            <p>Quick market assistant</p>
          </div>
          <button type="button" className="btn-press" onClick={resetChat}>
            Reset
          </button>
        </div>

        <div className="floating-chat-messages">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`floating-chat-row ${message.role}`}>
              <div className="floating-chat-bubble">{message.content}</div>
            </div>
          ))}
          {loading ? (
            <div className="floating-chat-row assistant">
              <div className="floating-chat-bubble floating-chat-thinking skeleton">Thinking...</div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {messages.length <= 1 ? (
          <div className="floating-chat-suggestions">
            {SUGGESTED.map((question) => (
              <button key={question} type="button" className="btn-press" onClick={() => sendMessage(question)}>
                {question}
              </button>
            ))}
          </div>
        ) : null}

        <div className="floating-chat-input">
          <input
            ref={inputRef}
            value={input}
            placeholder="Ask Orion AI..."
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            type="button"
            className="btn-press"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>

      <button
        type="button"
        className="floating-chat-fab btn-press"
        onClick={() => setIsOpen((value) => !value)}
      >
        {isOpen ? 'X' : 'AI'}
      </button>
    </>
  );
};

export default FloatingChatbot;
