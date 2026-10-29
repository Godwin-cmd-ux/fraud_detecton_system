<?php
require_once '../config/database.php';
redirectIfNotAdmin();

$database = new Database();
$db = $database->getConnection();

$user_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$message = '';
$error = '';

// Get user details
$user_query = "SELECT * FROM users WHERE id = :id";
$user_stmt = $db->prepare($user_query);
$user_stmt->execute([':id' => $user_id]);
$user = $user_stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    header("Location: users.php");
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $amount = floatval($_POST['amount']);
    $reason = sanitizeInput($_POST['reason']);
    $transaction_type = sanitizeInput($_POST['transaction_type']);
    
    // Validation
    $errors = [];
    
    if ($amount <= 0) {
        $errors[] = "Amount must be greater than 0";
    }
    
    if ($amount > 10000000) { // Maximum 10,000,000 TSh per transaction
        $errors[] = "Maximum amount per transaction is TSh 10,000,000";
    }
    
    if (empty($reason)) {
        $errors[] = "Please provide a reason for this balance adjustment";
    }
    
    if (empty($errors)) {
        // Start database transaction
        $db->beginTransaction();
        
        try {
            $old_balance = $user['balance'];
            $new_balance = $old_balance + $amount;
            $transaction_id = generateTransactionId();
            
            // Update user balance
            $update_query = "UPDATE users SET balance = balance + :amount, updated_at = NOW() WHERE id = :id";
            $update_stmt = $db->prepare($update_query);
            $update_stmt->execute([
                ':amount' => $amount,
                ':id' => $user_id
            ]);
            
            // Create transaction record
            $insert_query = "INSERT INTO transactions (transaction_id, receiver_id, receiver_name, amount, transaction_type, status, message, fraud_score, ip_address, user_agent, created_at) 
                            VALUES (:transaction_id, :receiver_id, :receiver_name, :amount, :transaction_type, 'SUCCESS', :message, 0, :ip_address, :user_agent, NOW())";
            
            $insert_stmt = $db->prepare($insert_query);
            $insert_stmt->execute([
                ':transaction_id' => $transaction_id,
                ':receiver_id' => $user_id,
                ':receiver_name' => $user['full_name'],
                ':amount' => $amount,
                ':transaction_type' => $transaction_type,
                ':message' => "Admin adjustment: " . $reason,
                ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                ':user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
            ]);
            
            // Log the action for audit trail
            $audit_query = "INSERT INTO admin_actions (admin_id, admin_name, action_type, user_id, user_name, amount, reason, ip_address, created_at) 
                           VALUES (:admin_id, :admin_name, 'add_balance', :user_id, :user_name, :amount, :reason, :ip_address, NOW())";
            $audit_stmt = $db->prepare($audit_query);
            $audit_stmt->execute([
                ':admin_id' => $_SESSION['admin_id'],
                ':admin_name' => $_SESSION['admin_name'],
                ':user_id' => $user_id,
                ':user_name' => $user['full_name'],
                ':amount' => $amount,
                ':reason' => $reason,
                ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null
            ]);
            
            $db->commit();
            
            $message = "✅ Successfully added " . formatCurrency($amount) . " to " . htmlspecialchars($user['full_name']) . "'s account!";
            // Refresh user data
            $user['balance'] = $new_balance;
            
        } catch (Exception $e) {
            $db->rollBack();
            $error = "❌ Failed to add balance: " . $e->getMessage();
        }
    } else {
        $error = implode("<br>", $errors);
    }
}

// Get recent balance adjustments for this user
$adjustments_query = "SELECT * FROM transactions 
                      WHERE receiver_id = :user_id 
                      AND transaction_type IN ('deposit', 'bonus', 'refund', 'adjustment')
                      ORDER BY created_at DESC LIMIT 10";
$adjustments_stmt = $db->prepare($adjustments_query);
$adjustments_stmt->execute([':user_id' => $user_id]);
$adjustments = $adjustments_stmt->fetchAll(PDO::FETCH_ASSOC);

include 'partials/sidebar.php';
?>

<div class="top-header">
    <div class="header-title">
        <h1>Add Balance to Account</h1>
        <p>Manage user funds: <?php echo htmlspecialchars($user['full_name']); ?></p>
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

