import requests
from django.conf import settings


class TelegramError(Exception):
    pass


def _telegram_token():
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
    if not token:
        raise TelegramError('TELEGRAM_BOT_TOKEN is not configured')
    return token


def _extract_api_error(response):
    try:
        payload = response.json()
    except ValueError:
        payload = None
    if isinstance(payload, dict):
        description = payload.get('description') or payload.get('error_description')
        if description:
            lowered = str(description).lower()
            if 'chat not found' in lowered:
                return (
                    'Telegram chat not found. Open the bot and send /start once before requesting OTP.'
                )
            if 'bot was blocked' in lowered:
                return 'Telegram bot is blocked for this user. Unblock the bot and try again.'
            if 'user is deactivated' in lowered:
                return 'Telegram account appears deactivated.'
            return f'Telegram API error: {description}'
    return f'Telegram API request failed with status {response.status_code}'


def _telegram_api_request(method, endpoint, **kwargs):
    token = _telegram_token()
    url = f'https://api.telegram.org/bot{token}/{endpoint}'
    try:
        response = requests.request(method, url, timeout=12, **kwargs)
    except requests.Timeout as exc:
        raise TelegramError('Telegram request timed out') from exc
    except requests.RequestException as exc:
        raise TelegramError(f'Telegram request failed: {exc}') from exc

    if response.status_code >= 400:
        raise TelegramError(_extract_api_error(response))

    try:
        data = response.json()
    except ValueError as exc:
        raise TelegramError('Telegram API returned a non-JSON response') from exc

    if not isinstance(data, dict) or not data.get('ok'):
        description = data.get('description') if isinstance(data, dict) else 'Unknown Telegram error'
        raise TelegramError(f'Telegram API error: {description}')
    return data


def send_telegram_message(chat_id, text):
    payload = {
        'chat_id': str(chat_id),
        'text': text,
        'parse_mode': 'Markdown',
    }
    return _telegram_api_request('POST', 'sendMessage', json=payload)


def get_updates(limit=100, offset=None):
    params = {'limit': int(limit)}
    if offset is not None:
        params['offset'] = int(offset)
    data = _telegram_api_request('GET', 'getUpdates', params=params)
    return data.get('result', []) if isinstance(data, dict) else []


def fetch_telegram_updates(limit=100, offset=None):
    updates = get_updates(limit=limit, offset=offset)
    parsed = []
    for update in updates:
        message = update.get('message') or update.get('edited_message') or {}
        if not isinstance(message, dict):
            continue
        chat = message.get('chat') or {}
        sender = message.get('from') or {}
        if str(chat.get('type') or '').lower() != 'private':
            continue

        username = str(sender.get('username') or chat.get('username') or '').strip().lstrip('@').lower()
        chat_id = chat.get('id')
        parsed.append(
            {
                'update_id': update.get('update_id'),
                'chat_id': str(chat_id) if chat_id is not None else None,
                'username': username or None,
                'text': str(message.get('text') or '').strip(),
            }
        )
    return parsed


def resolve_chat_id_from_updates(identifier, limit=100):
    username = str(identifier or '').strip().lstrip('@').lower()
    if not username:
        return None

    updates = get_updates(limit=limit)
    for update in reversed(updates):
        message = update.get('message') or update.get('edited_message') or {}
        chat = message.get('chat') or {}
        sender = message.get('from') or {}

        chat_username = str(chat.get('username') or '').lower()
        sender_username = str(sender.get('username') or '').lower()
        if username not in {chat_username, sender_username}:
            continue

        if str(chat.get('type', '')).lower() != 'private':
            continue

        chat_id = chat.get('id')
        if chat_id is not None:
            return str(chat_id)
    return None
