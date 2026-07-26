<?php
// Get current page name and script name
$current_page = basename($_SERVER['PHP_SELF']);
$current_script = $_SERVER['SCRIPT_NAME'];

// Get admin info from session
$admin_name = $_SESSION['admin_name'] ?? 'Administrator';
$admin_initial = substr($admin_name, 0, 1);

// Get notification counts
$database = new Database();
$db = $database->getConnection();

// Get pending transactions count
$pending_query = "SELECT COUNT(*) as count FROM transactions WHERE status = 'PENDING' AND fraud_score > 0";
$pending_stmt = $db->prepare($pending_query);
$pending_stmt->execute();
$pending_count = $pending_stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Get aborted transactions count
$aborted_query = "SELECT COUNT(*) as count FROM transactions WHERE status = 'ABORTED' AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)";
$aborted_stmt = $db->prepare($aborted_query);
$aborted_stmt->execute();
$aborted_count = $aborted_stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Get new users count (last 24 hours)
$new_users_query = "SELECT COUNT(*) as count FROM users WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)";
$new_users_stmt = $db->prepare($new_users_query);
$new_users_stmt->execute();
$new_users_count = $new_users_stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Get fraud alerts count
$fraud_alerts_query = "SELECT COUNT(*) as count FROM transactions WHERE fraud_prediction = 'FRAUD' AND fraud_score > 50";
$fraud_alerts_stmt = $db->prepare($fraud_alerts_query);
$fraud_alerts_stmt->execute();
$fraud_alerts_count = $fraud_alerts_stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Get high risk count
$high_risk_query = "SELECT COUNT(*) as count FROM transactions WHERE risk_level = 'HIGH'";
$high_risk_stmt = $db->prepare($high_risk_query);
$high_risk_stmt->execute();
$high_risk_count = $high_risk_stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Get pending approval users count
$pending_users_query = "SELECT COUNT(*) as count FROM users WHERE is_approved = 0";
$pending_users_stmt = $db->prepare($pending_users_query);
$pending_users_stmt->execute();
$pending_users_count = $pending_users_stmt->fetch(PDO::FETCH_ASSOC)['count'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fraud Detection System - Admin Panel</title>
    <link rel="stylesheet" href="../assets/css/style.css">
    <style>
        /* Sidebar specific styles */
        .sidebar {
            width: 280px;
            background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
            position: fixed;
            left: 0;
            top: 0;
            height: 100vh;
            overflow-y: auto;
            z-index: 1000;
            transition: all 0.3s ease;
            box-shadow: 2px 0 10px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
        }
        
        .sidebar-header {
            padding: 30px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            text-align: center;
            flex-shrink: 0;
        }
        
        .sidebar-header h3 {
            color: white;
            margin: 0 0 5px 0;
            font-size: 1.5rem;
        }
        
        .sidebar-header p {
            color: rgba(255,255,255,0.7);
            margin: 0;
            font-size: 0.85rem;
        }
        
        .sidebar-menu {
            padding: 20px 0;
            flex: 1;
            overflow-y: auto;
            padding-bottom: 80px;
        }
        
        .menu-item {
            display: flex;
            align-items: center;
            padding: 12px 25px;
            color: rgba(255,255,255,0.8);
            text-decoration: none;
            transition: all 0.3s ease;
            margin: 2px 0;
            position: relative;
        }
        
        .menu-item:hover {
            background: rgba(37, 99, 235, 0.2);
            color: white;
            padding-left: 30px;
        }
        
        .menu-item.active {
            background: linear-gradient(90deg, var(--primary-blue) 0%, rgba(37, 99, 235, 0.8) 100%);
            color: white;
            border-left: 4px solid white;
        }
        
        .menu-icon {
            width: 30px;
            font-size: 1.2rem;
            margin-right: 15px;
        }
        
        .menu-text {
            flex: 1;
            font-size: 0.95rem;
            font-weight: 500;
        }
        
        .menu-badge {
            background: var(--danger-red);
            color: white;
            border-radius: 20px;
            padding: 2px 8px;
            font-size: 0.7rem;
            font-weight: bold;
        }
        
        .menu-badge.warning {
            background: var(--warning-yellow);
            color: #78350f;
        }
        
        .menu-badge.info {
            background: var(--primary-blue);
        }
        
        .menu-badge.fraud {
            background: #dc2626;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .logout-item {
            margin-top: 10px;
            border-top: 1px solid rgba(255,255,255,0.1);
            color: #fca5a5;
        }
        
        .logout-item:hover {
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
        }
        
        .sidebar-footer {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 15px 20px;
            border-top: 1px solid rgba(255,255,255,0.1);
            font-size: 0.8rem;
            color: rgba(255,255,255,0.6);
            text-align: center;
            background: rgba(15, 23, 42, 0.95);
            flex-shrink: 0;
            z-index: 10;
        }
        
        .sidebar::-webkit-scrollbar {
            width: 5px;
        }
        
        .sidebar::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.1);
        }
        
        .sidebar::-webkit-scrollbar-thumb {
            background: var(--primary-blue);
            border-radius: 5px;
        }
        
        .main-content {
            margin-left: 280px;
            min-height: 100vh;
            background: #f8fafc;
        }
        
        .menu-divider {
            height: 1px;
            background: rgba(255,255,255,0.05);
            margin: 10px 25px;
        }
        
        @media (max-width: 768px) {
            .sidebar {
                transform: translateX(-100%);
                width: 260px;
            }
            
            .sidebar.active {
                transform: translateX(0);
            }
            
            .main-content {
                margin-left: 0;
            }
            
            .menu-toggle {
                display: block;
                position: fixed;
                top: 20px;
                left: 20px;
                z-index: 1001;
                background: var(--primary-blue);
                color: white;
                border: none;
                padding: 10px;
                border-radius: 8px;
                cursor: pointer;
            }
        }
        
        @media (min-width: 769px) {
            .menu-toggle {
                display: none;
            }
        }
    </style>
