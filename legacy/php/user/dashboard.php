<?php
require_once '../config/database.php';

// Check if user is logged in
if (!isUserLoggedIn()) {
    header("Location: ../login.php");
    exit();
}

$database = new Database();
$db = $database->getConnection();

// Get user data
$user_id = $_SESSION['user_id'];
$query = "SELECT * FROM users WHERE id = ? AND is_active = 1";
$stmt = $db->prepare($query);
$stmt->execute([$user_id]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    session_destroy();
    header("Location: ../login.php");
    exit();
}

// Get transaction statistics
$stats_query = "SELECT 
                    COUNT(*) as total_transactions,
                    SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful,
                    SUM(CASE WHEN status = 'ABORTED' THEN 1 ELSE 0 END) as aborted,
                    SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
                FROM transactions 
                WHERE sender_id = ? OR receiver_id = ?";
$stats_stmt = $db->prepare($stats_query);
$stats_stmt->execute([$user_id, $user_id]);
$stats = $stats_stmt->fetch(PDO::FETCH_ASSOC);

if (!$stats) {
    $stats = [
        'total_transactions' => 0,
        'successful' => 0,
        'aborted' => 0,
        'pending' => 0
    ];
}

// ========== FRAUD STATISTICS ==========
// Get fraud stats for this user
$fraud_stats_query = "SELECT 
                    COUNT(*) as total_analyzed,
                    SUM(CASE WHEN fraud_prediction = 'FRAUD' THEN 1 ELSE 0 END) as fraud_detected,
                    SUM(CASE WHEN fraud_prediction = 'LEGIT' THEN 1 ELSE 0 END) as legit,
                    AVG(fraud_score) as avg_score,
                    MAX(fraud_score) as max_score
                FROM transactions 
                WHERE (sender_id = ? OR receiver_id = ?) 
                AND fraud_prediction IS NOT NULL";
$fraud_stats_stmt = $db->prepare($fraud_stats_query);
$fraud_stats_stmt->execute([$user_id, $user_id]);
$fraud_stats = $fraud_stats_stmt->fetch(PDO::FETCH_ASSOC);

// Check if user has any fraud alerts
$has_fraud_alert = false;
if ($fraud_stats && $fraud_stats['fraud_detected'] > 0) {
    $has_fraud_alert = true;
}

// Get recent transactions (last 5)
$recent_query = "SELECT t.*, 
                    sender.full_name as sender_name, 
                    receiver.full_name as receiver_name
                 FROM transactions t
                 LEFT JOIN users sender ON t.sender_id = sender.id
                 LEFT JOIN users receiver ON t.receiver_id = receiver.id
                 WHERE t.sender_id = ? OR t.receiver_id = ?
                 ORDER BY t.created_at DESC LIMIT 5";
$recent_stmt = $db->prepare($recent_query);
$recent_stmt->execute([$user_id, $user_id]);
$recent_transactions = $recent_stmt->fetchAll(PDO::FETCH_ASSOC);

include 'partials/sidebar.php';
?>

