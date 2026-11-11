"""
OpsMind Anomaly Detection Service
Unsupervised machine learning with Isolation Forest combined with statistical baselines (Z-score, IQR).
Detects unusual sales and expense patterns with fine-grained feature attribution and explainability.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "artifacts")
EXPENSE_MODEL_PATH = os.path.join(ARTIFACTS_DIR, "expense_isolation_forest.joblib")
SALES_MODEL_PATH = os.path.join(ARTIFACTS_DIR, "sales_isolation_forest.joblib")
EXPENSE_META_PATH = os.path.join(ARTIFACTS_DIR, "expense_anomaly_meta.json")
SALES_META_PATH = os.path.join(ARTIFACTS_DIR, "sales_anomaly_meta.json")

DEFAULT_EXPENSES_CSV = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "synthetic", "synthetic_expenses.csv")
)
DEFAULT_SALES_CSV = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "processed", "cleaned_sales.csv")
)

class AnomalyDetectionService:
    def __init__(self):
        os.makedirs(ARTIFACTS_DIR, exist_ok=True)
        self.expense_model: Optional[IsolationForest] = None
        self.expense_meta: Optional[Dict[str, Any]] = None
        self.sales_model: Optional[IsolationForest] = None
        self.sales_meta: Optional[Dict[str, Any]] = None
        self._load_models_if_available()

    def _load_models_if_available(self):
        try:
            if os.path.exists(EXPENSE_MODEL_PATH) and os.path.exists(EXPENSE_META_PATH):
                self.expense_model = joblib.load(EXPENSE_MODEL_PATH)
                with open(EXPENSE_META_PATH, "r", encoding="utf-8") as f:
                    self.expense_meta = json.load(f)
                logger.info("Expense anomaly model loaded.")
        except Exception as e:
            logger.warning(f"Could not load expense anomaly model: {e}")

        try:
            if os.path.exists(SALES_MODEL_PATH) and os.path.exists(SALES_META_PATH):
                self.sales_model = joblib.load(SALES_MODEL_PATH)
                with open(SALES_META_PATH, "r", encoding="utf-8") as f:
                    self.sales_meta = json.load(f)
                logger.info("Sales anomaly model loaded.")
        except Exception as e:
            logger.warning(f"Could not load sales anomaly model: {e}")

    # =========================================================================
    # 1. EXPENSE ANOMALY DETECTION
    # =========================================================================

    def train_expense_detector(self, csv_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Train Isolation Forest on SME expenses with category-level Z-Score and IQR baselines.
        """
        target_csv = csv_path or DEFAULT_EXPENSES_CSV
        if not os.path.exists(target_csv):
            raise FileNotFoundError(f"Expenses CSV not found at {target_csv}")

        df = pd.read_csv(target_csv)
        df['parsed_date'] = pd.to_datetime(df['date'], format='mixed', utc=True)
        df['day_of_week'] = df['parsed_date'].dt.day_of_week

        # Compute Category Statistical Baselines
        category_stats = {}
        for category, grp in df.groupby('category'):
            amounts = grp['amount']
            q1 = float(amounts.quantile(0.25))
            q3 = float(amounts.quantile(0.75))
            iqr = q3 - q1
            mean = float(amounts.mean())
            std = float(amounts.std()) if amounts.std() > 0 else 1.0
            median = float(amounts.median())

            category_stats[category] = {
                "count": int(len(amounts)),
                "mean": round(mean, 2),
                "std": round(std, 2),
                "median": round(median, 2),
                "q1": round(q1, 2),
                "q3": round(q3, 2),
                "iqr": round(iqr, 2),
                "upper_fence": round(q3 + 1.5 * iqr, 2),
                "extreme_fence": round(q3 + 3.0 * iqr, 2),
            }

        # Feature Engineering: Normalized Z-Score and IQR Ratio per Category
        def compute_z(row):
            cat = row['category']
            st = category_stats.get(cat)
            if not st or st['std'] == 0:
                return 0.0
            return (row['amount'] - st['mean']) / st['std']

        def compute_iqr_ratio(row):
            cat = row['category']
            st = category_stats.get(cat)
            if not st or st['upper_fence'] <= 0:
                return 1.0
            return row['amount'] / st['upper_fence']

        df['cat_z_score'] = df.apply(compute_z, axis=1)
        df['cat_iqr_ratio'] = df.apply(compute_iqr_ratio, axis=1)

        features = ['amount', 'day_of_week', 'cat_z_score', 'cat_iqr_ratio']
        X = df[features].copy()

        # Fit Isolation Forest
        iso = IsolationForest(
            contamination=0.04,
            n_estimators=100,
            max_samples='auto',
            random_state=42
        )
        iso.fit(X)

        raw_scores = iso.decision_function(X)
        # Normalize score: 0 (normal) to 1 (highly anomalous)
        min_s, max_s = raw_scores.min(), raw_scores.max()
        normalized_scores = 1.0 - ((raw_scores - min_s) / (max_s - min_s + 1e-9))
        preds = iso.predict(X)

        df['is_anomaly'] = preds == -1
        df['anomaly_score'] = normalized_scores.round(4)

        anomalies_found = int(df['is_anomaly'].sum())

        metadata = {
            "model_type": "IsolationForest_With_Statistical_Baselines",
            "model_version": "1.0.0",
            "domain": "expenses",
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "total_samples": int(len(df)),
            "contamination_rate": 0.04,
            "anomalies_detected": anomalies_found,
            "category_statistical_baselines": category_stats,
            "feature_set": features,
            "score_normalization": {
                "min_decision_function": float(min_s),
                "max_decision_function": float(max_s)
            }
        }

        joblib.dump(iso, EXPENSE_MODEL_PATH)
        with open(EXPENSE_META_PATH, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        self.expense_model = iso
        self.expense_meta = metadata
        logger.info(f"Trained Expense Isolation Forest: {anomalies_found} anomalies flagged.")
        return metadata

    def detect_expense_anomalies(self, expenses: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Detect and explain anomalies in SME expenses.
        If expenses list is None, processes default historical dataset.
        """
        if self.expense_model is None or self.expense_meta is None:
            self.train_expense_detector()

        if expenses is None:
            df = pd.read_csv(DEFAULT_EXPENSES_CSV)
        else:
            df = pd.DataFrame(expenses)

        df['parsed_date'] = pd.to_datetime(df['date'], format='mixed', utc=True)
        df['day_of_week'] = df['parsed_date'].dt.day_of_week

        category_stats = self.expense_meta.get("category_statistical_baselines", {})

        def compute_z(row):
            cat = row.get('category', 'Other')
            st = category_stats.get(cat)
            if not st or st.get('std', 0) == 0:
                return 0.0
            return (row['amount'] - st['mean']) / st['std']

        def compute_iqr_ratio(row):
            cat = row.get('category', 'Other')
            st = category_stats.get(cat)
            if not st or st.get('upper_fence', 0) <= 0:
                return 1.0
            return row['amount'] / st['upper_fence']

        df['cat_z_score'] = df.apply(compute_z, axis=1)
        df['cat_iqr_ratio'] = df.apply(compute_iqr_ratio, axis=1)

        features = ['amount', 'day_of_week', 'cat_z_score', 'cat_iqr_ratio']
        X = df[features].copy()

        preds = self.expense_model.predict(X)
        raw_scores = self.expense_model.decision_function(X)

        norm = self.expense_meta.get("score_normalization", {})
        min_s = norm.get("min_decision_function", -0.2)
        max_s = norm.get("max_decision_function", 0.2)
        scores = 1.0 - np.clip((raw_scores - min_s) / (max_s - min_s + 1e-9), 0.0, 1.0)

        df['is_ml_anomaly'] = preds == -1
        df['anomaly_score'] = scores.round(4)

        results = []
        for idx, row in df.iterrows():
            cat = row.get('category', 'Other')
            st = category_stats.get(cat, {})
            amt = float(row['amount'])
            z = float(row['cat_z_score'])
            iqr_r = float(row['cat_iqr_ratio'])
            is_anomaly = bool(row['is_ml_anomaly']) or (z > 3.0) or (iqr_r > 1.5)

            if is_anomaly:
                reasons = []
                severity = "LOW"

                if st:
                    median_amt = st.get('median', 0)
                    upper_fence = st.get('upper_fence', 0)
                    extreme_fence = st.get('extreme_fence', 0)

                    if amt > extreme_fence:
                        severity = "CRITICAL"
                        reasons.append(f"Expense of ${amt:,.2f} exceeds extreme IQR fence (${extreme_fence:,.2f}) by +{(amt - extreme_fence):,.2f}.")
                    elif amt > upper_fence:
                        severity = "HIGH"
                        reasons.append(f"Expense of ${amt:,.2f} exceeds the category upper threshold (${upper_fence:,.2f}).")

                    if z > 3.0:
                        reasons.append(f"Statistical Z-Score of +{z:.1f} standard deviations above the category average (${st.get('mean', 0):,.2f}).")
                    elif z > 2.0:
                        reasons.append(f"Noticeably elevated amount (+{z:.1f} std devs from average).")

                    if median_amt > 0 and amt > 2.5 * median_amt:
                        reasons.append(f"Amount is {round(amt / median_amt, 1)}x the typical category median (${median_amt:,.2f}).")

                day_name = row['parsed_date'].strftime("%A")
                if row['day_of_week'] in [5, 6]:
                    reasons.append(f"Processed on a weekend ({day_name}), atypical for business operational expenses.")

                if not reasons:
                    reasons.append("Unusual multidimensional feature interaction detected by Isolation Forest.")

                results.append({
                    "expense_id": str(row.get('expenseId', f"EXP-{idx}")),
                    "category": cat,
                    "amount": amt,
                    "date": str(row['parsed_date'].strftime("%Y-%m-%d")),
                    "day_of_week": day_name,
                    "severity": severity,
                    "anomaly_score": float(row['anomaly_score']),
                    "z_score": round(z, 2),
                    "iqr_ratio": round(iqr_r, 2),
                    "explanation": reasons,
                    "baseline_stats": {
                        "category_median": st.get("median", 0),
                        "category_mean": st.get("mean", 0),
                        "category_upper_fence": st.get("upper_fence", 0)
                    }
                })

        # Sort by anomaly score descending
        results.sort(key=lambda x: x["anomaly_score"], reverse=True)

        return {
            "domain": "expenses",
            "total_evaluated": int(len(df)),
            "total_anomalies_detected": len(results),
            "model_metadata": self.expense_meta,
            "anomalies": results
        }

    # =========================================================================
    # 2. SALES ANOMALY DETECTION
    # =========================================================================

    def train_sales_detector(self, csv_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Train Isolation Forest on commercial sales transactions to detect quantity spikes,
        fat-finger pricing, and extreme revenue orders.
        """
        target_csv = csv_path or DEFAULT_SALES_CSV
        if not os.path.exists(target_csv):
            raise FileNotFoundError(f"Sales dataset not found at {target_csv}")

        # Sample representative valid sales (non-cancellations)
        df = pd.read_csv(target_csv, usecols=['InvoiceNo', 'StockCode', 'Quantity', 'InvoiceDate', 'UnitPrice', 'LineTotal', 'IsCancellation'])
        sales = df[~df['IsCancellation']].copy()

        # Filter strictly positive values for baselines
        sales = sales[(sales['Quantity'] > 0) & (sales['UnitPrice'] > 0)]
        sales['parsed_date'] = pd.to_datetime(sales['InvoiceDate'], utc=True)
        sales['day_of_week'] = sales['parsed_date'].dt.day_of_week

        # Overall statistical baselines
        qty_q1, qty_q3 = float(sales['Quantity'].quantile(0.25)), float(sales['Quantity'].quantile(0.75))
        qty_iqr = qty_q3 - qty_q1
        rev_q1, rev_q3 = float(sales['LineTotal'].quantile(0.25)), float(sales['LineTotal'].quantile(0.75))
        rev_iqr = rev_q3 - rev_q1

        baselines = {
            "quantity": {
                "median": float(sales['Quantity'].median()),
                "mean": round(float(sales['Quantity'].mean()), 2),
                "std": round(float(sales['Quantity'].std()), 2),
                "upper_fence": round(qty_q3 + 3.0 * qty_iqr, 2)
            },
            "line_total": {
                "median": float(sales['LineTotal'].median()),
                "mean": round(float(sales['LineTotal'].mean()), 2),
                "std": round(float(sales['LineTotal'].std()), 2),
                "upper_fence": round(rev_q3 + 3.0 * rev_iqr, 2)
            }
        }

        # Train on a stratified subset of 50,000 transactions for high precision
        sample_df = sales.sample(n=min(50000, len(sales)), random_state=42).copy()
        features = ['Quantity', 'UnitPrice', 'LineTotal', 'day_of_week']
        X = sample_df[features].copy()

        iso = IsolationForest(
            contamination=0.01,
            n_estimators=100,
            random_state=42
        )
        iso.fit(X)

        raw_scores = iso.decision_function(X)
        min_s, max_s = float(raw_scores.min()), float(raw_scores.max())

        metadata = {
            "model_type": "IsolationForest_Sales",
            "model_version": "1.0.0",
            "domain": "sales",
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "samples_trained": len(sample_df),
            "contamination_rate": 0.01,
            "statistical_baselines": baselines,
            "feature_set": features,
            "score_normalization": {
                "min_decision_function": min_s,
                "max_decision_function": max_s
            }
        }

        joblib.dump(iso, SALES_MODEL_PATH)
        with open(SALES_META_PATH, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        self.sales_model = iso
        self.sales_meta = metadata
        logger.info("Trained Sales Isolation Forest.")
        return metadata

    def detect_sales_anomalies(self, sales: Optional[List[Dict[str, Any]]] = None, limit: int = 50) -> Dict[str, Any]:
        """
        Detect unusual sales behavior (excessive quantity, out-of-range pricing, bulk anomalies).
        """
        if self.sales_model is None or self.sales_meta is None:
            self.train_sales_detector()

        if sales is None:
            df = pd.read_csv(DEFAULT_SALES_CSV, nrows=10000)
            df = df[~df['IsCancellation']].copy()
        else:
            df = pd.DataFrame(sales)

        df['parsed_date'] = pd.to_datetime(df['InvoiceDate'], utc=True)
        df['day_of_week'] = df['parsed_date'].dt.day_of_week

        features = ['Quantity', 'UnitPrice', 'LineTotal', 'day_of_week']
        X = df[features].copy()

        preds = self.sales_model.predict(X)
        raw_scores = self.sales_model.decision_function(X)

        norm = self.sales_meta.get("score_normalization", {})
        min_s = norm.get("min_decision_function", -0.2)
        max_s = norm.get("max_decision_function", 0.2)
        scores = 1.0 - np.clip((raw_scores - min_s) / (max_s - min_s + 1e-9), 0.0, 1.0)

        df['is_ml_anomaly'] = preds == -1
        df['anomaly_score'] = scores.round(4)

        base_qty = self.sales_meta.get("statistical_baselines", {}).get("quantity", {})
        base_rev = self.sales_meta.get("statistical_baselines", {}).get("line_total", {})
        qty_fence = base_qty.get("upper_fence", 150)
        rev_fence = base_rev.get("upper_fence", 300)

        results = []
        for idx, row in df.iterrows():
            qty = float(row['Quantity'])
            rev = float(row['LineTotal'])
            price = float(row['UnitPrice'])
            is_ml = bool(row['is_ml_anomaly'])

            if is_ml or qty > qty_fence or rev > rev_fence:
                reasons = []
                severity = "LOW"

                if rev > rev_fence * 2 or qty > qty_fence * 2:
                    severity = "CRITICAL"
                elif rev > rev_fence or qty > qty_fence:
                    severity = "HIGH"
                else:
                    severity = "MEDIUM"

                if qty > qty_fence:
                    reasons.append(f"Unusually large bulk volume: {int(qty):,} units exceeds normal 3x IQR fence ({int(qty_fence)} units).")
                if rev > rev_fence:
                    reasons.append(f"High order total of ${rev:,.2f} exceeds typical transaction fence (${rev_fence:,.2f}).")
                if price > 50.0:
                    reasons.append(f"High unit price of ${price:,.2f} significantly above retail catalog median.")

                if not reasons:
                    reasons.append("Unusual multi-dimensional feature interaction (Isolation Forest outlier).")

                results.append({
                    "invoice_no": str(row.get('InvoiceNo', f"INV-{idx}")),
                    "stock_code": str(row.get('StockCode', 'UNKNOWN')),
                    "description": str(row.get('Description', 'Product')),
                    "quantity": int(qty),
                    "unit_price": price,
                    "line_total": round(rev, 2),
                    "date": str(row['parsed_date'].strftime("%Y-%m-%d")),
                    "severity": severity,
                    "anomaly_score": float(row['anomaly_score']),
                    "explanation": reasons
                })

        results.sort(key=lambda x: x["anomaly_score"], reverse=True)
        return {
            "domain": "sales",
            "total_evaluated": int(len(df)),
            "total_anomalies_detected": len(results),
            "model_metadata": self.sales_meta,
            "anomalies": results[:limit]
        }

anomaly_service = AnomalyDetectionService()