</head>
<body>
<!-- Mobile menu toggle button -->
<button class="menu-toggle" onclick="toggleSidebar()">☰ Menu</button>

<div class="sidebar" id="sidebar">
    <div class="sidebar-header">
        <h3>🛡️ FraudDetect</h3>
        <p>Admin Control Panel</p>
        <div style="margin-top: 15px;">
            <div style="width: 50px; height: 50px; background: var(--primary-blue); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; font-size: 1.2rem; font-weight: bold;">
                <?php echo htmlspecialchars($admin_initial); ?>
            </div>
            <div style="margin-top: 8px; font-size: 0.85rem;">
                <?php echo htmlspecialchars($admin_name); ?>
            </div>
            <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">
                Administrator
            </div>
        </div>
    </div>
    
    <div class="sidebar-menu">
        <!-- Dashboard -->
        <a href="dashboard.php" class="menu-item <?php echo $current_page == 'dashboard.php' ? 'active' : ''; ?>">
            <span class="menu-icon">📊</span>
            <span class="menu-text">Dashboard</span>
        </a>
        
        <!-- Users -->
        <a href="users.php" class="menu-item <?php echo $current_page == 'users.php' ? 'active' : ''; ?>">
            <span class="menu-icon">👥</span>
            <span class="menu-text">Users</span>
            <?php if ($new_users_count > 0): ?>
                <span class="menu-badge info">+<?php echo $new_users_count; ?></span>
            <?php endif; ?>
        </a>
        
        <!-- Create User -->
        <a href="create-user.php" class="menu-item <?php echo $current_page == 'create-user.php' ? 'active' : ''; ?>">
            <span class="menu-icon">➕</span>
            <span class="menu-text">Create User</span>
        </a>
        
        <!-- Approve Users -->
        <a href="approve-users.php" class="menu-item <?php echo $current_page == 'approve-users.php' ? 'active' : ''; ?>">
            <span class="menu-icon">✅</span>
            <span class="menu-text">Approve Users</span>
            <?php if ($pending_users_count > 0): ?>
                <span class="menu-badge warning"><?php echo $pending_users_count; ?></span>
            <?php endif; ?>
        </a>
        
        <!-- Transactions -->
        <a href="transactions.php" class="menu-item <?php echo $current_page == 'transactions.php' ? 'active' : ''; ?>">
            <span class="menu-icon">💸</span>
            <span class="menu-text">Transactions</span>
            <?php if ($aborted_count > 0): ?>
                <span class="menu-badge warning"><?php echo $aborted_count; ?></span>
            <?php endif; ?>
        </a>
        
        <!-- Balance Adjustments -->
        <a href="balance-adjustments.php" class="menu-item <?php echo $current_page == 'balance-adjustments.php' ? 'active' : ''; ?>">
            <span class="menu-icon">💰</span>
            <span class="menu-text">Balance Adjustments</span>
        </a>
        
        <!-- Fraud Overview -->
        <a href="fraud-overview.php" class="menu-item <?php echo $current_page == 'fraud-overview.php' ? 'active' : ''; ?>">
            <span class="menu-icon">📈</span>
            <span class="menu-text">Fraud Overview</span>
        </a>
        
        <!-- Fraud Alerts -->
        <a href="fraud-alerts.php" class="menu-item <?php echo $current_page == 'fraud-alerts.php' ? 'active' : ''; ?>">
            <span class="menu-icon">🚨</span>
            <span class="menu-text">Fraud Alerts</span>
            <?php if ($fraud_alerts_count > 0): ?>
                <span class="menu-badge fraud"><?php echo $fraud_alerts_count; ?></span>
            <?php endif; ?>
        </a>
        
        <!-- High Risk (conditional) -->
        <?php if ($high_risk_count > 0): ?>
        <a href="transactions.php?risk_level=HIGH" class="menu-item">
            <span class="menu-icon">🔴</span>
            <span class="menu-text">High Risk</span>
            <span class="menu-badge fraud"><?php echo $high_risk_count; ?></span>
        </a>
        <?php endif; ?>
        
        <!-- AI Review Queue (conditional) -->
        <?php if ($pending_count > 0): ?>
        <a href="transactions.php?status=PENDING" class="menu-item">
            <span class="menu-icon">🤖</span>
            <span class="menu-text">AI Review Queue</span>
            <span class="menu-badge"><?php echo $pending_count; ?></span>
        </a>
        <?php endif; ?>
        
        <!-- Logout -->
        <a href="../logout.php" class="menu-item logout-item">
            <span class="menu-icon">🚪</span>
            <span class="menu-text">Logout</span>
        </a>
    </div>
    
    <div class="sidebar-footer">
        <div>Fraud Detection System v2.0</div>
        <div style="font-size: 0.7rem; margin-top: 5px;">
            🤖 AI-Powered Fraud Detection
        </div>
    </div>
</div>

<div class="main-content">

<script>
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector('.menu-toggle');
    
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(event.target) && !toggleBtn.contains(event.target)) {
            sidebar.classList.remove('active');
        }
    }
});

// Handle window resize
window.addEventListener('resize', function() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth > 768) {
        sidebar.classList.remove('active');
    }
});
</script>