import secrets
import re
from django.contrib.auth import authenticate, logout
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import UserProfile
from .telegram_service import (
    TelegramError,
    fetch_telegram_updates,
    send_telegram_message,
)

OTP_EXPIRY_SECONDS = 5 * 60
OTP_MAX_ATTEMPTS = 5
OTP_PURPOSE_LOGIN = 'login'
OTP_PURPOSE_RESET = 'reset_password'
OTP_ALLOWED_PURPOSES = {OTP_PURPOSE_LOGIN, OTP_PURPOSE_RESET}
OTP_LENGTH = 6
IDENTIFIER_MAX_LENGTH = 64
SECURITY_QA_MIN = 2
SECURITY_QA_MAX = 3
SECURITY_RESET_TOKEN_EXPIRY_SECONDS = 10 * 60
DEV_SEND_LIMIT_PER_WINDOW = 50
DEV_SEND_WINDOW_SECONDS = 60
PROD_SEND_LIMIT_PER_WINDOW = 5
PROD_SEND_WINDOW_SECONDS = 300
DEV_SEND_IP_LIMIT_PER_WINDOW = 250
PROD_SEND_IP_LIMIT_PER_WINDOW = 25
DEV_OTP_COOLDOWN_SECONDS = 5
PROD_OTP_COOLDOWN_SECONDS = 60
VERIFY_LIMIT_PER_HOUR = 25
VERIFY_LIMIT_PER_IP_PER_HOUR = 120
SECURITY_QUESTION_LIMIT_PER_HOUR = 20
SECURITY_QUESTION_LIMIT_PER_IP_PER_HOUR = 80
SECURITY_VERIFY_LIMIT_PER_HOUR = 15
SECURITY_VERIFY_LIMIT_PER_IP_PER_HOUR = 60
SYNC_LINK_LIMIT_PER_IP_PER_HOUR = 60
RATE_LIMIT_WINDOW_SECONDS = 60 * 60
IDENTIFIER_REGEX = re.compile(r'^[A-Za-z0-9@+._-]+$')
TELEGRAM_USERNAME_REGEX = re.compile(r'^[A-Za-z0-9_]{3,64}$')
OTP_REGEX = re.compile(r'^\d{6}$')


def _telegram_bot_link():
    raw_username = str(getattr(settings, 'TELEGRAM_BOT_USERNAME', '') or '').strip().lstrip('@')
    if raw_username:
        return f'https://t.me/{raw_username}'
    return None


def _telegram_not_linked_response():
    message = (
        'Telegram chat is not linked. Open your bot and send /start once, '
        'then retry with your Telegram username.'
    )
    bot_link = _telegram_bot_link()
    payload = {'error': message}
    if bot_link:
        payload['bot_link'] = bot_link
    return Response(payload, status=status.HTTP_400_BAD_REQUEST)


def _normalize_identifier(value):
    raw = str(value or '').strip()
    if not raw:
        return ''
    if raw.startswith('@'):
        return raw[1:]
    return raw


def _validate_identifier(identifier):
    raw = str(identifier or '').strip()
    if not raw:
        return None, 'Telegram username or phone number is required'
    if len(raw) > IDENTIFIER_MAX_LENGTH:
        return None, f'Identifier must be at most {IDENTIFIER_MAX_LENGTH} characters'
    if not IDENTIFIER_REGEX.match(raw):
        return None, 'Identifier has invalid characters'
    return raw, None


def _validate_telegram_username(identifier):
    normalized = _normalize_identifier(identifier)
    if not normalized:
        return None, 'Telegram username is required'
    if len(normalized) > IDENTIFIER_MAX_LENGTH:
        return None, f'Telegram username must be at most {IDENTIFIER_MAX_LENGTH} characters'
    if normalized.startswith('+') or normalized.isdigit():
        return None, 'Use Telegram username only. Phone number is not supported here.'
    if not TELEGRAM_USERNAME_REGEX.match(normalized):
        return None, 'Telegram username can only contain letters, numbers, and underscores'
    return normalized.lower(), None


def _debug_log(*parts):
    if settings.DEBUG:
        print('[AUTH][TELEGRAM]', *parts)


def _client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


def _rate_limit_key(scope, value):
    return f'auth:rate:{scope}:{value}'


def _otp_send_limit_and_window():
    if settings.DEBUG:
        return DEV_SEND_LIMIT_PER_WINDOW, DEV_SEND_WINDOW_SECONDS
    return PROD_SEND_LIMIT_PER_WINDOW, PROD_SEND_WINDOW_SECONDS


