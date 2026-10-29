<?php
require_once '../config/database.php';
redirectIfNotAdmin();

$database = new Database();
$db = $database->getConnection();

// Pagination
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = 20;
$offset = ($page - 1) * $limit;

// Filters
$search = isset($_GET['search']) ? sanitizeInput($_GET['search']) : '';
$risk_level = isset($_GET['risk_level']) ? sanitizeInput($_GET['risk_level']) : '';
$date_from = isset($_GET['date_from']) ? sanitizeInput($_GET['date_from']) : '';
$date_to = isset($_GET['date_to']) ? sanitizeInput($_GET['date_to']) : '';

// Build query
$where = "WHERE t.fraud_prediction = 'FRAUD' AND t.fraud_score > 50";
$params = [];

if ($search) {
    $where .= " AND (t.transaction_id LIKE ? OR sender.full_name LIKE ? OR receiver.full_name LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

if ($risk_level) {
    $where .= " AND t.risk_level = ?";
    $params[] = $risk_level;
}

if ($date_from) {
    $where .= " AND DATE(t.created_at) >= ?";
    $params[] = $date_from;
}

if ($date_to) {
    $where .= " AND DATE(t.created_at) <= ?";
    $params[] = $date_to;
}

// Get total records
$countQuery = "SELECT COUNT(*) as total FROM transactions t $where";
$countStmt = $db->prepare($countQuery);
$countStmt->execute($params);
$totalRecords = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
$totalPages = ceil($totalRecords / $limit);

// Get fraud alerts
$query = "SELECT t.*, 
          sender.full_name as sender_name, 
          receiver.full_name as receiver_name
          FROM transactions t
          LEFT JOIN users sender ON t.sender_id = sender.id
          LEFT JOIN users receiver ON t.receiver_id = receiver.id
          $where
          ORDER BY t.created_at DESC 
          LIMIT ? OFFSET ?";

$params[] = $limit;
$params[] = $offset;

$stmt = $db->prepare($query);
$stmt->execute($params);
$alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

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
    .alert-row-high { background: #fef2f2; }
    .alert-row-high:hover { background: #fee2e2; }
    .fraud-score-bar {
        width: 100px;
        height: 8px;
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
        <h1>🚨 Fraud Alerts</h1>
        <p>Monitor and investigate suspicious transactions</p>
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
        <h3>Fraud Alerts (<?php echo number_format($totalRecords); ?>)</h3>
        <form method="GET" action="" style="display: flex; gap: 10px; flex-wrap: wrap;">
            <input type="text" name="search" class="search-box" placeholder="Search by ID, sender, receiver..." 
                   value="<?php echo htmlspecialchars($search); ?>">
            <select name="risk_level" class="search-box" style="width: auto;">
                <option value="">All Risk Levels</option>
                <option value="HIGH" <?php echo $risk_level == 'HIGH' ? 'selected' : ''; ?>>High Risk</option>
                <option value="MEDIUM" <?php echo $risk_level == 'MEDIUM' ? 'selected' : ''; ?>>Medium Risk</option>
                <option value="LOW" <?php echo $risk_level == 'LOW' ? 'selected' : ''; ?>>Low Risk</option>
            </select>
            <input type="date" name="date_from" class="search-box" style="width: auto;" value="<?php echo htmlspecialchars($date_from); ?>">
            <input type="date" name="date_to" class="search-box" style="width: auto;" value="<?php echo htmlspecialchars($date_to); ?>">
            <button type="submit" class="btn btn-primary">Filter</button>
            <?php if ($search || $risk_level || $date_from || $date_to): ?>
                <a href="fraud-alerts.php" class="btn">Clear Filters</a>
            <?php endif; ?>
        </form>
    </div>
    
    <?php if (count($alerts) > 0): ?>
    <div style="overflow-x: auto;">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date & Time</th>
                    <th>Transaction ID</th>
                    <th>Sender</th>
                    <th>Receiver</th>
                    <th>Amount</th>
                    <th>Risk Score</th>
                    <th>Risk Level</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($alerts as $alert): ?>
                    <tr class="alert-row-<?php echo strtolower($alert['risk_level']); ?>">
                        <td><?php echo date('Y-m-d H:i:s', strtotime($alert['created_at'])); ?></td>
                        <td><?php echo htmlspecialchars($alert['transaction_id']); ?></td>
                        <td><?php echo htmlspecialchars($alert['sender_name'] ?? 'Unknown'); ?></td>
                        <td><?php echo htmlspecialchars($alert['receiver_name'] ?? 'Unknown'); ?></td>
                        <td>TSh <?php echo number_format($alert['amount'], 2); ?></td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="fraud-score-bar">
                                    <div class="fill" style="width: <?php echo $alert['fraud_score']; ?>%; background: <?php echo $alert['fraud_score'] > 70 ? '#ef4444' : '#f59e0b'; ?>;"></div>
                                </div>
                                <span style="font-weight: bold; <?php echo $alert['fraud_score'] > 70 ? 'color: #dc2626;' : 'color: #d97706;'; ?>">
                                    <?php echo $alert['fraud_score']; ?>%
                                </span>
                            </div>
                        </td>
                        <td>
                            <span class="risk-badge risk-<?php echo strtolower($alert['risk_level']); ?>">
                                <?php echo $alert['risk_level']; ?>
                            </span>
                        </td>
                        <td>
                            <span class="status-badge status-<?php echo strtolower($alert['status']); ?>">
                                <?php echo $alert['status']; ?>
                            </span>
                        </td>
                        <td>
                            <div style="display: flex; gap: 5px;">
                                <a href="transaction-details.php?id=<?php echo $alert['id']; ?>" 
                                   class="btn btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</a>
                                <button onclick="markReviewed(<?php echo $alert['id']; ?>)" 
                                        class="btn btn-success" style="padding: 5px 10px; font-size: 0.8rem;">Mark Reviewed</button>
                            </div>
                        </td>
                    </tr>
                <?php endforeach; ?>
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
    
    <?php else: ?>
        <div style="text-align: center; padding: 60px;">
            <div style="font-size: 4rem;">✅</div>
            <div style="font-size: 1.5rem; font-weight: bold; margin-top: 20px; color: var(--text-dark);">No Fraud Alerts</div>
            <div style="font-size: 1rem; color: var(--text-light);">All transactions appear legitimate</div>
        </div>
    <?php endif; ?>
</div>

<script>
function markReviewed(transactionId) {
    if (confirm('Mark this transaction as reviewed?')) {
        // AJAX call to mark as reviewed
        fetch('ajax/mark_fraud_reviewed.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'transaction_id=' + transactionId
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            } else {
                alert('Error marking as reviewed');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error marking as reviewed');
        });
    }
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