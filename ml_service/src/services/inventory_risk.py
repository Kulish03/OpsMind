"""
OpsMind Inventory Risk & Replenishment Service
Predicts stockout risks by combining machine-learned / run-rate forecast demand, current stock levels,
reorder thresholds, and supplier lead-time dynamics.
Generates actionable replenishment recommendations only when sufficient information exists.
"""

import os
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "artifacts")
META_PATH = os.path.join(ARTIFACTS_DIR, "inventory_risk_meta.json")

DEFAULT_PROD_CSV = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "synthetic", "products_enriched.csv")
)
DEFAULT_SUPP_CSV = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "synthetic", "synthetic_suppliers.csv")
)
DEFAULT_SALES_CSV = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "processed", "cleaned_sales.csv")
)

class InventoryRiskService:
    def __init__(self):
        os.makedirs(ARTIFACTS_DIR, exist_ok=True)
        self.metadata: Optional[Dict[str, Any]] = None
        self._load_meta_if_available()

    def _load_meta_if_available(self):
        if os.path.exists(META_PATH):
            try:
                with open(META_PATH, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load inventory meta: {e}")

    def compute_historical_velocities(self, window_days: int = 30) -> Dict[str, float]:
        """
        Compute average daily units sold per SKU over the recent active sales window.
        Uses cached fast-path artifact when available.
        """
        cached_path = os.path.join(ARTIFACTS_DIR, "sku_velocities.json")
        if os.path.exists(cached_path):
            try:
                with open(cached_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        if not os.path.exists(DEFAULT_SALES_CSV):
            return {}

        df = pd.read_csv(DEFAULT_SALES_CSV, usecols=['StockCode', 'Quantity', 'InvoiceDate', 'IsCancellation'])
        sales = df[~df['IsCancellation']].copy()
        sales['parsed_date'] = pd.to_datetime(sales['InvoiceDate'], utc=True)
        max_date = sales['parsed_date'].max()
        cutoff_date = max_date - timedelta(days=window_days)

        recent = sales[sales['parsed_date'] >= cutoff_date]
        sku_units = recent.groupby('StockCode')['Quantity'].sum().to_dict()

        velocities = {}
        for sku, units in sku_units.items():
            velocities[str(sku)] = round(float(units) / window_days, 2)

        return velocities

    def evaluate_inventory_risk(
        self,
        products: Optional[List[Dict[str, Any]]] = None,
        suppliers: Optional[List[Dict[str, Any]]] = None,
        forecast_daily_demands: Optional[Dict[str, float]] = None,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Evaluate stockout risks and formulate replenishment recommendations.
        Strictly enforces sufficient information criteria before recommending orders.
        """
        # Load products
        if products is None and os.path.exists(DEFAULT_PROD_CSV):
            df_prod = pd.read_csv(DEFAULT_PROD_CSV)
            prod_records = df_prod.to_dict(orient="records")
        else:
            prod_records = products or []

        # Load suppliers lookup
        supp_lookup = {}
        if suppliers is not None:
            for s in suppliers:
                sid = s.get("supplierId") or str(s.get("_id", ""))
                supp_lookup[sid] = s
        elif os.path.exists(DEFAULT_SUPP_CSV):
            df_supp = pd.read_csv(DEFAULT_SUPP_CSV)
            for _, row in df_supp.iterrows():
                supp_lookup[str(row['supplierId'])] = row.to_dict()

        # Demand velocity lookup
        if forecast_daily_demands is None:
            velocities = self.compute_historical_velocities(window_days=30)
        else:
            velocities = forecast_daily_demands

        today = datetime.now(timezone.utc).date()
        evaluated_items = []
        sufficient_info_count = 0
        insufficient_info_count = 0

        risk_counts = {
            "OUT_OF_STOCK": 0,
            "CRITICAL": 0,
            "HIGH": 0,
            "MODERATE": 0,
            "HEALTHY": 0
        }

        for item in prod_records:
            sku = str(item.get("StockCode") or item.get("sku") or "UNKNOWN")
            name = str(item.get("name") or item.get("Description") or sku)
            current_stock = item.get("currentStock")
            reorder_threshold = item.get("reorderThreshold")
            target_stock = item.get("targetStock") or (reorder_threshold * 2 if reorder_threshold else 100)
            cost_price = item.get("costPrice", 0.0)
            supplier_id = str(item.get("supplierId") or "")

            supplier = supp_lookup.get(supplier_id)
            lead_time_days = supplier.get("leadTimeDays") if supplier else None
            min_order_qty = supplier.get("minimumOrderQty", 10) if supplier else 10
            supplier_name = supplier.get("name", "Unknown Supplier") if supplier else "Unassigned"

            daily_demand = velocities.get(sku, 0.0)

            # Check information completeness
            missing_fields = []
            if current_stock is None or pd.isna(current_stock):
                missing_fields.append("currentStock")
            if reorder_threshold is None or pd.isna(reorder_threshold):
                missing_fields.append("reorderThreshold")
            if lead_time_days is None or pd.isna(lead_time_days):
                missing_fields.append("supplier.leadTimeDays")
            if cost_price is None or cost_price <= 0:
                missing_fields.append("costPrice")

            has_sufficient_data = (len(missing_fields) == 0)

            if not has_sufficient_data:
                insufficient_info_count += 1
                evaluated_items.append({
                    "sku": sku,
                    "name": name,
                    "current_stock": current_stock if current_stock is not None and not pd.isna(current_stock) else None,
                    "has_sufficient_data": False,
                    "missing_fields": missing_fields,
                    "risk_level": "UNKNOWN",
                    "stockout_risk_score": 0.0,
                    "replenishment_recommendation": {
                        "status": "INSUFFICIENT_DATA",
                        "reason": f"Cannot compute reliable replenishment recommendation. Missing critical operational parameters: {', '.join(missing_fields)}."
                    }
                })
                continue

            sufficient_info_count += 1
            current_stock = float(current_stock)
            reorder_threshold = float(reorder_threshold)
            lead_time_days = int(lead_time_days)
            cost_price = float(cost_price)
            daily_demand = max(0.0, float(daily_demand))

            # Days of Supply Calculation
            if current_stock <= 0:
                days_of_supply = 0.0
            elif daily_demand > 0:
                days_of_supply = round(current_stock / daily_demand, 1)
            else:
                days_of_supply = 999.0  # Infinite supply when no current run-rate

            # Lead time demand
            lead_time_demand = round(daily_demand * lead_time_days, 1)

            # Risk Classification & Scoring
            risk_level = "HEALTHY"
            risk_score = 0.05
            urgency = "NONE"

            if current_stock <= 0:
                risk_level = "OUT_OF_STOCK"
                risk_score = 1.00
                urgency = "IMMEDIATE"
            elif days_of_supply < lead_time_days:
                # Stock will deplete BEFORE new shipment arrives
                risk_level = "CRITICAL"
                risk_score = 0.92
                urgency = "IMMEDIATE"
            elif current_stock <= reorder_threshold or days_of_supply < (lead_time_days * 1.5):
                risk_level = "HIGH"
                risk_score = 0.75
                urgency = "HIGH"
            elif days_of_supply < (lead_time_days * 2.5):
                risk_level = "MODERATE"
                risk_score = 0.45
                urgency = "MEDIUM"
            else:
                risk_level = "HEALTHY"
                risk_score = 0.10
                urgency = "NONE"

            risk_counts[risk_level] += 1

            # Replenishment Order Calculation
            # Recommended Order = targetStock - currentStock + lead_time_demand
            if risk_level in ["OUT_OF_STOCK", "CRITICAL", "HIGH"]:
                deficit = target_stock - current_stock + lead_time_demand
                order_qty = max(min_order_qty, int(np.ceil(deficit)))
                order_cost = round(order_qty * cost_price, 2)
                exp_stockout_date = (today + timedelta(days=int(days_of_supply))).strftime("%Y-%m-%d") if days_of_supply < 365 else "N/A"

                recommendation = {
                    "status": "RECOMMENDED",
                    "urgency": urgency,
                    "suggested_order_quantity": order_qty,
                    "estimated_order_cost": order_cost,
                    "supplier_id": supplier_id,
                    "supplier_name": supplier_name,
                    "supplier_lead_time_days": lead_time_days,
                    "minimum_order_qty": min_order_qty,
                    "expected_stockout_date": "CURRENTLY_DEPLETED" if current_stock <= 0 else exp_stockout_date,
                    "rationale": (
                        f"Current stock ({int(current_stock)}) has {days_of_supply} days of supply remaining. "
                        f"Supplier lead time is {lead_time_days} days (requiring {lead_time_demand} units during transit). "
                        f"Reorder threshold is {int(reorder_threshold)} units."
                    )
                }
            else:
                recommendation = {
                    "status": "ADEQUATELY_STOCKED",
                    "urgency": "NONE",
                    "suggested_order_quantity": 0,
                    "estimated_order_cost": 0.0,
                    "supplier_id": supplier_id,
                    "supplier_name": supplier_name,
                    "supplier_lead_time_days": lead_time_days,
                    "minimum_order_qty": min_order_qty,
                    "rationale": f"Stock is healthy ({int(current_stock)} units, {days_of_supply} days of supply)."
                }

            evaluated_items.append({
                "sku": sku,
                "name": name,
                "current_stock": int(current_stock),
                "reorder_threshold": int(reorder_threshold),
                "target_stock": int(target_stock),
                "daily_demand_velocity": daily_demand,
                "days_of_supply": days_of_supply,
                "lead_time_demand": lead_time_demand,
                "supplier_lead_time_days": lead_time_days,
                "has_sufficient_data": True,
                "risk_level": risk_level,
                "stockout_risk_score": risk_score,
                "replenishment_recommendation": recommendation
            })

        # Sort: Highest risk first
        evaluated_items.sort(key=lambda x: x["stockout_risk_score"], reverse=True)

        meta = {
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
            "total_products_evaluated": len(prod_records),
            "sufficient_data_count": sufficient_info_count,
            "insufficient_data_count": insufficient_info_count,
            "risk_distribution": risk_counts,
            "critical_or_out_of_stock_count": risk_counts["OUT_OF_STOCK"] + risk_counts["CRITICAL"],
            "model_version": "1.0.0"
        }

        with open(META_PATH, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        self.metadata = meta

        return {
            "summary": meta,
            "items": evaluated_items[:limit]
        }

inventory_risk_service = InventoryRiskService()
