"""
OpsMind Machine Learning Model Training CLI
Executes training, baseline benchmarking, and artifact generation for all ML models.

Usage:
    python train_all.py                  # Train and evaluate all 4 models
    python train_all.py --model demand   # Train only demand forecaster
    python train_all.py --model expense  # Train only expense anomaly detector
    python train_all.py --model sales    # Train only sales anomaly detector
    python train_all.py --model churn    # Train only customer churn predictor
"""

import os
import sys
import time
import argparse

# Ensure src is in python path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from src.services.forecasting import demand_service
from src.services.anomaly_detector import anomaly_service
from src.services.customer_churn import customer_churn_service
from src.services.inventory_risk import inventory_risk_service

def train_demand():
    print("\n" + "=" * 60)
    print(" [1/4] TRAINING DEMAND FORECASTING MODEL")
    print("=" * 60)
    t0 = time.time()
    meta = demand_service.train_and_evaluate()
    elapsed = time.time() - t0

    eval_data = meta["evaluation"]
    print(f"  Status: SUCCESS ({elapsed:.2f}s)")
    print(f"  Algorithm: {meta['model_type']}")
    print(f"  Training Split: {meta['train_samples']} train days, {meta['test_samples']} test days (chronological)")
    print(f"  Naive Baseline WAPE:      {eval_data['naive_baseline']['wape_pct']}%")
    print(f"  7-Day MA Baseline WAPE:   {eval_data['moving_average_7d_baseline']['wape_pct']}%")
    print(f"  Random Forest Model WAPE: {eval_data['random_forest_model']['wape_pct']}%")
    print(f"  --> WAPE Improvement vs MA7: +{eval_data['wape_improvement_vs_ma7_pct']}%")
    print(f"  Artifact: src/models/artifacts/demand_forecast.joblib")
    return meta

def train_expense_anomaly():
    print("\n" + "=" * 60)
    print(" [2/4] TRAINING EXPENSE ANOMALY DETECTOR")
    print("=" * 60)
    t0 = time.time()
    meta = anomaly_service.train_expense_detector()
    elapsed = time.time() - t0

    print(f"  Status: SUCCESS ({elapsed:.2f}s)")
    print(f"  Algorithm: {meta['model_type']}")
    print(f"  Samples Evaluated: {meta['total_samples']} expense records")
    print(f"  Contamination Rate: {meta['contamination_rate'] * 100}%")
    print(f"  Flagged Anomalies: {meta['anomalies_detected']}")
    print(f"  Categories Profiled: {len(meta['category_statistical_baselines'])} categories")
    print(f"  Artifact: src/models/artifacts/expense_isolation_forest.joblib")
    return meta

def train_sales_anomaly():
    print("\n" + "=" * 60)
    print(" [3/4] TRAINING SALES ANOMALY DETECTOR")
    print("=" * 60)
    t0 = time.time()
    meta = anomaly_service.train_sales_detector()
    elapsed = time.time() - t0

    print(f"  Status: SUCCESS ({elapsed:.2f}s)")
    print(f"  Algorithm: {meta['model_type']}")
    print(f"  Stratified Train Samples: {meta['samples_trained']} transactions")
    print(f"  Contamination Rate: {meta['contamination_rate'] * 100}%")
    print(f"  Artifact: src/models/artifacts/sales_isolation_forest.joblib")
    return meta

def train_churn():
    print("\n" + "=" * 60)
    print(" [4/4] TRAINING CUSTOMER INACTIVITY & CHURN MODEL")
    print("=" * 60)
    t0 = time.time()
    meta = customer_churn_service.train_and_evaluate()
    elapsed = time.time() - t0

    eval_data = meta["evaluation"]
    print(f"  Status: SUCCESS ({elapsed:.2f}s)")
    print(f"  Algorithm: {meta['model_type']}")
    print(f"  Temporal Split: Observation strictly < {meta['observation_cutoff_date']} (no data leakage)")
    print(f"  Train/Test Sizes: {meta['train_samples']} train / {meta['test_samples']} test customers")
    print(f"  Baseline 60d Recency ROC-AUC: {eval_data['recency_60d_heuristic_baseline']['roc_auc']}")
    print(f"  Random Forest ROC-AUC:        {eval_data['random_forest_model']['roc_auc']}")
    print(f"  --> ROC-AUC Lift over Baseline: +{eval_data['auc_lift_vs_baseline_pct']}%")
    print(f"  Top Features: {meta['feature_importance']}")
    print(f"  Artifact: src/models/artifacts/churn_model.joblib")
    return meta

def main():
    parser = argparse.ArgumentParser(description="OpsMind ML Training CLI")
    parser.add_argument(
        "--model",
        type=str,
        default="all",
        choices=["all", "demand", "expense", "sales", "churn"],
        help="Specify which model to train (default: all)"
    )
    args = parser.parse_args()

    print("\n" + "#" * 60)
    print("       OPSMIND MACHINE LEARNING TRAINING PIPELINE")
    print("#" * 60)
    start_time = time.time()

    if args.model in ["all", "demand"]:
        train_demand()
    if args.model in ["all", "expense"]:
        train_expense_anomaly()
    if args.model in ["all", "sales"]:
        train_sales_anomaly()
    if args.model in ["all", "churn"]:
        train_churn()

    total_time = time.time() - start_time
    print("\n" + "#" * 60)
    print(f"  ALL MODELS TRAINED & EVALUATED IN {total_time:.2f} SECONDS")
    print("  Models are ready and active in ml_service/src/models/artifacts/")
    print("#" * 60 + "\n")

if __name__ == "__main__":
    main()
