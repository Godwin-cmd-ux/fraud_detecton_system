<?php
require_once '../config/database.php';
redirectIfNotAdmin();

$database = new Database();
$db = $database->getConnection();

// Get overall statistics
$stats_query = "SELECT 
                    COUNT(*) as total_transactions,
                    SUM(CASE WHEN fraud_prediction = 'FRAUD' THEN 1 ELSE 0 END) as fraud_count,
                    SUM(CASE WHEN fraud_prediction = 'LEGIT' THEN 1 ELSE 0 END) as legit_count,
                    SUM(CASE WHEN fraud_prediction = 'PENDING' OR fraud_prediction IS NULL THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_risk,
                    SUM(CASE WHEN risk_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_risk,
                    SUM(CASE WHEN risk_level = 'LOW' THEN 1 ELSE 0 END) as low_risk,
                    AVG(fraud_score) as avg_score,
                    MAX(fraud_score) as max_score,
                    MIN(fraud_score) as min_score
                FROM transactions";
$stats_stmt = $db->prepare($stats_query);
$stats_stmt->execute();
$stats = $stats_stmt->fetch(PDO::FETCH_ASSOC);

// Get daily fraud trends (last 7 days)
$trends_query = "SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total,
                    SUM(CASE WHEN fraud_prediction = 'FRAUD' THEN 1 ELSE 0 END) as frauds,
                    SUM(CASE WHEN fraud_prediction = 'LEGIT' THEN 1 ELSE 0 END) as legit
                FROM transactions
                WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY DATE(created_at)
                ORDER BY date ASC";
$trends_stmt = $db->prepare($trends_query);
$trends_stmt->execute();
$trends_data = $trends_stmt->fetchAll(PDO::FETCH_ASSOC);

// Get fraud by transaction type
$type_query = "SELECT 
                    transaction_type,
                    COUNT(*) as total,
                    SUM(CASE WHEN fraud_prediction = 'FRAUD' THEN 1 ELSE 0 END) as frauds
                FROM transactions
                WHERE fraud_prediction IS NOT NULL
                GROUP BY transaction_type";
$type_stmt = $db->prepare($type_query);
$type_stmt->execute();
$type_data = $type_stmt->fetchAll(PDO::FETCH_ASSOC);

// Get fraud by hour
$hourly_query = "SELECT 
                    HOUR(created_at) as hour,
                    COUNT(*) as total,
                    SUM(CASE WHEN fraud_prediction = 'FRAUD' THEN 1 ELSE 0 END) as frauds
                FROM transactions
                WHERE fraud_prediction IS NOT NULL
                GROUP BY HOUR(created_at)
                ORDER BY hour";
$hourly_stmt = $db->prepare($hourly_query);
$hourly_stmt->execute();
$hourly_data = $hourly_stmt->fetchAll(PDO::FETCH_ASSOC);

// Get top fraud suspects (users with most fraud transactions)
$suspects_query = "SELECT 
                    u.id,
                    u.full_name,
                    u.email,
                    COUNT(t.id) as fraud_count,
                    SUM(t.amount) as total_amount
                FROM users u
                JOIN transactions t ON u.id = t.sender_id
                WHERE t.fraud_prediction = 'FRAUD'
                GROUP BY u.id
                ORDER BY fraud_count DESC
                LIMIT 10";
$suspects_stmt = $db->prepare($suspects_query);
$suspects_stmt->execute();
$suspects = $suspects_stmt->fetchAll(PDO::FETCH_ASSOC);

include 'partials/sidebar.php';
?>

<style>
    .stat-card-fraud {
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        text-align: center;
    }
    .stat-card-fraud .stat-value {
        font-size: 2rem;
        font-weight: bold;
    }
    .stat-card-fraud .stat-label {
        font-size: 0.85rem;
        color: var(--text-light);
        margin-top: 5px;
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
    .chart-container {
        height: 250px;
        margin: 20px 0;
    }
    .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 30px;
    }
    .summary-item {
        background: var(--light-bg);
        padding: 15px;
        border-radius: 8px;
        text-align: center;
    }
    .summary-item .number {
        font-size: 1.5rem;
        font-weight: bold;
    }
    .summary-item .label {
        font-size: 0.8rem;
        color: var(--text-light);
    }
    @media (max-width: 768px) {
        .summary-grid {
            grid-template-columns: 1fr 1fr;
        }
    }
</style>

<div class="top-header">
    <div class="header-title">
        <h1>🛡️ Fraud Detection Overview</h1>
        <p>Comprehensive fraud analytics and monitoring dashboard</p>
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

<!-- Summary Statistics -->
<div class="summary-grid">
    <div class="summary-item" style="border-left: 4px solid #3b82f6;">
        <div class="number"><?php echo number_format($stats['total_transactions'] ?? 0); ?></div>
        <div class="label">Total Transactions Analyzed</div>
    </div>
    <div class="summary-item" style="border-left: 4px solid #ef4444;">
        <div class="number" style="color: #dc2626;"><?php echo number_format($stats['fraud_count'] ?? 0); ?></div>
        <div class="label">Fraud Detected</div>
    </div>
    <div class="summary-item" style="border-left: 4px solid #10b981;">
        <div class="number" style="color: #059669;"><?php echo number_format($stats['legit_count'] ?? 0); ?></div>
        <div class="label">Legitimate Transactions</div>
    </div>
    <div class="summary-item" style="border-left: 4px solid #f59e0b;">
        <div class="number" style="color: #d97706;"><?php echo number_format($stats['avg_score'] ?? 0, 1); ?>%</div>
        <div class="label">Average Risk Score</div>
    </div>
</div>

<!-- Statistics Cards -->
<div class="stats-grid">
    <div class="stat-card">
        <div class="stat-header">
            <span>🔴 High Risk</span>
            <div class="stat-icon">🚨</div>
        </div>
        <div class="stat-value" style="color: #dc2626;"><?php echo number_format($stats['high_risk'] ?? 0); ?></div>
        <div class="stat-label"><?php 
            $total = $stats['total_transactions'] ?? 1;
            echo number_format(($stats['high_risk'] ?? 0) / $total * 100, 1);
        ?>% of total</div>
    </div>
    
    <div class="stat-card">
        <div class="stat-header">
            <span>🟡 Medium Risk</span>
            <div class="stat-icon">⚠️</div>
        </div>
        <div class="stat-value" style="color: #d97706;"><?php echo number_format($stats['medium_risk'] ?? 0); ?></div>
        <div class="stat-label"><?php 
            echo number_format(($stats['medium_risk'] ?? 0) / $total * 100, 1);
        ?>% of total</div>
    </div>
    
    <div class="stat-card">
        <div class="stat-header">
            <span>🟢 Low Risk</span>
            <div class="stat-icon">✅</div>
        </div>
        <div class="stat-value" style="color: #059669;"><?php echo number_format($stats['low_risk'] ?? 0); ?></div>
        <div class="stat-label"><?php 
            echo number_format(($stats['low_risk'] ?? 0) / $total * 100, 1);
        ?>% of total</div>
    </div>
    
    <div class="stat-card">
        <div class="stat-header">
            <span>⏳ Pending Analysis</span>
            <div class="stat-icon">⏳</div>
        </div>
        <div class="stat-value" style="color: #6b7280;"><?php echo number_format($stats['pending_count'] ?? 0); ?></div>
        <div class="stat-label">Awaiting AI analysis</div>
    </div>
</div>

<!-- Risk Score Range -->
<div class="table-container">
    <div class="table-header">
        <h3>Risk Score Range</h3>
    </div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
        <div style="background: #fee2e2; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.8rem; color: #991b1b;">Highest Risk Score</div>
            <div style="font-size: 2rem; font-weight: bold; color: #dc2626;"><?php echo number_format($stats['max_score'] ?? 0, 1); ?>%</div>
        </div>
        <div style="background: #d1fae5; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.8rem; color: #065f46;">Lowest Risk Score</div>
            <div style="font-size: 2rem; font-weight: bold; color: #059669;"><?php echo number_format($stats['min_score'] ?? 0, 1); ?>%</div>
        </div>
        <div style="background: #e0f2fe; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.8rem; color: #075985;">Average Risk Score</div>
            <div style="font-size: 2rem; font-weight: bold; color: #3b82f6;"><?php echo number_format($stats['avg_score'] ?? 0, 1); ?>%</div>
        </div>
    </div>
</div>

<!-- Daily Trends Chart -->
<div class="table-container">
    <div class="table-header">
        <h3>Daily Fraud Trends (Last 7 Days)</h3>
    </div>
    <div class="chart-container">
        <canvas id="trendsChart"></canvas>
    </div>
</div>

<!-- Fraud by Transaction Type -->
<div class="table-container">
    <div class="table-header">
        <h3>Fraud by Transaction Type</h3>
    </div>
    <div class="chart-container">
        <canvas id="typeChart"></canvas>
    </div>
</div>

<!-- Hourly Fraud Activity -->
<div class="table-container">
    <div class="table-header">
        <h3>Fraud Activity by Hour</h3>
    </div>
    <div class="chart-container">
        <canvas id="hourlyChart"></canvas>
    </div>
</div>

<!-- Top Fraud Suspects -->
<div class="table-container">
    <div class="table-header">
        <h3>Top Fraud Suspects</h3>
        <span>Users with most fraud transactions</span>
    </div>
    <?php if (count($suspects) > 0): ?>
    <div style="overflow-x: auto;">
        <table class="data-table">
            <thead>
                <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Fraud Count</th>
                    <th>Total Amount</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($suspects as $suspect): ?>
                    <tr>
                        <td><strong><?php echo htmlspecialchars($suspect['full_name']); ?></strong></td>
                        <td><?php echo htmlspecialchars($suspect['email']); ?></td>
                        <td style="color: #dc2626; font-weight: bold;"><?php echo number_format($suspect['fraud_count']); ?></td>
                        <td>TSh <?php echo number_format($suspect['total_amount'], 2); ?></td>
                        <td>
                            <a href="users.php?search=<?php echo urlencode($suspect['full_name']); ?>" class="btn btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View User</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php else: ?>
    <div style="text-align: center; padding: 30px; color: var(--text-light);">
        No fraud suspects identified yet
    </div>
    <?php endif; ?>
</div>

<!-- Quick Actions -->
<div class="table-container">
    <div class="table-header">
        <h3>Quick Actions</h3>
    </div>
    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <a href="fraud-alerts.php" class="btn btn-danger" style="background: #dc2626; color: white; padding: 12px 25px;">
            🚨 View All Fraud Alerts
        </a>
        <a href="transactions.php?fraud_filter=fraud" class="btn btn-warning" style="background: #f59e0b; color: white; padding: 12px 25px;">
            ⚠️ Fraud Transactions
        </a>
        <a href="transactions.php?risk_level=HIGH" class="btn btn-danger" style="background: #dc2626; color: white; padding: 12px 25px;">
            🔴 High Risk Transactions
        </a>
        <a href="transactions.php" class="btn btn-primary" style="padding: 12px 25px;">
            📊 All Transactions
        </a>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
// Daily Trends Chart
const trendsCtx = document.getElementById('trendsChart').getContext('2d');
const trendsData = <?php echo json_encode($trends_data); ?>;

new Chart(trendsCtx, {
    type: 'line',
    data: {
        labels: trendsData.map(d => d.date),
        datasets: [
            {
                label: 'Total Transactions',
                data: trendsData.map(d => d.total),
                borderColor: 'rgba(59, 130, 246, 1)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            },
            {
                label: 'Fraud Detected',
                data: trendsData.map(d => d.frauds),
                borderColor: 'rgba(239, 68, 68, 1)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.4
            },
            {
                label: 'Legitimate',
                data: trendsData.map(d => d.legit),
                borderColor: 'rgba(16, 185, 129, 1)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            }
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});

// Transaction Type Chart
const typeCtx = document.getElementById('typeChart').getContext('2d');
const typeData = <?php echo json_encode($type_data); ?>;

new Chart(typeCtx, {
    type: 'bar',
    data: {
        labels: typeData.map(d => d.transaction_type.charAt(0).toUpperCase() + d.transaction_type.slice(1)),
        datasets: [
            {
                label: 'Total Transactions',
                data: typeData.map(d => d.total),
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            },
            {
                label: 'Fraud Detected',
                data: typeData.map(d => d.frauds),
                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 1
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            }
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});

// Hourly Activity Chart
const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');
const hourlyData = <?php echo json_encode($hourly_data); ?>;

new Chart(hourlyCtx, {
    type: 'bar',
    data: {
        labels: hourlyData.map(d => d.hour + ':00'),
        datasets: [
            {
                label: 'Total Transactions',
                data: hourlyData.map(d => d.total),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            },
            {
                label: 'Fraud Detected',
                data: hourlyData.map(d => d.frauds),
                backgroundColor: 'rgba(239, 68, 68, 0.5)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 1
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            }
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
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
    document.getElementById('currentTime').textContent = timeString + ' (EAT)';
}
updateTime();
setInterval(updateTime, 1000);
</script>

<?php include 'partials/sidebar_footer.php'; ?>