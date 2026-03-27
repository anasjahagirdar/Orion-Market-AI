import React from 'react';

const QuickReplies = ({ options, onSelect }) => {
  if (!options?.length) {
    return null;
  }

  return (
    <div className="floating-chat-suggestions">
      {options.map((option) => (
        <button key={option} type="button" className="btn-press" onClick={() => onSelect(option)}>
          {option}
        </button>
      ))}
    </div>
  );
};

export default React.memo(QuickReplies);

