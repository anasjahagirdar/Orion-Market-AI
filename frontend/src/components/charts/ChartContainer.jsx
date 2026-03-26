import React from 'react';

const ChartContainer = ({ children, title, subtitle, className = '', ...props }) => {
  return (
    <div className={`chart-container ${className}`} {...props}>
      {(title || subtitle) && (
        <header className="chart-header">
          {title && <h3>{title}</h3>}
          {subtitle && <span className="chart-subtitle">{subtitle}</span>}
        </header>
      )}
      <div className="chart-stage">
        {children}
      </div>
    </div>
  );
};

export default ChartContainer;
