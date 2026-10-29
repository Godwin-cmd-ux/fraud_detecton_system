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
$type_filter = isset($_GET['type']) ? sanitizeInput($_GET['type']) : '';
$date_from = isset($_GET['date_from']) ? sanitizeInput($_GET['date_from']) : '';
$date_to = isset($_GET['date_to']) ? sanitizeInput($_GET['date_to']) : '';
$admin_filter = isset($_GET['admin']) ? sanitizeInput($_GET['admin']) : '';

// Build query for total count
$where_conditions = [];
$params = [];

$where_conditions[] = "t.transaction_type IN ('deposit', 'bonus', 'refund', 'adjustment')";

if ($search) {
    $where_conditions[] = "(t.transaction_id LIKE :search OR u.full_name LIKE :search OR u.email LIKE :search OR t.message LIKE :search)";
    $params[':search'] = "%$search%";
}

if ($type_filter) {
    $where_conditions[] = "t.transaction_type = :type";
    $params[':type'] = $type_filter;
}

if ($date_from) {
    $where_conditions[] = "DATE(t.created_at) >= :date_from";
    $params[':date_from'] = $date_from;
}

if ($date_to) {
    $where_conditions[] = "DATE(t.created_at) <= :date_to";
    $params[':date_to'] = $date_to;
}

if ($admin_filter) {
    $where_conditions[] = "t.admin_id = :admin_id";
    $params[':admin_id'] = $admin_filter;
}

$where_sql = count($where_conditions) > 0 ? "WHERE " . implode(" AND ", $where_conditions) : "";

// Get total records
$countQuery = "SELECT COUNT(*) as total 
                FROM transactions t
                LEFT JOIN users u ON t.receiver_id = u.id
                $where_sql";
$countStmt = $db->prepare($countQuery);
foreach ($params as $key => $value) {
    $countStmt->bindValue($key, $value);
}
$countStmt->execute();
$totalRecords = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
$totalPages = ceil($totalRecords / $limit);

// Get all balance adjustments
$query = "SELECT t.*, 
          u.full_name as user_name, 
          u.email as user_email,
          u.phone as user_phone,
          u.card_number,
          a.full_name as admin_full_name,
          a.username as admin_username
          FROM transactions t
          LEFT JOIN users u ON t.receiver_id = u.id
          LEFT JOIN admins a ON t.admin_id = a.id
          $where_sql
          ORDER BY t.created_at DESC 
          LIMIT :limit OFFSET :offset";

$stmt = $db->prepare($query);
foreach ($params as $key => $value) {
    $stmt->bindValue($key, $value);
}
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$adjustments = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get statistics
$statsQuery = "SELECT 
                COUNT(*) as total_adjustments,
                SUM(amount) as total_amount,
                AVG(amount) as avg_amount,
                COUNT(DISTINCT receiver_id) as unique_users,
                COUNT(DISTINCT admin_id) as unique_admins
               FROM transactions 
               WHERE transaction_type IN ('deposit', 'bonus', 'refund', 'adjustment')";
$statsStmt = $db->prepare($statsQuery);
$statsStmt->execute();
$stats = $statsStmt->fetch(PDO::FETCH_ASSOC);

// Get adjustment types summary
$typesQuery = "SELECT 
                transaction_type,
                COUNT(*) as count,
                SUM(amount) as total
               FROM transactions 
               WHERE transaction_type IN ('deposit', 'bonus', 'refund', 'adjustment')
               GROUP BY transaction_type";
$typesStmt = $db->prepare($typesQuery);
$typesStmt->execute();
$type_summary = $typesStmt->fetchAll(PDO::FETCH_ASSOC);

// Get admins list for filter
$adminsQuery = "SELECT id, full_name, username FROM admins WHERE is_active = 1 ORDER BY full_name";
$adminsStmt = $db->prepare($adminsQuery);
$adminsStmt->execute();
$admins = $adminsStmt->fetchAll(PDO::FETCH_ASSOC);

