import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .pipeline import get_btc_dataset, get_btc_dataset_sample

logger = logging.getLogger(__name__)


def _normalize_phase7_response(payload):
    """
    Phase 7 API contract:
    historical_data, predictions, metrics, explainability at top-level.
    Keeps legacy keys (ranges/ml) for backward compatibility.
    """
    ml = payload.get("ml", {})
    normalized = {
        "symbol": payload.get("symbol"),
        "generated_at": payload.get("generated_at"),
        "data_source": payload.get("data_source", "unknown"),
        "period": payload.get("period"),
        "interval": payload.get("interval"),
        "historical_data": payload.get("ranges", {}),
        "predictions": ml.get("predictions", {}),
        "metrics": ml.get("metrics", {}),
        "explainability": ml.get("explainability", {}),
        "model_info": ml.get("model_info", {}),
        "counts": payload.get("counts", {}),
        # backward compatibility with existing frontend integration
        "ranges": payload.get("ranges", {}),
        "ml": ml,
    }
    if "warning" in payload:
        normalized["warning"] = payload["warning"]
    return normalized


@api_view(["GET"])
@permission_classes([AllowAny])
def btc_analysis_data(request):
    """
    BTC/USD reusable pipeline endpoint.
    Returns historical ranges + ML predictions + metrics + explainability.
    """
    force_refresh = request.query_params.get("refresh") == "1"
    source = request.query_params.get("source", "live").lower()
    allow_fallback = request.query_params.get("allow_fallback", "1") != "0"

    try:
        if source == "sample":
            payload = get_btc_dataset_sample()
        else:
            payload = get_btc_dataset(force_refresh=force_refresh)
        return Response(_normalize_phase7_response(payload))
    except Exception as exc:
        logger.error("btc_analysis_data failed (source=%s): %s", source, exc)
        if allow_fallback:
            fallback_payload = get_btc_dataset_sample()
            fallback_payload["data_source"] = "sample_fallback"
            fallback_payload["warning"] = (
                "Live BTC/USD source unavailable; serving synthetic fallback dataset."
            )
            return Response(_normalize_phase7_response(fallback_payload))
        return Response(
            {"error": str(exc)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
