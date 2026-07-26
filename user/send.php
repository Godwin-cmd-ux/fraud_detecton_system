<?php
require_once '../config/database.php';

// Check if user is logged in
if (!isUserLoggedIn()) {
    header("Location: ../login.php");
    exit();
}

$database = new Database();
$db = $database->getConnection();
$user_id = $_SESSION['user_id'];

// Get user data
$user_query = "SELECT * FROM users WHERE id = ? AND is_active = 1";
$user_stmt = $db->prepare($user_query);
$user_stmt->execute([$user_id]);
$sender = $user_stmt->fetch(PDO::FETCH_ASSOC);

if (!$sender) {
    session_destroy();
    header("Location: ../login.php");
    exit();
}

// Get all other users for dropdown
$users_query = "SELECT id, full_name, email, phone FROM users WHERE id != ? AND is_active = 1 AND is_approved = 1 ORDER BY full_name";
$users_stmt = $db->prepare($users_query);
$users_stmt->execute([$user_id]);
$users = $users_stmt->fetchAll(PDO::FETCH_ASSOC);

// Get available locations
$locations = getAvailableLocations();
$user_location = isset($_POST['location']) ? sanitizeInput($_POST['location']) : getUserLocation($user_id);

// ========== CHECK ALL PATTERNS ==========
// Pattern 1: Large Transaction Volume (3+ large transactions in 5 min)
$is_large_volume_blocked = isUserBlockedByLargeVolume($user_id);
$large_volume_stats = getLargeTransactionStats($user_id);

// Pattern 2: Many Receivers (4 allowed, 5th blocked)
$is_receiver_blocked = isUserBlockedByReceivers($user_id);
$receiver_stats = getReceiverStats($user_id);

// Pattern 3: Many Senders (3 allowed, 4th blocked)
$receiver_id = isset($_POST['receiver_id']) ? (int)$_POST['receiver_id'] : 0;
$is_sender_flood = false;
$sender_stats = ['unique_senders' => 0, 'total_transactions' => 0, 'total_amount' => 0];

if ($receiver_id > 0) {
    $is_sender_flood = isReceiverFlooded($receiver_id);
    $sender_stats = getSenderStats($receiver_id);
}

