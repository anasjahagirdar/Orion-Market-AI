import json
import logging

from chatbot.ai_engine import get_groq_client

from quality_stocks.models import StockAIReport, StockFinancialSnapshot

logger = logging.getLogger(__name__)

MODEL_NAME = 'llama-3.1-8b-instant'


def _fmt(value):
    return 'N/A' if value is None else value


def _strip_markdown_fences(text):
    content = (text or '').strip()
    if content.startswith('```') and content.endswith('```'):
        lines = content.splitlines()
        if len(lines) >= 3:
            return '\n'.join(lines[1:-1]).strip()
    return content


def _normalize_label(raw_value, allowed, default):
    value = str(raw_value or '').strip()
    return value if value in allowed else default


def _normalize_float(raw_value, default=0.0, minimum=None, maximum=None):
    try:
        value = float(raw_value)
    except (TypeError, ValueError):
        return default

    if minimum is not None:
        value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


def generate_report(quality_stock_instance):
    try:
        financials = StockFinancialSnapshot.objects.get(stock=quality_stock_instance)
    except StockFinancialSnapshot.DoesNotExist:
        logger.warning('Skipping %s: financial snapshot missing', quality_stock_instance.ticker)
        return None

    client = get_groq_client()
    if not client:
        logger.warning('Skipping %s: Groq client unavailable', quality_stock_instance.ticker)
        return None

    prompt = f"""You are a senior equity research analyst. Analyze the stock below and return a structured JSON report.

Stock: {quality_stock_instance.name} ({quality_stock_instance.ticker})
Sector: {quality_stock_instance.sector} | Exchange: {quality_stock_instance.exchange} | Market: {quality_stock_instance.market}

Financial Data:
- Current Price: {_fmt(financials.current_price)}
- Market Cap: {_fmt(financials.market_cap)}
- PE Ratio: {_fmt(financials.pe_ratio)}
- PB Ratio: {_fmt(financials.pb_ratio)}
- EPS: {_fmt(financials.eps)}
- ROE: {_fmt(financials.roe)}%
- Profit Margin: {_fmt(financials.profit_margin)}%
- Revenue Growth YoY: {_fmt(financials.revenue_growth_yoy)}%
- Debt-to-Equity: {_fmt(financials.debt_to_equity)}
- Dividend Yield: {_fmt(financials.dividend_yield)}%
- Beta: {_fmt(financials.beta)}
- 52-Week High: {_fmt(financials.week_52_high)}
- 52-Week Low: {_fmt(financials.week_52_low)}

Respond ONLY with a valid JSON object - no preamble, no markdown fences:
{{
  "summary": "<2-3 sentence executive summary>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "risks": ["<risk 1>", "<risk 2>"],
  "full_report": "<full markdown report with these sections: ## Overview\\n## Financial Health\\n## Growth Prospects\\n## Key Risks\\n## Conclusion>",
  "sentiment_label": "<Bullish|Neutral|Bearish>",
  "sentiment_score": <float -1.0 to 1.0>,
  "recommendation": "<Strong Buy|Buy|Hold|Sell>"
}}"""

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {'role': 'system', 'content': 'You are an expert equity research analyst. Return only JSON.'},
                {'role': 'user', 'content': prompt},
            ],
            max_tokens=1200,
            temperature=0.3,
        )
    except Exception as exc:
        logger.warning('Skipping %s: Groq request failed: %s', quality_stock_instance.ticker, exc)
        return None

    raw_content = ''
    try:
        raw_content = response.choices[0].message.content
    except Exception:
        raw_content = ''

    cleaned_content = _strip_markdown_fences(raw_content)

    try:
        report_data = json.loads(cleaned_content)
    except json.JSONDecodeError as exc:
        logger.warning('Skipping %s: JSON parsing failed: %s', quality_stock_instance.ticker, exc)
        return None

    summary = str(report_data.get('summary') or '').strip()
    full_report = str(report_data.get('full_report') or '').strip()
    strengths = report_data.get('strengths') if isinstance(report_data.get('strengths'), list) else []
    risks = report_data.get('risks') if isinstance(report_data.get('risks'), list) else []

    if not summary:
        summary = 'No summary generated.'
    if not full_report:
        full_report = '## Overview\nNo report body generated.'

    sentiment_label = _normalize_label(
        report_data.get('sentiment_label'),
        {'Bullish', 'Neutral', 'Bearish'},
        'Neutral',
    )
    recommendation = _normalize_label(
        report_data.get('recommendation'),
        {'Strong Buy', 'Buy', 'Hold', 'Sell'},
        'Hold',
    )

    report_obj, _ = StockAIReport.objects.update_or_create(
        stock=quality_stock_instance,
        defaults={
            'summary': summary,
            'strengths': [str(item) for item in strengths],
            'risks': [str(item) for item in risks],
            'full_report': full_report,
            'sentiment_label': sentiment_label,
            'sentiment_score': _normalize_float(
                report_data.get('sentiment_score'),
                default=0.0,
                minimum=-1.0,
                maximum=1.0,
            ),
            'recommendation': recommendation,
            'model_used': MODEL_NAME,
        },
    )
    return report_obj
