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

// Check if transactions are unlocked
$transactions_unlocked = isset($_SESSION['transactions_unlocked']) && $_SESSION['transactions_unlocked'] === true;
$unlock_error = '';

// Handle unlock request
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['unlock_transactions'])) {
    $password = $_POST['password'];
    
    // Verify password
    $verify_query = "SELECT password FROM users WHERE id = ?";
    $verify_stmt = $db->prepare($verify_query);
    $verify_stmt->execute([$user_id]);
    $user_data = $verify_stmt->fetch(PDO::FETCH_ASSOC);
    
    if (password_verify($password, $user_data['password'])) {
        $_SESSION['transactions_unlocked'] = true;
        $_SESSION['transactions_unlock_time'] = time();
        $transactions_unlocked = true;
        
        // Refresh page to show transactions
        header("Location: transactions.php");
        exit();
    } else {
        $unlock_error = "❌ Incorrect password. Please try again.";
    }
}

// Auto-lock after 5 minutes of inactivity
if ($transactions_unlocked && isset($_SESSION['transactions_unlock_time'])) {
    if (time() - $_SESSION['transactions_unlock_time'] > 300) { // 5 minutes
        $_SESSION['transactions_unlocked'] = false;
        $transactions_unlocked = false;
    }
}

// Pagination
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = 15;
$offset = ($page - 1) * $limit;

// Search and filters
$search = isset($_GET['search']) ? sanitizeInput($_GET['search']) : '';
$status_filter = isset($_GET['status']) ? sanitizeInput($_GET['status']) : '';
$fraud_filter = isset($_GET['fraud_filter']) ? sanitizeInput($_GET['fraud_filter']) : '';

// Build the base query
$where_conditions = [];
$params = [];

// User condition
$where_conditions[] = "(t.sender_id = ? OR t.receiver_id = ?)";
$params[] = $user_id;
$params[] = $user_id;

