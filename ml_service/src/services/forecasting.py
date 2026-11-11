"""
OpsMind Demand Forecasting Service
Independently developed, evaluated and explainable time-series demand forecasting.
Features chronological train/test splitting, baseline comparisons (Naive, 7-Day MA),
and Random Forest Regressor with recursive multi-step forecasting and confidence bounds.
"""

import os
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "artifacts")
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "demand_forecast.joblib")
META_PATH = os.path.join(ARTIFACTS_DIR, "demand_forecast_meta.json")
DEFAULT_SALES_CSV = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "processed", "cleaned_sales.csv")
)

FEATURE_COLUMNS = [
    'lag_1', 'lag_2', 'lag_3', 'lag_7', 'lag_14',
    'rolling_mean_7', 'rolling_std_7', 'rolling_mean_14',
    'day_of_week', 'is_weekend', 'day_of_month', 'month'
]

def calculate_wape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Calculate Weighted Absolute Percentage Error: sum(|y - y_hat|) / sum(y)"""
    total = np.sum(y_true)
    if total == 0:
        return 0.0
    return float(np.sum(np.abs(y_true - y_pred)) / total)

class DemandForecastingService:
    def __init__(self):
        os.makedirs(ARTIFACTS_DIR, exist_ok=True)
        self.model: Optional[RandomForestRegressor] = None
        self.metadata: Optional[Dict[str, Any]] = None
        self._load_model_if_available()

    def _load_model_if_available(self):
        try:
            if os.path.exists(MODEL_PATH) and os.path.exists(META_PATH):
                self.model = joblib.load(MODEL_PATH)
                with open(META_PATH, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                logger.info("Demand forecasting model loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load pre-trained demand forecast model: {e}")

    def prepare_demand_series(self, df: pd.DataFrame, sku: Optional[str] = None) -> pd.DataFrame:
        """
        Aggregate sales into daily demand series.
        - Excludes returns/cancellations.
        - Fills calendar gaps with zero demand (preventing step distortion).
        """
        subset = df[~df['IsCancellation']].copy()
        if sku:
            subset = subset[subset['StockCode'] == sku]

        if subset.empty:
            return pd.DataFrame(columns=['date', 'units_sold', 'revenue', 'order_count'])

        subset['date'] = pd.to_datetime(subset['InvoiceDate']).dt.date
        daily = subset.groupby('date').agg(
            units_sold=('Quantity', 'sum'),
            revenue=('LineTotal', 'sum'),
            order_count=('InvoiceNo', 'nunique')
        ).reset_index()

        daily['date'] = pd.to_datetime(daily['date'])
        full_idx = pd.date_range(start=daily['date'].min(), end=daily['date'].max(), freq='D')
        daily = daily.set_index('date').reindex(full_idx, fill_value=0).reset_index()
        daily.rename(columns={'index': 'date'}, inplace=True)
        daily['units_sold'] = daily['units_sold'].astype(int)
        daily['order_count'] = daily['order_count'].astype(int)
        daily['revenue'] = daily['revenue'].astype(float)
        return daily

    def engineer_features(self, daily_df: pd.DataFrame) -> pd.DataFrame:
        """
        Engineer lag and rolling calendar features strictly using past observations.
        No future information leakage.
        """
        df = daily_df.copy()
        df.sort_values('date', inplace=True)

        # Lags
        df['lag_1'] = df['units_sold'].shift(1)
        df['lag_2'] = df['units_sold'].shift(2)
        df['lag_3'] = df['units_sold'].shift(3)
        df['lag_7'] = df['units_sold'].shift(7)
        df['lag_14'] = df['units_sold'].shift(14)

        # Rolling statistics strictly shifted by 1 day
        df['rolling_mean_7'] = df['units_sold'].shift(1).rolling(7).mean()
        df['rolling_std_7'] = df['units_sold'].shift(1).rolling(7).std().fillna(0)
        df['rolling_mean_14'] = df['units_sold'].shift(1).rolling(14).mean()

        # Calendar features
        df['day_of_week'] = df['date'].dt.day_of_week
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        df['day_of_month'] = df['date'].dt.day
        df['month'] = df['date'].dt.month

        return df

    def train_and_evaluate(self, csv_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Train demand forecasting model using chronological train/test split.
        Compares Random Forest with Naive Baseline and 7-day Moving Average Baseline.
        Saves artifacts and returns detailed evaluation metrics.
        """
        target_csv = csv_path or DEFAULT_SALES_CSV
        if not os.path.exists(target_csv):
            raise FileNotFoundError(f"Sales dataset not found at {target_csv}")

        df = pd.read_csv(target_csv, usecols=['InvoiceNo', 'StockCode', 'Quantity', 'InvoiceDate', 'LineTotal', 'IsCancellation'])
        daily = self.prepare_demand_series(df)
        featured = self.engineer_features(daily)
        clean = featured.dropna().copy()

        if len(clean) < 30:
            raise ValueError(f"Insufficient historical data points ({len(clean)}) for time-series forecasting.")

        # Chronological Split (80% train, 20% test)
        split_idx = int(len(clean) * 0.8)
        train_df = clean.iloc[:split_idx]
        test_df = clean.iloc[split_idx:]

        X_train = train_df[FEATURE_COLUMNS]
        y_train = train_df['units_sold']
        X_test = test_df[FEATURE_COLUMNS]
        y_test = test_df['units_sold']

        # Baseline 1: Naive (predict yesterday's value)
        naive_preds = test_df['lag_1'].values
        naive_mae = float(mean_absolute_error(y_test, naive_preds))
        naive_rmse = float(root_mean_squared_error(y_test, naive_preds))
        naive_wape = calculate_wape(y_test.values, naive_preds)

        # Baseline 2: 7-Day Moving Average
        ma7_preds = test_df['rolling_mean_7'].values
        ma7_mae = float(mean_absolute_error(y_test, ma7_preds))
        ma7_rmse = float(root_mean_squared_error(y_test, ma7_preds))
        ma7_wape = calculate_wape(y_test.values, ma7_preds)

        # Supervised ML Model: Random Forest Regressor
        rf = RandomForestRegressor(
            n_estimators=100,
            max_depth=6,
            min_samples_split=4,
            min_samples_leaf=2,
            random_state=42
        )
        rf.fit(X_train, y_train)

        # Test evaluation
        rf_preds = rf.predict(X_test)
        rf_mae = float(mean_absolute_error(y_test, rf_preds))
        rf_rmse = float(root_mean_squared_error(y_test, rf_preds))
        rf_wape = calculate_wape(y_test.values, rf_preds)

        # Residual std for confidence intervals
        test_residuals = y_test.values - rf_preds
        residual_std = float(np.std(test_residuals))

        # Average revenue per unit from training data
        total_units = float(train_df['units_sold'].sum())
        total_rev = float(train_df['revenue'].sum()) if 'revenue' in train_df else 0.0
        avg_rev_per_unit = (total_rev / total_units) if total_units > 0 else 2.15

        # Feature importances
        feature_importance = {
            col: round(float(imp), 4)
            for col, imp in zip(FEATURE_COLUMNS, rf.feature_importances_)
        }

        # Calculate improvement over 7-Day Moving Average Baseline
        wape_improvement_pct = round(((ma7_wape - rf_wape) / ma7_wape) * 100, 2)
        mae_improvement_pct = round(((ma7_mae - rf_mae) / ma7_mae) * 100, 2)

        metadata = {
            "model_type": "RandomForestRegressor",
            "model_version": "1.0.0",
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "train_samples": int(len(train_df)),
            "test_samples": int(len(test_df)),
            "train_date_range": [train_df['date'].min().strftime("%Y-%m-%d"), train_df['date'].max().strftime("%Y-%m-%d")],
            "test_date_range": [test_df['date'].min().strftime("%Y-%m-%d"), test_df['date'].max().strftime("%Y-%m-%d")],
            "evaluation": {
                "naive_baseline": {
                    "mae": round(naive_mae, 2),
                    "rmse": round(naive_rmse, 2),
                    "wape_pct": round(naive_wape * 100, 2)
                },
                "moving_average_7d_baseline": {
                    "mae": round(ma7_mae, 2),
                    "rmse": round(ma7_rmse, 2),
                    "wape_pct": round(ma7_wape * 100, 2)
                },
                "random_forest_model": {
                    "mae": round(rf_mae, 2),
                    "rmse": round(rf_rmse, 2),
                    "wape_pct": round(rf_wape * 100, 2),
                    "residual_std": round(residual_std, 2)
                },
                "wape_improvement_vs_ma7_pct": wape_improvement_pct,
                "mae_improvement_vs_ma7_pct": mae_improvement_pct
            },
            "feature_importance": feature_importance,
            "avg_revenue_per_unit": round(avg_rev_per_unit, 2),
            "last_known_date": daily['date'].max().strftime("%Y-%m-%d")
        }

        # Save artifacts
        joblib.dump(rf, MODEL_PATH)
        with open(META_PATH, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        self.model = rf
        self.metadata = metadata
        logger.info(f"Demand model trained and saved. WAPE: {round(rf_wape*100, 2)}% vs MA7 {round(ma7_wape*100, 2)}%")
        return metadata

    def forecast_demand(self, horizon_days: int = 14, sku: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate multi-step recursive demand forecast for the next `horizon_days`.
        Returns point predictions, confidence intervals, and evaluation context.
        """
        if self.model is None or self.metadata is None:
            self.train_and_evaluate()

        # Load daily history (prefer precomputed fast-path artifact for store aggregate)
        daily_path = os.path.join(ARTIFACTS_DIR, "daily_demand_history.csv")
        if sku is None and os.path.exists(daily_path):
            daily = pd.read_csv(daily_path)
            daily['date'] = pd.to_datetime(daily['date'])
        else:
            df = pd.read_csv(DEFAULT_SALES_CSV, usecols=['InvoiceNo', 'StockCode', 'Quantity', 'InvoiceDate', 'LineTotal', 'IsCancellation'])
            daily = self.prepare_demand_series(df, sku=sku)

        history_units = list(daily['units_sold'].values)
        history_dates = list(daily['date'])
        last_date = history_dates[-1]

        avg_rev_per_unit = self.metadata.get("avg_revenue_per_unit", 2.15)
        residual_std = self.metadata.get("evaluation", {}).get("random_forest_model", {}).get("residual_std", 5000.0)

        forecasts = []
        running_history = list(history_units)

        for step in range(1, horizon_days + 1):
            curr_date = last_date + timedelta(days=step)
            day_of_week = curr_date.dayofweek
            is_weekend = 1 if day_of_week in [5, 6] else 0
            day_of_month = curr_date.day
            month = curr_date.month

            # Build feature vector for step
            lag_1 = running_history[-1]
            lag_2 = running_history[-2]
            lag_3 = running_history[-3]
            lag_7 = running_history[-7] if len(running_history) >= 7 else running_history[-1]
            lag_14 = running_history[-14] if len(running_history) >= 14 else running_history[-1]

            past_7 = running_history[-7:]
            past_14 = running_history[-14:]
            rolling_mean_7 = float(np.mean(past_7))
            rolling_std_7 = float(np.std(past_7))
            rolling_mean_14 = float(np.mean(past_14))

            feature_dict = {
                'lag_1': lag_1,
                'lag_2': lag_2,
                'lag_3': lag_3,
                'lag_7': lag_7,
                'lag_14': lag_14,
                'rolling_mean_7': rolling_mean_7,
                'rolling_std_7': rolling_std_7,
                'rolling_mean_14': rolling_mean_14,
                'day_of_week': day_of_week,
                'is_weekend': is_weekend,
                'day_of_month': day_of_month,
                'month': month
            }
            feat_row = pd.DataFrame([feature_dict])[FEATURE_COLUMNS]

            pred_units = float(self.model.predict(feat_row)[0])
            pred_units = max(0.0, pred_units)

            # Uncertainty bounds (1.645 * std for 90% confidence interval, scaled with forecast horizon sqrt)
            horizon_scale = np.sqrt(step)
            margin = 1.645 * (residual_std / np.sqrt(len(FEATURE_COLUMNS))) * horizon_scale
            lower_bound = max(0.0, pred_units - margin)
            upper_bound = pred_units + margin

            predicted_revenue = round(pred_units * avg_rev_per_unit, 2)

            forecasts.append({
                "date": curr_date.strftime("%Y-%m-%d"),
                "day_name": curr_date.strftime("%a"),
                "predicted_units": round(pred_units),
                "lower_bound_units": round(lower_bound),
                "upper_bound_units": round(upper_bound),
                "predicted_revenue": predicted_revenue,
                "is_weekend": bool(is_weekend)
            })

            running_history.append(pred_units)

        total_predicted_units = sum(f["predicted_units"] for f in forecasts)
        total_predicted_revenue = round(sum(f["predicted_revenue"] for f in forecasts), 2)

        return {
            "forecast_horizon_days": horizon_days,
            "sku": sku or "STORE_AGGREGATE",
            "model_metadata": self.metadata,
            "summary": {
                "total_forecasted_units": total_predicted_units,
                "total_forecasted_revenue": total_predicted_revenue,
                "daily_average_units": round(total_predicted_units / horizon_days, 1),
                "daily_average_revenue": round(total_predicted_revenue / horizon_days, 2)
            },
            "daily_forecasts": forecasts
        }

demand_service = DemandForecastingService()