def _otp_send_ip_limit_and_window():
    _, window_seconds = _otp_send_limit_and_window()
    if settings.DEBUG:
        return DEV_SEND_IP_LIMIT_PER_WINDOW, window_seconds
    return PROD_SEND_IP_LIMIT_PER_WINDOW, window_seconds


def _otp_cooldown_seconds():
    if settings.DEBUG:
        return DEV_OTP_COOLDOWN_SECONDS
    return PROD_OTP_COOLDOWN_SECONDS


def _check_rate_limit(scope, value, limit, window_seconds=RATE_LIMIT_WINDOW_SECONDS):
    key = _rate_limit_key(scope, value)
    now_ts = int(timezone.now().timestamp())
    record = cache.get(key)
    if not isinstance(record, dict):
        record = {'count': 0, 'window_start': now_ts}

    window_start = int(record.get('window_start', now_ts))
    count = int(record.get('count', 0))
    elapsed = max(0, now_ts - window_start)

    if elapsed >= int(window_seconds):
        window_start = now_ts
        count = 0
        elapsed = 0

    if count >= int(limit):
        retry_after = max(1, int(window_seconds) - elapsed)
        cache.set(
            key,
            {'count': count, 'window_start': window_start},
            retry_after,
        )
        return False, retry_after

    count += 1
    ttl = max(1, int(window_seconds) - (now_ts - window_start))
    cache.set(
        key,
        {'count': count, 'window_start': window_start},
        ttl,
    )
    return True, 0


def _reset_rate_limit(scope, value):
    cache.delete(_rate_limit_key(scope, value))


def _find_profile_by_identifier(identifier):
    normalized = _normalize_identifier(identifier)
    if not normalized:
        return None

    return (
        UserProfile.objects.select_related('user')
        .filter(
            Q(phone_number=identifier)
            | Q(phone_number=normalized)
            | Q(telegram_phone=identifier)
            | Q(telegram_phone=normalized)
            | Q(telegram_username__iexact=normalized)
        )
        .first()
    )


def _find_profile_by_telegram_username(identifier):
    normalized = _normalize_identifier(identifier).lower()
    if not normalized:
        return None
    return (
        UserProfile.objects.select_related('user')
        .filter(telegram_username__iexact=normalized)
        .first()
    )


def _otp_purpose(value):
    raw = str(value or OTP_PURPOSE_LOGIN).strip().lower()
    if raw in OTP_ALLOWED_PURPOSES:
        return raw
    return None


def _otp_cache_key(user_id, purpose):
    return f'telegram:otp:{purpose}:{user_id}'


def _otp_cooldown_key(user_id, purpose):
    return f'telegram:otp:cooldown:{purpose}:{user_id}'


def _reset_otp_rate_limits(identifier, purpose):
    normalized_identifier = _normalize_identifier(identifier)
    if normalized_identifier:
        _reset_rate_limit(
            'send_otp_identifier',
            f'{purpose}:{normalized_identifier}',
        )
        _reset_rate_limit(
            'verify_otp_identifier',
            f'{purpose}:{normalized_identifier}',
        )


def _security_reset_cache_key(user_id):
    return f'auth:security-reset:{user_id}'


def _is_telegram_linked_profile(profile):
    return bool(profile.telegram_chat_id and (profile.telegram_username or profile.telegram_phone))