// Search condition
if ($search) {
    $where_conditions[] = "(t.transaction_id LIKE ? OR t.message LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

// Status filter condition
if ($status_filter) {
    $where_conditions[] = "t.status = ?";
    $params[] = $status_filter;
}

// Fraud filter condition
if ($fraud_filter === 'fraud') {
    $where_conditions[] = "t.fraud_prediction = 'FRAUD'";
} elseif ($fraud_filter === 'legit') {
    $where_conditions[] = "t.fraud_prediction = 'LEGIT'";
} elseif ($fraud_filter === 'pending') {
    $where_conditions[] = "(t.fraud_prediction = 'PENDING' OR t.fraud_prediction IS NULL)";
}

$where_sql = implode(" AND ", $where_conditions);

// Get total records
$countQuery = "SELECT COUNT(*) as total FROM transactions t WHERE $where_sql";
$countStmt = $db->prepare($countQuery);
$countStmt->execute($params);
$totalRecords = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
$totalPages = ceil($totalRecords / $limit);

// Get transactions with pagination
$query = "SELECT t.*, 
          sender.full_name as sender_name, 
          receiver.full_name as receiver_name
          FROM transactions t
          LEFT JOIN users sender ON t.sender_id = sender.id
          LEFT JOIN users receiver ON t.receiver_id = receiver.id
          WHERE $where_sql
          ORDER BY t.created_at DESC 
          LIMIT ? OFFSET ?";

// Add pagination parameters
$params[] = $limit;
$params[] = $offset;

$stmt = $db->prepare($query);
$stmt->execute($params);
$transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

include 'partials/sidebar.php';
?>

<style>
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
    .transaction-type-icon {
        font-size: 1rem;
        margin-right: 5px;
    }
    
    /* Glass Overlay Styles */
    .glass-overlay-wrapper {
        position: relative;
    }
    .glass-overlay-wrapper .blurred-content {
        filter: blur(12px);
        pointer-events: none;
        user-select: none;
        opacity: 0.4;
        transition: all 0.3s ease;
    }
    .glass-overlay-wrapper .unlocked-content {
        filter: none;
        pointer-events: all;
        user-select: all;
        opacity: 1;
        transition: all 0.3s ease;
    }
    
    /* Floating Password Modal */
    .floating-password-modal {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        pointer-events: none;
        padding: 20px;
    }
    .floating-password-modal.active {
        pointer-events: all;
    }
    .floating-password-modal .modal-box {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 24px;
        padding: 40px;
        max-width: 440px;
        width: 100%;
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3);
        animation: modalSlideUp 0.5s ease;
        border: 1px solid rgba(255, 255, 255, 0.2);
        text-align: center;
    }
    @keyframes modalSlideUp {
        from { 
            opacity: 0; 
            transform: translateY(30px) scale(0.95);
        }
        to { 
            opacity: 1; 
            transform: translateY(0) scale(1);
        }
    }
    .floating-password-modal .modal-box .lock-icon {
        font-size: 4.5rem;
        margin-bottom: 15px;
        display: block;
        animation: floatPulse 2s ease-in-out infinite;
    }
    @keyframes floatPulse {
        0%, 100% { transform: scale(1) translateY(0); }
        50% { transform: scale(1.1) translateY(-5px); }
    }
    .floating-password-modal .modal-box h2 {
        font-size: 1.5rem;
        color: var(--text-dark);
        margin-bottom: 10px;
        font-weight: 700;
    }
    .floating-password-modal .modal-box p {
        color: var(--text-light);
        margin-bottom: 25px;
        font-size: 0.95rem;
        line-height: 1.5;
    }
    .floating-password-modal .modal-box .unlock-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .floating-password-modal .modal-box .unlock-form input {
        padding: 14px 20px;
        border: 2px solid var(--border-color);
        border-radius: 12px;
        font-size: 1rem;
        transition: all 0.3s ease;
        background: white;
        text-align: center;
        letter-spacing: 2px;
    }
    .floating-password-modal .modal-box .unlock-form input:focus {
        outline: none;
        border-color: var(--primary-blue);
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
    }
    .floating-password-modal .modal-box .unlock-form button {
        padding: 14px 30px;
        background: var(--primary-blue);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        width: 100%;
    }
    .floating-password-modal .modal-box .unlock-form button:hover {
        background: var(--primary-dark);
        transform: translateY(-2px);
        box-shadow: 0 10px 30px rgba(37, 99, 235, 0.3);
    }
    .floating-password-modal .modal-box .unlock-form button:active {
        transform: translateY(0);
    }
    .floating-password-modal .modal-box .error-message {
        color: #dc2626;
        background: #fee2e2;
        padding: 10px 15px;
        border-radius: 8px;
        margin-top: 5px;
        font-size: 0.9rem;
        display: none;
    }
    .floating-password-modal .modal-box .error-message.show {
        display: block;
    }
    .floating-password-modal .modal-box .unlock-hint {
        color: var(--text-light);
        font-size: 0.75rem;
        margin-top: 15px;
        opacity: 0.7;
    }
    .floating-password-modal .modal-box .unlock-hint span {
        display: inline-block;
        margin: 0 3px;
    }
    
    /* Status Badge in Header */
    .lock-status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 15px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 500;
    }
    .lock-status.locked {
        background: #fed7aa;
        color: #92400e;
    }
    .lock-status.unlocked {
        background: #d1fae5;
        color: #065f46;
    }
    .lock-status .lock-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.7rem;
        text-decoration: underline;
        color: inherit;
        padding: 0 5px;
    }
    .lock-status .lock-btn:hover {
        opacity: 0.7;
    }
    
    /* Glass overlay background when locked */
    .glass-background {
        position: relative;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        overflow: hidden;
    }
    .glass-background.locked {
        background: rgba(0, 0, 0, 0.02);
    }
    
    @media (max-width: 768px) {
        .floating-password-modal .modal-box {
            padding: 30px 20px;
            margin: 10px;
        }
        .floating-password-modal .modal-box .lock-icon {
            font-size: 3.5rem;
        }
        .floating-password-modal .modal-box h2 {
            font-size: 1.2rem;
        }
    }
</style>

<div class="top-header">
    <div class="header-title">
        <h1>Transaction History</h1>
        <p>View all your financial activities with fraud analysis</p>
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