include 'partials/sidebar.php';
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Balance Adjustments - Admin Panel</title>
    <style>
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card-small {
            background: white;
            border-radius: 12px;
            padding: 15px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-card-small .stat-value {
            font-size: 1.8rem;
            font-weight: bold;
            color: var(--primary-blue);
        }
        .stat-card-small .stat-label {
            font-size: 0.8rem;
            color: var(--text-light);
            margin-top: 5px;
        }
        .filter-section {
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .filter-form {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            align-items: end;
        }
        .filter-group {
            display: flex;
            flex-direction: column;
        }
        .filter-group label {
            font-size: 0.8rem;
            font-weight: 600;
            margin-bottom: 5px;
            color: var(--text-dark);
        }
        .filter-group input, .filter-group select {
            padding: 8px 12px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            font-size: 0.9rem;
        }
        .type-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .type-deposit { background: #d1fae5; color: #065f46; }
        .type-bonus { background: #fed7aa; color: #92400e; }
        .type-refund { background: #e0f2fe; color: #075985; }
        .type-adjustment { background: #e0e7ff; color: #3730a3; }
        .export-buttons {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            justify-content: flex-end;
        }
        .btn-export {
            padding: 8px 16px;
            background: var(--light-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.85rem;
            transition: all 0.3s ease;
        }
        .btn-export:hover {
            background: var(--primary-blue);
            color: white;
        }
        @media print {
            .sidebar, .top-header, .filter-section, .export-buttons, .pagination, .btn {
                display: none;
            }
            .main-content {
                margin: 0;
                padding: 0;
            }
            .table-container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>

<div class="top-header">
    <div class="header-title">
        <h1>💰 Balance Adjustments Log</h1>
        <p>View all admin-initiated balance additions and adjustments</p>
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

<!-- Statistics Summary -->
<div class="stats-grid">
    <div class="stat-card-small">
        <div class="stat-value"><?php echo number_format($stats['total_adjustments'] ?? 0); ?></div>
        <div class="stat-label">Total Adjustments</div>
    </div>
    <div class="stat-card-small">
        <div class="stat-value"><?php echo formatCurrency($stats['total_amount'] ?? 0); ?></div>
        <div class="stat-label">Total Amount Added</div>
    </div>
    <div class="stat-card-small">
        <div class="stat-value"><?php echo formatCurrency($stats['avg_amount'] ?? 0); ?></div>
        <div class="stat-label">Average Amount</div>
    </div>
    <div class="stat-card-small">
        <div class="stat-value"><?php echo number_format($stats['unique_users'] ?? 0); ?></div>
        <div class="stat-label">Unique Users</div>
    </div>
    <div class="stat-card-small">
        <div class="stat-value"><?php echo number_format($stats['unique_admins'] ?? 0); ?></div>
        <div class="stat-label">Unique Admins</div>
    </div>
</div>

<!-- Adjustment Types Summary -->
<div class="filter-section">
    <h4 style="margin-bottom: 15px;">Adjustment Types Summary</h4>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
        <?php foreach ($type_summary as $type): ?>
        <div style="text-align: center; padding: 10px; background: var(--light-bg); border-radius: 8px;">
            <div class="type-badge type-<?php echo $type['transaction_type']; ?>">
                <?php echo ucfirst($type['transaction_type']); ?>
            </div>
            <div style="font-size: 1.2rem; font-weight: bold; margin-top: 8px;">
                <?php echo number_format($type['count']); ?>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-light);">
                <?php echo formatCurrency($type['total']); ?>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
</div>

<!-- Filter Section -->
<div class="filter-section">
    <form method="GET" action="" class="filter-form">
        <div class="filter-group">
            <label>🔍 Search</label>
            <input type="text" name="search" placeholder="Transaction ID, User, Reason..." 
                   value="<?php echo htmlspecialchars($search); ?>">
        </div>
        
        <div class="filter-group">
            <label>📊 Transaction Type</label>
            <select name="type">
                <option value="">All Types</option>
                <option value="deposit" <?php echo $type_filter == 'deposit' ? 'selected' : ''; ?>>Deposit</option>
                <option value="bonus" <?php echo $type_filter == 'bonus' ? 'selected' : ''; ?>>Bonus</option>
                <option value="refund" <?php echo $type_filter == 'refund' ? 'selected' : ''; ?>>Refund</option>
                <option value="adjustment" <?php echo $type_filter == 'adjustment' ? 'selected' : ''; ?>>Adjustment</option>
            </select>
        </div>
        
        <div class="filter-group">
            <label>👤 Admin</label>
            <select name="admin">
                <option value="">All Admins</option>
                <?php foreach ($admins as $admin): ?>
                    <option value="<?php echo $admin['id']; ?>" <?php echo $admin_filter == $admin['id'] ? 'selected' : ''; ?>>
                        <?php echo htmlspecialchars($admin['full_name']); ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        
        <div class="filter-group">
            <label>📅 Date From</label>
            <input type="date" name="date_from" value="<?php echo htmlspecialchars($date_from); ?>">
        </div>
        
        <div class="filter-group">
            <label>📅 Date To</label>
            <input type="date" name="date_to" value="<?php echo htmlspecialchars($date_to); ?>">
        </div>
        
        <div class="filter-group">
            <button type="submit" class="btn btn-primary">Apply Filters</button>
        </div>
        
        <?php if ($search || $type_filter || $date_from || $date_to || $admin_filter): ?>
            <div class="filter-group">
                <a href="balance-adjustments.php" class="btn" style="background: var(--light-bg); text-align: center;">Clear Filters</a>
            </div>
        <?php endif; ?>
    </form>
</div>

<!-- Export Buttons -->
<div class="export-buttons">
    <button onclick="exportToCSV()" class="btn-export">📊 Export to CSV</button>
    <button onclick="window.print()" class="btn-export">🖨️ Print Report</button>
</div>

<!-- Adjustments Table -->
<div class="table-container">
    <div class="table-header">
        <h3>All Balance Adjustments</h3>
        <div>Total: <?php echo number_format($totalRecords); ?> records</div>
    </div>
    
    <div style="overflow-x: auto;">
        <table class="data-table" id="adjustmentsTable">
            <thead>
                <tr>
                    <th>Date & Time</th>
                    <th>Transaction ID</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Admin</th>
                    <th>Reason</th>
                    <th>IP Address</th>
                </tr>
            </thead>
            <tbody>
                <?php if (count($adjustments) > 0): ?>
                    <?php foreach ($adjustments as $adjustment): ?>
                        <tr>
                            <td style="white-space: nowrap;">
                                <?php echo date('Y-m-d H:i:s', strtotime($adjustment['created_at'])); ?>
                            </td>
                            <td>
                                <code style="font-size: 0.8rem;"><?php echo htmlspecialchars($adjustment['transaction_id']); ?></code>
                            </td>
                            <td>
                                <strong><?php echo htmlspecialchars($adjustment['user_name'] ?? 'Unknown'); ?></strong><br>
                                <small style="color: var(--text-light);">
                                    <?php echo htmlspecialchars($adjustment['user_email'] ?? 'No email'); ?>
                                </small>
                             </td>
                            <td style="color: var(--success-green); font-weight: bold; white-space: nowrap;">
                                +<?php echo formatCurrency($adjustment['amount']); ?>
                             </td>
                            <td>
                                <span class="type-badge type-<?php echo $adjustment['transaction_type']; ?>">
                                    <?php echo ucfirst($adjustment['transaction_type']); ?>
                                </span>
                             </td>
                            <td>
                                <?php if ($adjustment['admin_full_name']): ?>
                                    <strong><?php echo htmlspecialchars($adjustment['admin_full_name']); ?></strong><br>
                                    <small style="color: var(--text-light);">@<?php echo htmlspecialchars($adjustment['admin_username']); ?></small>
                                <?php else: ?>
                                    <span style="color: var(--text-light);">System</span>
                                <?php endif; ?>
                             </td>
                            <td style="max-width: 300px;">
                                <?php echo htmlspecialchars($adjustment['message']); ?>
                             </td>
                            <td>
                                <code style="font-size: 0.7rem;"><?php echo htmlspecialchars($adjustment['ip_address'] ?? 'N/A'); ?></code>
                             </td>
                        </tr>
                    <?php endforeach; ?>
                <?php else: ?>
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 40px;">
                            <div style="font-size: 1rem; color: var(--text-light);">
                                📭 No balance adjustments found
                            </div>
                            <div style="font-size: 0.85rem; margin-top: 10px;">
                                <a href="add-balance.php" class="btn btn-primary">Add Balance to a User</a>
                            </div>
                        </td>
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
            $base_url = 'balance-adjustments.php';
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

function exportToCSV() {
    // Get the table data
    const table = document.getElementById('adjustmentsTable');
    const rows = table.querySelectorAll('tr');
    let csv = [];
    
    // Get headers
    const headers = [];
    const headerCells = rows[0].querySelectorAll('th');
    headerCells.forEach(cell => {
        headers.push(cell.innerText);
    });
    csv.push(headers.join(','));
    
    // Get data rows
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const rowData = [];
            cells.forEach(cell => {
                // Clean the data (remove HTML tags, handle commas)
                let text = cell.innerText.replace(/,/g, ';').replace(/\n/g, ' ');
                rowData.push('"' + text + '"');
            });
            csv.push(rowData.join(','));
        }
    }
    
    // Download CSV
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'balance-adjustments-' + new Date().toISOString().slice(0,19) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Auto-refresh filters when date changes
document.querySelectorAll('input[type="date"]').forEach(input => {
    input.addEventListener('change', () => {
        document.querySelector('.filter-form').submit();
    });
});

updateTime();
setInterval(updateTime, 1000);
</script>

<?php include 'partials/sidebar_footer.php'; ?>