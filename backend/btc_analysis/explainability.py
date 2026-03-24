from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List

import numpy as np
import pandas as pd

try:
    import shap
except Exception:  # pragma: no cover - runtime fallback
    shap = None

try:
    from lime.lime_tabular import LimeTabularExplainer
except Exception:  # pragma: no cover - runtime fallback
    LimeTabularExplainer = None

if TYPE_CHECKING:
    from .modeling import RegressionArtifacts


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _get_raw_train_test(artifacts: RegressionArtifacts) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series]:
    train_size = len(artifacts.y_train)
    x_train_raw = artifacts.prepared_features.iloc[:train_size].copy()
    x_test_raw = artifacts.prepared_features.loc[artifacts.test_index].copy()
    y_test_series = artifacts.target.loc[artifacts.test_index].copy()
    return x_train_raw, x_test_raw, y_test_series


def _shap_explanations(artifacts: RegressionArtifacts) -> Dict[str, Any]:
    if shap is None:
        return {
            "status": "unavailable",
            "reason": "shap library is not installed.",
            "global_importance": [],
            "latest_prediction": [],
        }

    x_train_raw, x_test_raw, _ = _get_raw_train_test(artifacts)
    if x_train_raw.empty or x_test_raw.empty:
        return {
            "status": "unavailable",
            "reason": "insufficient test samples for SHAP.",
            "global_importance": [],
            "latest_prediction": [],
        }

    try:
        background_raw = x_train_raw.tail(min(120, len(x_train_raw)))
        target_raw = x_test_raw.tail(min(120, len(x_test_raw)))

        background_scaled = artifacts.scaler.transform(background_raw)
        target_scaled = artifacts.scaler.transform(target_raw)

        explainer = shap.LinearExplainer(artifacts.model, background_scaled)
        shap_values = explainer.shap_values(target_scaled)
        shap_array = np.array(shap_values)

        if shap_array.ndim == 1:
            shap_array = shap_array.reshape(-1, 1)

        mean_abs = np.mean(np.abs(shap_array), axis=0)
        mean_signed = np.mean(shap_array, axis=0)
        latest_values = shap_array[-1]

        global_importance = []
        for feature_name, abs_value, signed_value in zip(
            artifacts.feature_columns,
            mean_abs,
            mean_signed,
        ):
            global_importance.append(
                {
                    "feature": feature_name,
                    "mean_abs_shap": round(_safe_float(abs_value), 6),
                    "mean_shap": round(_safe_float(signed_value), 6),
                }
            )

        global_importance.sort(key=lambda item: item["mean_abs_shap"], reverse=True)

        latest_prediction = []
        for feature_name, shap_value in zip(artifacts.feature_columns, latest_values):
            latest_prediction.append(
                {
                    "feature": feature_name,
                    "shap_value": round(_safe_float(shap_value), 6),
                }
            )
        latest_prediction.sort(key=lambda item: abs(item["shap_value"]), reverse=True)

        expected_value = getattr(explainer, "expected_value", 0.0)
        if isinstance(expected_value, (list, tuple, np.ndarray)):
            expected_value = expected_value[0] if len(expected_value) else 0.0

        return {
            "status": "ok",
            "expected_value": round(_safe_float(expected_value), 6),
            "global_importance": global_importance,
            "latest_prediction": latest_prediction,
        }
    except Exception as exc:
        return {
            "status": "error",
            "reason": str(exc),
            "global_importance": [],
            "latest_prediction": [],
        }


def _lime_explanations(artifacts: RegressionArtifacts) -> Dict[str, Any]:
    if LimeTabularExplainer is None:
        return {
            "status": "unavailable",
            "reason": "lime library is not installed.",
            "prediction_date": None,
            "predicted_close": None,
            "actual_close": None,
            "feature_importance": [],
        }

    x_train_raw, x_test_raw, y_test_series = _get_raw_train_test(artifacts)
    if x_train_raw.empty or x_test_raw.empty:
        return {
            "status": "unavailable",
            "reason": "insufficient test samples for LIME.",
            "prediction_date": None,
            "predicted_close": None,
            "actual_close": None,
            "feature_importance": [],
        }

    try:
        explainer = LimeTabularExplainer(
            training_data=x_train_raw.to_numpy(),
            feature_names=artifacts.feature_columns,
            mode="regression",
            random_state=42,
            discretize_continuous=True,
        )

        def predict_fn(raw_matrix: np.ndarray) -> np.ndarray:
            raw_frame = pd.DataFrame(raw_matrix, columns=artifacts.feature_columns)
            scaled = artifacts.scaler.transform(raw_frame)
            return artifacts.model.predict(scaled)

        latest_x = x_test_raw.iloc[-1].to_numpy()
        latest_date = x_test_raw.index[-1]
        predicted_value = _safe_float(predict_fn(np.array([latest_x]))[0])
        actual_value = _safe_float(y_test_series.iloc[-1])

        explanation = explainer.explain_instance(
            data_row=latest_x,
            predict_fn=predict_fn,
            num_features=min(8, len(artifacts.feature_columns)),
        )

        items = []
        for rule, weight in explanation.as_list():
            items.append(
                {
                    "feature": rule,
                    "weight": round(_safe_float(weight), 6),
                }
            )

        items.sort(key=lambda item: abs(item["weight"]), reverse=True)

        return {
            "status": "ok",
            "prediction_date": latest_date.date().isoformat() if hasattr(latest_date, "date") else str(latest_date),
            "predicted_close": round(predicted_value, 2),
            "actual_close": round(actual_value, 2),
            "feature_importance": items,
        }
    except Exception as exc:
        return {
            "status": "error",
            "reason": str(exc),
            "prediction_date": None,
            "predicted_close": None,
            "actual_close": None,
            "feature_importance": [],
        }


def build_explainability_outputs(artifacts: RegressionArtifacts) -> Dict[str, Any]:
    return {
        "lime": _lime_explanations(artifacts),
        "shap": _shap_explanations(artifacts),
    }
