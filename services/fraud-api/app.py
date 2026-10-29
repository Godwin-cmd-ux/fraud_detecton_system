#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
FRAUD DETECTION API SERVICE
This service provides fraud prediction endpoints for the PHP application.
Run: python app.py
"""

import os
import sys
import json
import logging
import numpy as np
import pandas as pd
import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Model paths
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'fraud_model.pkl')
FEATURES_PATH = os.path.join(MODEL_DIR, 'feature_columns.pkl')
SCALER_PATH = os.path.join(MODEL_DIR, 'scaler.pkl')
VERSION_PATH = os.path.join(MODEL_DIR, 'model_version.json')

# Global variables for model
model = None
feature_columns = None
scaler = None
model_version = None
model_loaded = False

# Risk level mapping
def get_risk_level(score):
    """Convert risk score to risk level."""
    if score <= 30:
        return 'LOW'
    elif score <= 70:
        return 'MEDIUM'
    else:
        return 'HIGH'

# Risk level color
def get_risk_color(level):
    """Get color for risk level."""
    colors = {
        'LOW': '#10b981',    # Green
        'MEDIUM': '#f59e0b', # Yellow
        'HIGH': '#ef4444'    # Red
    }
    return colors.get(level, '#6b7280')

# Load model
def load_model():
    """Load the fraud detection model and artifacts."""
    global model, feature_columns, scaler, model_version, model_loaded
    
    try:
        logger.info("🔄 Loading fraud detection model...")
        
        # Check if model files exist
        if not os.path.exists(MODEL_PATH):
            logger.error(f"❌ Model file not found: {MODEL_PATH}")
            return False
        
        if not os.path.exists(FEATURES_PATH):
            logger.error(f"❌ Features file not found: {FEATURES_PATH}")
            return False
        
        if not os.path.exists(SCALER_PATH):
            logger.error(f"❌ Scaler file not found: {SCALER_PATH}")
            return False
        
        # Load model
        model = joblib.load(MODEL_PATH)
        logger.info("✅ Model loaded successfully")
        
        # Load feature columns
        feature_columns = joblib.load(FEATURES_PATH)
        logger.info(f"✅ Features loaded: {len(feature_columns)} features")
        
        # Load scaler
        scaler = joblib.load(SCALER_PATH)
        logger.info("✅ Scaler loaded successfully")
        
        # Load version info
        if os.path.exists(VERSION_PATH):
            with open(VERSION_PATH, 'r') as f:
                model_version = json.load(f)
            logger.info(f"✅ Model version: {model_version.get('model_version', 'unknown')}")
        
        model_loaded = True
        logger.info("✅ All models loaded successfully!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to load model: {str(e)}")
        logger.error(traceback.format_exc())
        return False

# Feature extraction function
def extract_features(transaction_data):
    """
    Extract features from transaction data for prediction.
    
    Expected input:
    {
        'amount': float,
        'transaction_count_last_5min': int,
        'amount_last_5min': float,
        'unique_receivers_last_5min': int,
        'unique_senders_last_5min': int,
        'failed_withdrawals_last_10min': int,
        'transaction_hour': int,
        'avg_user_amount': float,
        'amount_deviation': float,
        'account_age_days': int,
        'balance': float
    }
    """
    try:
        # Create feature vector
        features = []
        for col in feature_columns:
            value = transaction_data.get(col, 0)
            features.append(value)
        
        return np.array(features).reshape(1, -1)
        
    except Exception as e:
        logger.error(f"❌ Feature extraction failed: {str(e)}")
        raise

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model_loaded,
        'version': model_version.get('model_version', 'unknown') if model_version else 'unknown',
        'features': len(feature_columns) if feature_columns else 0
    })

# Predict endpoint
@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict fraud probability for a transaction.
    
    Expected POST body:
    {
        'amount': 150000,
        'transaction_count_last_5min': 1,
        'amount_last_5min': 150000,
        'unique_receivers_last_5min': 1,
        'unique_senders_last_5min': 1,
        'failed_withdrawals_last_10min': 0,
        'transaction_hour': 14,
        'avg_user_amount': 50000,
        'amount_deviation': 2.0,
        'account_age_days': 365,
        'balance': 500000
    }
    """
    if not model_loaded:
        return jsonify({
            'error': 'Model not loaded',
            'status': 'error'
        }), 503
    
    try:
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({
                'error': 'No data provided',
                'status': 'error'
            }), 400
        
        # Extract features
        feature_vector = extract_features(data)
        
        # Scale features
        feature_scaled = scaler.transform(feature_vector)
        
        # Make prediction
        prediction = model.predict(feature_scaled)[0]
        probability = model.predict_proba(feature_scaled)[0][1]
        
        # Calculate risk score (0-100)
        risk_score = int(round(probability * 100))
        
        # Determine risk level
        risk_level = get_risk_level(risk_score)
        
        # Prepare response
        response = {
            'status': 'success',
            'prediction': 'FRAUD' if prediction == 1 else 'LEGIT',
            'risk_score': risk_score,
            'risk_level': risk_level,
            'risk_color': get_risk_color(risk_level),
            'probability': float(probability),
            'prediction_time': datetime.now().isoformat(),
            'model_version': model_version.get('model_version', 'unknown') if model_version else 'unknown',
            'features_used': feature_columns
        }
        
        # Log prediction
        logger.info(f"📊 Prediction: {response['prediction']} | Risk Score: {risk_score} | Level: {risk_level}")
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"❌ Prediction failed: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

