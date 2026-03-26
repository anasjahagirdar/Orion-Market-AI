import React from 'react';

const Card = ({ children, className = '', ...props }) => {
  return (
    <section className={`glass-card card-enter ${className}`} {...props}>
      {children}
    </section>
  );
};

export default Card;
