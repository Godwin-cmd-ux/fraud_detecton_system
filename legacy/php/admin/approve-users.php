<?php
require_once '../config/database.php';
redirectIfNotAdmin();

$database = new Database();
$db = $database->getConnection();

$message = '';
$error = '';

// Get pending users
$pending_query = "SELECT * FROM users WHERE is_approved = 0 ORDER BY created_at DESC";
$pending_stmt = $db->prepare($pending_query);
$pending_stmt->execute();
$pending_users = $pending_stmt->fetchAll(PDO::FETCH_ASSOC);

// Get approved users
$approved_query = "SELECT * FROM users WHERE is_approved = 1 ORDER BY created_at DESC LIMIT 20";
$approved_stmt = $db->prepare($approved_query);
$approved_stmt->execute();
$approved_users = $approved_stmt->fetchAll(PDO::FETCH_ASSOC);

// Handle approval/rejection
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user_id = (int)$_POST['user_id'];
    $action = $_POST['action'];
    $reason = sanitizeInput($_POST['reason'] ?? '');
    
    if ($action === 'approve') {
        // Approve user
        $update_query = "UPDATE users SET is_approved = 1 WHERE id = ?";
        $update_stmt = $db->prepare($update_query);
        $update_stmt->execute([$user_id]);
        
        // Log action
        logAdminAction(
            $_SESSION['admin_id'],
            $_SESSION['admin_name'],
            'approve_user',
            $user_id,
            null,
            null,
            $reason,
            'User account approved'
        );
        
        $message = "✅ User approved successfully!";
    } elseif ($action === 'reject') {
        // Reject/delete user
        $delete_query = "DELETE FROM users WHERE id = ? AND is_approved = 0";
        $delete_stmt = $db->prepare($delete_query);
        $delete_stmt->execute([$user_id]);
        
        // Log action
        logAdminAction(
            $_SESSION['admin_id'],
            $_SESSION['admin_name'],
            'reject_user',
            $user_id,
            null,
            null,
            $reason,
            'User account rejected'
        );
        
        $message = "✅ User rejected and removed.";
    }
    
    // Redirect to refresh page
    header("Location: approve-users.php?message=" . urlencode($message));
    exit();
}

$message = isset($_GET['message']) ? $_GET['message'] : '';

include 'partials/sidebar.php';
?>

<div class="top-header">
    <div class="header-title">
        <h1>👥 User Approvals</h1>
        <p>Review and approve pending user registrations</p>
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

<?php if ($message): ?>
    <div style="background: #d1fae5; color: #065f46; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <?php echo htmlspecialchars($message); ?>
    </div>
<?php endif; ?>

<!-- Pending Users -->
<div class="table-container">
    <div class="table-header">
        <h3>⏳ Pending Approvals (<?php echo count($pending_users); ?>)</h3>
    </div>
    
    <?php if (count($pending_users) > 0): ?>
    <div style="overflow-x: auto;">
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Registered</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($pending_users as $user): ?>
                    <tr>
                        <td><?php echo $user['id']; ?></td>
                        <td><strong><?php echo htmlspecialchars($user['full_name']); ?></strong></td>
                        <td><?php echo htmlspecialchars($user['email']); ?></td>
                        <td><?php echo htmlspecialchars($user['phone']); ?></td>
                        <td><?php echo date('Y-m-d H:i', strtotime($user['created_at'])); ?></td>
                        <td>
                            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                                <button onclick="showApproveModal(<?php echo $user['id']; ?>, '<?php echo htmlspecialchars($user['full_name']); ?>')" 
                                        class="btn btn-success" style="padding: 5px 10px; font-size: 0.8rem;">
                                    ✅ Approve
                                </button>
                                <button onclick="showRejectModal(<?php echo $user['id']; ?>, '<?php echo htmlspecialchars($user['full_name']); ?>')" 
                                        class="btn btn-danger" style="padding: 5px 10px; font-size: 0.8rem; background: var(--danger-red);">
                                    ❌ Reject
                                </button>
                                <button onclick="viewUserDetails(<?php echo htmlspecialchars(json_encode($user)); ?>)" 
                                        class="btn btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">
                                    👁️ View
                                </button>
                            </div>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php else: ?>
        <div style="text-align: center; padding: 40px; color: var(--text-light);">
            <div style="font-size: 3rem;">✅</div>
            <div style="font-size: 1.2rem; margin-top: 10px;">No pending approvals</div>
            <div style="font-size: 0.9rem;">All users have been reviewed</div>
        </div>
    <?php endif; ?>
