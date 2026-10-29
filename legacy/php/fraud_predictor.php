<?php
/**
 * Fraud Detection Predictor
 * Handles communication with Python Flask API for fraud prediction
 */

class FraudPredictor {
    private $api_url;
    private $timeout;
    private $last_response;
    private $last_error;
    
    /**
     * Constructor
     * 
     * @param string $api_url The URL of the Flask API
     * @param int $timeout Timeout in seconds
     */
    public function __construct($api_url = 'http://localhost:5000', $timeout = 5) {
        $this->api_url = $api_url;
        $this->timeout = $timeout;
        $this->last_response = null;
        $this->last_error = null;
    }
    
    /**
     * Check if the fraud detection service is available
     * 
     * @return bool
     */
    public function isServiceAvailable() {
        $url = $this->api_url . '/health';
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_setopt($ch, CURLOPT_NOBODY, true);
        
        $result = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        return $http_code === 200;
    }
    
    /**
     * Predict fraud for a single transaction
     * 
     * @param array $transaction_data Transaction features
     * @return array|false Prediction result or false on error
     */
    public function predict($transaction_data) {
        $url = $this->api_url . '/predict';
        
        $json_data = json_encode($transaction_data);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json_data);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($json_data)
        ]);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            $this->last_error = "CURL Error: " . $error;
            return false;
        }
        
        if ($http_code !== 200) {
            $this->last_error = "API returned HTTP code: " . $http_code;
            if ($response) {
                $error_data = json_decode($response, true);
                if (isset($error_data['error'])) {
                    $this->last_error .= " - " . $error_data['error'];
                }
            }
            return false;
        }
        
        $result = json_decode($response, true);
        
        if (!$result || !isset($result['status']) || $result['status'] !== 'success') {
            $this->last_error = "Invalid response from API";
            return false;
        }
        
        $this->last_response = $result;
        
        return $result;
    }
    
    /**
     * Predict fraud for multiple transactions
     * 
     * @param array $transactions Array of transaction data
     * @return array|false Batch prediction results
     */
    public function predictBatch($transactions) {
        $url = $this->api_url . '/predict_batch';
        
        $data = ['transactions' => $transactions];
        $json_data = json_encode($data);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json_data);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout * 2);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($json_data)
        ]);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            $this->last_error = "CURL Error: " . $error;
            return false;
        }
        
        if ($http_code !== 200) {
            $this->last_error = "API returned HTTP code: " . $http_code;
            return false;
        }
        
        $result = json_decode($response, true);
        
        if (!$result || !isset($result['status']) || $result['status'] !== 'success') {
            $this->last_error = "Invalid response from API";
            return false;
        }
        
        $this->last_response = $result;
        
        return $result;
    }
    
    /**
     * Get model information
     * 
     * @return array|false Model info or false on error
     */
    public function getModelInfo() {
        $url = $this->api_url . '/model_info';
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($http_code !== 200) {
            return false;
        }
        
        return json_decode($response, true);
    }
    
    /**
     * Get the last response
     * 
     * @return array|null
     */
    public function getLastResponse() {
        return $this->last_response;
    }
    
    /**
     * Get the last error
     * 
     * @return string|null
     */
    public function getLastError() {
        return $this->last_error;
    }
    
    /**
     * Build feature array from transaction data
     * 
     * @param array $transaction Transaction data from database
     * @param array $user_data User data
     * @param array $context Additional context
     * @return array Feature array for prediction
     */
    public function buildFeatures($transaction, $user_data, $context = []) {
        return [
            'amount' => floatval($transaction['amount'] ?? 0),
            'transaction_count_last_5min' => intval($context['transaction_count_last_5min'] ?? 0),
            'amount_last_5min' => floatval($context['amount_last_5min'] ?? 0),
            'unique_receivers_last_5min' => intval($context['unique_receivers_last_5min'] ?? 0),
            'unique_senders_last_5min' => intval($context['unique_senders_last_5min'] ?? 0),
            'failed_withdrawals_last_10min' => intval($context['failed_withdrawals_last_10min'] ?? 0),
            'transaction_hour' => intval(date('H', strtotime($transaction['created_at'] ?? 'now'))),
            'avg_user_amount' => floatval($user_data['avg_user_amount'] ?? $transaction['amount'] ?? 0),
            'amount_deviation' => $this->calculateAmountDeviation(
                $transaction['amount'] ?? 0,
                $user_data['avg_user_amount'] ?? 0
            ),
            'account_age_days' => $this->calculateAccountAge($user_data['created_at'] ?? null),
            'balance' => floatval($user_data['balance'] ?? 0)
        ];
    }
    
    /**
     * Calculate amount deviation
     * 
     * @param float $amount Transaction amount
     * @param float $avg_amount Average amount for user
     * @return float Deviation score
     */
    private function calculateAmountDeviation($amount, $avg_amount) {
        if ($avg_amount == 0) {
            return 0;
        }
        return ($amount - $avg_amount) / ($avg_amount + 1);
    }
    
    /**
     * Calculate account age in days
     * 
     * @param string|null $created_at Account creation date
     * @return int Age in days
     */
    private function calculateAccountAge($created_at) {
        if (empty($created_at)) {
            return 0;
        }
        
        try {
            $created = new DateTime($created_at);
            $now = new DateTime();
            $interval = $created->diff($now);
            return $interval->days;
        } catch (Exception $e) {
            return 0;
        }
    }
}