$message = '';
$error = '';
$fraud_warning = '';
$location_warning = '';
$transaction_blocked = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $receiver_id = (int)$_POST['receiver_id'];
    $amount = floatval($_POST['amount']);
    $transfer_message = sanitizeInput($_POST['message'] ?? '');
    $location = sanitizeInput($_POST['location'] ?? getUserLocation($user_id));
    
    // Refresh all stats
    $large_volume_stats = getLargeTransactionStats($user_id);
    $large_count = $large_volume_stats['large_count'];
    $large_amount = $large_volume_stats['total_amount'];
    
    // ========== 1. CHECK PATTERN 1: LARGE TRANSACTION VOLUME ==========
    // Check if this transaction would be large
    $is_large = ($amount > 1000000);
    
    // Calculate what the count would be after this transaction
    $new_large_count = $large_count;
    $new_large_amount = $large_amount;
    if ($is_large) {
        $new_large_count = $large_count + 1;
        $new_large_amount = $large_amount + $amount;
    }
    
    // BLOCK if this would make 3 or more large transactions with total > 10M
    if ($new_large_count >= 3 && $new_large_amount > 10000000) {
        error_log("BLOCKED: User $user_id would have $new_large_count large transactions totaling " . formatCurrency($new_large_amount) . " in 5 minutes");
        
        $receiver_name_query = "SELECT full_name FROM users WHERE id = ?";
        $receiver_name_stmt = $db->prepare($receiver_name_query);
        $receiver_name_stmt->execute([$receiver_id]);
        $receiver_name = $receiver_name_stmt->fetch(PDO::FETCH_ASSOC);
        
        $transaction_id = generateTransactionId();
        
        $insert_query = "INSERT INTO transactions (
            transaction_id, sender_id, receiver_id, sender_name, receiver_name, 
            amount, transaction_type, status, message, 
            fraud_score, fraud_prediction, risk_level,
            transaction_location, ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'transfer', 'ABORTED', ?, ?, ?, ?, ?, ?, ?, NOW())";
        
        $insert_stmt = $db->prepare($insert_query);
        $insert_stmt->execute([
            $transaction_id,
            $user_id,
            $receiver_id,
            $sender['full_name'],
            $receiver_name['full_name'] ?? 'Unknown',
            $amount,
            "BLOCKED: Large transaction volume - $new_large_count large transactions totaling " . formatCurrency($new_large_amount) . " in 5 minutes (max: 3, 10M) | " . $transfer_message,
            85,
            'FRAUD',
            'HIGH',
            $location,
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);
        
        $error = "❌ TRANSACTION BLOCKED\n\n";
        $error .= "You have made " . $new_large_count . " large transactions totaling " . formatCurrency($new_large_amount) . " in the last 5 minutes.\n";
        $error .= "Maximum allowed: 3 large transactions totaling 10,000,000 TSh per 5 minutes.\n\n";
        $error .= "Please wait a few minutes before sending again.";
        $transaction_blocked = true;
        
        include 'partials/sidebar.php';
        ?>
        <style>
            .blocked-transaction {
                background: #fee2e2;
                border-left: 4px solid #dc2626;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                animation: slideDown 0.5s ease;
            }
            .blocked-transaction .title {
                font-weight: 700;
                color: #991b1b;
                font-size: 1.2rem;
            }
            .blocked-transaction .reason {
                color: #7f1d1d;
                margin: 10px 0;
            }
            .blocked-transaction .details {
                background: white;
                padding: 15px;
                border-radius: 6px;
                margin: 10px 0;
                font-size: 0.9rem;
            }
            .blocked-transaction .details .label {
                font-weight: 600;
                color: var(--text-dark);
            }
            .blocked-transaction .contact {
                color: #7f1d1d;
                font-size: 0.9rem;
                margin-top: 10px;
            }
        </style>
        
        <div class="top-header">
            <div class="header-title">
                <h1>Send Money</h1>
                <p>Transfer funds to other users</p>
            </div>
            <div class="header-info">
                <div class="admin-profile">
                    <div class="admin-avatar">
                        <?php echo substr($sender['full_name'], 0, 1); ?>
                    </div>
                    <div>
                        <strong><?php echo htmlspecialchars($sender['full_name']); ?></strong>
                        <div style="font-size: 0.8rem; color: var(--text-light);">Making a transfer</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="form-container">
            <div class="blocked-transaction">
                <div class="title">🚫 TRANSACTION BLOCKED</div>
                <div class="reason">You have exceeded the large transaction limit in a 5-minute period.</div>
                <div class="details">
                    <div><span class="label">Reason:</span> <?php echo nl2br(htmlspecialchars($error)); ?></div>
                </div>
                <div class="contact">📞 If you believe this is a mistake, please contact our support team.</div>
            </div>
        </div>
        
        <?php include 'partials/sidebar_footer.php'; ?>
        <?php
        exit();
    }
    
    // ========== 2. CHECK PATTERN 2: MANY RECEIVERS ==========
    $unique_count = getUniqueReceiverCountLast5Min($user_id);
    
    $check_receiver_query = "SELECT COUNT(*) as count FROM transactions 
                             WHERE sender_id = ? AND receiver_id = ? 
                             AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)";
    $check_receiver_stmt = $db->prepare($check_receiver_query);
    $check_receiver_stmt->execute([$user_id, $receiver_id]);
    $check_receiver_result = $check_receiver_stmt->fetch(PDO::FETCH_ASSOC);
    $is_existing_receiver = $check_receiver_result['count'] > 0;
    
    $new_count = $unique_count;
    if (!$is_existing_receiver) {
        $new_count = $unique_count + 1;
    }
    
    if ($new_count >= 4) {
        error_log("BLOCKED: User $user_id would have $new_count unique receivers in 5 minutes (limit: 4)");
        
        $receiver_name_query = "SELECT full_name FROM users WHERE id = ?";
        $receiver_name_stmt = $db->prepare($receiver_name_query);
        $receiver_name_stmt->execute([$receiver_id]);
        $receiver_name = $receiver_name_stmt->fetch(PDO::FETCH_ASSOC);
        
        $transaction_id = generateTransactionId();
        
        $insert_query = "INSERT INTO transactions (
            transaction_id, sender_id, receiver_id, sender_name, receiver_name, 
            amount, transaction_type, status, message, 
            fraud_score, fraud_prediction, risk_level,
            transaction_location, ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'transfer', 'ABORTED', ?, ?, ?, ?, ?, ?, ?, NOW())";
        
        $insert_stmt = $db->prepare($insert_query);
        $insert_stmt->execute([
            $transaction_id,
            $user_id,
            $receiver_id,
            $sender['full_name'],
            $receiver_name['full_name'] ?? 'Unknown',
            $amount,
            "BLOCKED: User has " . $unique_count . " unique receivers in 5 minutes. Attempting to send to " . $new_count . " (max: 4) | " . $transfer_message,
            90,
            'FRAUD',
            'HIGH',
            $location,
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);
        
        $error = "❌ TRANSACTION BLOCKED\n\n";
        $error .= "You have sent money to " . $unique_count . " different recipients in the last 5 minutes.\n";
        $error .= "Maximum allowed: 4 recipients per 5 minutes.\n\n";
        $error .= "Please wait a few minutes before sending again.";
        $transaction_blocked = true;
        
        include 'partials/sidebar.php';
        ?>
        <div class="top-header">
            <div class="header-title">
                <h1>Send Money</h1>
                <p>Transfer funds to other users</p>
            </div>
            <div class="header-info">
                <div class="admin-profile">
                    <div class="admin-avatar">
                        <?php echo substr($sender['full_name'], 0, 1); ?>
                    </div>
                    <div>
                        <strong><?php echo htmlspecialchars($sender['full_name']); ?></strong>
                        <div style="font-size: 0.8rem; color: var(--text-light);">Making a transfer</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="form-container">
            <div class="blocked-transaction">
                <div class="title">🚫 TRANSACTION BLOCKED</div>
                <div class="reason">You have reached the maximum number of recipients allowed in a 5-minute period.</div>
                <div class="details">
                    <div><span class="label">Reason:</span> <?php echo nl2br(htmlspecialchars($error)); ?></div>
                </div>
                <div class="contact">📞 If you believe this is a mistake, please contact our support team.</div>
            </div>
        </div>
        
        <?php include 'partials/sidebar_footer.php'; ?>
        <?php
        exit();
    }
    
    // ========== 3. CHECK PATTERN 3: MANY SENDERS ==========
    $unique_sender_count = getUniqueSenderCountLast7Min($receiver_id);
    
    $check_sender_query = "SELECT COUNT(*) as count FROM transactions 
                           WHERE receiver_id = ? AND sender_id = ? 
                           AND created_at >= DATE_SUB(NOW(), INTERVAL 7 MINUTE)";
    $check_sender_stmt = $db->prepare($check_sender_query);
    $check_sender_stmt->execute([$receiver_id, $user_id]);
    $check_sender_result = $check_sender_stmt->fetch(PDO::FETCH_ASSOC);
    $is_existing_sender = $check_sender_result['count'] > 0;
    
    $new_sender_count = $unique_sender_count;
    if (!$is_existing_sender) {
        $new_sender_count = $unique_sender_count + 1;
    }
    
    if ($new_sender_count >= 3) {
        error_log("BLOCKED: Receiver $receiver_id would have $new_sender_count unique senders in 7 minutes (limit: 3)");
        
        $receiver_name_query = "SELECT full_name FROM users WHERE id = ?";
        $receiver_name_stmt = $db->prepare($receiver_name_query);
        $receiver_name_stmt->execute([$receiver_id]);
        $receiver_name = $receiver_name_stmt->fetch(PDO::FETCH_ASSOC);
        
        $transaction_id = generateTransactionId();
        
        $insert_query = "INSERT INTO transactions (
            transaction_id, sender_id, receiver_id, sender_name, receiver_name, 
            amount, transaction_type, status, message, 
            fraud_score, fraud_prediction, risk_level,
            transaction_location, ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'transfer', 'ABORTED', ?, ?, ?, ?, ?, ?, ?, NOW())";
        
        $insert_stmt = $db->prepare($insert_query);
        $insert_stmt->execute([
            $transaction_id,
            $user_id,
            $receiver_id,
            $sender['full_name'],
            $receiver_name['full_name'] ?? 'Unknown',
            $amount,
            "BLOCKED: Receiver has " . $unique_sender_count . " unique senders in 7 minutes. Attempting to receive from " . $new_sender_count . " (max: 3) | " . $transfer_message,
            90,
            'FRAUD',
            'HIGH',
            $location,
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);
        
        $error = "❌ TRANSACTION BLOCKED\n\n";
        $error .= "The recipient has received money from " . $unique_sender_count . " different senders in the last 7 minutes.\n";
        $error .= "Maximum allowed: 3 senders per 7 minutes.\n\n";
        $error .= "Please wait a few minutes before sending again.";
        $transaction_blocked = true;
        
        include 'partials/sidebar.php';
        ?>
        <div class="top-header">
            <div class="header-title">
                <h1>Send Money</h1>
                <p>Transfer funds to other users</p>
            </div>
            <div class="header-info">
                <div class="admin-profile">
                    <div class="admin-avatar">
                        <?php echo substr($sender['full_name'], 0, 1); ?>
                    </div>
                    <div>
                        <strong><?php echo htmlspecialchars($sender['full_name']); ?></strong>
                        <div style="font-size: 0.8rem; color: var(--text-light);">Making a transfer</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="form-container">
            <div class="blocked-transaction">
                <div class="title">🚫 TRANSACTION BLOCKED</div>
                <div class="reason">The recipient has received too many transactions from different senders in a 7-minute period.</div>
                <div class="details">
                    <div><span class="label">Reason:</span> <?php echo nl2br(htmlspecialchars($error)); ?></div>
                </div>
                <div class="contact">📞 If you believe this is a mistake, please contact our support team.</div>
            </div>
        </div>
        
        <?php include 'partials/sidebar_footer.php'; ?>
        <?php
        exit();
    }
    
    // ========== 4. CHECK LOCATION CHANGE ==========
    $location_check = checkLocationRapidChange($user_id, $location);
    if ($location_check['changed']) {
        $location_warning = "⚠️ Location changed from " . $location_check['previous_location'] . 
                           " to " . $location . " (" . $location_check['distance'] . " away) in " . 
                           $location_check['time_elapsed'] . " minutes";
    }
    $location_fraud_score = getLocationFraudScore($user_id, $location);
    
    // ========== 5. VALIDATION ==========
    $errors = [];
    
    if ($receiver_id <= 0) {
        $errors[] = "Please select a receiver";
    }
    
    if ($receiver_id == $user_id) {
        $errors[] = "You cannot send money to yourself";
    }
    
    if ($amount <= 0) {
        $errors[] = "Amount must be greater than 0";
    }
    
    if ($amount > $sender['balance']) {
        $errors[] = "Insufficient balance. Your balance is " . formatCurrency($sender['balance']);
    }
    
    $receiver_query = "SELECT * FROM users WHERE id = ? AND is_active = 1 AND is_approved = 1";
    $receiver_stmt = $db->prepare($receiver_query);
    $receiver_stmt->execute([$receiver_id]);
    $receiver = $receiver_stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$receiver) {
        $errors[] = "Invalid receiver selected";
    }
    
    if (empty($errors)) {
        // ========== 6. FRAUD DETECTION ==========
        $context = [
            'transaction_count_last_5min' => getTransactionCountLast5Min($user_id),
            'amount_last_5min' => getAmountLast5Min($user_id),
            'large_transaction_count' => getLargeTransactionCountLast5Min($user_id),
            'large_transaction_amount' => getLargeTransactionAmountLast5Min($user_id),
            'unique_receivers_last_5min' => getUniqueReceiverCountLast5Min($user_id),
            'unique_senders_last_5min' => getUniqueSendersLast5Min($user_id),
            'failed_withdrawals_last_10min' => getFailedWithdrawalsLast10Min($user_id)
        ];
        
        $fraud_score = 0;
        $fraud_prediction = 'LEGIT';
        $risk_level = 'LOW';
        $prediction_time = null;
        $model_version = '1.0.0';
        $block_transaction = false;
        $block_reason = '';
        
        // Try to load fraud predictor
        $fraud_predictor_loaded = false;
        $fraud_predictor = null;
        
        if (file_exists('../fraud_predictor.php')) {
            try {
                require_once '../fraud_predictor.php';
                $fraud_predictor = new FraudPredictor();
                if ($fraud_predictor->isServiceAvailable()) {
                    $fraud_predictor_loaded = true;
                }
            } catch (Exception $e) {
                error_log("Failed to load fraud predictor: " . $e->getMessage());
            }
        }
        
        if ($fraud_predictor_loaded && $fraud_predictor) {
            try {
                $features = $fraud_predictor->buildFeatures(
                    ['amount' => $amount, 'created_at' => date('Y-m-d H:i:s')],
                    [
                        'avg_user_amount' => $sender['avg_user_amount'] ?? getUserAvgAmount($user_id),
                        'balance' => $sender['balance'],
                        'created_at' => $sender['created_at']
                    ],
                    $context
                );
                
                $prediction = $fraud_predictor->predict($features);
                
                if ($prediction) {
                    $fraud_score = $prediction['risk_score'] ?? 0;
                    $fraud_prediction = $prediction['prediction'] ?? 'LEGIT';
                    $risk_level = $prediction['risk_level'] ?? 'LOW';
                    $prediction_time = $prediction['prediction_time'] ?? date('Y-m-d H:i:s');
                    $model_version = $prediction['model_version'] ?? '1.0.0';
                }
            } catch (Exception $e) {
                error_log("Fraud prediction failed: " . $e->getMessage());
            }
        }
        
        // ========== 7. RULE-BASED FRAUD DETECTION ==========
        // Pattern 4: Failed Withdrawals
        if ($context['failed_withdrawals_last_10min'] >= 3) {
            $fraud_score = max($fraud_score, 85);
            $fraud_prediction = 'FRAUD';
            $risk_level = 'HIGH';
            $block_transaction = true;
            $block_reason = "Multiple failed withdrawal attempts detected";
        }
        
        // Pattern 5: Abnormal Activity
        $current_hour = date('H');
        if ($current_hour < 6 && $amount > 1000000) {
            $fraud_score = max($fraud_score, 80);
            $fraud_prediction = 'FRAUD';
            $risk_level = 'HIGH';
            $block_transaction = true;
            $block_reason = "Abnormal transaction at unusual hour with large amount";
        }
        
        // Location change + large amount
        if ($location_fraud_score > 30 && $amount > 500000) {
            $fraud_score = max($fraud_score, 75);
            $fraud_prediction = 'FRAUD';
            $risk_level = 'HIGH';
            $block_transaction = true;
            $block_reason = "Suspicious location change with large transaction";
        }
        
        // Extremely large transaction
        if ($amount > 10000000) {
            $fraud_score = max($fraud_score, 90);
            $fraud_prediction = 'FRAUD';
            $risk_level = 'HIGH';
            $block_transaction = true;
            $block_reason = "Transaction amount exceeds security threshold";
        }
        
        if ($location_fraud_score > 0) {
            $fraud_score = min($fraud_score + $location_fraud_score, 100);
        }
        
        // ========== 8. PROCESS OR BLOCK TRANSACTION ==========
        $db->beginTransaction();
        
        try {
            $transaction_id = generateTransactionId();
            
            if ($block_transaction) {
                $status = 'ABORTED';
                
                $insert_query = "INSERT INTO transactions (
                    transaction_id, sender_id, receiver_id, sender_name, receiver_name, 
                    amount, transaction_type, status, message, 
                    fraud_score, fraud_prediction, risk_level, prediction_time, model_version,
                    transaction_location, ip_address, user_agent, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'transfer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
                
                $insert_stmt = $db->prepare($insert_query);
                $insert_stmt->execute([
                    $transaction_id,
                    $user_id,
                    $receiver_id,
                    $sender['full_name'],
                    $receiver['full_name'],
                    $amount,
                    $status,
                    "BLOCKED: " . $block_reason . " | " . $transfer_message,
                    $fraud_score,
                    $fraud_prediction,
                    $risk_level,
                    $prediction_time,
                    $model_version,
                    $location,
                    $_SERVER['REMOTE_ADDR'] ?? null,
                    $_SERVER['HTTP_USER_AGENT'] ?? null
                ]);
                
                $db->commit();
                
                $error = "❌ Transaction BLOCKED due to fraud detection.\n\n";
                $error .= "Reason: " . $block_reason . "\n";
                $error .= "Risk Score: " . $fraud_score . "%\n";
                $error .= "Risk Level: " . $risk_level . "\n\n";
                $error .= "Please contact support if you believe this is a mistake.";
                $transaction_blocked = true;
                
                error_log("TRANSACTION BLOCKED: User $user_id - " . $block_reason . " - Risk Score: $fraud_score%");
                
            } else {
                $status = 'SUCCESS';
                
                $deduct_query = "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?";
                $deduct_stmt = $db->prepare($deduct_query);
                $deduct_stmt->execute([$amount, $user_id, $amount]);
                
                if ($deduct_stmt->rowCount() == 0) {
                    throw new Exception("Failed to deduct balance");
                }
                
                $add_query = "UPDATE users SET balance = balance + ? WHERE id = ?";
                $add_stmt = $db->prepare($add_query);
                $add_stmt->execute([$amount, $receiver_id]);
                
                updateUserLocation($user_id, $location);
                
                $insert_query = "INSERT INTO transactions (
                    transaction_id, sender_id, receiver_id, sender_name, receiver_name, 
                    amount, transaction_type, status, message, 
                    fraud_score, fraud_prediction, risk_level, prediction_time, model_version,
                    transaction_location, ip_address, user_agent, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'transfer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
                
                $insert_stmt = $db->prepare($insert_query);
                $insert_stmt->execute([
                    $transaction_id,
                    $user_id,
                    $receiver_id,
                    $sender['full_name'],
                    $receiver['full_name'],
                    $amount,
                    $status,
                    $transfer_message,
                    $fraud_score,
                    $fraud_prediction,
                    $risk_level,
                    $prediction_time,
                    $model_version,
                    $location,
                    $_SERVER['REMOTE_ADDR'] ?? null,
                    $_SERVER['HTTP_USER_AGENT'] ?? null
                ]);
                
                logForAIAnalysis($transaction_id, [
                    'sender_id' => $user_id,
                    'receiver_id' => $receiver_id,
                    'amount' => $amount,
                    'location' => $location,
                    'location_change' => $location_check,
                    'fraud_score' => $fraud_score,
                    'fraud_prediction' => $fraud_prediction,
                    'risk_level' => $risk_level,
                    'context_features' => $context,
                    'timestamp' => date('Y-m-d H:i:s')
                ]);
                
                $db->commit();
                
                $message = "Transaction successful! You sent " . formatCurrency($amount) . " to " . htmlspecialchars($receiver['full_name']);
                
                if ($fraud_score > 40 && $fraud_score <= 70) {
                    $fraud_warning = "⚠️ This transaction was flagged for review. Please monitor your account.";
                }
                
                $sender['balance'] -= $amount;
            }
            
        } catch (Exception $e) {
            $db->rollBack();
            $error = "Transaction failed: " . $e->getMessage();
            error_log("Transaction failed: " . $e->getMessage());
        }
    } else {
        $error = implode("<br>", $errors);
    }
}

