<?php
require_once '../config/database.php';
redirectIfNotAdmin();

$database = new Database();
$db = $database->getConnection();

$transaction_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

$query = "SELECT t.*, 
          sender.full_name as sender_name, sender.email as sender_email, sender.phone as sender_phone, sender.balance as sender_balance,
          receiver.full_name as receiver_name, receiver.email as receiver_email, receiver.phone as receiver_phone, receiver.balance as receiver_balance
          FROM transactions t
          LEFT JOIN users sender ON t.sender_id = sender.id
          LEFT JOIN users receiver ON t.receiver_id = receiver.id
          WHERE t.id = ?";

$stmt = $db->prepare($query);
$stmt->execute([$transaction_id]);
$transaction = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$transaction) {
    header("Location: transactions.php");
    exit();
}

include 'partials/sidebar.php';
?>

<style>
    .detail-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .detail-card h4 {
        margin-top: 0;
        margin-bottom: 15px;
        color: var(--text-dark);
        border-bottom: 2px solid var(--border-color);
        padding-bottom: 10px;
    }
    .detail-item {
        display: flex;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid var(--border-color);
    }
    .detail-item:last-child {
        border-bottom: none;
    }
    .detail-label {
        font-weight: 600;
        color: var(--text-light);
    }
    .detail-value {
        font-weight: 500;
        color: var(--text-dark);
    }
    .risk-meter {
        width: 100%;
        height: 20px;
        background: #e5e7eb;
        border-radius: 10px;
        overflow: hidden;
        margin: 10px 0;
        position: relative;
    }
    .risk-meter .fill {
        height: 100%;
        border-radius: 10px;
        transition: width 0.6s ease;
    }
    .risk-meter .labels {
        display: flex;
        justify-content: space-between;
        font-size: 0.7rem;
        color: var(--text-light);
        margin-top: 5px;
    }
    .risk-level-badge {
        display: inline-block;
        padding: 6px 16px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 0.9rem;
    }
    .risk-high { background: #fee2e2; color: #991b1b; }
    .risk-medium { background: #fed7aa; color: #92400e; }
    .risk-low { background: #d1fae5; color: #065f46; }
    .risk-pending { background: #e0f2fe; color: #075985; }
    .fraud-badge {
        display: inline-block;
        padding: 6px 16px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 0.9rem;
    }
    .fraud-yes { background: #fee2e2; color: #991b1b; }
    .fraud-no { background: #d1fae5; color: #065f46; }
    .fraud-pending { background: #e0f2fe; color: #075985; }
    .feature-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
    }
    .feature-item {
        background: var(--light-bg);
        padding: 10px 15px;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .feature-item .label {
        font-size: 0.8rem;
        color: var(--text-light);
    }
    .feature-item .value {
        font-weight: 600;
        color: var(--text-dark);
    }
    .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    .status-success { background: #d1fae5; color: #065f46; }
    .status-aborted { background: #fee2e2; color: #991b1b; }
    .status-pending { background: #e0f2fe; color: #075985; }
    @media (max-width: 768px) {
        .feature-grid {
            grid-template-columns: 1fr;
        }
        .detail-item {
            flex-direction: column;
            gap: 5px;
        }
    }
</style>

<div class="top-header">
    <div class="header-title">
        <h1>Transaction Details</h1>
        <p>View complete transaction information with fraud analysis</p>
    </div>
    <div class="header-info">
        <div class="admin-profile">
            <div class="admin-avatar">
                <?php echo substr($_SESSION['admin_name'] ?? 'A', 0, 1); ?>
            </div>
            <div>
                <strong><?php echo htmlspecialchars($_SESSION['admin_name'] ?? 'Administrator'); ?></strong>
                <div class="current-time" id="currentTime"></div>
            </div>
        </div>
    </div>
</div>

<!-- Transaction Information -->
<div class="detail-card">
    <h4>📋 Transaction Information</h4>
    <div class="detail-item">
        <span class="detail-label">Transaction ID</span>
        <span class="detail-value"><strong><?php echo htmlspecialchars($transaction['transaction_id']); ?></strong></span>
    </div>
    <div class="detail-item">
        <span class="detail-label">Status</span>
        <span class="detail-value">
            <span class="status-badge status-<?php echo strtolower($transaction['status']); ?>">
                <?php echo $transaction['status']; ?>
            </span>
        </span>
    </div>
    <div class="detail-item">
        <span class="detail-label">Transaction Type</span>
        <span class="detail-value"><?php echo ucfirst($transaction['transaction_type']); ?></span>
    </div>
    <div class="detail-item">
        <span class="detail-label">Amount</span>
        <span class="detail-value" style="font-size: 1.2rem; font-weight: bold; color: var(--primary-blue);">
            TSh <?php echo number_format($transaction['amount'], 2); ?>
        </span>
    </div>
    <div class="detail-item">
        <span class="detail-label">Date & Time</span>
        <span class="detail-value"><?php echo date('F j, Y, g:i a', strtotime($transaction['created_at'])); ?></span>
    </div>
    <?php if ($transaction['message']): ?>
    <div class="detail-item">
        <span class="detail-label">Message</span>
        <span class="detail-value"><?php echo htmlspecialchars($transaction['message']); ?></span>
    </div>
    <?php endif; ?>
</div>

<!-- Party Information -->
<div class="detail-card">
    <h4>👤 Party Information</h4>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
            <h5 style="margin: 0 0 10px 0; color: var(--text-dark);">Sender</h5>
            <div class="detail-item">
                <span class="detail-label">Name</span>
                <span class="detail-value"><strong><?php echo htmlspecialchars($transaction['sender_name'] ?? 'System'); ?></strong></span>
            </div>
            <?php if ($transaction['sender_email']): ?>
            <div class="detail-item">
                <span class="detail-label">Email</span>
                <span class="detail-value"><?php echo htmlspecialchars($transaction['sender_email']); ?></span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Phone</span>
                <span class="detail-value"><?php echo htmlspecialchars($transaction['sender_phone']); ?></span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Balance</span>
                <span class="detail-value">TSh <?php echo number_format($transaction['sender_balance'] ?? 0, 2); ?></span>
            </div>
            <?php endif; ?>
        </div>
        <div>
            <h5 style="margin: 0 0 10px 0; color: var(--text-dark);">Receiver</h5>
            <div class="detail-item">
                <span class="detail-label">Name</span>
                <span class="detail-value"><strong><?php echo htmlspecialchars($transaction['receiver_name'] ?? 'System'); ?></strong></span>
            </div>
            <?php if ($transaction['receiver_email']): ?>
            <div class="detail-item">
                <span class="detail-label">Email</span>
                <span class="detail-value"><?php echo htmlspecialchars($transaction['receiver_email']); ?></span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Phone</span>
                <span class="detail-value"><?php echo htmlspecialchars($transaction['receiver_phone']); ?></span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Balance</span>
                <span class="detail-value">TSh <?php echo number_format($transaction['receiver_balance'] ?? 0, 2); ?></span>
            </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<!-- Fraud Detection Analysis -->
<?php if (!empty($transaction['fraud_score']) && $transaction['fraud_score'] > 0): ?>
<div class="detail-card" style="border-left: 4px solid <?php echo $transaction['fraud_score'] > 70 ? '#ef4444' : ($transaction['fraud_score'] > 40 ? '#f59e0b' : '#10b981'); ?>;">
    <h4>🛡️ Fraud Detection Analysis</h4>
    
    <!-- Risk Overview -->
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
        <div style="text-align: center; padding: 15px; background: var(--light-bg); border-radius: 8px;">
            <div style="font-size: 0.8rem; color: var(--text-light);">Risk Score</div>
            <div style="font-size: 2rem; font-weight: bold; color: <?php echo $transaction['fraud_score'] > 70 ? '#ef4444' : ($transaction['fraud_score'] > 40 ? '#f59e0b' : '#10b981'); ?>;">
                <?php echo $transaction['fraud_score']; ?>%
            </div>
        </div>
        <div style="text-align: center; padding: 15px; background: var(--light-bg); border-radius: 8px;">
            <div style="font-size: 0.8rem; color: var(--text-light);">Prediction</div>
            <div style="font-size: 1.2rem; font-weight: bold; margin-top: 5px;">
                <span class="fraud-badge <?php echo $transaction['fraud_prediction'] == 'FRAUD' ? 'fraud-yes' : ($transaction['fraud_prediction'] == 'LEGIT' ? 'fraud-no' : 'fraud-pending'); ?>">
                    <?php echo $transaction['fraud_prediction'] ?? 'PENDING'; ?>
                </span>
            </div>
        </div>
        <div style="text-align: center; padding: 15px; background: var(--light-bg); border-radius: 8px;">
            <div style="font-size: 0.8rem; color: var(--text-light);">Risk Level</div>
            <div style="font-size: 1.2rem; font-weight: bold; margin-top: 5px;">
                <span class="risk-level-badge risk-<?php echo strtolower($transaction['risk_level'] ?? 'pending'); ?>">
                    <?php echo $transaction['risk_level'] ?? 'PENDING'; ?>
                </span>
            </div>
        </div>
    </div>
    
    <!-- Risk Meter -->
    <div style="margin: 20px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-light); margin-bottom: 5px;">
            <span>Low Risk</span>
            <span>Medium Risk</span>
            <span>High Risk</span>
        </div>
        <div class="risk-meter">
            <div class="fill" style="width: <?php echo $transaction['fraud_score']; ?>%; background: <?php echo $transaction['fraud_score'] > 70 ? '#ef4444' : ($transaction['fraud_score'] > 40 ? '#f59e0b' : '#10b981'); ?>;"></div>
        </div>
        <div class="labels">
            <span>0%</span>
            <span>30%</span>
            <span>70%</span>
            <span>100%</span>
        </div>
    </div>
    
    <!-- Model Information -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
        <div class="feature-item">
            <span class="label">Model Version</span>
            <span class="value"><?php echo htmlspecialchars($transaction['model_version'] ?? '1.0.0'); ?></span>
        </div>
        <div class="feature-item">
            <span class="label">Prediction Time</span>
            <span class="value"><?php echo $transaction['prediction_time'] ? date('Y-m-d H:i:s', strtotime($transaction['prediction_time'])) : 'N/A'; ?></span>
        </div>
    </div>
    
    <!-- Feature Importance -->
    <h5 style="margin: 20px 0 10px 0; color: var(--text-dark);">🔍 Key Features Analyzed</h5>
    <div class="feature-grid">
        <?php
        // Calculate feature values from transaction data
        $features = [
            'Amount' => number_format($transaction['amount'], 2),
            'Transaction Hour' => date('H:00', strtotime($transaction['created_at'])),
            'Sender Balance' => number_format($transaction['sender_balance'] ?? 0, 2),
            'Receiver Balance' => number_format($transaction['receiver_balance'] ?? 0, 2)
        ];
        
        // Add additional features if available in context
        if (!empty($transaction['feature_data'])) {
            $feature_data = json_decode($transaction['feature_data'], true);
            if ($feature_data) {
                $features['Transaction Count (Last 5min)'] = $feature_data['transaction_count_last_5min'] ?? 'N/A';
                $features['Amount (Last 5min)'] = isset($feature_data['amount_last_5min']) ? number_format($feature_data['amount_last_5min'], 2) : 'N/A';
                $features['Unique Receivers'] = $feature_data['unique_receivers_last_5min'] ?? 'N/A';
                $features['Unique Senders'] = $feature_data['unique_senders_last_5min'] ?? 'N/A';
                $features['Failed Withdrawals'] = $feature_data['failed_withdrawals_last_10min'] ?? 'N/A';
                $features['Amount Deviation'] = $feature_data['amount_deviation'] ?? 'N/A';
                $features['Account Age (Days)'] = $feature_data['account_age_days'] ?? 'N/A';
            }
        }
        ?>
        
        <?php foreach ($features as $label => $value): ?>
        <div class="feature-item">
            <span class="label"><?php echo htmlspecialchars($label); ?></span>
            <span class="value"><?php echo htmlspecialchars($value); ?></span>
        </div>
        <?php endforeach; ?>
    </div>
</div>
<?php else: ?>
<div class="detail-card" style="border-left: 4px solid #10b981;">
    <h4>🛡️ Fraud Detection</h4>
    <div style="text-align: center; padding: 20px;">
        <div style="font-size: 3rem;">✅</div>
        <div style="font-size: 1.1rem; font-weight: bold; color: #065f46;">No Fraud Analysis Available</div>
        <div style="color: var(--text-light); margin-top: 5px;">This transaction has not been analyzed by the fraud detection system</div>
    </div>
</div>
<?php endif; ?>

<!-- Action Buttons -->
<div class="detail-card" style="text-align: center;">
    <a href="transactions.php" class="btn btn-primary">← Back to Transactions</a>
    <?php if (!empty($transaction['fraud_score']) && $transaction['fraud_score'] > 70): ?>
        <a href="fraud-alerts.php" class="btn btn-danger" style="background: #dc2626; color: white;">View All Fraud Alerts</a>
    <?php endif; ?>
</div>

<script>
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