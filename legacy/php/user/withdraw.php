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
$user = $user_stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    session_destroy();
    header("Location: ../login.php");
    exit();
}

// Get available locations
$locations = getAvailableLocations();
$user_location = isset($_POST['location']) ? sanitizeInput($_POST['location']) : getUserLocation($user_id);

$message = '';
$error = '';
$transaction_blocked = false;

// Clean old failed attempts (24 hours old)
cleanOldFailedAttempts();

// Get current failed attempt count
$failed_attempts = getFailedAttemptDetails($user_id);
$failed_count = $failed_attempts['count'];

// ========== AJAX HANDLER FOR INCREMENTING COUNT ==========
if (isset($_POST['ajax_action']) && $_POST['ajax_action'] === 'increment_failed') {
    header('Content-Type: application/json');
    
    try {
        // Increment the failed attempt count
        incrementFailedAttempt($user_id);
        $new_count = getFailedAttemptCount($user_id);
        
        // Check if user is now blocked
        $is_blocked = $new_count >= 3;
        
        echo json_encode([
            'success' => true,
            'count' => $new_count,
            'blocked' => $is_blocked,
            'message' => $is_blocked ? 'User is now blocked' : 'Count incremented'
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $amount = floatval($_POST['amount']);
    $withdrawal_message = sanitizeInput($_POST['message'] ?? '');
    $location = sanitizeInput($_POST['location'] ?? getUserLocation($user_id));
    
    // ========== 1. CHECK IF USER IS BLOCKED ==========
    // Get the latest count (could have been updated by AJAX)
    $failed_count = getFailedAttemptCount($user_id);
    
    if ($failed_count >= 3) {
        error_log("BLOCKED: User $user_id has $failed_count consecutive failed withdrawal attempts");
        
        // Create a blocked transaction record
        $db->beginTransaction();
        try {
            $transaction_id = generateTransactionId();
            
            $insert_query = "INSERT INTO transactions (
                transaction_id, sender_id, sender_name, amount, transaction_type, 
                status, message, 
                fraud_score, fraud_prediction, risk_level,
                transaction_location, ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, 'withdrawal', 'ABORTED', ?, ?, ?, ?, ?, ?, ?, NOW())";
            
            $insert_stmt = $db->prepare($insert_query);
            $insert_stmt->execute([
                $transaction_id,
                $user_id,
                $user['full_name'],
                $amount,
                "BLOCKED: User has " . $failed_count . " consecutive failed withdrawal attempts | " . $withdrawal_message,
                95,
                'FRAUD',
                'HIGH',
                $location,
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null
            ]);
            
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            error_log("Failed to log blocked transaction: " . $e->getMessage());
        }
        
        // Show blocked message
        $error = "❌ WITHDRAWAL BLOCKED\n\n";
        $error .= "Your account has been temporarily blocked due to multiple consecutive failed withdrawal attempts.\n";
        $error .= "Please contact support if you believe this is a mistake.";
        $transaction_blocked = true;
        
        include 'partials/sidebar.php';
        ?>
        <div class="top-header">
            <div class="header-title">
                <h1>Withdraw Funds</h1>
                <p>Withdraw money from your account</p>
            </div>
            <div class="header-info">
                <div class="admin-profile">
                    <div class="admin-avatar">
                        <?php echo substr($user['full_name'], 0, 1); ?>
                    </div>
                    <div>
                        <strong><?php echo htmlspecialchars($user['full_name']); ?></strong>
                        <div style="font-size: 0.8rem; color: var(--text-light);">Processing withdrawal</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="form-container">
            <div class="blocked-transaction">
                <div class="title">🚫 WITHDRAWAL BLOCKED</div>
                <div class="reason">Your account has been temporarily blocked due to multiple consecutive failed withdrawal attempts.</div>
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
    
    // ========== 2. CHECK LOCATION CHANGE ==========
    $location_check = checkLocationRapidChange($user_id, $location);
    $location_fraud_score = getLocationFraudScore($user_id, $location);
    
    // ========== 3. VALIDATION ==========
    $errors = [];
    
    if ($amount <= 0) {
        $errors[] = "Amount must be greater than 0";
    }
    
    if ($amount < 1000) {
        $errors[] = "Minimum withdrawal amount is TSh 1,000";
    }
    
    $amount_exceeds_balance = ($amount > $user['balance']);
    
    if ($amount_exceeds_balance) {
        $errors[] = "Insufficient balance. Please try a lower amount.";
    }
    
    if (empty($errors)) {
        // ========== 4. FRAUD DETECTION ==========
        $context = [
            'transaction_count_last_5min' => getTransactionCountLast5Min($user_id),
            'amount_last_5min' => getAmountLast5Min($user_id),
            'unique_receivers_last_5min' => getUniqueReceiversLast5Min($user_id),
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
        $status = 'SUCCESS';
        $message_text = $withdrawal_message;
        
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
                        'avg_user_amount' => $user['avg_user_amount'] ?? getUserAvgAmount($user_id),
                        'balance' => $user['balance'],
                        'created_at' => $user['created_at']
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
        
        // ========== 5. RULE-BASED FRAUD DETECTION ==========
        if ($context['transaction_count_last_5min'] >= 3 && $context['amount_last_5min'] > 10000000) {
            $fraud_score = max($fraud_score, 85);
            $fraud_prediction = 'FRAUD';
            $risk_level = 'HIGH';
            $block_transaction = true;
            $block_reason = "Multiple large transactions detected in short period";
        }
        
        $current_hour = date('H');
        if ($current_hour < 6 && $amount > 1000000) {
            $fraud_score = max($fraud_score, 85);
            $fraud_prediction = 'FRAUD';
            $risk_level = 'HIGH';
            $block_transaction = true;
            $block_reason = "Abnormal withdrawal at unusual hour with large amount";
        }
        
        if ($location_fraud_score > 30 && $amount > 500000) {
            $fraud_score = max($fraud_score, 80);
            $fraud_prediction = 'FRAUD';
            $risk_level = 'HIGH';
            $block_transaction = true;
            $block_reason = "Suspicious location change with large withdrawal";
        }
        
        $balance_percentage = ($amount / $user['balance']) * 100;
        if ($balance_percentage > 90 && $amount > 1000000) {
            $fraud_score = max($fraud_score, 80);
            $fraud_prediction = 'FRAUD';
            $risk_level = 'HIGH';
            $block_transaction = true;
            $block_reason = "Attempting to withdraw more than 90% of balance";
        }
        
        if ($amount > 10000000) {
            $fraud_score = max($fraud_score, 90);
            $fraud_prediction = 'FRAUD';
            $risk_level = 'HIGH';
            $block_transaction = true;
            $block_reason = "Withdrawal amount exceeds security threshold";
        }
        
        if ($location_fraud_score > 0) {
            $fraud_score = min($fraud_score + $location_fraud_score, 100);
        }
        
        // ========== 6. HANDLE THE ATTEMPT ==========
        $db->beginTransaction();
        
        try {
            $transaction_id = generateTransactionId();
            
            if ($amount_exceeds_balance) {
                // FAILED ATTEMPT: Amount exceeds balance
                $status = 'ABORTED';
                $fraud_score = max($fraud_score, 50 + ($failed_count * 10));
                $fraud_prediction = 'PENDING';
                $risk_level = 'MEDIUM';
                $message_text = "FAILED: Insufficient balance (Attempt " . ($failed_count + 1) . ") | " . $withdrawal_message;
                
                // The count will be incremented by AJAX when user clicks OK on alert
                // So we don't increment here - it's done client-side
                
            } elseif ($block_transaction) {
                // Blocked by other fraud detection
                $status = 'ABORTED';
                $message_text = "BLOCKED: " . $block_reason . " | " . $withdrawal_message;
                
            } else {
                // SUCCESSFUL ATTEMPT: Valid amount within balance
                $status = 'SUCCESS';
                
                // RESET FAILED ATTEMPT COUNT
                resetFailedAttempts($user_id);
                
                // Deduct from user balance
                $deduct_query = "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?";
                $deduct_stmt = $db->prepare($deduct_query);
                $deduct_stmt->execute([$amount, $user_id, $amount]);
                
                if ($deduct_stmt->rowCount() == 0) {
                    throw new Exception("Failed to process withdrawal");
                }
                
                updateUserLocation($user_id, $location);
                $user['balance'] -= $amount;
                
                $message = "Withdrawal successful! You withdrew " . formatCurrency($amount);
                
                error_log("SUCCESSFUL WITHDRAWAL: User $user_id withdrew " . formatCurrency($amount) . " (Failed attempts reset)");
            }
            
            // Insert transaction record
            $insert_query = "INSERT INTO transactions (
                transaction_id, sender_id, sender_name, amount, transaction_type, 
                status, message, 
                fraud_score, fraud_prediction, risk_level, prediction_time, model_version,
                transaction_location, ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, 'withdrawal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
            
            $insert_stmt = $db->prepare($insert_query);
            $insert_stmt->execute([
                $transaction_id,
                $user_id,
                $user['full_name'],
                $amount,
                $status,
                $message_text,
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
            
            if ($amount_exceeds_balance) {
                $error = "Insufficient balance. Please try a lower amount.";
            } elseif ($block_transaction) {
                $error = "❌ Withdrawal BLOCKED due to fraud detection.\n\n";
                $error .= "Reason: " . $block_reason . "\n";
                $error .= "Risk Score: " . $fraud_score . "%\n";
                $error .= "Risk Level: " . $risk_level . "\n\n";
                $error .= "Please contact support if you believe this is a mistake.";
                $transaction_blocked = true;
            }
            
        } catch (Exception $e) {
            $db->rollBack();
            $error = "Withdrawal failed: " . $e->getMessage();
            error_log("Withdrawal failed: " . $e->getMessage());
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
</style>

<div class="top-header">
    <div class="header-title">
        <h1>Withdraw Funds</h1>
        <p>Withdraw money from your account</p>
    </div>
    <div class="header-info">
        <div class="admin-profile">
            <div class="admin-avatar">
                <?php echo substr($user['full_name'], 0, 1); ?>
            </div>
            <div>
                <strong><?php echo htmlspecialchars($user['full_name']); ?></strong>
                <div style="font-size: 0.8rem; color: var(--text-light);">Processing withdrawal</div>
            </div>
        </div>
    </div>
</div>

<div class="form-container">
    <?php if ($transaction_blocked): ?>
        <div class="blocked-transaction">
            <div class="title">🚫 WITHDRAWAL BLOCKED</div>
            <div class="reason">Your account has been temporarily blocked due to multiple consecutive failed withdrawal attempts.</div>
            <div class="details">
                <div><span class="label">Reason:</span> <?php echo nl2br(htmlspecialchars($error)); ?></div>
            </div>
            <div class="contact">📞 If you believe this is a mistake, please contact our support team.</div>
        </div>
    <?php endif; ?>
    
    <?php if ($message): ?>
        <div style="background: #d1fae5; color: #065f46; padding: 12px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
            ✅ <?php echo $message; ?>
        </div>
    <?php endif; ?>
    
    <?php if ($error && !$transaction_blocked): ?>
        <div id="errorMessageContainer" style="background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
            ❌ <?php echo nl2br(htmlspecialchars($error)); ?>
        </div>
    <?php endif; ?>
    
    <?php if (!$transaction_blocked): ?>
    <form id="withdrawForm" method="POST" action="" onsubmit="return validateWithdrawForm()">
        <div class="form-group">
            <label for="location">Withdrawal Location *</label>
            <select id="location" name="location" required>
                <?php foreach ($locations as $loc): ?>
                    <option value="<?php echo $loc; ?>" <?php echo $loc == $user_location ? 'selected' : ''; ?>>
                        <?php echo $loc; ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <small style="color: var(--text-light);">Select your current location</small>
        </div>
        
        <div class="form-group">
            <label for="amount">Withdrawal Amount (TSh) *</label>
            <input type="number" id="amount" name="amount" step="0.01" required 
                   placeholder="Enter amount to withdraw">
        </div>
        
        <div class="form-group">
            <label for="message">Reason/Reference (Optional)</label>
            <textarea id="message" name="message" rows="3" placeholder="Reason for withdrawal..."></textarea>
        </div>
        
        <div class="form-group">
            <button type="submit" class="btn btn-success">Confirm Withdrawal</button>
            <button type="reset" class="btn" style="background: var(--light-bg);" onclick="resetForm()">Reset</button>
        </div>
    </form>
    <?php endif; ?>
    
    <div class="info-box" style="margin-top: 20px; padding: 15px; background: var(--light-bg); border-radius: 8px;">
        <strong>🏧 Withdrawal Information:</strong><br>
        • Minimum withdrawal: TSh 1,000<br>
        • Funds will be deducted immediately from your balance<br>
        • Keep withdrawal receipts for your records
    </div>
</div>

<script>
// Current failed attempt count from server
let currentFailedCount = <?php echo $failed_count; ?>;

function incrementFailedCount() {
    return new Promise((resolve, reject) => {
        fetch('withdraw.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'ajax_action=increment_failed'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentFailedCount = data.count;
                console.log('Failed count updated to: ' + currentFailedCount);
                resolve(data);
            } else {
                reject(data.error);
            }
        })
        .catch(error => {
            reject(error);
        });
    });
}

function validateWithdrawForm() {
    const amount = parseFloat(document.getElementById('amount').value);
    const balance = <?php echo $user['balance']; ?>;
    
    if (isNaN(amount) || amount < 1000) {
        alert('Minimum withdrawal amount is TSh 1,000');
        document.getElementById('amount').focus();
        return false;
    }
    
    if (amount > balance) {
        // Show the alert
        alert('Insufficient balance. Please try a lower amount.');
        
        // After user clicks OK, increment the failed count via AJAX
        // This runs in the background before the form resubmits
        incrementFailedCount()
            .then((data) => {
                console.log('Count updated successfully');
                // If user is now blocked, show a message
                if (data.blocked) {
                    alert('Your account has been temporarily blocked due to multiple failed withdrawal attempts. Please contact support.');
                }
                // Reload the page to show updated state
                location.reload();
            })
            .catch((error) => {
                console.error('Failed to update count:', error);
                // Still reload to ensure consistency
                location.reload();
            });
        
        // Return false to prevent form submission
        return false;
    }
    
    // For valid amount, check if user is about to be blocked (if count is 2)
    if (currentFailedCount >= 2) {
        return confirm(`⚠️ Warning: You have ${currentFailedCount} previous failed attempts. If this withdrawal fails, your account may be blocked. Continue?`);
    }
    
    return confirm(`You are about to withdraw ${formatCurrency(amount)} from your account. Continue?`);
}

function formatCurrency(amount) {
    return 'TSh ' + amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function resetForm() {
    document.getElementById('amount').value = '';
    document.getElementById('message').value = '';
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