def _verify_otp_record(identifier, otp, purpose, username_only=False):
    profile = (
        _find_profile_by_telegram_username(identifier)
        if username_only
        else _find_profile_by_identifier(identifier)
    )
    if profile is None:
        return None, Response({'error': 'Invalid OTP or identifier'}, status=status.HTTP_401_UNAUTHORIZED)

    cache_key = _otp_cache_key(profile.user_id, purpose)
    otp_record = cache.get(cache_key)
    if not otp_record:
        return None, Response(
            {'error': 'OTP expired or not requested'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    now_ts = int(timezone.now().timestamp())
    expires_at = int(otp_record.get('expires_at', 0))
    if now_ts >= expires_at:
        cache.delete(cache_key)
        return None, Response({'error': 'OTP expired'}, status=status.HTTP_400_BAD_REQUEST)

    attempts = int(otp_record.get('attempts', 0))
    if attempts >= OTP_MAX_ATTEMPTS:
        cache.delete(cache_key)
        return None, Response(
            {'error': 'OTP attempts exceeded. Request a new OTP.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if not check_password(otp, otp_record.get('otp_hash', '')):
        attempts += 1
        otp_record['attempts'] = attempts
        ttl = max(1, expires_at - now_ts)
        cache.set(cache_key, otp_record, ttl)
        return None, Response({'error': 'Invalid OTP'}, status=status.HTTP_401_UNAUTHORIZED)

    cache.delete(cache_key)
    return profile, None


def _normalize_security_answer(value):
    compact = re.sub(r'\s+', ' ', str(value or '').strip().lower())
    return compact


def _extract_security_entries(data):
    security_questions = data.get('security_questions')
    security_answers = data.get('security_answers')
    entries = []

    if isinstance(security_questions, list) and security_questions:
        first = security_questions[0]
        if isinstance(first, dict):
            for item in security_questions:
                question = str((item or {}).get('question') or '').strip()
                answer = str((item or {}).get('answer') or '').strip()
                if question or answer:
                    entries.append({'question': question, 'answer': answer})
        else:
            answers = security_answers if isinstance(security_answers, list) else []
            for index, question_value in enumerate(security_questions):
                question = str(question_value or '').strip()
                answer = str(answers[index] if index < len(answers) else '').strip()
                if question or answer:
                    entries.append({'question': question, 'answer': answer})

    if not entries:
        return [], [], None

    if not (SECURITY_QA_MIN <= len(entries) <= SECURITY_QA_MAX):
        return None, None, f'Provide {SECURITY_QA_MIN}-{SECURITY_QA_MAX} security questions'

    for entry in entries:
        if not entry['question'] or not entry['answer']:
            return None, None, 'Each security question must include both question and answer'

    questions = [entry['question'] for entry in entries]
    answers = [make_password(_normalize_security_answer(entry['answer'])) for entry in entries]
    return questions, answers, None


def _make_telegram_username(seed):
    normalized_seed = re.sub(r'[^A-Za-z0-9_]+', '_', str(seed or '')).strip('_').lower()
    normalized_seed = normalized_seed or 'user'
    base = f'tg_{normalized_seed[:20]}'
    candidate = base
    suffix = 1
    while User.objects.filter(username=candidate).exists():
        suffix += 1
        candidate = f'{base}_{suffix}'
    return candidate


def _extract_security_answer_values(raw_answers):
    answers = []
    if not isinstance(raw_answers, list):
        return answers
    for answer in raw_answers:
        if isinstance(answer, dict):
            answers.append(str(answer.get('answer') or '').strip())
        else:
            answers.append(str(answer or '').strip())
    return answers


def _latest_chat_map_from_updates(limit=200):
    updates = fetch_telegram_updates(limit=limit)
    latest_by_username = {}
    for item in updates:
        username = str(item.get('username') or '').strip().lower()
        chat_id = item.get('chat_id')
        if not username or not chat_id:
            continue
        update_id = int(item.get('update_id') or -1)
        current = latest_by_username.get(username)
        if current is None or update_id >= int(current.get('update_id', -1)):
            latest_by_username[username] = {
                'chat_id': str(chat_id),
                'update_id': update_id,
            }
    return latest_by_username


def _sync_telegram_chat_links_from_updates(limit=200, target_username=None):
    latest_by_username = _latest_chat_map_from_updates(limit=limit)
    if not latest_by_username:
        return 0

    queryset = UserProfile.objects.exclude(telegram_username__isnull=True).exclude(
        telegram_username__exact=''
    )
    if target_username:
        queryset = queryset.filter(telegram_username__iexact=target_username)

    changed = 0
    for profile in queryset:
        profile_username = _normalize_identifier(profile.telegram_username).lower()
        latest = latest_by_username.get(profile_username)
        if not latest:
            continue
        new_chat_id = str(latest['chat_id'])
        if str(profile.telegram_chat_id or '') == new_chat_id:
            continue
        profile.telegram_chat_id = new_chat_id
        profile.save(update_fields=['telegram_chat_id', 'updated_at'])
        changed += 1
        _debug_log(
            f'Linked telegram_username={profile_username}',
            f'chat_id={new_chat_id}',
        )
    return changed


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Register a new user."""
    try:
        data = request.data
        raw_auth_type = str(data.get('auth_type') or '').strip().lower()
        if raw_auth_type and raw_auth_type not in {
            UserProfile.AUTH_TYPE_USERNAME,
            UserProfile.AUTH_TYPE_TELEGRAM,
        }:
            return Response({'error': 'Invalid auth_type'}, status=status.HTTP_400_BAD_REQUEST)

        auth_type = raw_auth_type or UserProfile.AUTH_TYPE_USERNAME
        legacy_mode = not raw_auth_type

        if auth_type == UserProfile.AUTH_TYPE_TELEGRAM:
            telegram_username = _normalize_identifier(data.get('telegram_username'))
            telegram_phone = str(data.get('telegram_phone') or data.get('phone_number') or '').strip()
            requested_username = str(data.get('username') or '').strip()
            email = str(data.get('email') or '').strip()

            if not telegram_username and not telegram_phone:
                return Response(
                    {'error': 'Telegram username or telegram phone is required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if telegram_username and UserProfile.objects.filter(
                telegram_username__iexact=telegram_username
            ).exists():
                return Response(
                    {'error': 'Telegram username already exists'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if telegram_phone and UserProfile.objects.filter(
                Q(telegram_phone=telegram_phone) | Q(phone_number=telegram_phone)
            ).exists():
                return Response(
                    {'error': 'Telegram phone already exists'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if requested_username:
                if User.objects.filter(username=requested_username).exists():
                    return Response(
                        {'error': 'Username already exists'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                username = requested_username
            else:
                username = _make_telegram_username(telegram_username or telegram_phone)

            if email and User.objects.filter(email=email).exists():
                return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

            user = User(username=username, email=email)
            user.set_unusable_password()
            user.save()

            UserProfile.objects.create(
                user=user,
                phone_number=telegram_phone or None,
                telegram_phone=telegram_phone or None,
                telegram_username=telegram_username or None,
                telegram_chat_id=data.get('telegram_chat_id'),
                auth_type=UserProfile.AUTH_TYPE_TELEGRAM,
                security_questions=[],
                security_answers=[],
            )

            return Response(
                {
                    'message': 'Telegram user registered successfully',
                    'username': username,
                    'auth_type': UserProfile.AUTH_TYPE_TELEGRAM,
                },
                status=status.HTTP_201_CREATED,
            )

        username = str(data.get('username') or '').strip()
        email = str(data.get('email') or '').strip()
        password = str(data.get('password') or '')

        if not username or not password:
            return Response(
                {'error': 'Username and password are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

        if email and User.objects.filter(email=email).exists():
            return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

        security_questions, security_answers, security_error = _extract_security_entries(data)
        if security_error:
            return Response({'error': security_error}, status=status.HTTP_400_BAD_REQUEST)
        if raw_auth_type == UserProfile.AUTH_TYPE_USERNAME and not security_questions:
            return Response(
                {
                    'error': (
                        f'Provide {SECURITY_QA_MIN}-{SECURITY_QA_MAX} security questions '
                        'for username registration'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if legacy_mode:
            security_questions = security_questions or []
            security_answers = security_answers or []

        user = User.objects.create_user(username=username, email=email, password=password)
        UserProfile.objects.create(
            user=user,
            phone_number=data.get('phone_number'),
            telegram_phone=data.get('telegram_phone'),
            telegram_username=_normalize_identifier(data.get('telegram_username')),
            telegram_chat_id=data.get('telegram_chat_id'),
            auth_type=UserProfile.AUTH_TYPE_USERNAME,
            security_questions=security_questions or [],
            security_answers=security_answers or [],
        )

        return Response(
            {
                'message': 'User registered successfully',
                'username': username,
                'auth_type': UserProfile.AUTH_TYPE_USERNAME,
            },
            status=status.HTTP_201_CREATED,
        )
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Login using username + password."""
    try:
        data = request.data
        username = str(data.get('username') or '').strip()
        password = str(data.get('password') or '')

        if not username or not password:
            return Response(
                {'error': 'Username and password are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_obj = User.objects.filter(username=username).first()
        if user_obj is None:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            profile = user_obj.profile
        except UserProfile.DoesNotExist:
            profile = None

        if profile and profile.auth_type == UserProfile.AUTH_TYPE_TELEGRAM:
            return Response(
                {'error': 'This account uses Telegram login only'},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                'message': 'Login successful',
                'username': user.username,
                'email': user.email,
                'user_id': user.id,
                'token': token.key,
            }
        )
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def debug_reset_otp_rate_limit(request):
    """Development helper to clear OTP rate-limits for an identifier."""
    try:
        if not settings.DEBUG:
            return Response({'error': 'Debug endpoint is disabled'}, status=status.HTTP_403_FORBIDDEN)

        identifier, identifier_error = _validate_telegram_username(request.data.get('identifier'))
        if identifier_error:
            return Response({'error': identifier_error}, status=status.HTTP_400_BAD_REQUEST)

        explicit_purpose = request.data.get('purpose')
        purposes = [OTP_PURPOSE_LOGIN, OTP_PURPOSE_RESET]
        if explicit_purpose is not None:
            parsed = _otp_purpose(explicit_purpose)
            if parsed is None:
                return Response({'error': 'Invalid OTP purpose'}, status=status.HTTP_400_BAD_REQUEST)
            purposes = [parsed]

        normalized_identifier = _normalize_identifier(identifier)
        for purpose in purposes:
            _reset_rate_limit('send_otp_identifier', f'{purpose}:{normalized_identifier}')
            _reset_rate_limit('verify_otp_identifier', f'{purpose}:{normalized_identifier}')

        profile = _find_profile_by_identifier(identifier)
        if profile is not None:
            for purpose in purposes:
                cache.delete(_otp_cache_key(profile.user_id, purpose))
                cache.delete(_otp_cooldown_key(profile.user_id, purpose))

        return Response(
            {
                'message': 'OTP rate limits reset',
                'identifier': normalized_identifier,
                'purposes': purposes,
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def sync_telegram_chat(request):
    """Synchronize Telegram chat_id from bot updates for a given identifier."""
    try:
        identifier, identifier_error = _validate_telegram_username(request.data.get('identifier'))
        if identifier_error:
            return Response({'error': identifier_error}, status=status.HTTP_400_BAD_REQUEST)

        request_ip = _client_ip(request)
        allowed, retry_after = _check_rate_limit(
            'sync_telegram_chat_ip',
            request_ip,
            SYNC_LINK_LIMIT_PER_IP_PER_HOUR,
        )
        if not allowed:
            return Response(
                {
                    'error': f'Too many sync attempts. Try again in {retry_after} seconds.',
                    'retry_after_seconds': retry_after,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        profile = _find_profile_by_telegram_username(identifier)
        if profile is None:
            return Response(
                {'error': 'No account found for this Telegram username'},
                status=status.HTTP_404_NOT_FOUND,
            )

        _debug_log(f'Entered username: {identifier}')
        _debug_log(f'DB username: {profile.telegram_username}')
        _debug_log(f'chat_id found: {profile.telegram_chat_id}')

        updated_profiles = _sync_telegram_chat_links_from_updates(limit=250, target_username=identifier)

        profile.refresh_from_db(fields=['telegram_chat_id'])
        if not profile.telegram_chat_id:
            not_linked_response = _telegram_not_linked_response()
            not_linked_response.data.update(
                {
                    'linked': False,
                    'synced_profiles': updated_profiles,
                }
            )
            return not_linked_response

        return Response(
            {
                'message': 'Telegram chat linked successfully',
                'linked': True,
                'telegram_username': profile.telegram_username,
                'synced_profiles': updated_profiles,
            },
            status=status.HTTP_200_OK,
        )
    except TelegramError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def send_telegram_otp(request):
    """Send a Telegram OTP for login or password reset."""
    try:
        identifier, identifier_error = _validate_telegram_username(request.data.get('identifier'))
        if identifier_error:
            return Response({'error': identifier_error}, status=status.HTTP_400_BAD_REQUEST)

        purpose = _otp_purpose(request.data.get('purpose'))
        if purpose is None:
            return Response({'error': 'Invalid OTP purpose'}, status=status.HTTP_400_BAD_REQUEST)

        normalized_identifier = identifier
        request_ip = _client_ip(request)
        send_limit, send_window = _otp_send_limit_and_window()
        allowed, retry_after = _check_rate_limit(
            'send_otp_identifier',
            f'{purpose}:{normalized_identifier}',
            send_limit,
            send_window,
        )
        if not allowed:
            return Response(
                {
                    'error': f'Too many requests. Try again in {retry_after} seconds.',
                    'retry_after_seconds': retry_after,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        send_ip_limit, send_ip_window = _otp_send_ip_limit_and_window()
        allowed, retry_after = _check_rate_limit(
            'send_otp_ip',
            f'{purpose}:{request_ip}',
            send_ip_limit,
            send_ip_window,
        )
        if not allowed:
            return Response(
                {
                    'error': f'Too many requests from this network. Try again in {retry_after} seconds.',
                    'retry_after_seconds': retry_after,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        profile = _find_profile_by_telegram_username(identifier)
        if profile is None:
            return Response(
                {'error': 'No account found for this Telegram username'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if purpose == OTP_PURPOSE_LOGIN:
            if (
                profile.auth_type == UserProfile.AUTH_TYPE_USERNAME
                and not _is_telegram_linked_profile(profile)
            ):
                return Response(
                    {'error': 'Telegram login is not linked for this username account'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif purpose == OTP_PURPOSE_RESET:
            if (
                profile.auth_type == UserProfile.AUTH_TYPE_USERNAME
                and not _is_telegram_linked_profile(profile)
            ):
                return Response(
                    {'error': 'Use security-question recovery for this username account'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        profile_username = str(profile.telegram_username or '').strip()
        _debug_log(f'Entered username: {identifier}')
        _debug_log(f'DB username: {profile_username}')
        _debug_log(f'chat_id found: {profile.telegram_chat_id}')

        if not profile.telegram_chat_id:
            _sync_telegram_chat_links_from_updates(limit=250, target_username=identifier)
            profile.refresh_from_db(fields=['telegram_chat_id', 'updated_at'])

        if not profile.telegram_chat_id:
            return _telegram_not_linked_response()

        cooldown_key = _otp_cooldown_key(profile.user_id, purpose)
        now_ts = int(timezone.now().timestamp())
        cooldown_record = cache.get(cooldown_key)
        if isinstance(cooldown_record, dict):
            cooldown_expires_at = int(cooldown_record.get('expires_at', 0))
            if cooldown_expires_at > now_ts:
                retry_after = max(1, cooldown_expires_at - now_ts)
                return Response(
                    {
                        'error': f'OTP was sent recently. Try again in {retry_after} seconds.',
                        'retry_after_seconds': retry_after,
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
        elif cooldown_record:
            return Response(
                {'error': 'OTP was sent recently. Please wait before requesting again.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        otp = f'{secrets.randbelow(1_000_000):06d}'
        expires_at = int(timezone.now().timestamp()) + OTP_EXPIRY_SECONDS
        otp_record = {
            'otp_hash': make_password(otp),
            'expires_at': expires_at,
            'attempts': 0,
            'identifier': normalized_identifier,
            'purpose': purpose,
        }
        cache.set(_otp_cache_key(profile.user_id, purpose), otp_record, OTP_EXPIRY_SECONDS + 30)
        cooldown_seconds = _otp_cooldown_seconds()
        cache.set(
            cooldown_key,
            {'expires_at': now_ts + cooldown_seconds},
            cooldown_seconds,
        )

        otp_context = 'login' if purpose == OTP_PURPOSE_LOGIN else 'password reset'

        send_telegram_message(
            profile.telegram_chat_id,
            f'Your Orion Market AI {otp_context} OTP is: *{otp}*\nThis OTP expires in 5 minutes.',
        )

        return Response(
            {
                'message': 'OTP sent to Telegram',
                'expires_in_seconds': OTP_EXPIRY_SECONDS,
                'purpose': purpose,
            },
            status=status.HTTP_200_OK,
        )
    except TelegramError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_telegram_otp(request):
    """Verify Telegram OTP and return auth token."""
    try:
        identifier, identifier_error = _validate_telegram_username(request.data.get('identifier'))
        if identifier_error:
            return Response({'error': identifier_error}, status=status.HTTP_400_BAD_REQUEST)

        otp = str(request.data.get('otp') or '').strip()
        purpose = _otp_purpose(request.data.get('purpose'))
        if purpose is None:
            return Response({'error': 'Invalid OTP purpose'}, status=status.HTTP_400_BAD_REQUEST)

        if not identifier or not otp:
            return Response(
                {'error': 'Telegram username and OTP are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not OTP_REGEX.match(otp):
            return Response(
                {'error': f'OTP must be exactly {OTP_LENGTH} digits'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized_identifier = identifier
        request_ip = _client_ip(request)
        allowed, retry_after = _check_rate_limit(
            'verify_otp_identifier',
            f'{purpose}:{normalized_identifier}',
            VERIFY_LIMIT_PER_HOUR,
        )
        if not allowed:
            return Response(
                {
                    'error': f'Too many OTP verification attempts. Try again in {retry_after} seconds.',
                    'retry_after_seconds': retry_after,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        allowed, retry_after = _check_rate_limit(
            'verify_otp_ip',
            f'{purpose}:{request_ip}',
            VERIFY_LIMIT_PER_IP_PER_HOUR,
        )
        if not allowed:
            return Response(
                {
                    'error': (
                        'Too many OTP verification attempts from this network. '
                        f'Try again in {retry_after} seconds.'
                    ),
                    'retry_after_seconds': retry_after,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        profile, error_response = _verify_otp_record(
            identifier,
            otp,
            purpose,
            username_only=True,
        )
        if error_response:
            return error_response

        _reset_otp_rate_limits(identifier, purpose)
        cache.delete(_otp_cooldown_key(profile.user_id, purpose))

        if purpose == OTP_PURPOSE_LOGIN:
            if (
                profile.auth_type == UserProfile.AUTH_TYPE_USERNAME
                and not _is_telegram_linked_profile(profile)
            ):
                return Response(
                    {'error': 'Telegram login is not linked for this username account'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if purpose != OTP_PURPOSE_LOGIN:
            return Response({'message': 'OTP verified', 'purpose': purpose}, status=status.HTTP_200_OK)

        user = profile.user
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                'message': 'Login successful',
                'username': user.username,
                'email': user.email,
                'user_id': user.id,
                'token': token.key,
            }
        )
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def get_security_questions(request):
    """Fetch security questions for username-based accounts."""
    try:
        username = str(request.data.get('username') or '').strip()
        if not username:
            return Response({'error': 'Username is required'}, status=status.HTTP_400_BAD_REQUEST)

        request_ip = _client_ip(request)
        allowed, _ = _check_rate_limit(
            'security_questions_username',
            username.lower(),
            SECURITY_QUESTION_LIMIT_PER_HOUR,
        )
        if not allowed:
            return Response(
                {'error': 'Too many requests for security questions. Try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        allowed, _ = _check_rate_limit(
            'security_questions_ip',
            request_ip,
            SECURITY_QUESTION_LIMIT_PER_IP_PER_HOUR,
        )
        if not allowed:
            return Response(
                {'error': 'Too many requests from this network. Try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = User.objects.filter(username=username).first()
        if user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            profile = user.profile
        except UserProfile.DoesNotExist:
            return Response(
                {'error': 'Security-question recovery is not configured for this account'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if profile.auth_type != UserProfile.AUTH_TYPE_USERNAME:
            return Response(
                {'error': 'This account uses Telegram OTP recovery'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        questions = profile.security_questions if isinstance(profile.security_questions, list) else []
        if len(questions) < SECURITY_QA_MIN:
            return Response(
                {'error': 'Security questions are not configured for this account'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                'username': user.username,
                'security_questions': [
                    {'index': index, 'question': question}
                    for index, question in enumerate(questions)
                ],
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_security_answers(request):
    """Verify security answers and return a short-lived reset token."""
    try:
        username = str(request.data.get('username') or '').strip()
        answers_raw = request.data.get('answers')
        if not username:
            return Response({'error': 'Username is required'}, status=status.HTTP_400_BAD_REQUEST)

        answers = _extract_security_answer_values(answers_raw)
        if not answers:
            return Response({'error': 'Security answers are required'}, status=status.HTTP_400_BAD_REQUEST)

        request_ip = _client_ip(request)
        allowed, _ = _check_rate_limit(
            'security_verify_username',
            username.lower(),
            SECURITY_VERIFY_LIMIT_PER_HOUR,
        )
        if not allowed:
            return Response(
                {'error': 'Too many security-answer attempts. Try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        allowed, _ = _check_rate_limit(
            'security_verify_ip',
            request_ip,
            SECURITY_VERIFY_LIMIT_PER_IP_PER_HOUR,
        )
        if not allowed:
            return Response(
                {'error': 'Too many attempts from this network. Try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = User.objects.filter(username=username).first()
        if user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            profile = user.profile
        except UserProfile.DoesNotExist:
            return Response(
                {'error': 'Security-question recovery is not configured for this account'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if profile.auth_type != UserProfile.AUTH_TYPE_USERNAME:
            return Response(
                {'error': 'This account uses Telegram OTP recovery'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        question_count = len(profile.security_questions or [])
        hashed_answers = profile.security_answers if isinstance(profile.security_answers, list) else []
        if question_count < SECURITY_QA_MIN or question_count != len(hashed_answers):
            return Response(
                {'error': 'Security questions are not configured for this account'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(answers) != question_count:
            return Response(
                {'error': 'Please answer all security questions'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for index, raw_answer in enumerate(answers):
            normalized = _normalize_security_answer(raw_answer)
            if not check_password(normalized, hashed_answers[index]):
                return Response({'error': 'Security answers do not match'}, status=status.HTTP_401_UNAUTHORIZED)

        reset_token = secrets.token_urlsafe(24)
        expires_at = int(timezone.now().timestamp()) + SECURITY_RESET_TOKEN_EXPIRY_SECONDS
        record = {
            'token_hash': make_password(reset_token),
            'expires_at': expires_at,
        }
        cache.set(
            _security_reset_cache_key(user.id),
            record,
            SECURITY_RESET_TOKEN_EXPIRY_SECONDS + 30,
        )

        return Response(
            {
                'message': 'Security answers verified',
                'reset_token': reset_token,
                'expires_in_seconds': SECURITY_RESET_TOKEN_EXPIRY_SECONDS,
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """Reset password using Telegram OTP or verified security-answer token."""
    try:
        new_password = str(request.data.get('new_password') or '')
        if not new_password:
            return Response({'error': 'new_password is required'}, status=status.HTTP_400_BAD_REQUEST)

        username = str(request.data.get('username') or '').strip()
        security_token = str(request.data.get('security_token') or '').strip()
        if username and security_token:
            user = User.objects.filter(username=username).first()
            if user is None:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

            try:
                profile = user.profile
            except UserProfile.DoesNotExist:
                return Response({'error': 'Account profile not found'}, status=status.HTTP_400_BAD_REQUEST)

            if profile.auth_type != UserProfile.AUTH_TYPE_USERNAME:
                return Response(
                    {'error': 'This account uses Telegram OTP recovery'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            cache_key = _security_reset_cache_key(user.id)
            token_record = cache.get(cache_key)
            if not token_record:
                return Response(
                    {'error': 'Security verification expired. Verify answers again.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            now_ts = int(timezone.now().timestamp())
            expires_at = int(token_record.get('expires_at', 0))
            if now_ts >= expires_at:
                cache.delete(cache_key)
                return Response({'error': 'Security verification expired'}, status=status.HTTP_400_BAD_REQUEST)

            if not check_password(security_token, token_record.get('token_hash', '')):
                return Response(
                    {'error': 'Invalid security verification token'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            try:
                validate_password(new_password, user=user)
            except ValidationError as exc:
                return Response({'error': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

            user.set_password(new_password)
            user.save(update_fields=['password'])
            Token.objects.filter(user=user).delete()
            cache.delete(cache_key)

            return Response(
                {'message': 'Password reset successful. Please login again.'},
                status=status.HTTP_200_OK,
            )

        identifier, identifier_error = _validate_telegram_username(request.data.get('identifier'))
        if identifier_error:
            return Response({'error': identifier_error}, status=status.HTTP_400_BAD_REQUEST)

        otp = str(request.data.get('otp') or '').strip()
        if not otp:
            return Response({'error': 'OTP is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not OTP_REGEX.match(otp):
            return Response({'error': f'OTP must be exactly {OTP_LENGTH} digits'}, status=status.HTTP_400_BAD_REQUEST)

        profile, error_response = _verify_otp_record(
            identifier,
            otp,
            OTP_PURPOSE_RESET,
            username_only=True,
        )
        if error_response:
            return error_response

        _reset_otp_rate_limits(identifier, OTP_PURPOSE_RESET)
        cache.delete(_otp_cooldown_key(profile.user_id, OTP_PURPOSE_RESET))

        if (
            profile.auth_type == UserProfile.AUTH_TYPE_USERNAME
            and not _is_telegram_linked_profile(profile)
        ):
            return Response(
                {'error': 'Use security-question recovery for this username account'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            validate_password(new_password, user=profile.user)
        except ValidationError as exc:
            return Response({'error': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        profile.user.set_password(new_password)
        profile.user.save(update_fields=['password'])
        Token.objects.filter(user=profile.user).delete()

        return Response({'message': 'Password reset successful. Please login again.'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Logout a user and revoke token."""
    try:
        request.user.auth_token.delete()
    except Exception:
        pass
    logout(request)
    return Response({'message': 'Logged out successfully'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile(request):
    """Get user profile."""
    user = request.user
    try:
        user_profile = user.profile
        phone = user_profile.phone_number
        is_verified = user_profile.is_verified
        telegram_username = user_profile.telegram_username
        telegram_phone = user_profile.telegram_phone
        telegram_chat_id = user_profile.telegram_chat_id
        auth_type = user_profile.auth_type
    except UserProfile.DoesNotExist:
        phone = None
        is_verified = False
        telegram_username = None
        telegram_phone = None
        telegram_chat_id = None
        auth_type = UserProfile.AUTH_TYPE_USERNAME

    return Response(
        {
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'phone_number': phone,
            'telegram_username': telegram_username,
            'telegram_phone': telegram_phone,
            'telegram_chat_id': telegram_chat_id,
            'auth_type': auth_type,
            'is_verified': is_verified,
            'date_joined': user.date_joined,
        }
    )
