import React, { useCallback, useState } from 'react';
import ChatWindow from './ChatWindow';
import { useChatSession } from './useChatSession';
import '../../styles/components/floating-chatbot.css';

const ChatbotShell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, input, isTyping, isFallbackMode, hasUserMessages, sendMessage, setInput, resetChat } =
    useChatSession();

  const handleToggle = useCallback(() => {
    setIsOpen((previous) => !previous);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSend = useCallback(
    (candidate) => {
      sendMessage(candidate);
    },
    [sendMessage]
  );

  return (
    <>
      {isOpen ? <div className="floating-chat-backdrop" onClick={handleClose} aria-hidden="true" /> : null}

      <ChatWindow
        isOpen={isOpen}
        isTyping={isTyping}
        isFallbackMode={isFallbackMode}
        messages={messages}
        hasUserMessages={hasUserMessages}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        onReset={resetChat}
        onClose={handleClose}
      />

      <button
        type="button"
        className="floating-chat-fab btn-press"
        onClick={handleToggle}
        aria-label={isOpen ? 'Close Orion AI Assistant' : 'Open Orion AI Assistant'}
      >
        {isOpen ? 'X' : 'AI'}
      </button>
    </>
  );
};

export default React.memo(ChatbotShell);

