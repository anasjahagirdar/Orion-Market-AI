export const normalizeSentimentLabel = (label) => {
  const safe = String(label || '').toLowerCase();
  if (safe === 'bullish' || safe === 'bearish' || safe === 'neutral') {
    return safe;
  }
  return 'neutral';
};

export const formatSentimentScore = (score) => {
  if (score === null || score === undefined || score === '') {
    return 'N/A';
  }
  const numeric = Number(score);
  if (Number.isNaN(numeric)) {
    return 'N/A';
  }
  const fixed = numeric.toFixed(2);
  return numeric > 0 ? `+${fixed}` : fixed;
};

export const formatHeadlineDate = (publishedAt) => {
  if (!publishedAt) {
    return '';
  }
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};
