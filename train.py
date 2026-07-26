#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Re-train XGBoost model without deprecated parameters
Run: python train.py
"""

import os  # <-- THIS WAS MISSING
import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
import warnings
warnings.filterwarnings('ignore')

print("=" * 60)
print("  RETRAINING XGBOOST MODEL")
print("  Without deprecated parameters")
print("=" * 60)
print()

# Generate synthetic training data
print("📊 Generating synthetic training data...")
np.random.seed(42)
n_samples = 10000

# Generate features
data = {
    'amount': np.random.exponential(50000, n_samples) + 100,
    'transaction_count_last_5min': np.random.randint(0, 10, n_samples),
    'amount_last_5min': np.random.exponential(50000, n_samples) + 100,
    'unique_receivers_last_5min': np.random.randint(0, 5, n_samples),
    'unique_senders_last_5min': np.random.randint(0, 5, n_samples),
    'failed_withdrawals_last_10min': np.random.randint(0, 3, n_samples),
    'transaction_hour': np.random.randint(0, 24, n_samples),
    'avg_user_amount': np.random.exponential(50000, n_samples) + 100,
    'amount_deviation': np.random.normal(0, 5, n_samples),
    'account_age_days': np.random.randint(1, 1000, n_samples),
    'balance': np.random.exponential(50000, n_samples) + 100
}

df = pd.DataFrame(data)

# Generate target (fraud) with patterns
df['is_fraud'] = 0

# Pattern 1: Large transactions
df.loc[df['amount'] > 1000000, 'is_fraud'] = 1

# Pattern 2: Many transactions in 5min
df.loc[df['transaction_count_last_5min'] > 5, 'is_fraud'] = 1

# Pattern 3: Failed withdrawals
df.loc[df['failed_withdrawals_last_10min'] > 2, 'is_fraud'] = 1

# Pattern 4: Abnormal hour + large amount
df.loc[(df['transaction_hour'] < 6) & (df['amount'] > 500000), 'is_fraud'] = 1

# Add some random noise
random_fraud = np.random.choice(df.index, size=int(len(df) * 0.05), replace=False)
df.loc[random_fraud, 'is_fraud'] = 1

print(f"✅ Generated {n_samples:,} samples")
print(f"   Fraud rate: {df['is_fraud'].mean()*100:.2f}%")
print()

# Prepare features
feature_columns = [
    'amount', 'transaction_count_last_5min', 'amount_last_5min',
    'unique_receivers_last_5min', 'unique_senders_last_5min',
    'failed_withdrawals_last_10min', 'transaction_hour',
    'avg_user_amount', 'amount_deviation', 'account_age_days', 'balance'
]

X = df[feature_columns]
y = df['is_fraud']

print(f"📋 Features: {len(feature_columns)} features")
print(f"   {', '.join(feature_columns)}")
print()

# Train-test split
print("🔄 Splitting data...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Scale features
print("📊 Scaling features...")
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train model WITHOUT use_label_encoder
print("🤖 Training XGBoost model...")
print("   (This may take a few seconds)")
model = XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    eval_metric='logloss'
)

model.fit(X_train_scaled, y_train)

# Evaluate
y_pred = model.predict(X_test_scaled)
accuracy = (y_pred == y_test).mean()
print(f"✅ Model accuracy: {accuracy:.4f}")
print()

# Save model
print("💾 Saving model files...")

# Create models directory if it doesn't exist
os.makedirs('models', exist_ok=True)

# Save files
joblib.dump(model, 'models/fraud_model.pkl')
joblib.dump(feature_columns, 'models/feature_columns.pkl')
joblib.dump(scaler, 'models/scaler.pkl')

print("✅ Model saved successfully!")
print(f"   📍 {os.path.abspath('models/fraud_model.pkl')}")
print(f"   📍 {os.path.abspath('models/feature_columns.pkl')}")
print(f"   📍 {os.path.abspath('models/scaler.pkl')}")
print()

print("=" * 60)
print("  ✅ RETRAINING COMPLETE!")
print("=" * 60)
print()
print("Next steps:")
print("1. Restart the Flask API")
print("   python fraud_api/app.py")
print()
print("2. Test the API:")
print("   curl http://localhost:5000/health")