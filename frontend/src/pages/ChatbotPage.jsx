import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../context/AuthContext';
import { chatbotAPI } from '../services/api';
import '../styles/pages/chatbot-page.css';

const SUGGESTED_PROMPTS = [
  'What is the sentiment for AAPL?',
  'Is TSLA a buy signal right now?',
  'Latest impact of RELIANCE news',
  'Compare GOOGL and MSFT sentiment',
];

const ChatbotPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello, I am Orion AI. Ask about stock sentiment, trends, or market context for any symbol.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
        { role: 'assistant', content: response.data.message },
      ]);
    } catch (error) {
      toast.error('Failed to get response');
      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: 'I could not process that request. Please retry in a few seconds.',
        },
      ]);
    }
    setLoading(false);
  };

  const resetConversation = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'New session started. Ask me about stocks, sentiment, or market signals.',
      },
    ]);
    setSessionId(null);
    setInput('');
  };

  return (
    <AppShell
      title="AI Analysis"
      subtitle="Conversational stock research assistant"
      activePath="/chatbot"
      user={user}
      onLogout={handleLogout}
      indicators={[
        { label: 'Model', value: 'LLaMA + RAG', tone: 'neutral' },
        { label: 'Status', value: loading ? 'Busy' : 'Online', tone: loading ? 'negative' : 'positive' },
      ]}
      portfolioValue="Research Mode"
    >
      <section className="chatbot-shell glass-card">
        <header className="chatbot-header">
          <div>
            <h2>Orion Assistant</h2>
            <p>Ask focused questions for better market answers.</p>
          </div>
          <button type="button" className="chatbot-reset-btn" onClick={resetConversation}>
            New Session
          </button>
        </header>

        <div className="chatbot-messages">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`chatbot-row ${message.role}`}>
              <div className="chatbot-bubble">{message.content}</div>
            </div>
          ))}

          {loading ? (
            <div className="chatbot-row assistant">
              <div className="chatbot-bubble">Thinking...</div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {messages.length <= 1 ? (
          <div className="chatbot-suggestions">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" onClick={() => sendMessage(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        <div className="chatbot-input">
          <textarea
            value={input}
            rows={1}
            placeholder="Ask a stock question. Press Enter to send."
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            type="button"
            className="chatbot-send-btn"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </section>
    </AppShell>
  );
};

export default ChatbotPage;
