import React from 'react';

const MetricCard = ({ label, value, tone = 'neutral', subtitle = null }) => {
  return (
    <article className={`metric-card glass-card ${tone}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {subtitle ? <p className="metric-subtitle">{subtitle}</p> : null}
    </article>
  );
};

export default MetricCard;
