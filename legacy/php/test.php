<?php
require_once 'config/database.php';

// Check if user is logged in as admin
if (!isAdminLoggedIn()) {
    // Use relative path for redirect
    header("Location: login.php");
    exit();
}

$database = new Database();
$db = $database->getConnection();

// Get users for dropdown
$users_query = "SELECT id, full_name, email FROM users ORDER BY full_name";
$users_stmt = $db->prepare($users_query);
$users_stmt->execute();
$users = $users_stmt->fetchAll(PDO::FETCH_ASSOC);

$selected_user = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

// Handle manual test record
if (isset($_POST['test_record']) && isset($_POST['test_user_id'])) {
    $test_user = (int)$_POST['test_user_id'];
    $test_receiver = (int)$_POST['test_receiver_id'];
    $tx_id = 'TEST_' . time() . '_' . rand(1000, 9999);
    $amount = rand(1000, 10000);
    
    // Create a test transaction ID
    $test_transaction_id = 'TXN_TEST_' . time() . rand(100, 999);
    
    $result = recordReceiverActivity($test_user, $test_receiver, $test_transaction_id, $amount);
    
    if ($result) {
        $test_message = "✅ Recorded successfully! Transaction ID: $test_transaction_id, Amount: " . formatCurrency($amount);
    } else {
        $test_message = "❌ Failed to record!";
    }
}

// Run debug function if user selected
if ($selected_user > 0) {
    ob_start();
    debugReceiverActivity($selected_user);
    $debug_output = ob_get_clean();
}