<div class="form-container">
    <?php if ($message): ?>
        <div style="background: #d1fae5; color: #065f46; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
            <?php echo $message; ?>
        </div>
    <?php endif; ?>
    
    <?php if ($error): ?>
        <div style="background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
            <?php echo $error; ?>
        </div>
    <?php endif; ?>
    
    <!-- User Information Card -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; margin-bottom: 30px; color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
            <div>
                <h3 style="margin: 0 0 5px 0;"><?php echo htmlspecialchars($user['full_name']); ?></h3>
                <p style="margin: 0; opacity: 0.9;">📧 <?php echo htmlspecialchars($user['email']); ?></p>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">📞 <?php echo htmlspecialchars($user['phone']); ?></p>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 0.9rem; opacity: 0.9;">Current Balance</div>
                <div style="font-size: 2rem; font-weight: bold;"><?php echo formatCurrency($user['balance']); ?></div>
            </div>
        </div>
    </div>
    
    <form method="POST" action="" onsubmit="return validateForm()">
        <div class="form-row">
            <div class="form-group">
                <label for="amount">Amount to Add (TSh) *</label>
                <input type="number" id="amount" name="amount" step="0.01" required 
                       placeholder="Enter amount in Tanzanian Shillings"
                       onkeyup="updatePreview()">
                <small style="color: var(--text-light);">Min: TSh 1 | Max: TSh 10,000,000 per transaction</small>
            </div>
            
            <div class="form-group">
                <label for="transaction_type">Transaction Type *</label>
                <select id="transaction_type" name="transaction_type" required>
                    <option value="deposit">💰 Deposit</option>
                    <option value="bonus">🎁 Bonus/Cashback</option>
                    <option value="refund">🔄 Refund</option>
                    <option value="adjustment">⚙️ Balance Adjustment</option>
                </select>
            </div>
        </div>
        
        <div class="form-group">
            <label for="reason">Reason for Balance Addition *</label>
            <textarea id="reason" name="reason" rows="3" required 
                      placeholder="Explain why you're adding funds to this account (e.g., Customer promotion, Refund processing, Bonus reward, etc.)"></textarea>
            <small style="color: var(--text-light);">This reason will be recorded in the transaction history</small>
        </div>
        
        <!-- Preview Section -->
        <div id="previewSection" style="background: var(--light-bg); border-radius: 12px; padding: 15px; margin-bottom: 20px; display: none;">
            <h4 style="margin: 0 0 10px 0;">📋 Transaction Preview</h4>
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                <div>
                    <div><strong>Customer:</strong> <?php echo htmlspecialchars($user['full_name']); ?></div>
                    <div><strong>Current Balance:</strong> <?php echo formatCurrency($user['balance']); ?></div>
                </div>
                <div style="text-align: right;">
                    <div><strong>Amount to Add:</strong> <span id="previewAmount" style="color: var(--success-green); font-weight: bold;">TSh 0.00</span></div>
                    <div><strong>New Balance:</strong> <span id="previewNewBalance" style="font-weight: bold;"><?php echo formatCurrency($user['balance']); ?></span></div>
                </div>
            </div>
        </div>
        
        <div class="form-group">
            <button type="submit" class="btn btn-success" style="background: var(--success-green);">
                ✅ Add Balance to Account
            </button>
            <a href="users.php" class="btn" style="background: var(--light-bg);">← Back to Users</a>
        </div>
    </form>
    
    <!-- Recent Adjustments -->
    <?php if (count($adjustments) > 0): ?>
    <div style="margin-top: 40px;">
        <h3>Recent Balance Adjustments</h3>
        <div style="height: 2px; background: var(--border-color); margin: 10px 0 20px 0;"></div>
        
        <div style="overflow-x: auto;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Transaction ID</th>
                        <th>Amount</th>
                        <th>Type</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($adjustments as $adjustment): ?>
                    <tr>
                        <td><?php echo date('Y-m-d H:i', strtotime($adjustment['created_at'])); ?></td>
                        <td><?php echo htmlspecialchars($adjustment['transaction_id']); ?></td>
                        <td style="color: var(--success-green); font-weight: bold;">+<?php echo formatCurrency($adjustment['amount']); ?></td>
                        <td><?php echo ucfirst($adjustment['transaction_type']); ?></td>
                        <td><?php echo htmlspecialchars($adjustment['message']); ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <?php endif; ?>
</div>

<script>
function updatePreview() {
    const amount = parseFloat(document.getElementById('amount').value);
    const currentBalance = <?php echo $user['balance']; ?>;
    const previewSection = document.getElementById('previewSection');
    
    if (!isNaN(amount) && amount > 0) {
        const newBalance = currentBalance + amount;
        document.getElementById('previewAmount').innerHTML = 'TSh ' + amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        document.getElementById('previewNewBalance').innerHTML = 'TSh ' + newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        previewSection.style.display = 'block';
    } else {
        previewSection.style.display = 'none';
    }
}

function validateForm() {
    const amount = parseFloat(document.getElementById('amount').value);
    const reason = document.getElementById('reason').value.trim();
    const transactionType = document.getElementById('transaction_type').value;
    
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount greater than 0');
        return false;
    }
    
    if (amount > 10000000) {
        alert('Maximum amount per transaction is TSh 10,000,000');
        return false;
    }
    
    if (reason.length === 0) {
        alert('Please provide a reason for this balance adjustment');
        return false;
    }
    
    if (reason.length < 10) {
        alert('Please provide a more detailed reason (at least 10 characters)');
        return false;
    }
    
    let typeText = '';
    switch(transactionType) {
        case 'deposit': typeText = 'Deposit'; break;
        case 'bonus': typeText = 'Bonus/Cashback'; break;
        case 'refund': typeText = 'Refund'; break;
        case 'adjustment': typeText = 'Balance Adjustment'; break;
    }
    
    return confirm(`You are about to add ${formatCurrency(amount)} to ${document.querySelector('.top-header .header-title p').innerText}.\n\nTransaction Type: ${typeText}\nReason: ${reason}\n\nNew balance will be: ${document.getElementById('previewNewBalance').innerText}\n\nContinue?`);
}

function formatCurrency(amount) {
    return 'TSh ' + amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
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
    if (document.getElementById('currentTime')) {
        document.getElementById('currentTime').textContent = timeString + ' (EAT)';
    }
}
updateTime();
setInterval(updateTime, 1000);
</script>

<?php include 'partials/sidebar_footer.php'; ?>