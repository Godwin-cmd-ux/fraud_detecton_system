<?php
require_once '../config/database.php';

// Check if admin is logged in
if (!isAdminLoggedIn()) {
    header("Location: ../login.php");
    exit();
}

$database = new Database();
$db = $database->getConnection();

// Get regular statistics
$stats = [];

// Total Users
$query = "SELECT COUNT(*) as total FROM users";
$stmt = $db->prepare($query);
$stmt->execute();
$stats['total_users'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

// Total Transactions
$query = "SELECT COUNT(*) as total FROM transactions";
$stmt = $db->prepare($query);
$stmt->execute();
$stats['total_transactions'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

// Successful Transactions
$query = "SELECT COUNT(*) as total FROM transactions WHERE status = 'SUCCESS'";
$stmt = $db->prepare($query);
$stmt->execute();
$stats['successful_transactions'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

// Aborted Transactions
$query = "SELECT COUNT(*) as total FROM transactions WHERE status = 'ABORTED'";
$stmt = $db->prepare($query);
$stmt->execute();
$stats['aborted_transactions'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

// Total Money Moved in TSh
$query = "SELECT SUM(amount) as total FROM transactions WHERE status = 'SUCCESS'";
$stmt = $db->prepare($query);
$stmt->execute();
$stats['total_money'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;

// ========== NEW FRAUD STATISTICS ==========
// Get fraud statistics
$fraud_query = "SELECT 
                    COUNT(*) as total_fraud,
                    SUM(CASE WHEN risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_risk,
                    SUM(CASE WHEN risk_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_risk,
                    SUM(CASE WHEN risk_level = 'LOW' THEN 1 ELSE 0 END) as low_risk,
                    AVG(fraud_score) as avg_score
                FROM transactions 
                WHERE fraud_prediction IS NOT NULL";
$fraud_stmt = $db->prepare($fraud_query);
$fraud_stmt->execute();
$fraud_stats = $fraud_stmt->fetch(PDO::FETCH_ASSOC);

// Get pending AI reviews count
$pending_query = "SELECT COUNT(*) as count FROM transactions WHERE fraud_prediction = 'PENDING' AND fraud_score > 0";
$pending_stmt = $db->prepare($pending_query);
$pending_stmt->execute();
$pending_ai_reviews = $pending_stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Get recent fraud alerts
$alerts_query = "SELECT t.*, 
                  sender.full_name as sender_name, 
                  receiver.full_name as receiver_name
                  FROM transactions t
                  LEFT JOIN users sender ON t.sender_id = sender.id
                  LEFT JOIN users receiver ON t.receiver_id = receiver.id
                  WHERE fraud_prediction = 'FRAUD' AND fraud_score > 50
                  ORDER BY created_at DESC LIMIT 5";
$alerts_stmt = $db->prepare($alerts_query);
$alerts_stmt->execute();
$fraud_alerts = $alerts_stmt->fetchAll(PDO::FETCH_ASSOC);

// Recent Transactions (last 10)
$query = "SELECT t.*, 
          sender.full_name as sender_full_name, 
          receiver.full_name as receiver_full_name 
          FROM transactions t
          LEFT JOIN users sender ON t.sender_id = sender.id
          LEFT JOIN users receiver ON t.receiver_id = receiver.id
          ORDER BY t.created_at DESC LIMIT 10";
$stmt = $db->prepare($query);
$stmt->execute();
$recent_transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Recent Users (last 10)
$query = "SELECT * FROM users ORDER BY created_at DESC LIMIT 10";
$stmt = $db->prepare($query);
$stmt->execute();
$recent_users = $stmt->fetchAll(PDO::FETCH_ASSOC);

include 'partials/sidebar.php';
?>

<style>
    .fraud-stat-card {
        background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
        border-radius: 12px;
        padding: 20px;
        color: white;
        border-left: 4px solid #ef4444;
    }
    .fraud-stat-card .stat-value {
        font-size: 2rem;
        font-weight: bold;
    }
    .fraud-stat-card .stat-label {
        font-size: 0.85rem;
        opacity: 0.8;
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
</style>

<div class="top-header">
    <div class="header-title">
        <h1>Dashboard Overview</h1>
        <p>Welcome back, <?php echo htmlspecialchars($_SESSION['admin_name'] ?? 'Admin'); ?>!</p>
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

<div class="stats-grid">
    <!-- Regular Stats -->
    <div class="stat-card">
        <div class="stat-header">
            <span>Total Users</span>
            <div class="stat-icon">👥</div>
        </div>
        <div class="stat-value"><?php echo number_format($stats['total_users']); ?></div>
        <div class="stat-label">Registered accounts</div>
    </div>
    
    <div class="stat-card">
        <div class="stat-header">
            <span>Total Transactions</span>
            <div class="stat-icon">💸</div>
        </div>
        <div class="stat-value"><?php echo number_format($stats['total_transactions']); ?></div>
        <div class="stat-label">All time transactions</div>
    </div>
    
    <div class="stat-card">
        <div class="stat-header">
            <span>Successful</span>
            <div class="stat-icon">✅</div>
        </div>
        <div class="stat-value"><?php echo number_format($stats['successful_transactions']); ?></div>
        <div class="stat-label">Completed transactions</div>
    </div>
    
    <div class="stat-card">
        <div class="stat-header">
            <span>Aborted</span>
            <div class="stat-icon">⚠️</div>
        </div>
        <div class="stat-value"><?php echo number_format($stats['aborted_transactions']); ?></div>
        <div class="stat-label">Suspicious transactions</div>
    </div>
    
    <div class="stat-card">
        <div class="stat-header">
            <span>Total Money Moved</span>
            <div class="stat-icon">💰</div>
        </div>
        <div class="stat-value">TSh <?php echo number_format($stats['total_money'], 2); ?></div>
        <div class="stat-label">Total volume processed</div>
    </div>

    <!-- NEW: Fraud Stats -->
    <div class="stat-card" style="border-left: 4px solid #ef4444; background: #fef2f2;">
        <div class="stat-header">
            <span>🚨 Fraud Detected</span>
            <div class="stat-icon">⚠️</div>
        </div>
        <div class="stat-value" style="color: #dc2626;"><?php echo number_format($fraud_stats['total_fraud'] ?? 0); ?></div>
        <div class="stat-label">Transactions flagged as fraud</div>
    </div>

    <?php if ($fraud_stats['high_risk'] > 0): ?>
    <div class="stat-card" style="border-left: 4px solid #dc2626; background: #fee2e2;">
        <div class="stat-header">
            <span>🔴 High Risk</span>
            <div class="stat-icon">🚨</div>
        </div>
        <div class="stat-value" style="color: #dc2626;"><?php echo number_format($fraud_stats['high_risk'] ?? 0); ?></div>
        <div class="stat-label">Immediate attention needed</div>
    </div>
    <?php endif; ?>

    <?php if ($pending_ai_reviews > 0): ?>
    <div class="stat-card" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">
        <div class="stat-header">
            <span>🤖 AI Review Queue</span>
            <div class="stat-icon">🤖</div>
        </div>
        <div class="stat-value"><?php echo $pending_ai_reviews; ?></div>
        <div class="stat-label">Pending fraud analysis</div>
    </div>
    <?php endif; ?>
</div>

<!-- Fraud Alerts Section -->
<?php if (count($fraud_alerts) > 0): ?>
<div class="table-container" style="border-left: 4px solid #ef4444;">
    <div class="table-header">
        <h3 style="color: #dc2626;">🚨 Recent Fraud Alerts</h3>
        <a href="fraud-alerts.php" class="btn btn-danger" style="background: #dc2626; color: white;">View All Alerts →</a>
    </div>
    <div style="overflow-x: auto;">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Transaction ID</th>
                    <th>Sender</th>
                    <th>Receiver</th>
                    <th>Amount</th>
                    <th>Risk Score</th>
                    <th>Risk Level</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($fraud_alerts as $alert): ?>
                    <tr>
                        <td><?php echo htmlspecialchars($alert['transaction_id']); ?></td>
                        <td><?php echo htmlspecialchars($alert['sender_name'] ?? 'Unknown'); ?></td>
                        <td><?php echo htmlspecialchars($alert['receiver_name'] ?? 'Unknown'); ?></td>
                        <td>TSh <?php echo number_format($alert['amount'], 2); ?></td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 100px; background: #e5e7eb; border-radius: 10px; height: 8px;">
                                    <div style="width: <?php echo $alert['fraud_score']; ?>%; background: <?php echo $alert['fraud_score'] > 70 ? '#ef4444' : '#f59e0b'; ?>; border-radius: 10px; height: 8px;"></div>
                                </div>
                                <span><?php echo $alert['fraud_score']; ?>%</span>
                            </div>
                        </td>
                        <td>
                            <span class="risk-badge risk-<?php echo strtolower($alert['risk_level']); ?>">
                                <?php echo $alert['risk_level']; ?>
                            </span>
                        </td>
                        <td>
                            <a href="transaction-details.php?id=<?php echo $alert['id']; ?>" class="btn btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php endif; ?>

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
                    <th>Sender</th>
                    <th>Receiver</th>
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
                            <td><?php echo htmlspecialchars($transaction['sender_full_name'] ?? 'System'); ?></td>
                            <td><?php echo htmlspecialchars($transaction['receiver_full_name'] ?? 'System'); ?></td>
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
                        <td colspan="7" style="text-align: center;">No transactions found</td>
                    </tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>

<!-- Recent Users -->
<div class="table-container">
    <div class="table-header">
        <h3>Recent Users</h3>
        <a href="users.php" class="btn btn-primary">View All →</a>
    </div>
    <div style="overflow-x: auto;">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Balance (TSh)</th>
                    <th>Created</th>
                </tr>
            </thead>
            <tbody>
                <?php if (count($recent_users) > 0): ?>
                    <?php foreach ($recent_users as $user): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($user['full_name']); ?></td>
                            <td><?php echo htmlspecialchars($user['email']); ?></td>
                            <td><?php echo htmlspecialchars($user['phone']); ?></td>
                            <td>TSh <?php echo number_format($user['balance'], 2); ?></td>
                            <td><?php echo date('Y-m-d', strtotime($user['created_at'])); ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php else: ?>
                    <tr>
                        <td colspan="5" style="text-align: center;">No users found</td>
                    </tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
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