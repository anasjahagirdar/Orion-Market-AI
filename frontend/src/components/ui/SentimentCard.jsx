import React from 'react';
import {
  formatHeadlineDate,
  formatSentimentScore,
  normalizeSentimentLabel,
} from '../../utils/sentiment';
import '../../styles/components/sentiment-card.css';

const SentimentCard = ({ article }) => {
  const sentimentLabel = normalizeSentimentLabel(article.sentiment_label);
  const sentimentScore = formatSentimentScore(article.sentiment_score);
  const publishedDate = formatHeadlineDate(article.published_at);

  return (
    <li
      className="sentiment-card"
      onClick={() => window.open(article.url, '_blank', 'noopener,noreferrer')}
    >
      <p className="sentiment-card-title">{article.title}</p>
      <div className="sentiment-card-meta">
        <span className="sentiment-card-source">{article.source}</span>
        <span className={`sentiment-card-badge ${sentimentLabel}`}>
          {sentimentLabel.toUpperCase()} - {sentimentScore}
        </span>
        <span className="sentiment-card-date">{publishedDate}</span>
      </div>
    </li>
  );
};

export default SentimentCard;