# Batch predict endpoint
@app.route('/predict_batch', methods=['POST'])
def predict_batch():
    """
    Batch predict fraud probability for multiple transactions.
    
    Expected POST body:
    {
        'transactions': [
            {...transaction 1...},
            {...transaction 2...}
        ]
    }
    """
    if not model_loaded:
        return jsonify({
            'error': 'Model not loaded',
            'status': 'error'
        }), 503
    
    try:
        data = request.get_json()
        
        if not data or 'transactions' not in data:
            return jsonify({
                'error': 'No transactions provided',
                'status': 'error'
            }), 400
        
        transactions = data['transactions']
        results = []
        
        for transaction in transactions:
            try:
                feature_vector = extract_features(transaction)
                feature_scaled = scaler.transform(feature_vector)
                prediction = model.predict(feature_scaled)[0]
                probability = model.predict_proba(feature_scaled)[0][1]
                risk_score = int(round(probability * 100))
                risk_level = get_risk_level(risk_score)
                
                results.append({
                    'prediction': 'FRAUD' if prediction == 1 else 'LEGIT',
                    'risk_score': risk_score,
                    'risk_level': risk_level,
                    'probability': float(probability),
                    'risk_color': get_risk_color(risk_level)
                })
            except Exception as e:
                results.append({
                    'error': str(e),
                    'prediction': 'ERROR'
                })
        
        return jsonify({
            'status': 'success',
            'results': results,
            'total': len(results)
        })
        
    except Exception as e:
        logger.error(f"❌ Batch prediction failed: {str(e)}")
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

# Model info endpoint
@app.route('/model_info', methods=['GET'])
def model_info():
    """Get model information."""
    return jsonify({
        'loaded': model_loaded,
        'version': model_version.get('model_version', 'unknown') if model_version else 'unknown',
        'features': feature_columns if feature_columns else [],
        'feature_count': len(feature_columns) if feature_columns else 0,
        'model_type': 'XGBoost',
        'training_date': model_version.get('training_date', 'unknown') if model_version else 'unknown'
    })

# Start the service
if __name__ == '__main__':
    # Load model on startup
    if load_model():
        logger.info("🚀 Starting Fraud Detection API Service...")
        logger.info("📍 http://localhost:5000")
        logger.info("📊 Endpoints:")
        logger.info("   GET  /health - Health check")
        logger.info("   POST /predict - Single prediction")
        logger.info("   POST /predict_batch - Batch prediction")
        logger.info("   GET  /model_info - Model information")
        app.run(host='0.0.0.0', port=5000, debug=False)
    else:
        logger.error("❌ Failed to load model. Service not started.")
        sys.exit(1)