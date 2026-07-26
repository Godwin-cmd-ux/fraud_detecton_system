<?php
// Get current page name
$current_page = basename($_SERVER['PHP_SELF']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fraud Detection System - User Panel</title>
    <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body>
<div class="admin-container">
    <div class="sidebar">
        <div class="sidebar-header">
            <h3>🛡️ FraudDetect</h3>
            <p>Customer Portal</p>
        </div>
        <div class="sidebar-menu">
            <a href="dashboard.php" class="menu-item <?php echo $current_page == 'dashboard.php' ? 'active' : ''; ?>">
                <span class="menu-icon">📊</span>
                <span class="menu-text">Dashboard</span>
            </a>
            <a href="send.php" class="menu-item <?php echo $current_page == 'send.php' ? 'active' : ''; ?>">
                <span class="menu-icon">💸</span>
                <span class="menu-text">Send Money</span>
            </a>
            <a href="withdraw.php" class="menu-item <?php echo $current_page == 'withdraw.php' ? 'active' : ''; ?>">
                <span class="menu-icon">🏧</span>
                <span class="menu-text">Withdraw</span>
            </a>
            <a href="transactions.php" class="menu-item <?php echo $current_page == 'transactions.php' ? 'active' : ''; ?>">
                <span class="menu-icon">📜</span>
                <span class="menu-text">Transactions</span>
            </a>
            <a href="../logout.php" class="menu-item logout-item">
                <span class="menu-icon">🚪</span>
                <span class="menu-text">Logout</span>
            </a>
        </div>
    </div>
    <div class="main-content">