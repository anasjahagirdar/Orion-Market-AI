import React from 'react';

const MetricBox = ({ label, value, tone = 'neutral', subtitle = null }) => {
  return (
    <article className={`metric-card glass-card ${tone}`}>
      <p className="metric-label">{label}</p>
      <p key={`${label}-${value}`} className="metric-value value-updated">
        {value}
      </p>
      {subtitle ? <p className="metric-subtitle">{subtitle}</p> : null}
    </article>
  );
};

export default React.memo(MetricBox);
