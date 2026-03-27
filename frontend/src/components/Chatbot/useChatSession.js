import { useCallback, useEffect, useMemo, useState } from 'react';
import { chatbotAPI } from '../../services/api';
import { FALLBACK_MESSAGE, WELCOME_MESSAGE } from './constants';
import { resolveFaqResponse } from './faqMap';

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const STORAGE_KEY = 'orion_chatbot_session';

const createMessage = (role, content) => ({
  id: makeId(),
  role,
  content,
  timestamp: new Date().toISOString(),
});

const createSessionId = () => `orion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useChatSession = () => {
  const [messages, setMessages] = useState(() => {
    if (typeof window === 'undefined') {
      return [createMessage('assistant', WELCOME_MESSAGE)];
    }

    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [createMessage('assistant', WELCOME_MESSAGE)];
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.messages) && parsed.messages.length) {
        return parsed.messages.map((message) => ({
          id: message?.id || makeId(),
          role: message?.role === 'user' ? 'user' : 'assistant',
          content: String(message?.content || ''),
          timestamp: message?.timestamp || new Date().toISOString(),
        }));
      }
    } catch (error) {
      // Ignore invalid session payload and recover to default welcome state.
    }
    return [createMessage('assistant', WELCOME_MESSAGE)];
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window === 'undefined') {
      return createSessionId();
    }
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.sessionId || createSessionId();
    } catch (error) {
      return createSessionId();
    }
  });
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  const hasUserMessages = useMemo(
    () => messages.some((message) => message.role === 'user'),
    [messages]
  );

  const resetChat = useCallback(() => {
    setMessages([createMessage('assistant', WELCOME_MESSAGE)]);
    setInput('');
    setSessionId(createSessionId());
    setIsTyping(false);
    setIsFallbackMode(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          messages,
          sessionId,
        })
      );
    } catch (error) {
      // Ignore storage quota and privacy-mode failures.
    }
  }, [messages, sessionId]);

  const sendMessage = useCallback(
    async (candidateText = '') => {
      const text = String(candidateText || input || '').trim();
      if (!text || isTyping) {
        return;
      }

      setInput('');
      setMessages((previous) => [...previous, createMessage('user', text)]);

      const faqResponse = resolveFaqResponse(text);
      if (faqResponse) {
        setMessages((previous) => [...previous, createMessage('assistant', faqResponse)]);
        return;
      }

      setIsTyping(true);
      try {
        const response = await chatbotAPI.sendMessage(text, sessionId);
        const assistantText =
          String(response?.data?.message || '').trim() ||
          'I do not have a clear answer yet. Please try rephrasing your question.';

        if (response?.data?.session_id) {
          setSessionId(response.data.session_id);
        }

        setMessages((previous) => [...previous, createMessage('assistant', assistantText)]);
        setIsFallbackMode(false);
      } catch (error) {
        setMessages((previous) => [...previous, createMessage('assistant', FALLBACK_MESSAGE)]);
        setIsFallbackMode(true);
      } finally {
        setIsTyping(false);
      }
    },
    [input, isTyping, sessionId]
  );

  return {
    input,
    isFallbackMode,
    isTyping,
    messages,
    hasUserMessages,
    resetChat,
    sendMessage,
    setInput,
  };
};

export default useChatSession;

