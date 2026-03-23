from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from transformers import pipeline
from .models import SentimentResult, StockSentimentSummary
from stocks.models import Stock
import logging

logger = logging.getLogger(__name__)

# Load sentiment model once when server starts
try:
    sentiment_pipeline = pipeline(
        "sentiment-analysis",
        model="ProsusAI/finbert",
        tokenizer="ProsusAI/finbert"
    )
    logger.info("FinBERT model loaded successfully")
except Exception as e:
    sentiment_pipeline = None
    logger.error(f"Failed to load FinBERT model: {e}")


def analyze_text(text):
    """Analyze sentiment of a single text"""
    if not sentiment_pipeline:
        return {'label': 'neutral', 'score': 0.0}

    try:
        # Truncate text to 512 tokens max
        text = text[:512]
        result = sentiment_pipeline(text)[0]
        label = result['label'].lower()
        confidence = result['score']

        # Convert to numeric score (-1 to +1)
        if label == 'positive':
            score = confidence
        elif label == 'negative':
            score = -confidence
        else:
            score = 0.0

        return {'label': label, 'score': round(score, 4)}
    except Exception as e:
        logger.error(f"Sentiment analysis error: {e}")
        return {'label': 'neutral', 'score': 0.0}


@api_view(['POST'])
@permission_classes([AllowAny])
def analyze_sentiment(request):
    """Analyze sentiment of provided text"""
    try:
        text = request.data.get('text', '')
        if not text:
            return Response(
                {'error': 'Text is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = analyze_text(text)
        return Response({
            'text': text[:200],
            'sentiment': result['label'],
            'score': result['score'],
            'model': 'ProsusAI/finbert'
        })

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_stock_sentiment(request, symbol):
    """Get recent sentiment results for a stock"""
    try:
        stock = Stock.objects.get(symbol=symbol.upper())
        sentiments = SentimentResult.objects.filter(stock=stock).order_by('-analyzed_at')[:20]

        data = [{
            'sentiment': s.sentiment_label,
            'score': s.sentiment_score,
            'analyzed_at': s.analyzed_at,
            'model': s.model_used,
        } for s in sentiments]

        return Response({'symbol': symbol.upper(), 'sentiments': data})

    except Stock.DoesNotExist:
        return Response({'error': 'Stock not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_sentiment_summary(request, symbol):
    """Get aggregated sentiment summary for a stock"""
    try:
        stock = Stock.objects.get(symbol=symbol.upper())
        summaries = StockSentimentSummary.objects.filter(stock=stock).order_by('-date')[:30]

        data = [{
            'date': str(s.date),
            'avg_score': s.avg_score,
            'positive': s.positive_count,
            'negative': s.negative_count,
            'neutral': s.neutral_count,
            'total': s.total_articles,
        } for s in summaries]

        return Response({'symbol': symbol.upper(), 'summaries': data})

    except Stock.DoesNotExist:
        return Response({'error': 'Stock not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)