<div class="table-container">
    <div class="table-header">
        <h3>All Transactions</h3>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <?php if ($transactions_unlocked): ?>
                <span class="lock-status unlocked">
                    🔓 Unlocked
                    <button class="lock-btn" onclick="lockTransactions()">Lock</button>
                </span>
            <?php else: ?>
                <span class="lock-status locked">
                    🔒 Locked
                </span>
            <?php endif; ?>
            
            <form method="GET" action="" style="display: flex; gap: 10px; flex-wrap: wrap;">
                <input type="text" name="search" class="search-box" placeholder="Search by transaction ID or message..." 
                       value="<?php echo htmlspecialchars($search); ?>">
                <select name="status" class="search-box" style="width: auto;">
                    <option value="">All Status</option>
                    <option value="SUCCESS" <?php echo $status_filter == 'SUCCESS' ? 'selected' : ''; ?>>Success</option>
                    <option value="ABORTED" <?php echo $status_filter == 'ABORTED' ? 'selected' : ''; ?>>Aborted</option>
                    <option value="PENDING" <?php echo $status_filter == 'PENDING' ? 'selected' : ''; ?>>Pending</option>
                </select>
                <select name="fraud_filter" class="search-box" style="width: auto;">
                    <option value="">All Transactions</option>
                    <option value="fraud" <?php echo $fraud_filter == 'fraud' ? 'selected' : ''; ?>>🚨 Fraud Detected</option>
                    <option value="legit" <?php echo $fraud_filter == 'legit' ? 'selected' : ''; ?>>✅ Legitimate</option>
                    <option value="pending" <?php echo $fraud_filter == 'pending' ? 'selected' : ''; ?>>⏳ Pending Analysis</option>
                </select>
                <button type="submit" class="btn btn-primary">Filter</button>
                <?php if ($search || $status_filter || $fraud_filter): ?>
                    <a href="transactions.php" class="btn">Clear</a>
                <?php endif; ?>
            </form>
        </div>
    </div>
    
    <!-- Glass Overlay Wrapper -->
    <div class="glass-overlay-wrapper">
        
        <!-- Blurred/Unblurred Content -->
        <div class="<?php echo $transactions_unlocked ? 'unlocked-content' : 'blurred-content'; ?>">
            <div style="overflow-x: auto; min-height: 400px;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Transaction ID</th>
                            <th>Type</th>
                            <th>Amount (TSh)</th>
                            <th>Status</th>
                            <th>Risk Score</th>
                            <th>Risk Level</th>
                            <th>Date</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (count($transactions) > 0): ?>
                            <?php foreach ($transactions as $transaction): ?>
                                <tr>
                                    <td><?php echo htmlspecialchars($transaction['transaction_id']); ?></td>
                                    <td>
                                        <?php 
                                        // Determine transaction type display
                                        $type_display = '';
                                        $icon = '';
                                        
                                        if ($transaction['transaction_type'] == 'withdrawal') {
                                            $icon = '🏧';
                                            $type_display = 'Withdrawal';
                                        } elseif ($transaction['transaction_type'] == 'deposit') {
                                            $icon = '💰';
                                            $type_display = 'Deposit';
                                        } elseif ($transaction['sender_id'] == $user_id) {
                                            $icon = '💸';
                                            $type_display = 'Sent to ' . htmlspecialchars($transaction['receiver_name'] ?? 'Unknown');
                                        } elseif ($transaction['receiver_id'] == $user_id) {
                                            $icon = '💰';
                                            $type_display = 'Received from ' . htmlspecialchars($transaction['sender_name'] ?? 'Unknown');
                                        } else {
                                            $icon = '📊';
                                            $type_display = ucfirst($transaction['transaction_type']);
                                        }
                                        ?>
                                        <span class="transaction-type-icon"><?php echo $icon; ?></span>
                                        <?php echo $type_display; ?>
                                    </td>
                                    <td>TSh <?php echo number_format($transaction['amount'], 2); ?></td>
                                    <td>
                                        <span class="status-badge status-<?php echo strtolower($transaction['status']); ?>">
                                            <?php echo $transaction['status']; ?>
                                        </span>
                                    </td>
                                    <td>
                                        <?php if ($transaction['fraud_score'] > 0): ?>
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <div class="fraud-score-bar">
                                                    <div class="fill" style="width: <?php echo $transaction['fraud_score']; ?>%; background: <?php echo $transaction['fraud_score'] > 70 ? '#ef4444' : ($transaction['fraud_score'] > 40 ? '#f59e0b' : '#10b981'); ?>;"></div>
                                                </div>
                                                <span><?php echo $transaction['fraud_score']; ?>%</span>
                                            </div>
                                        <?php else: ?>
                                            <span style="color: var(--text-light); font-size: 0.8rem;">N/A</span>
                                        <?php endif; ?>
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
                                    <td>
                                        <button onclick="showTransactionDetails(<?php echo htmlspecialchars(json_encode($transaction)); ?>)" 
                                                class="btn btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">
                                            View
                                        </button>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 40px;">
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
        
        <!-- Floating Password Modal -->
        <?php if (!$transactions_unlocked): ?>
        <div class="floating-password-modal active">
            <div class="modal-box">
                <span class="lock-icon">🔒</span>
                <h2>Transactions Locked</h2>
                <p>Enter your password to view your transaction history.</p>
                
                <?php if ($unlock_error): ?>
                    <div class="error-message show"><?php echo $unlock_error; ?></div>
                <?php endif; ?>
                
                <form method="POST" action="" class="unlock-form" onsubmit="return validateUnlockForm()">
                    <input type="password" name="password" placeholder="Enter your password" required autofocus>
                    <button type="submit" name="unlock_transactions" value="1">🔓 Unlock Transactions</button>
                </form>
                <div class="unlock-hint">
                    🔒 Your transactions will automatically lock after <span>5 minutes</span> of inactivity
                </div>
            </div>
        </div>
        <?php endif; ?>
        
    </div>
    
    <?php if ($totalPages > 1): ?>
        <div class="pagination">
            <?php 
            $query_params = $_GET;
            unset($query_params['page']);
            ?>
            
            <?php if ($page > 1): ?>
                <a href="?<?php echo http_build_query(array_merge($query_params, ['page' => $page - 1])); ?>">← Previous</a>
            <?php endif; ?>
            
            <?php
            $start = max(1, $page - 2);
            $end = min($totalPages, $page + 2);
            
            if ($start > 1) {
                echo '<a href="?' . http_build_query(array_merge($query_params, ['page' => 1])) . '">1</a>';
                if ($start > 2) echo '<span>...</span>';
            }
            
            for ($i = $start; $i <= $end; $i++):
            ?>
                <a href="?<?php echo http_build_query(array_merge($query_params, ['page' => $i])); ?>" 
                   class="<?php echo $i == $page ? 'active' : ''; ?>">
                    <?php echo $i; ?>
                </a>
            <?php endfor; ?>
            
            <?php if ($end < $totalPages): ?>
                <?php if ($end < $totalPages - 1) echo '<span>...</span>'; ?>
                <a href="?<?php echo http_build_query(array_merge($query_params, ['page' => $totalPages])); ?>">
                    <?php echo $totalPages; ?>
                </a>
            <?php endif; ?>
            
            <?php if ($page < $totalPages): ?>
                <a href="?<?php echo http_build_query(array_merge($query_params, ['page' => $page + 1])); ?>">Next →</a>
            <?php endif; ?>
        </div>
    <?php endif; ?>