include 'partials/sidebar.php';
?>

<style>
    .blocked-transaction {
        background: #fee2e2;
        border-left: 4px solid #dc2626;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        animation: slideDown 0.5s ease;
    }
    .blocked-transaction .title {
        font-weight: 700;
        color: #991b1b;
        font-size: 1.2rem;
    }
    .blocked-transaction .reason {
        color: #7f1d1d;
        margin: 10px 0;
    }
    .blocked-transaction .details {
        background: white;
        padding: 15px;
        border-radius: 6px;
        margin: 10px 0;
        font-size: 0.9rem;
    }
    .blocked-transaction .details .label {
        font-weight: 600;
        color: var(--text-dark);
    }
    .blocked-transaction .contact {
        color: #7f1d1d;
        font-size: 0.9rem;
        margin-top: 10px;
    }
    .location-warning {
        background: #fee2e2;
        border-left: 4px solid #dc2626;
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
    }
    .location-warning .title {
        font-weight: 600;
        color: #991b1b;
    }
    .large-volume-warning {
        background: #fed7aa;
        border-left: 4px solid #f59e0b;
        padding: 12px;
        border-radius: 8px;
        margin: 10px 0;
        color: #92400e;
    }
    .info-box {
        background: var(--light-bg);
        padding: 15px;
        border-radius: 8px;
        margin-top: 20px;
    }
