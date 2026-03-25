#!/usr/bin/env python
import argparse
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "orion_backend.settings")

import django  # noqa: E402

django.setup()

from stocks.models import Stock, StockPrice  # noqa: E402

try:
    from stocks.market_data_service import get_price_data  # noqa: E402
except Exception:
    get_price_data = None


DEFAULT_MAPPING = BACKEND_DIR / "data" / "sector_mapping.json"
DEFAULT_OUTPUT = BACKEND_DIR / "data" / "portfolio_outputs"


@dataclass
class StockFeatureRow:
    symbol: str
    name: str
    market: str
    sector: str
    price: float
    pe_ratio: float
    volume: int
    discount_price: float
    feature_source: str


def _stable_unit(symbol: str, salt: str) -> float:
    digest = hashlib.sha256(f"{symbol}|{salt}".encode("utf-8")).hexdigest()
    value = int(digest[:12], 16)
    return value / float((16**12) - 1)


def _stable_float(symbol: str, salt: str, low: float, high: float) -> float:
    return low + (_stable_unit(symbol, salt) * (high - low))


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def _load_mapping(mapping_path: Path) -> Dict[str, List[str]]:
    payload = json.loads(mapping_path.read_text(encoding="utf-8"))
    sectors = payload.get("sectors", {})
    if not isinstance(sectors, dict) or not sectors:
        raise ValueError("Invalid sector mapping: missing 'sectors'")
    return sectors


def _latest_price_row(stock_obj: Stock):
    return (
        StockPrice.objects.filter(stock=stock_obj)
        .order_by("-timestamp")
        .values("close_price", "volume")
        .first()
    )


def _api_pe_ratio(symbol: str):
    if get_price_data is None:
        return None
    try:
        payload = get_price_data(symbol)
        metrics = payload.get("market_metrics", {}) if isinstance(payload, dict) else {}
        value = metrics.get("pe_ttm")
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _compute_discount_price(price: float, pe_ratio: float) -> float:
    discount_factor = min(0.35, max(0.05, 0.15 + ((pe_ratio - 20.0) / 200.0)))
    return round(price * (1.0 - discount_factor), 2)


def _build_feature_row(symbol: str, sector: str, stock_lookup: Dict[str, Stock], enrich_api: bool) -> StockFeatureRow:
    stock = stock_lookup.get(symbol)
    latest = _latest_price_row(stock) if stock else None

    db_price = float(latest["close_price"]) if latest and latest.get("close_price") is not None else None
    db_volume = int(latest["volume"]) if latest and latest.get("volume") is not None else None

    api_pe = _api_pe_ratio(symbol) if enrich_api else None

    price = round(db_price, 2) if db_price is not None else round(_stable_float(symbol, "price", 25.0, 2500.0), 2)
    volume = db_volume if db_volume is not None else int(_stable_float(symbol, "volume", 500_000.0, 200_000_000.0))
    pe_ratio = round(api_pe, 2) if api_pe is not None else round(_stable_float(symbol, "pe_ratio", 6.0, 45.0), 2)
    discount_price = _compute_discount_price(price, pe_ratio)

    if db_price is not None and db_volume is not None:
        source = "db"
    elif db_price is not None or db_volume is not None:
        source = "db+synthetic"
    else:
        source = "synthetic"
    if api_pe is not None:
        source = f"{source}+api_pe"

    return StockFeatureRow(
        symbol=symbol,
        name=stock.name if stock else symbol,
        market=stock.market if stock else "UNKNOWN",
        sector=sector,
        price=price,
        pe_ratio=pe_ratio,
        volume=volume,
        discount_price=discount_price,
        feature_source=source,
    )


def _cluster_sector(rows: List[StockFeatureRow], random_state: int, primary_clusters: int, valuation_clusters: int):
    if not rows:
        return {}, {}, {}

    rows_sorted = sorted(rows, key=lambda item: item.symbol)
    matrix = np.array([[r.price, r.pe_ratio, float(r.volume), r.discount_price] for r in rows_sorted], dtype=float)

    scaler = StandardScaler()
    scaled = scaler.fit_transform(matrix)

    n_primary = max(1, min(primary_clusters, len(rows_sorted)))
    if len(rows_sorted) == 1:
        primary_labels = np.array([0], dtype=int)
    else:
        primary_labels = KMeans(
            n_clusters=n_primary,
            random_state=random_state,
            n_init=10,
        ).fit_predict(scaled)

    if len(rows_sorted) >= 2:
        pca = PCA(n_components=2, random_state=random_state)
        pca_points = pca.fit_transform(scaled)
    else:
        pca_points = np.array([[0.0, 0.0]], dtype=float)

    valuation_matrix = np.array([[r.pe_ratio, r.discount_price] for r in rows_sorted], dtype=float)
    valuation_scaled = StandardScaler().fit_transform(valuation_matrix)
    n_valuation = max(1, min(valuation_clusters, len(rows_sorted)))
    if len(rows_sorted) == 1:
        valuation_labels = np.array([0], dtype=int)
    else:
        valuation_labels = KMeans(
            n_clusters=n_valuation,
            random_state=random_state,
            n_init=10,
        ).fit_predict(valuation_scaled)

    return rows_sorted, primary_labels, valuation_labels, pca_points


