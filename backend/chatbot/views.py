from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import ChatSession, ChatMessage
import logging

logger = logging.getLogger(__name__)


def simple_stock_response(message):
    """Simple rule-based responses while RAG is being set up"""
    message_lower = message.lower()

    if any(word in message_lower for word in ['hello', 'hi', 'hey']):
        return "Hello! I'm Orion, your AI stock market assistant. Ask me about any stock sentiment, news, or market trends!"

    if 'sentiment' in message_lower:
        return "I can analyze sentiment for stocks! Try asking: 'What is the sentiment for AAPL?' or 'Is TSLA bullish?'"

    if 'news' in message_lower:
        return "I can fetch latest financial news. Which stock or topic are you interested in?"

    if any(word in message_lower for word in ['buy', 'sell', 'invest']):
        return "I can help analyze market sentiment to inform your decisions. Note: This is not financial advice. Always do your own research!"

    return "I'm Orion, your stock market AI assistant. I can help with stock sentiment analysis, news, and market data. What would you like to know?"


@api_view(['POST'])
@permission_classes([AllowAny])
def chat(request):
    """Handle chat messages"""
    try:
        message = request.data.get('message', '').strip()
        session_id = request.data.get('session_id', None)

        if not message:
            return Response(
                {'error': 'Message is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create session for authenticated users
        session = None
        if request.user.is_authenticated:
            if session_id:
                try:
                    session = ChatSession.objects.get(id=session_id, user=request.user)
                except ChatSession.DoesNotExist:
                    pass

            if not session:
                session = ChatSession.objects.create(
                    user=request.user,
                    title=message[:50]
                )

            # Save user message
            ChatMessage.objects.create(
                session=session,
                role='user',
                content=message
            )

        # Generate response
        response_text = simple_stock_response(message)

        # Save assistant response
        if session:
            ChatMessage.objects.create(
                session=session,
                role='assistant',
                content=response_text
            )

        return Response({
            'message': response_text,
            'session_id': session.id if session else None,
        })

    except Exception as e:
        logger.error(f"Chat error: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_sessions(request):
    """Get all chat sessions for current user"""
    try:
        sessions = ChatSession.objects.filter(user=request.user).order_by('-updated_at')
        data = [{
            'id': s.id,
            'title': s.title,
            'created_at': s.created_at,
            'updated_at': s.updated_at,
        } for s in sessions]
        return Response({'sessions': data})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_session_messages(request, session_id):
    """Get all messages in a chat session"""
    try:
        session = ChatSession.objects.get(id=session_id, user=request.user)
        messages = session.messages.all()
        data = [{
            'id': m.id,
            'role': m.role,
            'content': m.content,
            'created_at': m.created_at,
        } for m in messages]
        return Response({'session_id': session_id, 'messages': data})
    except ChatSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_session(request, session_id):
    """Delete a chat session"""
    try:
        session = ChatSession.objects.get(id=session_id, user=request.user)
        session.delete()
        return Response({'message': 'Session deleted successfully'})
    except ChatSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)