</style>

<div class="top-header">
    <div class="header-title">
        <h1>Send Money</h1>
        <p>Transfer funds to other users</p>
    </div>
    <div class="header-info">
        <div class="admin-profile">
            <div class="admin-avatar">
                <?php echo substr($sender['full_name'], 0, 1); ?>
            </div>
            <div>
                <strong><?php echo htmlspecialchars($sender['full_name']); ?></strong>
                <div style="font-size: 0.8rem; color: var(--text-light);">Making a transfer</div>
            </div>
        </div>
    </div>
</div>

<div class="form-container">
    <?php if ($transaction_blocked): ?>
        <div class="blocked-transaction">
            <div class="title">🚫 TRANSACTION BLOCKED</div>
            <div class="reason">This transaction was blocked by our fraud detection system.</div>
            <div class="details">
                <div><span class="label">Reason:</span> <?php echo nl2br(htmlspecialchars($error)); ?></div>
            </div>
            <div class="contact">📞 If you believe this is a mistake, please contact our support team.</div>
        </div>
    <?php endif; ?>
    
    <?php if ($message): ?>
        <div style="background: #d1fae5; color: #065f46; padding: 12px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
            ✅ <?php echo $message; ?>
            <?php if ($fraud_warning): ?>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(6, 95, 70, 0.2);">
                    <?php echo $fraud_warning; ?>
                </div>
            <?php endif; ?>
        </div>
    <?php endif; ?>
    
    <?php if ($error && !$transaction_blocked): ?>
        <div style="background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
            ❌ <?php echo nl2br(htmlspecialchars($error)); ?>
        </div>
    <?php endif; ?>
    
    <?php if ($location_warning): ?>
        <div class="location-warning">
            <div class="title">🚨 Location Change Detected</div>
            <div style="color: #7f1d1d; font-size: 0.9rem; margin-top: 5px;">
                <?php echo $location_warning; ?>
            </div>
        </div>
    <?php endif; ?>
    
    <?php if ($large_volume_stats['large_count'] >= 2 && !$is_large_volume_blocked): ?>
        <div class="large-volume-warning">
            ⚠️ You have made <strong><?php echo $large_volume_stats['large_count']; ?></strong> large transactions (>1M TSh) 
            totaling <strong><?php echo formatCurrency($large_volume_stats['total_amount']); ?></strong> in the last 5 minutes.
            <strong>Limit is 3 transactions totaling 10,000,000 TSh.</strong>
        </div>
    <?php endif; ?>
    
    <?php if (!$transaction_blocked): ?>
    <form method="POST" action="" onsubmit="return validateSendForm()">
        <div class="form-group">
            <label for="receiver_id">Select Receiver *</label>
            <select id="receiver_id" name="receiver_id" required>
                <option value="">-- Select a user --</option>
                <?php foreach ($users as $user): ?>
                    <option value="<?php echo $user['id']; ?>">
                        <?php echo htmlspecialchars($user['full_name']); ?> - <?php echo htmlspecialchars($user['email']); ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        
        <div class="form-group">
            <label for="location">Transaction Location *</label>
            <select id="location" name="location" required>
                <?php foreach ($locations as $loc): ?>
                    <option value="<?php echo $loc; ?>" <?php echo $loc == $user_location ? 'selected' : ''; ?>>
                        <?php echo $loc; ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <small style="color: var(--text-light);">Select your current location for fraud detection</small>
        </div>
        
        <div class="form-group">
            <label for="amount">Amount (TSh) *</label>
            <input type="number" id="amount" name="amount" step="0.01" required 
                   placeholder="Enter amount in Tanzanian Shillings">
        </div>
        
        <div class="form-group">
            <label for="message">Message (Optional)</label>
            <textarea id="message" name="message" rows="3" placeholder="Add a reference or note..."></textarea>
        </div>
        
        <div class="form-group">
            <button type="submit" class="btn btn-primary">Send Money</button>
            <button type="reset" class="btn" style="background: var(--light-bg);" onclick="resetForm()">Reset</button>
        </div>
    </form>
    <?php endif; ?>
    
   
