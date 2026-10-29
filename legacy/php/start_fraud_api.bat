@echo off
REM Start Fraud Detection API Service

cd /d %~dp0

REM Install dependencies if needed
pip install -r fraud_api/requirements.txt -q

REM Start the service
python fraud_api/app.py