<style>
    .fraud-warning-banner {
        background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
        border-left: 4px solid #dc2626;
        padding: 15px 20px;
        border-radius: 8px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 15px;
        animation: slideDown 0.5s ease;
    }
    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .risk-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
    }
    .risk-high { background: #fee2e2; color: #991b1b; }
    .risk-medium { background: #fed7aa; color: #92400e; }
    .risk-low { background: #d1fae5; color: #065f46; }
    .risk-pending { background: #e0f2fe; color: #075985; }
    .fraud-score-bar {
        width: 80px;
        height: 6px;
        background: #e5e7eb;
        border-radius: 10px;
        overflow: hidden;
        display: inline-block;
        vertical-align: middle;
    }
    .fraud-score-bar .fill {
        height: 100%;
        border-radius: 10px;
        transition: width 0.3s ease;
    }
    
    /* Balance Display Styles */
    .balance-display {
        display: flex;
        align-items: center;
        gap: 15px;
        flex-wrap: wrap;
        cursor: pointer;
        padding: 5px 10px;
        border-radius: 8px;
        transition: background 0.3s ease;
    }
    .balance-display:hover {
        background: rgba(255,255,255,0.1);
    }
    .balance-hidden {
        font-size: 2.5rem;
        font-weight: bold;
        color: white;
        letter-spacing: 2px;
    }
    .balance-visible {
        font-size: 2.5rem;
        font-weight: bold;
        color: white;
        letter-spacing: 1px;
    }
    .balance-lock-icon {
        font-size: 1.5rem;
        margin-right: 5px;
    }
    .balance-status {
        font-size: 0.7rem;
        background: rgba(255,255,255,0.2);
        padding: 4px 12px;
        border-radius: 20px;
        color: rgba(255,255,255,0.8);
        white-space: nowrap;
    }
    .balance-status.visible {
        background: rgba(16, 185, 129, 0.3);
        color: #10b981;
    }
    .balance-hint {
        font-size: 0.8rem;
        opacity: 0.7;
        margin-top: 5px;
        color: rgba(255,255,255,0.8);
    }
    
    /* Password Modal */
    .password-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        z-index: 9999;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(5px);
        animation: fadeIn 0.3s ease;
    }
    .password-modal.active {
        display: flex;
    }
    .password-modal-content {
        background: white;
        border-radius: 16px;
        padding: 40px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
    }
    .password-modal-content h3 {
        text-align: center;
        margin-bottom: 10px;
        color: var(--text-dark);
    }
    .password-modal-content p {
        text-align: center;
        color: var(--text-light);
        margin-bottom: 20px;
        font-size: 0.9rem;
    }
    .password-modal-content .form-group {
        margin-bottom: 20px;
    }
    .password-modal-content .form-group input {
        width: 100%;
        padding: 12px;
        border: 2px solid var(--border-color);
        border-radius: 8px;
        font-size: 1rem;
        transition: border-color 0.3s ease;
        text-align: center;
    }
    .password-modal-content .form-group input:focus {
        outline: none;
        border-color: var(--primary-blue);
    }
    .password-modal-content .btn-group {
        display: flex;
        gap: 10px;
    }
    .password-modal-content .btn-group button {
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    .btn-confirm {
        background: var(--primary-blue);
        color: white;
    }
    .btn-confirm:hover {
        background: var(--primary-dark);
        transform: translateY(-2px);
    }
    .btn-cancel {
        background: var(--light-bg);
        color: var(--text-dark);
    }
    .btn-cancel:hover {
        background: #e5e7eb;
        transform: translateY(-2px);
    }
    .password-error {
        color: var(--danger-red);
        font-size: 0.85rem;
        text-align: center;
        margin-top: 10px;
        display: none;
    }
    .password-error.show {
        display: block;
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
</style>

<div class="top-header">
    <div class="header-title">
        <h1>Welcome back, <?php echo htmlspecialchars($user['full_name']); ?>!</h1>
        <p>Your financial dashboard</p>
    </div>
    <div class="header-info">
        <div class="admin-profile">
            <div class="admin-avatar">
                <?php echo substr($user['full_name'], 0, 1); ?>
            </div>
            <div>
                <strong><?php echo htmlspecialchars($user['full_name']); ?></strong>
                <div class="current-time" id="currentTime"></div>
            </div>
        </div>
    </div>
</div>

<?php if ($has_fraud_alert): ?>
<div class="fraud-warning-banner">
    <div style="font-size: 2rem;">⚠️</div>
    <div>
        <strong style="color: #991b1b;">Security Alert:</strong>
        <span style="color: #7f1d1d;">We've detected suspicious activity on your account. Please review your recent transactions.</span>
        <br>
        <a href="transactions.php?fraud_filter=fraud" style="color: #dc2626; font-weight: 600; text-decoration: none;">
            View Suspicious Transactions →
        </a>
    </div>
</div>
<?php endif; ?>

<!-- Balance Card -->
<div class="stats-grid">
    <div class="stat-card" style="background: linear-gradient(135deg, var(--primary-blue) 0%, var(--primary-dark) 100%); color: white;">
        <div class="stat-header">
            <span style="color: rgba(255,255,255,0.9);">Available Balance</span>
            <div class="stat-icon">💰</div>
        </div>
        <div style="display: flex; flex-direction: column;">
            <div class="balance-display" onclick="toggleBalanceVisibility()" title="Click to view balance">
                <span id="balanceLockIcon" class="balance-lock-icon">🔒</span>
                <span id="balanceText" class="balance-hidden">••••••••••••••••</span>
            </div>
            <div style="display: flex; align-items: center; gap: 15px; margin-top: 5px;">
                <span id="balanceStatus" class="balance-status">🔒 Hidden</span>
                <span class="balance-hint">Click balance to view</span>
            </div>
        </div>
        <div class="stat-label" style="color: rgba(255,255,255,0.8); margin-top: 5px;">
            <?php echo $user['balance'] > 0 ? 'Click the balance amount to reveal' : 'Your balance is empty'; ?>
        </div>
    </div>
    
    <div class="stat-card">
        <div class="stat-header">
            <span>Card Number</span>
            <div class="stat-icon">💳</div>
        </div>
        <div class="stat-value" style="font-size: 1.2rem;">•••• •••• •••• <?php echo substr($user['card_number'], -4); ?></div>
        <div class="stat-label">Virtual Card</div>
    </div>
    
    <div class="stat-card">
        <div class="stat-header">
            <span>Total Transactions</span>
            <div class="stat-icon">📊</div>
        </div>
        <div class="stat-value"><?php echo number_format($stats['total_transactions']); ?></div>
        <div class="stat-label">All time</div>
    </div>
    
    <div class="stat-card">
        <div class="stat-header">
            <span>Success Rate</span>
            <div class="stat-icon">✅</div>
        </div>
        <div class="stat-value">
            <?php 
            $total = $stats['total_transactions'];
            $success_rate = $total > 0 ? round(($stats['successful'] / $total) * 100) : 0;
            echo $success_rate . '%';
            ?>
        </div>
        <div class="stat-label">Transaction success rate</div>
    </div>
</div>

<!-- Fraud Stats (if available) -->
<?php if ($fraud_stats && $fraud_stats['total_analyzed'] > 0): ?>
<div class="stats-grid" style="margin-top: -10px;">
    <div class="stat-card" style="border-left: 4px solid <?php echo $fraud_stats['fraud_detected'] > 0 ? '#ef4444' : '#10b981'; ?>;">
        <div class="stat-header">
            <span>🛡️ Fraud Status</span>
            <div class="stat-icon">🛡️</div>
        </div>
        <div class="stat-value" style="font-size: 1.2rem; color: <?php echo $fraud_stats['fraud_detected'] > 0 ? '#dc2626' : '#059669'; ?>;">
            <?php echo $fraud_stats['fraud_detected'] > 0 ? '⚠️ Suspicious Activity' : '✅ Safe'; ?>
        </div>
        <div class="stat-label">
            <?php echo number_format($fraud_stats['total_analyzed']); ?> transactions analyzed
        </div>
    </div>
    <div class="stat-card" style="border-left: 4px solid #3b82f6;">
        <div class="stat-header">
            <span>📊 Average Risk Score</span>
            <div class="stat-icon">📊</div>
        </div>
        <div class="stat-value" style="font-size: 1.2rem;">
            <?php echo $fraud_stats['avg_score'] ? round($fraud_stats['avg_score'], 1) : 0; ?>%
        </div>
        <div class="stat-label">
            <?php echo $fraud_stats['max_score'] ? 'Highest: ' . round($fraud_stats['max_score'], 1) . '%' : 'No risk data'; ?>
        </div>
    </div>
</div>
<?php endif; ?>

<!-- Password Verification Modal -->
<div class="password-modal" id="passwordModal">
    <div class="password-modal-content">
        <h3>🔐 Verify Identity</h3>
        <p>Enter your password to view your balance</p>
        <form id="passwordForm" onsubmit="return verifyPassword(event)">
            <div class="form-group">
                <input type="password" id="passwordInput" placeholder="Enter your password" required autofocus>
            </div>
            <div class="password-error" id="passwordError">❌ Incorrect password. Please try again.</div>
            <div class="btn-group">
                <button type="button" class="btn-cancel" onclick="closePasswordModal()">Cancel</button>
                <button type="submit" class="btn-confirm">Confirm</button>
            </div>
        </form>
    </div>
</div>

<!-- Quick Actions -->
<div class="table-container">
    <div class="table-header">
        <h3>Quick Actions</h3>
    </div>
    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <a href="send.php" class="btn btn-primary" style="flex: 1; text-align: center; padding: 15px;">
            💸 Send Money
        </a>
        <a href="withdraw.php" class="btn btn-success" style="flex: 1; text-align: center; padding: 15px; background: var(--success-green);">
            🏧 Withdraw
        </a>
        <a href="transactions.php" class="btn" style="flex: 1; text-align: center; padding: 15px; background: var(--light-bg);">
            📜 View Transactions
        </a>
    </div>
</div>

<!-- Recent Transactions -->
<div class="table-container">
    <div class="table-header">
        <h3>Recent Transactions</h3>
        <a href="transactions.php" class="btn btn-primary">View All →</a>
    </div>
    <div style="overflow-x: auto;">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Transaction ID</th>
                    <th>Type</th>
                    <th>Amount (TSh)</th>
                    <th>Status</th>
                    <th>Risk Level</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
                <?php if (count($recent_transactions) > 0): ?>
                    <?php foreach ($recent_transactions as $transaction): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($transaction['transaction_id']); ?></td>
                            <td>
                                <?php if ($transaction['sender_id'] == $user_id): ?>
                                    📤 Sent to <?php echo htmlspecialchars($transaction['receiver_name'] ?? 'Unknown'); ?>
                                <?php elseif ($transaction['receiver_id'] == $user_id): ?>
                                    📥 Received from <?php echo htmlspecialchars($transaction['sender_name'] ?? 'Unknown'); ?>
                                <?php else: ?>
                                    <?php echo ucfirst($transaction['transaction_type']); ?>
                                <?php endif; ?>
                            </td>
                            <td>TSh <?php echo number_format($transaction['amount'], 2); ?></td>
                            <td>
                                <span class="status-badge status-<?php echo strtolower($transaction['status']); ?>">
                                    <?php echo $transaction['status']; ?>
                                </span>
                            </td>
                            <td>
                                <?php if (!empty($transaction['risk_level'])): ?>
                                    <span class="risk-badge risk-<?php echo strtolower($transaction['risk_level']); ?>">
                                        <?php echo $transaction['risk_level']; ?>
                                    </span>
                                <?php else: ?>
                                    <span class="risk-badge risk-pending">PENDING</span>
                                <?php endif; ?>
                            </td>
                            <td><?php echo date('Y-m-d H:i', strtotime($transaction['created_at'])); ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php else: ?>
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 40px;">
                            <div>📭 No transactions found</div>
                            <div style="margin-top: 10px;">
                                <a href="send.php" class="btn btn-primary">Send Money</a>
                            </div>
                        </td>
                    </tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>

<script>
let balanceVisible = false;
let actualBalance = <?php echo $user['balance']; ?>;

function toggleBalanceVisibility() {
    // If balance is already visible, hide it
    if (balanceVisible) {
        hideBalance();
        return;
    }
    
    // Otherwise, show the password modal
    document.getElementById('passwordModal').classList.add('active');
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordError').classList.remove('show');
    setTimeout(() => {
        document.getElementById('passwordInput').focus();
    }, 100);
}

function verifyPassword(event) {
    event.preventDefault();
    const password = document.getElementById('passwordInput').value;
    
    if (!password) {
        document.getElementById('passwordError').textContent = '❌ Please enter your password';
        document.getElementById('passwordError').classList.add('show');
        return false;
    }
    
    fetch('../ajax/verify_password.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'password=' + encodeURIComponent(password) + '&user_id=<?php echo $user_id; ?>'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showBalance();
            document.getElementById('passwordModal').classList.remove('active');
        } else {
            document.getElementById('passwordError').textContent = '❌ Incorrect password. Please try again.';
            document.getElementById('passwordError').classList.add('show');
            document.getElementById('passwordInput').value = '';
            document.getElementById('passwordInput').focus();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('passwordError').textContent = '❌ An error occurred. Please try again.';
        document.getElementById('passwordError').classList.add('show');
    });
    
    return false;
}

function showBalance() {
    balanceVisible = true;
    const balanceText = document.getElementById('balanceText');
    const balanceLockIcon = document.getElementById('balanceLockIcon');
    const balanceStatus = document.getElementById('balanceStatus');
    
    const formattedBalance = actualBalance.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    balanceText.textContent = 'TSh ' + formattedBalance;
    balanceText.className = 'balance-visible';
    balanceLockIcon.textContent = '🔓';
    balanceStatus.textContent = '👁️ Visible';
    balanceStatus.className = 'balance-status visible';
}

function hideBalance() {
    balanceVisible = false;
    const balanceText = document.getElementById('balanceText');
    const balanceLockIcon = document.getElementById('balanceLockIcon');
    const balanceStatus = document.getElementById('balanceStatus');
    
    balanceText.textContent = '••••••••••••••••';
    balanceText.className = 'balance-hidden';
    balanceLockIcon.textContent = '🔒';
    balanceStatus.textContent = '🔒 Hidden';
    balanceStatus.className = 'balance-status';
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.remove('active');
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordError').classList.remove('show');
}

// Close modal when clicking outside
document.getElementById('passwordModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closePasswordModal();
    }
});

// Handle Enter key in password input
document.getElementById('passwordInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('passwordForm').dispatchEvent(new Event('submit'));
    }
});

// Handle Escape key to close modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closePasswordModal();
    }
});

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