</div>

<script>
function validateSendForm() {
    const receiver = document.getElementById('receiver_id').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const balance = <?php echo $sender['balance']; ?>;
    const receiverCount = <?php echo $receiver_stats['unique_receivers']; ?>;
    const senderCount = <?php echo $sender_stats['unique_senders']; ?>;
    const largeCount = <?php echo $large_volume_stats['large_count']; ?>;
    const largeAmount = <?php echo $large_volume_stats['total_amount']; ?>;
    const isLarge = amount > 1000000;
    
    if (!receiver) {
        alert('Please select a receiver');
        document.getElementById('receiver_id').focus();
        return false;
    }
    
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount greater than 0');
        document.getElementById('amount').focus();
        return false;
    }
    
    if (amount > balance) {
        alert('Insufficient balance. Your balance is ' + formatCurrency(balance));
        document.getElementById('amount').focus();
        return false;
    }
    
    // Check Pattern 1: Large Transaction Volume
    if (isLarge) {
        const newLargeCount = largeCount + 1;
        const newLargeAmount = largeAmount + amount;
        
        if (newLargeCount >= 3 && newLargeAmount > 10000000) {
            alert('❌ You have reached the maximum of 3 large transactions totaling 10,000,000 TSh in 5 minutes. This transaction will be BLOCKED.');
            return false;
        }
        
        if (largeCount >= 2) {
            if (!confirm(`⚠️ You have made ${largeCount} large transactions totaling ${formatCurrency(largeAmount)} in the last 5 minutes.\nThis transaction will make ${newLargeCount} transactions totaling ${formatCurrency(newLargeAmount)}.\nIf this exceeds 3 transactions or 10,000,000 TSh, it will be BLOCKED. Continue?`)) {
                return false;
            }
        }
    }
    
    // Check Pattern 2: Many Receivers
    if (receiverCount >= 3) {
        if (receiverCount >= 4) {
            alert('❌ You have reached the maximum of 4 recipients in 5 minutes. This transaction will be BLOCKED.');
            return false;
        }
        if (!confirm(`⚠️ You have sent to ${receiverCount} recipients in the last 5 minutes.\nSending to another recipient will result in your account being blocked. Continue?`)) {
            return false;
        }
    }
    
    // Check Pattern 3: Many Senders
    if (senderCount >= 2) {
        if (senderCount >= 3) {
            alert('❌ The recipient has reached the maximum of 3 senders in 7 minutes. This transaction will be BLOCKED.');
            return false;
        }
        if (!confirm(`⚠️ The recipient has received from ${senderCount} different senders in the last 7 minutes.\nSending to this recipient will result in the account being blocked. Continue?`)) {
            return false;
        }
    }
    
    return confirm(`You are about to send ${formatCurrency(amount)} to the selected recipient. Continue?`);
}

function formatCurrency(amount) {
    return 'TSh ' + amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function resetForm() {
    document.getElementById('amount').value = '';
    document.getElementById('message').value = '';
    document.getElementById('receiver_id').value = '';
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Africa/Dar_es_Salaam'
    });
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = timeString + ' (EAT)';
    }
}
updateTime();
setInterval(updateTime, 1000);
</script>

<?php include 'partials/sidebar_footer.php'; ?>