</div>

<!-- Transaction Details Modal -->
<div id="transactionModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; justify-content: center; align-items: center;">
    <div style="background: white; border-radius: 12px; max-width: 500px; width: 90%; max-height: 80%; overflow-y: auto; padding: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>Transaction Details</h3>
            <button onclick="closeModal()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        <div id="modalContent"></div>
    </div>
</div>

<script>
function lockTransactions() {
    if (confirm('Lock your transaction history? You will need to enter your password to view it again.')) {
        fetch('ajax/lock_transactions.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }
}

function validateUnlockForm() {
    const password = document.querySelector('input[name="password"]');
    if (!password.value.trim()) {
        alert('Please enter your password');
        return false;
    }
    return true;
}

function showTransactionDetails(transaction) {
    const modal = document.getElementById('transactionModal');
    const modalContent = document.getElementById('modalContent');
    
    // Determine transaction type for display
    let typeDisplay = '';
    let typeIcon = '';
    
    if (transaction.transaction_type == 'withdrawal') {
        typeIcon = '🏧';
        typeDisplay = 'Withdrawal';
    } else if (transaction.transaction_type == 'deposit') {
        typeIcon = '💰';
        typeDisplay = 'Deposit';
    } else if (transaction.sender_id == <?php echo $user_id; ?>) {
        typeIcon = '💸';
        typeDisplay = 'Sent to ' + (transaction.receiver_name || 'Unknown');
    } else if (transaction.receiver_id == <?php echo $user_id; ?>) {
        typeIcon = '💰';
        typeDisplay = 'Received from ' + (transaction.sender_name || 'Unknown');
    } else {
        typeIcon = '📊';
        typeDisplay = ucfirst(transaction.transaction_type);
    }
    
    let fraudSection = '';
    if (transaction.fraud_score > 0) {
        const riskColor = transaction.fraud_score > 70 ? '#dc2626' : (transaction.fraud_score > 40 ? '#d97706' : '#059669');
        fraudSection = `
            <div style="margin-bottom: 15px; padding: 15px; background: var(--light-bg); border-radius: 8px; border-left: 4px solid ${riskColor};">
                <label style="font-weight: 600; display: block; margin-bottom: 8px;">🛡️ Fraud Analysis</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-light);">Risk Score</div>
                        <div style="font-size: 1.2rem; font-weight: bold; color: ${riskColor};">${transaction.fraud_score}%</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-light);">Prediction</div>
                        <div style="font-size: 1.1rem; font-weight: bold;">
                            ${transaction.fraud_prediction || 'PENDING'}
                        </div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-light);">Risk Level</div>
                        <div>
                            <span class="risk-badge risk-${(transaction.risk_level || 'pending').toLowerCase()}">
                                ${transaction.risk_level || 'PENDING'}
                            </span>
                        </div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-light);">Model Version</div>
                        <div style="font-weight: 500;">${transaction.model_version || '1.0.0'}</div>
                    </div>
                </div>
                ${transaction.fraud_score > 70 ? '<div style="margin-top: 10px; color: #dc2626; font-weight: 600;">⚠️ This transaction was flagged as high risk</div>' : ''}
            </div>
        `;
    }
    
    modalContent.innerHTML = `
        <div style="margin-bottom: 15px;">
            <label style="font-weight: 600; display: block; margin-bottom: 5px;">Transaction ID</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">${transaction.transaction_id}</div>
        </div>
        <div style="margin-bottom: 15px;">
            <label style="font-weight: 600; display: block; margin-bottom: 5px;">Type</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">${typeIcon} ${typeDisplay}</div>
        </div>
        <div style="margin-bottom: 15px;">
            <label style="font-weight: 600; display: block; margin-bottom: 5px;">Amount</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px; font-size: 1.3rem; font-weight: bold; color: var(--primary-blue);">
                TSh ${parseFloat(transaction.amount).toLocaleString('en-US', {minimumFractionDigits: 2})}
            </div>
        </div>
        <div style="margin-bottom: 15px;">
            <label style="font-weight: 600; display: block; margin-bottom: 5px;">Status</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">
                <span class="status-badge status-${transaction.status.toLowerCase()}">${transaction.status}</span>
            </div>
        </div>
        ${fraudSection}
        <div style="margin-bottom: 15px;">
            <label style="font-weight: 600; display: block; margin-bottom: 5px;">Date & Time</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">${new Date(transaction.created_at).toLocaleString()}</div>
        </div>
        ${transaction.message ? `
        <div style="margin-bottom: 15px;">
            <label style="font-weight: 600; display: block; margin-bottom: 5px;">Message</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">${transaction.message}</div>
        </div>
        ` : ''}
        <div style="margin-top: 20px;">
            <button onclick="closeModal()" class="btn btn-primary" style="width: 100%;">Close</button>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('transactionModal').style.display = 'none';
}

function ucfirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
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

// Enter key support for unlock
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.querySelector('input[name="password"]');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.querySelector('.unlock-form').submit();
            }
        });
        passwordInput.focus();
    }
});
</script>

<?php include 'partials/sidebar_footer.php'; ?>