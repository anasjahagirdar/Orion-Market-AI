from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
from .explainability import build_explainability_outputs


FEATURE_COLUMNS = [
    "date_ordinal",
    "open",
    "high",
    "low",
    "volume",
    "lag_close_1",
    "lag_close_2",
    "lag_close_3",
    "ma_close_7",
    "ma_close_14",
    "volatility_7",
    "range_pct",
]


@dataclass
class RegressionArtifacts:
    model: LinearRegression
    scaler: StandardScaler
    feature_columns: List[str]
    x_train_scaled: np.ndarray
    x_test_scaled: np.ndarray
    y_train: np.ndarray
    y_test: np.ndarray
    test_index: pd.DatetimeIndex
    prepared_features: pd.DataFrame
    target: pd.Series
    raw_dataset: pd.DataFrame


def _prepare_features(dataset: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    frame = dataset.copy().sort_index()
    frame["date_ordinal"] = frame.index.map(lambda x: x.date().toordinal())
    frame["lag_close_1"] = frame["close"].shift(1)
    frame["lag_close_2"] = frame["close"].shift(2)
    frame["lag_close_3"] = frame["close"].shift(3)
    frame["ma_close_7"] = frame["close"].shift(1).rolling(window=7).mean()
    frame["ma_close_14"] = frame["close"].shift(1).rolling(window=14).mean()
    frame["volatility_7"] = frame["close"].shift(1).rolling(window=7).std()
    frame["range_pct"] = (frame["high"] - frame["low"]) / frame["close"].replace(0, np.nan)

    prepared = frame[FEATURE_COLUMNS + ["close"]].dropna()
    if prepared.empty or len(prepared) < 40:
        raise ValueError("Not enough BTC data to train regression model.")

    x_all = prepared[FEATURE_COLUMNS]
    y_all = prepared["close"]
    return x_all, y_all


def train_btc_regression_model(dataset: pd.DataFrame) -> RegressionArtifacts:
    x_all, y_all = _prepare_features(dataset)
    split_index = int(len(x_all) * 0.8)

    if split_index < 30 or len(x_all) - split_index < 10:
        raise ValueError("BTC train-test split is too small for stable evaluation.")

    x_train = x_all.iloc[:split_index]
    x_test = x_all.iloc[split_index:]
    y_train = y_all.iloc[:split_index]
    y_test = y_all.iloc[split_index:]

    scaler = StandardScaler()
    x_train_scaled = scaler.fit_transform(x_train)
    x_test_scaled = scaler.transform(x_test)

    model = LinearRegression()
    model.fit(x_train_scaled, y_train)

    return RegressionArtifacts(
        model=model,
        scaler=scaler,
        feature_columns=FEATURE_COLUMNS.copy(),
        x_train_scaled=x_train_scaled,
        x_test_scaled=x_test_scaled,
        y_train=y_train.to_numpy(),
        y_test=y_test.to_numpy(),
        test_index=x_test.index,
        prepared_features=x_all,
        target=y_all,
        raw_dataset=dataset.copy(),
    )


def _build_actual_vs_predicted(artifacts: RegressionArtifacts) -> List[Dict[str, Any]]:
    predictions = artifacts.model.predict(artifacts.x_test_scaled)
    rows: List[Dict[str, Any]] = []

    for date_value, actual_close, predicted_close in zip(
        artifacts.test_index,
        artifacts.y_test,
        predictions,
    ):
        rows.append(
            {
                "date": date_value.date().isoformat(),
                "actual_close": round(float(actual_close), 2),
                "predicted_close": round(float(predicted_close), 2),
            }
        )

    return rows


def _feature_row_from_assumptions(
    next_date: pd.Timestamp,
    open_price: float,
    high_price: float,
    low_price: float,
    volume: float,
    historical_closes: List[float],
) -> Dict[str, float]:
    lag1 = historical_closes[-1]
    lag2 = historical_closes[-2]
    lag3 = historical_closes[-3]
    ma7 = float(np.mean(historical_closes[-7:]))
    ma14 = float(np.mean(historical_closes[-14:]))
    vol7 = float(np.std(historical_closes[-7:]))
    range_pct = (high_price - low_price) / max(lag1, 1e-6)

    return {
        "date_ordinal": float(next_date.date().toordinal()),
        "open": float(open_price),
        "high": float(high_price),
        "low": float(low_price),
        "volume": float(volume),
        "lag_close_1": float(lag1),
        "lag_close_2": float(lag2),
        "lag_close_3": float(lag3),
        "ma_close_7": float(ma7),
        "ma_close_14": float(ma14),
        "volatility_7": float(vol7),
        "range_pct": float(range_pct),
    }


def _build_future_predictions(
    artifacts: RegressionArtifacts,
    days_ahead: int = 7,
) -> List[Dict[str, Any]]:
    if days_ahead < 1:
        return []

    frame = artifacts.raw_dataset.copy().sort_index()
    historical_closes = frame["close"].astype(float).tolist()
    if len(historical_closes) < 14:
        return []

    returns = frame["close"].pct_change().dropna()
    drift = float(returns.tail(30).mean()) if not returns.empty else 0.0
    abs_move = float(returns.tail(30).abs().mean()) if not returns.empty else 0.015
    abs_move = max(abs_move, 0.003)
    avg_volume = float(frame["volume"].tail(30).mean())
    if avg_volume <= 0:
        avg_volume = float(frame["volume"].iloc[-1])

    last_date = frame.index[-1]
    output: List[Dict[str, Any]] = []

    for step in range(1, days_ahead + 1):
        next_date = last_date + timedelta(days=step)
        assumed_open = historical_closes[-1] * (1 + drift * 0.5)
        assumed_high = assumed_open * (1 + abs_move)
        assumed_low = assumed_open * (1 - abs_move)
        assumed_volume = avg_volume

        feature_row = _feature_row_from_assumptions(
            next_date=next_date,
            open_price=assumed_open,
            high_price=assumed_high,
            low_price=assumed_low,
            volume=assumed_volume,
            historical_closes=historical_closes,
        )

        feature_frame = pd.DataFrame([feature_row], columns=artifacts.feature_columns)
        feature_scaled = artifacts.scaler.transform(feature_frame)
        predicted_close = float(artifacts.model.predict(feature_scaled)[0])
        historical_closes.append(predicted_close)

        output.append(
            {
                "date": next_date.date().isoformat(),
                "predicted_close": round(predicted_close, 2),
            }
        )

    return output


def build_regression_outputs(artifacts: RegressionArtifacts) -> Dict[str, Any]:
    predictions = artifacts.model.predict(artifacts.x_test_scaled)
    r2 = r2_score(artifacts.y_test, predictions)
    rmse = np.sqrt(mean_squared_error(artifacts.y_test, predictions))
    explainability = build_explainability_outputs(artifacts)

    model_features = []
    for feature_name, coefficient in zip(artifacts.feature_columns, artifacts.model.coef_):
        model_features.append(
            {
                "feature": feature_name,
                "coefficient": round(float(coefficient), 6),
            }
        )

    return {
        "metrics": {
            "r2_score": round(float(r2), 6),
            "rmse": round(float(rmse), 6),
            "train_size": int(len(artifacts.y_train)),
            "test_size": int(len(artifacts.y_test)),
        },
        "predictions": {
            "actual_vs_predicted": _build_actual_vs_predicted(artifacts),
            "future": _build_future_predictions(artifacts, days_ahead=7),
        },
        "model_info": {
            "algorithm": "LinearRegression",
            "features": model_features,
        },
        "explainability": explainability,
    }