def generate(mapping_path: Path, output_dir: Path, random_state: int, primary_clusters: int, valuation_clusters: int, enrich_api: bool, dry_run: bool):
    sectors = _load_mapping(mapping_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    all_symbols = sorted({symbol for symbols in sectors.values() for symbol in symbols})
    stock_lookup = Stock.objects.in_bulk(all_symbols, field_name="symbol")

    summary = {}
    for sector, symbols in sorted(sectors.items(), key=lambda x: x[0]):
        feature_rows = [_build_feature_row(symbol, sector, stock_lookup, enrich_api=enrich_api) for symbol in symbols]
        rows_sorted, primary_labels, valuation_labels, pca_points = _cluster_sector(
            feature_rows,
            random_state=random_state,
            primary_clusters=primary_clusters,
            valuation_clusters=valuation_clusters,
        )

        stocks_payload = []
        features_payload = []
        pca_payload = []
        discount_payload = []
        primary_map = {}
        valuation_map = {}

        for idx, row in enumerate(rows_sorted):
            primary_label = int(primary_labels[idx])
            valuation_label = int(valuation_labels[idx])
            pca_x = round(float(pca_points[idx][0]), 6)
            pca_y = round(float(pca_points[idx][1]), 6)

            stocks_payload.append(
                {
                    "symbol": row.symbol,
                    "name": row.name,
                    "market": row.market,
                    "sector": row.sector,
                    "features": {
                        "price": row.price,
                        "pe_ratio": row.pe_ratio,
                        "volume": row.volume,
                        "discount_price": row.discount_price,
                    },
                    "cluster": {
                        "primary": primary_label,
                        "valuation": valuation_label,
                    },
                    "pca": {"x": pca_x, "y": pca_y},
                    "feature_source": row.feature_source,
                }
            )

            features_payload.append(
                {
                    "symbol": row.symbol,
                    "price": row.price,
                    "pe_ratio": row.pe_ratio,
                    "volume": row.volume,
                    "discount_price": row.discount_price,
                }
            )
            pca_payload.append({"symbol": row.symbol, "pc1": pca_x, "pc2": pca_y})
            discount_payload.append({"symbol": row.symbol, "discount_price": row.discount_price})
            primary_map[row.symbol] = primary_label
            valuation_map[row.symbol] = valuation_label

        sector_payload = {
            "sector": sector,
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "meta": {
                "random_state": random_state,
                "primary_clusters_used": len(set(primary_map.values())) if primary_map else 0,
                "valuation_clusters_used": len(set(valuation_map.values())) if valuation_map else 0,
                "stock_count": len(rows_sorted),
            },
            "stocks": stocks_payload,
            "features": features_payload,
            "cluster_labels": {
                "primary": primary_map,
                "valuation": valuation_map,
            },
            "pca_values": pca_payload,
            "discount_price": discount_payload,
        }

        sector_filename = f"{_slugify(sector)}.json"
        sector_path = output_dir / sector_filename
        if not dry_run:
            sector_path.write_text(json.dumps(sector_payload, indent=2), encoding="utf-8")

        summary[sector] = {
            "file": str(sector_path),
            "stocks": len(rows_sorted),
        }

    return summary


def parse_args():
    parser = argparse.ArgumentParser(description="Generate sector portfolio outputs with deterministic ML clustering.")
    parser.add_argument("--mapping", type=Path, default=DEFAULT_MAPPING, help="Path to sector_mapping.json")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Directory for generated sector JSON files")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed for KMeans/PCA")
    parser.add_argument("--primary-clusters", type=int, default=4, help="Max clusters for primary feature clustering")
    parser.add_argument("--valuation-clusters", type=int, default=3, help="Max clusters for PE/discount clustering")
    parser.add_argument("--enrich-api", action="store_true", help="Optionally enrich PE ratio using market data API")
    parser.add_argument("--dry-run", action="store_true", help="Run pipeline without writing output files")
    return parser.parse_args()


def main():
    args = parse_args()
    if not args.mapping.exists():
        raise FileNotFoundError(f"Mapping file not found: {args.mapping}")

    summary = generate(
        mapping_path=args.mapping,
        output_dir=args.output,
        random_state=args.random_state,
        primary_clusters=args.primary_clusters,
        valuation_clusters=args.valuation_clusters,
        enrich_api=args.enrich_api,
        dry_run=args.dry_run,
    )

    print(f"Sectors processed: {len(summary)}")
    total = sum(item["stocks"] for item in summary.values())
    print(f"Stocks processed: {total}")
    if args.dry_run:
        print("Dry run completed (no files written).")
    else:
        print(f"Outputs written to: {args.output}")


if __name__ == "__main__":
    main()
