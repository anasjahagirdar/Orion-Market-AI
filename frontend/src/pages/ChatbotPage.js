import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatbotAPI } from '../services/api';
import toast from 'react-hot-toast';

const SUGGESTED = [
  'What is the sentiment for AAPL?',
  'Is TSLA a good buy right now?',
  'Latest news impact on RELIANCE?',
  'Compare GOOGL vs MSFT sentiment',
];

const ChatbotPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "👋 Hi! I'm Orion, your AI stock market assistant. Ask me about any stock sentiment, news impact, or market trends!",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text = null) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: messageText }]);
    setLoading(true);

    try {
      const res = await chatbotAPI.sendMessage(messageText, sessionId);
      setSessionId(res.data.session_id);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.message },
      ]);
    } catch (error) {
      toast.error('Failed to get response');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarLogo}>
          <span>📈</span>
          <span style={styles.sidebarLogoText}>Orion</span>
        </div>
        <nav style={styles.nav}>
          {[
            { icon: '📊', label: 'Dashboard', path: '/dashboard' },
            { icon: '🤖', label: 'AI Chatbot', path: '/chatbot' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                ...styles.navItem,
                ...(item.path === '/chatbot' ? styles.activeNavItem : {}),
              }}
              onClick={() => navigate(item.path)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={styles.sidebarBottom}>
          <div style={styles.userInfo}>
            <div style={styles.avatar}>
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <span style={styles.username}>{user?.username || 'Guest'}</span>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div style={styles.chatArea}>
        {/* Header */}
        <div style={styles.chatHeader}>
          <div style={styles.botInfo}>
            <div style={styles.botAvatar}>🤖</div>
            <div>
              <p style={styles.botName}>Orion AI</p>
              <p style={styles.botStatus}>● Online</p>
            </div>
          </div>
          <button
            style={styles.newChatBtn}
            onClick={() => {
              setMessages([{
                role: 'assistant',
                content: "👋 Hi! I'm Orion, your AI stock market assistant. Ask me about any stock!"
              }]);
              setSessionId(null);
            }}
          >
            + New Chat
          </button>
        </div>

        {/* Messages */}
        <div style={styles.messages}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.messageRow,
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.role === 'assistant' && (
                <div style={styles.botAvatarSmall}>🤖</div>
              )}
              <div
                style={{
                  ...styles.bubble,
                  ...(msg.role === 'user' ? styles.userBubble : styles.botBubble),
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
              <div style={styles.botAvatarSmall}>🤖</div>
              <div style={styles.botBubble}>
                <span style={styles.typing}>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length <= 1 && (
          <div style={styles.suggestions}>
            {SUGGESTED.map((q, i) => (
              <button
                key={i}
                style={styles.suggestionBtn}
                onClick={() => sendMessage(q)}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={styles.inputArea}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any stock... (Enter to send)"
            style={styles.textarea}
            rows={1}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              ...styles.sendBtn,
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    background: '#0a0a1a',
    color: '#fff',
  },
  sidebar: {
    width: '220px',
    background: 'rgba(255,255,255,0.03)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    flexShrink: 0,
  },
  sidebarLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '22px',
    marginBottom: '32px',
    paddingLeft: '8px',
  },
  sidebarLogoText: { fontWeight: '700', color: '#fff', fontSize: '20px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '4px' },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
  },
  activeNavItem: {
    background: 'rgba(108,99,255,0.15)',
    color: '#6c63ff',
  },
  sidebarBottom: { marginTop: 'auto' },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
    marginBottom: '10px',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#6c63ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '14px',
  },
  username: { color: '#fff', fontSize: '13px', fontWeight: '500' },
  logoutBtn: {
    width: '100%',
    padding: '9px',
    background: 'rgba(255,77,77,0.15)',
    border: '1px solid rgba(255,77,77,0.3)',
    borderRadius: '8px',
    color: '#ff4d4d',
    cursor: 'pointer',
    fontSize: '13px',
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  chatHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  botInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
  botAvatar: { fontSize: '32px' },
  botName: { fontWeight: '600', fontSize: '15px', margin: 0 },
  botStatus: { color: '#00d4aa', fontSize: '12px', margin: 0 },
  newChatBtn: {
    padding: '8px 16px',
    background: 'rgba(108,99,255,0.15)',
    border: '1px solid rgba(108,99,255,0.3)',
    borderRadius: '8px',
    color: '#6c63ff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
  },
  botAvatarSmall: { fontSize: '24px', flexShrink: 0 },
  bubble: {
    maxWidth: '70%',
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  userBubble: {
    background: '#6c63ff',
    color: '#fff',
    borderBottomRightRadius: '4px',
  },
  botBubble: {
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.9)',
    borderBottomLeftRadius: '4px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  typing: { color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
  suggestions: {
    padding: '0 24px 16px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  suggestionBtn: {
    padding: '8px 14px',
    background: 'rgba(108,99,255,0.1)',
    border: '1px solid rgba(108,99,255,0.2)',
    borderRadius: '20px',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    fontSize: '12px',
  },
  inputArea: {
    padding: '16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '14px',
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
  },
  sendBtn: {
    width: '44px',
    height: '44px',
    background: '#6c63ff',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '18px',
    cursor: 'pointer',
    flexShrink: 0,
  },
};

export default ChatbotPage;