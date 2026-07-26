<?php
require_once '../config/database.php';
redirectIfNotAdmin();

$database = new Database();
$db = $database->getConnection();

// Pagination
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = 20;
$offset = ($page - 1) * $limit;

// Search and filters
$search = isset($_GET['search']) ? sanitizeInput($_GET['search']) : '';
$status = isset($_GET['status']) ? sanitizeInput($_GET['status']) : '';
$type = isset($_GET['type']) ? sanitizeInput($_GET['type']) : '';
$risk_level = isset($_GET['risk_level']) ? sanitizeInput($_GET['risk_level']) : '';
$fraud_filter = isset($_GET['fraud_filter']) ? sanitizeInput($_GET['fraud_filter']) : '';

// Build query
$where = "WHERE 1=1";
$params = [];

if ($search) {
    $where .= " AND (t.transaction_id LIKE ? OR sender.full_name LIKE ? OR receiver.full_name LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

if ($status) {
    $where .= " AND t.status = ?";
    $params[] = $status;
}

if ($type) {
    $where .= " AND t.transaction_type = ?";
    $params[] = $type;
}

if ($risk_level) {
    $where .= " AND t.risk_level = ?";
    $params[] = $risk_level;
}

if ($fraud_filter) {
    if ($fraud_filter === 'fraud') {
        $where .= " AND t.fraud_prediction = 'FRAUD'";
    } elseif ($fraud_filter === 'legit') {
        $where .= " AND t.fraud_prediction = 'LEGIT'";
    } elseif ($fraud_filter === 'pending') {
        $where .= " AND (t.fraud_prediction = 'PENDING' OR t.fraud_prediction IS NULL)";
    }
}

// Get total records
$countQuery = "SELECT COUNT(*) as total FROM transactions t $where";
$countStmt = $db->prepare($countQuery);
$countStmt->execute($params);
$totalRecords = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
$totalPages = ceil($totalRecords / $limit);

// Get transactions
$query = "SELECT t.*, 
          sender.full_name as sender_name, 
          receiver.full_name as receiver_name 
          FROM transactions t
          LEFT JOIN users sender ON t.sender_id = sender.id
          LEFT JOIN users receiver ON t.receiver_id = receiver.id
          $where 
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
</style>

<div class="top-header">
    <div class="header-title">
        <h1>Transaction Monitoring</h1>
        <p>View and analyze all financial transactions with fraud detection</p>
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

<div class="table-container">
    <div class="table-header">
        <h3>All Transactions</h3>
        <form method="GET" action="" style="display: flex; gap: 10px; flex-wrap: wrap;">
            <input type="text" name="search" class="search-box" placeholder="Search by ID, sender, receiver..." 
                   value="<?php echo htmlspecialchars($search); ?>">
            <select name="status" class="search-box" style="width: auto;">
                <option value="">All Status</option>
                <option value="SUCCESS" <?php echo $status == 'SUCCESS' ? 'selected' : ''; ?>>Success</option>
                <option value="ABORTED" <?php echo $status == 'ABORTED' ? 'selected' : ''; ?>>Aborted</option>
                <option value="PENDING" <?php echo $status == 'PENDING' ? 'selected' : ''; ?>>Pending</option>
            </select>
            <select name="type" class="search-box" style="width: auto;">
                <option value="">All Types</option>
                <option value="transfer" <?php echo $type == 'transfer' ? 'selected' : ''; ?>>Transfer</option>
                <option value="deposit" <?php echo $type == 'deposit' ? 'selected' : ''; ?>>Deposit</option>
                <option value="withdrawal" <?php echo $type == 'withdrawal' ? 'selected' : ''; ?>>Withdrawal</option>
            </select>
            <select name="risk_level" class="search-box" style="width: auto;">
                <option value="">All Risk Levels</option>
                <option value="HIGH" <?php echo $risk_level == 'HIGH' ? 'selected' : ''; ?>>High Risk</option>
                <option value="MEDIUM" <?php echo $risk_level == 'MEDIUM' ? 'selected' : ''; ?>>Medium Risk</option>
                <option value="LOW" <?php echo $risk_level == 'LOW' ? 'selected' : ''; ?>>Low Risk</option>
            </select>
            <select name="fraud_filter" class="search-box" style="width: auto;">
                <option value="">All Transactions</option>
                <option value="fraud" <?php echo $fraud_filter == 'fraud' ? 'selected' : ''; ?>>🚨 Fraud Only</option>
                <option value="legit" <?php echo $fraud_filter == 'legit' ? 'selected' : ''; ?>>✅ Legitimate Only</option>
                <option value="pending" <?php echo $fraud_filter == 'pending' ? 'selected' : ''; ?>>⏳ Pending Analysis</option>
            </select>
            <button type="submit" class="btn btn-primary">Filter</button>
            <?php if ($search || $status || $type || $risk_level || $fraud_filter): ?>
                <a href="transactions.php" class="btn">Clear Filters</a>
            <?php endif; ?>
        </form>
    </div>
    
    <div style="overflow-x: auto;">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Transaction ID</th>
                    <th>Sender</th>
                    <th>Receiver</th>
                    <th>Amount (TSh)</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Risk Score</th>
                    <th>Risk Level</th>
                    <th>Date</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php if (count($transactions) > 0): ?>
                    <?php foreach ($transactions as $transaction): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($transaction['transaction_id']); ?></td>
                            <td><?php echo htmlspecialchars($transaction['sender_name'] ?? 'System'); ?></td>
                            <td><?php echo htmlspecialchars($transaction['receiver_name'] ?? 'System'); ?></td>
                            <td>TSh <?php echo number_format($transaction['amount'], 2); ?></td>
                            <td><?php echo ucfirst($transaction['transaction_type']); ?></td>
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
                                <a href="transaction-details.php?id=<?php echo $transaction['id']; ?>" 
                                   class="btn btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php else: ?>
                    <tr>
                        <td colspan="10" style="text-align: center;">No transactions found</td>
                    </tr>
                <?php endif; ?>
            </tbody>
        </table>
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