</div>

<!-- Approve Modal -->
<div id="approveModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; justify-content: center; align-items: center;">
    <div style="background: white; border-radius: 12px; max-width: 400px; width: 90%; padding: 30px;">
        <h3>✅ Approve User</h3>
        <p>Are you sure you want to approve <strong id="approveUserName"></strong>?</p>
        <form method="POST" action="">
            <input type="hidden" id="approveUserId" name="user_id" value="">
            <input type="hidden" name="action" value="approve">
            <div class="form-group">
                <label for="approveReason">Reason (Optional)</label>
                <textarea id="approveReason" name="reason" rows="2" placeholder="Any notes about this approval..."></textarea>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button type="button" onclick="closeModal('approveModal')" class="btn" style="flex: 1; background: var(--light-bg);">Cancel</button>
                <button type="submit" class="btn btn-success" style="flex: 1; background: var(--success-green);">Approve</button>
            </div>
        </form>
    </div>
</div>

<!-- Reject Modal -->
<div id="rejectModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; justify-content: center; align-items: center;">
    <div style="background: white; border-radius: 12px; max-width: 400px; width: 90%; padding: 30px;">
        <h3>❌ Reject User</h3>
        <p>Are you sure you want to reject <strong id="rejectUserName"></strong>? This action cannot be undone.</p>
        <form method="POST" action="">
            <input type="hidden" id="rejectUserId" name="user_id" value="">
            <input type="hidden" name="action" value="reject">
            <div class="form-group">
                <label for="rejectReason">Reason *</label>
                <textarea id="rejectReason" name="reason" rows="2" required placeholder="Why is this user being rejected?"></textarea>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button type="button" onclick="closeModal('rejectModal')" class="btn" style="flex: 1; background: var(--light-bg);">Cancel</button>
                <button type="submit" class="btn btn-danger" style="flex: 1; background: var(--danger-red);">Reject</button>
            </div>
        </form>
    </div>
</div>

<!-- User Details Modal -->
<div id="userModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; justify-content: center; align-items: center;">
    <div style="background: white; border-radius: 12px; max-width: 500px; width: 90%; max-height: 80%; overflow-y: auto; padding: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>User Details</h3>
            <button onclick="closeModal('userModal')" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        <div id="userModalContent"></div>
    </div>
</div>

<script>
function showApproveModal(userId, userName) {
    document.getElementById('approveUserId').value = userId;
    document.getElementById('approveUserName').innerHTML = userName;
    document.getElementById('approveModal').style.display = 'flex';
}

function showRejectModal(userId, userName) {
    document.getElementById('rejectUserId').value = userId;
    document.getElementById('rejectUserName').innerHTML = userName;
    document.getElementById('rejectModal').style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function viewUserDetails(user) {
    const modal = document.getElementById('userModal');
    const modalContent = document.getElementById('userModalContent');
    
    modalContent.innerHTML = `
        <div class="form-group">
            <label>Full Name</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">${user.full_name}</div>
        </div>
        <div class="form-group">
            <label>Email</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">${user.email}</div>
        </div>
        <div class="form-group">
            <label>Phone Number</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">${user.phone}</div>
        </div>
        <div class="form-group">
            <label>Card Number</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">****${user.card_number.slice(-4)}</div>
        </div>
        <div class="form-group">
            <label>Status</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">
                ${user.is_approved ? '✅ Approved' : '⏳ Pending Approval'}
            </div>
        </div>
        <div class="form-group">
            <label>Registered</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">${new Date(user.created_at).toLocaleString()}</div>
        </div>
    `;
    
    modal.style.display = 'flex';
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

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal-backdrop')) {
        closeModal(event.target.id);
    }
}
</script>

<?php include 'partials/sidebar_footer.php'; ?>