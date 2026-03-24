from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
import yfinance as yf
from .modeling import build_regression_outputs, train_btc_regression_model

SYMBOL = "BTC-USD"
HISTORY_PERIOD = "1y"
HISTORY_INTERVAL = "1d"
CACHE_TTL_MINUTES = 15

_CACHE: Dict[str, Any] = {
    "created_at": None,
    "payload": None,
}


def _configure_yfinance_cache() -> None:
    """
    Use a workspace-local writable cache path.
    This avoids sqlite permission issues in restricted environments.
    """
    cache_dir = Path(__file__).resolve().parent / ".yfinance_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    if hasattr(yf, "set_tz_cache_location"):
        yf.set_tz_cache_location(str(cache_dir))


def _is_cache_valid() -> bool:
    created_at = _CACHE.get("created_at")
    payload = _CACHE.get("payload")
    if not created_at or payload is None:
        return False
    return datetime.now(timezone.utc) - created_at < timedelta(minutes=CACHE_TTL_MINUTES)


def _fetch_btc_ohlcv() -> pd.DataFrame:
    _configure_yfinance_cache()
    ticker = yf.Ticker(SYMBOL)
    history = ticker.history(period=HISTORY_PERIOD, interval=HISTORY_INTERVAL)

    if history is None or history.empty:
        raise ValueError("No BTC/USD historical data returned from yfinance.")

    dataset = history[["Open", "High", "Low", "Close", "Volume"]].copy()
    dataset = dataset.dropna()
    dataset = dataset.rename(
        columns={
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        }
    )

    if dataset.empty:
        raise ValueError("BTC/USD dataset is empty after cleaning.")

    return dataset


def _to_records(dataset: pd.DataFrame) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    for index, row in dataset.iterrows():
        if hasattr(index, "date"):
            date_value = index.date().isoformat()
        else:
            date_value = str(index)[:10]

        records.append(
            {
                "date": date_value,
                "open": round(float(row["open"]), 2),
                "high": round(float(row["high"]), 2),
                "low": round(float(row["low"]), 2),
                "close": round(float(row["close"]), 2),
                "volume": int(row["volume"]),
            }
        )

    return records


def _build_ranges(dataset: pd.DataFrame) -> Dict[str, List[Dict[str, Any]]]:
    return {
        "1m": _to_records(dataset.tail(30)),
        "3m": _to_records(dataset.tail(90)),
        "6m": _to_records(dataset.tail(180)),
        "1y": _to_records(dataset),
    }


def _build_payload(dataset: pd.DataFrame, data_source: str) -> Dict[str, Any]:
    ranges = _build_ranges(dataset)
    regression_artifacts = train_btc_regression_model(dataset)
    regression_outputs = build_regression_outputs(regression_artifacts)

    return {
        "symbol": SYMBOL,
        "period": HISTORY_PERIOD,
        "interval": HISTORY_INTERVAL,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_source": data_source,
        "ranges": ranges,
        "counts": {key: len(value) for key, value in ranges.items()},
        "ml": regression_outputs,
    }


def get_btc_dataset(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Returns reusable structured BTC/USD OHLCV data for 1M/3M/6M/1Y ranges.
    Data is cached in-memory for a short TTL to avoid repeated yfinance calls.
    """
    if not force_refresh and _is_cache_valid():
        return _CACHE["payload"]

    dataset = _fetch_btc_ohlcv()
    payload = _build_payload(dataset=dataset, data_source="yfinance_live")

    _CACHE["created_at"] = datetime.now(timezone.utc)
    _CACHE["payload"] = payload
    return payload


def get_btc_dataset_sample() -> Dict[str, Any]:
    """
    Deterministic synthetic BTC/USD-like dataset.
    Useful as a fallback when external network access is unavailable.
    """
    periods = 365
    date_index = pd.date_range(
        end=datetime.now(timezone.utc).date(),
        periods=periods,
        freq="D",
    )

    rng = np.random.default_rng(seed=42)
    trend = np.linspace(42000, 76000, periods)
    seasonality = 2400 * np.sin(np.linspace(0, 8 * np.pi, periods))
    noise = rng.normal(0, 850, periods)
    close = trend + seasonality + noise
    close = np.maximum(close, 15000)

    open_price = close + rng.normal(0, 260, periods)
    high = np.maximum(open_price, close) + np.abs(rng.normal(210, 80, periods))
    low = np.minimum(open_price, close) - np.abs(rng.normal(210, 80, periods))
    volume = rng.integers(850000, 4200000, periods)

    dataset = pd.DataFrame(
        {
            "open": open_price,
            "high": high,
            "low": low,
            "close": close,
            "volume": volume,
        },
        index=date_index,
    )

    return _build_payload(dataset=dataset, data_source="sample_synthetic")
