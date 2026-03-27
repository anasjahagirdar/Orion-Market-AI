const FAQ_ENTRIES = [
  {
    keywords: ['pe ratio', 'p/e'],
    answer:
      '**P/E ratio** compares share price to earnings per share. A higher P/E often implies higher growth expectations, while a lower P/E can indicate value or lower expected growth.',
  },
  {
    keywords: ['roe', 'return on equity'],
    answer:
      '**ROE (Return on Equity)** shows how efficiently a company generates profit from shareholder equity. Sustained higher ROE usually indicates stronger capital efficiency.',
  },
  {
    keywords: ['profit margin'],
    answer:
      '**Profit margin** tells you how much profit a company keeps from each unit of revenue. Higher and stable margins usually signal stronger business quality.',
  },
  {
    keywords: ['eps', 'earnings per share'],
    answer:
      '**EPS** is net profit allocated per outstanding share. Rising EPS over time is often a positive sign for long-term investors.',
  },
  {
    keywords: ['beta'],
    answer:
      '**Beta** measures volatility vs the broader market. Around 1 means market-like movement, above 1 is more volatile, and below 1 is typically more stable.',
  },
  {
    keywords: ['dividend yield'],
    answer:
      '**Dividend yield** is annual dividend divided by current share price. It helps evaluate income potential, but always check payout sustainability too.',
  },
  {
    keywords: ['pb ratio', 'price to book'],
    answer:
      '**P/B ratio** compares market price with book value. It is especially useful in banking and asset-heavy sectors, but should be read with ROE and growth.',
  },
  {
    keywords: ['debt to equity', 'debt/equity'],
    answer:
      '**Debt-to-equity** compares total debt against shareholder equity. Lower values generally indicate lower leverage risk, depending on industry norms.',
  },
  {
    keywords: ['watchlist'],
    answer:
      'Use **Watchlist** to track symbols and short-term signals. It is best for monitoring candidates before deciding whether to move them into a portfolio view.',
  },
  {
    keywords: ['portfolio analysis', 'portfolio'],
    answer:
      '**Portfolio Analysis** helps evaluate sector concentration, diversification, and relative positioning. Use it to balance risk rather than chase single-stock moves.',
  },
  {
    keywords: ['btc analysis', 'btc'],
    answer:
      '**BTC Analysis** focuses on crypto-specific trend insights and model outputs. Treat it separately from equity risk assumptions.',
  },
  {
    keywords: ['quality stocks'],
    answer:
      '**Quality Stocks** highlights top-ranked names by sector using financial scoring and AI commentary, so you can compare stronger candidates quickly.',
  },
  {
    keywords: ['dashboard'],
    answer:
      'The **Dashboard** gives a live snapshot: price action, chart history, and sentiment headlines. It is the fastest way to triage a symbol.',
  },
  {
    keywords: ['market sentiment', 'sentiment'],
    answer:
      '**Market sentiment** reflects the tone of news and commentary. Positive sentiment can support momentum, but fundamentals should confirm the trend.',
  },
  {
    keywords: ['bullish'],
    answer:
      '**Bullish** means optimistic expectations for price direction. Confirmation from earnings quality, trend strength, and risk controls is still important.',
  },
  {
    keywords: ['bearish'],
    answer:
      '**Bearish** means downside expectations or risk-off tone. In these phases, position sizing and downside discipline become more important.',
  },
  {
    keywords: ['candlestick'],
    answer:
      '**Candlestick charts** show open, high, low, and close in each period. They are useful for reading momentum, reversals, and intraperiod volatility.',
  },
  {
    keywords: ['sector diversification', 'diversification'],
    answer:
      '**Sector diversification** reduces concentration risk by spreading exposure across industries with different economic sensitivities.',
  },
  {
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'thank you', 'thanks'],
    answer:
      'Hello. I am here to help with stock analysis, sentiment context, and platform guidance whenever you are ready.',
  },
  {
    keywords: ['what can you do', 'help', 'features', 'capabilities'],
    answer:
      'I can explain financial metrics, interpret sentiment context, guide you through Orion features, and help structure stock research questions clearly.',
  },
];

export const resolveFaqResponse = (message) => {
  const text = String(message || '').trim().toLowerCase();
  if (!text) {
    return null;
  }

  const match = FAQ_ENTRIES.find((entry) =>
    entry.keywords.some((keyword) => text.includes(keyword))
  );

  return match ? match.answer : null;
};