// Check database tables exist
$tables_check = [];
$tables = ['receiver_activity', 'receiver_interval_counts', 'failed_withdrawal_attempts'];
foreach ($tables as $table) {
    $query = "SHOW TABLES LIKE '$table'";
    $stmt = $db->prepare($query);
    $stmt->execute();
    $tables_check[$table] = $stmt->rowCount() > 0;
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Debug Receiver Tracking</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; margin: 0; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f0f0f0; }
        .success { color: green; font-weight: bold; }
        .error { color: red; font-weight: bold; }
        .warning { color: orange; font-weight: bold; }
        .info { color: blue; }
        select, button { padding: 10px 15px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #2563eb; color: white; border: none; cursor: pointer; }
        button:hover { background: #1d4ed8; }
        .header { background: #1e293b; color: white; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { margin: 0; }
        .table-status { margin: 15px 0; padding: 15px; border-radius: 4px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .table-status .exists { color: green; }
        .table-status .missing { color: red; }
        .nav-links { margin: 15px 0; padding: 10px; background: #f1f5f9; border-radius: 4px; }
        .nav-links a { color: #2563eb; text-decoration: none; margin-right: 15px; }
        .nav-links a:hover { text-decoration: underline; }
        .test-result { padding: 10px; margin: 10px 0; border-radius: 4px; background: #f0fdf4; border: 1px solid #86efac; }
        .test-result.error { background: #fee2e2; border-color: #fca5a5; }
        pre { background: #f8fafc; padding: 15px; border-radius: 4px; overflow-x: auto; border: 1px solid #e2e8f0; }
        .debug-output { background: #f8fafc; padding: 15px; border-radius: 4px; border: 1px solid #e2e8f0; margin: 10px 0; }
        .debug-output pre { margin: 0; background: transparent; border: none; padding: 0; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>🔍 Debug Receiver Tracking</h1>
    </div>
    
    <div class="nav-links">
        <a href="admin/dashboard.php">📊 Dashboard</a>
        <a href="admin/users.php">👥 Users</a>
        <a href="admin/transactions.php">💸 Transactions</a>
        <a href="admin/fraud-overview.php">🛡️ Fraud Overview</a>
        <a href="logout.php">🚪 Logout</a>
    </div>
    
    <!-- Check if tables exist -->
    <div class="table-status">
        <strong>📋 Database Tables Status:</strong><br>
        <?php foreach ($tables_check as $table => $exists): ?>
            <?php if ($exists): ?>
                <span class="exists">✅ <?php echo $table; ?> exists</span><br>
            <?php else: ?>
                <span class="missing">❌ <?php echo $table; ?> is MISSING - Please create it</span><br>
            <?php endif; ?>
        <?php endforeach; ?>
    </div>
    
    <!-- Test message -->
    <?php if (isset($test_message)): ?>
        <div class="test-result <?php echo strpos($test_message, 'Failed') !== false ? 'error' : ''; ?>">
            <?php echo $test_message; ?>
        </div>
    <?php endif; ?>
    
    <form method="GET" style="margin: 20px 0; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <label><strong>Select User:</strong></label>
        <select name="user_id" onchange="this.form.submit()" style="padding: 10px; min-width: 300px;">
            <option value="">-- Select User --</option>
            <?php foreach ($users as $user): ?>
                <option value="<?php echo $user['id']; ?>" <?php echo $selected_user == $user['id'] ? 'selected' : ''; ?>>
                    <?php echo htmlspecialchars($user['full_name']); ?> (<?php echo htmlspecialchars($user['email']); ?>)
                </option>
            <?php endforeach; ?>
        </select>
        <?php if ($selected_user > 0): ?>
            <a href="debug_receivers.php" style="color: #ef4444; text-decoration: none; padding: 8px 15px; border: 1px solid #ef4444; border-radius: 4px;">Clear</a>
        <?php endif; ?>
    </form>
    
    <?php if ($selected_user > 0): ?>
        <hr>
        <h3>🔵 Manual Test: Record Receiver Activity</h3>
        <p>This will create a test transaction and record it in the receiver tables.</p>
        <form method="POST" style="margin: 10px 0; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <input type="hidden" name="test_user_id" value="<?php echo $selected_user; ?>">
            <input type="hidden" name="test_receiver_id" value="<?php echo $selected_user; ?>">
            <button type="submit" name="test_record" value="1">🔵 Test Record</button>
        </form>
        
        <?php 
        if (isset($debug_output)) {
            echo '<div class="debug-output">';
            echo $debug_output;
            echo '</div>';
        }
        ?>
        
        <hr>
        <h3>📊 Raw Database Tables</h3>
        
        <h4>receiver_activity</h4>
        <?php
        $query = "SELECT * FROM receiver_activity WHERE user_id = ? ORDER BY created_at DESC LIMIT 20";
        $stmt = $db->prepare($query);
        $stmt->execute([$selected_user]);
        $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);
        ?>
        <?php if (count($activities) > 0): ?>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Receiver ID</th>
                        <th>Transaction ID</th>
                        <th>Amount</th>
                        <th>Created At</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($activities as $row): ?>
                        <tr>
                            <td><?php echo $row['id']; ?></td>
                            <td><?php echo $row['receiver_id']; ?></td>
                            <td><?php echo htmlspecialchars($row['transaction_id']); ?></td>
                            <td><?php echo formatCurrency($row['amount']); ?></td>
                            <td><?php echo $row['created_at']; ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php else: ?>
            <p class="warning">⚠️ No records found in receiver_activity for this user.</p>
        <?php endif; ?>
        
        <h4>receiver_interval_counts</h4>
        <?php
        $query = "SELECT * FROM receiver_interval_counts WHERE user_id = ? ORDER BY interval_start DESC LIMIT 10";
        $stmt = $db->prepare($query);
        $stmt->execute([$selected_user]);
        $intervals = $stmt->fetchAll(PDO::FETCH_ASSOC);
        ?>
        <?php if (count($intervals) > 0): ?>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Interval Start</th>
                        <th>Unique Receivers</th>
                        <th>Total Transactions</th>
                        <th>Total Amount</th>
                        <th>Blocked</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($intervals as $row): ?>
                        <tr>
                            <td><?php echo $row['id']; ?></td>
                            <td><?php echo $row['interval_start']; ?></td>
                            <td><?php echo $row['unique_receiver_count']; ?></td>
                            <td><?php echo $row['total_transactions']; ?></td>
                            <td><?php echo formatCurrency($row['total_amount']); ?></td>
                            <td><?php echo $row['is_blocked'] ? '🚫 Yes' : '✅ No'; ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php else: ?>
            <p class="warning">⚠️ No records found in receiver_interval_counts for this user.</p>
        <?php endif; ?>
        
    <?php else: ?>
        <div style="padding: 40px; text-align: center; color: #6b7280;">
            <p style="font-size: 1.2rem;">👆 Select a user from the dropdown above to view their receiver activity</p>
            <p>This will show you all receiver tracking data for that user.</p>
        </div>
    <?php endif; ?>
</div>
</body>
</html>