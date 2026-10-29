<?php
require_once '../config/database.php';
redirectIfNotAdmin();

$database = new Database();
$db = $database->getConnection();

// Handle approve/reject/delete actions
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    $user_id = (int)$_POST['user_id'];
    $action = $_POST['action'];
    $message = '';
    
    if ($action === 'approve') {
        $query = "UPDATE users SET is_approved = 1 WHERE id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $message = "✅ User approved successfully!";
        
        logAdminAction(
            $_SESSION['admin_id'],
            $_SESSION['admin_name'],
            'approve_user',
            $user_id,
            null,
            null,
            'User account approved',
            'User approved by admin'
        );
        
        setFlashMessage('success', $message);
    } elseif ($action === 'disapprove') {
        $query = "UPDATE users SET is_approved = 0 WHERE id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $message = "✅ User disapproved successfully!";
        
        logAdminAction(
            $_SESSION['admin_id'],
            $_SESSION['admin_name'],
            'disapprove_user',
            $user_id,
            null,
            null,
            'User account disapproved',
            'User disapproved by admin'
        );
        
        setFlashMessage('success', $message);
    } elseif ($action === 'activate') {
        $query = "UPDATE users SET is_active = 1 WHERE id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $message = "✅ User activated successfully!";
        
        logAdminAction(
            $_SESSION['admin_id'],
            $_SESSION['admin_name'],
            'activate_user',
            $user_id,
            null,
            null,
            'User account activated',
            'User activated by admin'
        );
        
        setFlashMessage('success', $message);
    } elseif ($action === 'deactivate') {
        $query = "UPDATE users SET is_active = 0 WHERE id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $message = "✅ User deactivated successfully!";
        
        logAdminAction(
            $_SESSION['admin_id'],
            $_SESSION['admin_name'],
            'deactivate_user',
            $user_id,
            null,
            null,
            'User account deactivated',
            'User deactivated by admin'
        );
        
        setFlashMessage('success', $message);
    } elseif ($action === 'delete') {
        // DELETE USER - This is permanent!
        // First, get user info for logging
        $user_query = "SELECT full_name, email FROM users WHERE id = ?";
        $user_stmt = $db->prepare($user_query);
        $user_stmt->execute([$user_id]);
        $user_data = $user_stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user_data) {
            // Delete user (cascade will delete related transactions if foreign keys are set)
            $delete_query = "DELETE FROM users WHERE id = ?";
            $delete_stmt = $db->prepare($delete_query);
            $delete_stmt->execute([$user_id]);
            
            $message = "🗑️ User deleted successfully!";
            
            logAdminAction(
                $_SESSION['admin_id'],
                $_SESSION['admin_name'],
                'delete_user',
                $user_id,
                $user_data['full_name'],
                null,
                'User account deleted',
                'User deleted by admin - Email: ' . $user_data['email']
            );
            
            setFlashMessage('success', $message);
        } else {
            setFlashMessage('error', '❌ User not found!');
        }
    }
    
    header("Location: users.php");
    exit();
}

// Pagination
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = 20;
$offset = ($page - 1) * $limit;

// Search
$search = isset($_GET['search']) ? sanitizeInput($_GET['search']) : '';

// Build query with positional placeholders for simplicity
$params = [];

if ($search) {
    $where = "WHERE full_name LIKE ? OR email LIKE ? OR phone LIKE ?";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
} else {
    $where = "";
}

// Get total records
$countQuery = "SELECT COUNT(*) as total FROM users $where";
$countStmt = $db->prepare($countQuery);
$countStmt->execute($params);
$totalRecords = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
$totalPages = ceil($totalRecords / $limit);

// Get users with pagination
$query = "SELECT * FROM users $where ORDER BY created_at DESC LIMIT ? OFFSET ?";
$stmt = $db->prepare($query);

// Add search parameters
foreach ($params as $key => $value) {
    $stmt->bindValue($key + 1, $value);
}

// Add pagination parameters
$stmt->bindValue(count($params) + 1, $limit, PDO::PARAM_INT);
$stmt->bindValue(count($params) + 2, $offset, PDO::PARAM_INT);

$stmt->execute();
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

include 'partials/sidebar.php';
?>

<style>
    .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
    }
    .status-approved {
        background: #d1fae5;
        color: #065f46;
    }
    .status-pending {
        background: #fed7aa;
        color: #92400e;
    }
    .status-active {
        background: #d1fae5;
        color: #065f46;
    }
    .status-inactive {
        background: #fee2e2;
        color: #991b1b;
    }
    .action-btn {
        padding: 4px 8px;
        font-size: 0.7rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        display: inline-block;
        margin: 2px;
    }
    .action-btn:hover {
        transform: translateY(-1px);
    }
    .btn-approve {
        background: #10b981;
        color: white;
    }
    .btn-approve:hover {
        background: #059669;
    }
    .btn-disapprove {
        background: #f59e0b;
        color: white;
    }
    .btn-disapprove:hover {
        background: #d97706;
    }
    .btn-activate {
        background: #3b82f6;
        color: white;
    }
    .btn-activate:hover {
        background: #2563eb;
    }
    .btn-deactivate {
        background: #ef4444;
        color: white;
    }
    .btn-deactivate:hover {
        background: #dc2626;
    }
    .btn-delete {
        background: #dc2626;
        color: white;
    }
    .btn-delete:hover {
        background: #991b1b;
    }
    .user-status-label {
        font-size: 0.75rem;
        margin-top: 2px;
    }
</style>

<div class="top-header">
    <div class="header-title">
        <h1>User Management</h1>
        <p>View and manage all registered users</p>
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

<?php displayFlashMessage(); ?>

<div class="table-container">
    <div class="table-header">
        <h3>All Users</h3>
        <form method="GET" action="" style="display: flex; gap: 10px; flex-wrap: wrap;">
            <input type="text" name="search" class="search-box" placeholder="Search by name, email, or phone..." 
                   value="<?php echo htmlspecialchars($search); ?>">
            <button type="submit" class="btn btn-primary">Search</button>
            <?php if ($search): ?>
                <a href="users.php" class="btn">Clear</a>
            <?php endif; ?>
        </form>
    </div>
    
    <div style="overflow-x: auto;">
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Balance (TSh)</th>
                    <th>Card Number</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php if (count($users) > 0): ?>
                    <?php foreach ($users as $user): ?>
                        <tr>
                            <td><?php echo $user['id']; ?></td>
                            <td><strong><?php echo htmlspecialchars($user['full_name']); ?></strong></td>
                            <td><?php echo htmlspecialchars($user['email']); ?></td>
                            <td><?php echo htmlspecialchars($user['phone']); ?></td>
                            <td style="font-weight: bold; color: var(--primary-blue);">
                                <?php echo formatCurrency($user['balance']); ?>
                            </td>
                            <td>****<?php echo substr($user['card_number'], -4); ?></td>
                            <td>
                                <div>
                                    <?php if ($user['is_active'] == 0): ?>
                                        <span class="status-badge status-inactive">🔴 Inactive</span>
                                    <?php elseif ($user['is_approved'] == 0): ?>
                                        <span class="status-badge status-pending">⏳ Pending</span>
                                    <?php else: ?>
                                        <span class="status-badge status-approved">✅ Active</span>
                                    <?php endif; ?>
                                </div>
                                <div class="user-status-label">
                                    <?php if ($user['is_active'] == 1 && $user['is_approved'] == 1): ?>
                                        <span style="color: #065f46;">Fully Active</span>
                                    <?php elseif ($user['is_active'] == 1 && $user['is_approved'] == 0): ?>
                                        <span style="color: #92400e;">Awaiting Approval</span>
                                    <?php elseif ($user['is_active'] == 0): ?>
                                        <span style="color: #991b1b;">Deactivated</span>
                                    <?php endif; ?>
                                </div>
                            </td>
                            <td><?php echo date('Y-m-d', strtotime($user['created_at'])); ?></td>
                            <td>
                                <div style="display: flex; flex-direction: column; gap: 3px;">
                                    <div style="display: flex; gap: 3px; flex-wrap: wrap;">
                                        <!-- Approval Actions -->
                                        <?php if ($user['is_approved'] == 0 && $user['is_active'] == 1): ?>
                                            <form method="POST" style="display: inline;" onsubmit="return confirm('Approve this user?')">
                                                <input type="hidden" name="user_id" value="<?php echo $user['id']; ?>">
                                                <input type="hidden" name="action" value="approve">
                                                <button type="submit" class="action-btn btn-approve">✅ Approve</button>
                                            </form>
                                        <?php endif; ?>
                                        
                                        <?php if ($user['is_approved'] == 1 && $user['is_active'] == 1): ?>
                                            <form method="POST" style="display: inline;" onsubmit="return confirm('Disapprove this user? This will require admin approval again.')">
                                                <input type="hidden" name="user_id" value="<?php echo $user['id']; ?>">
                                                <input type="hidden" name="action" value="disapprove">
                                                <button type="submit" class="action-btn btn-disapprove">⏳ Disapprove</button>
                                            </form>
                                        <?php endif; ?>
                                        
                                        <!-- Activation Actions -->
                                        <?php if ($user['is_active'] == 0): ?>
                                            <form method="POST" style="display: inline;" onsubmit="return confirm('Activate this user?')">
                                                <input type="hidden" name="user_id" value="<?php echo $user['id']; ?>">
                                                <input type="hidden" name="action" value="activate">
                                                <button type="submit" class="action-btn btn-activate">▶️ Activate</button>
                                            </form>
                                        <?php else: ?>
                                            <form method="POST" style="display: inline;" onsubmit="return confirm('Deactivate this user? They will not be able to login.')">
                                                <input type="hidden" name="user_id" value="<?php echo $user['id']; ?>">
                                                <input type="hidden" name="action" value="deactivate">
                                                <button type="submit" class="action-btn btn-deactivate">⏹️ Deactivate</button>
                                            </form>
                                        <?php endif; ?>
                                        
                                        <!-- Delete Action -->
                                        <form method="POST" style="display: inline;" 
                                              onsubmit="return confirm('⚠️ WARNING: This action is permanent!\n\nAre you sure you want to DELETE this user?\nThis will remove all their data including transactions.\n\nUser: <?php echo htmlspecialchars($user['full_name']); ?>\nEmail: <?php echo htmlspecialchars($user['email']); ?>\n\nThis action CANNOT be undone!')">
                                            <input type="hidden" name="user_id" value="<?php echo $user['id']; ?>">
                                            <input type="hidden" name="action" value="delete">
                                            <button type="submit" class="action-btn btn-delete">🗑️ Delete</button>
                                        </form>
                                    </div>
                                    <div style="display: flex; gap: 3px; flex-wrap: wrap;">
                                        <a href="add-balance.php?id=<?php echo $user['id']; ?>" 
                                           class="action-btn" 
                                           style="background: var(--success-green); color: white; padding: 4px 8px; font-size: 0.7rem; border-radius: 4px; text-decoration: none;">
                                            💰 Add Balance
                                        </a>
                                        <button onclick="viewUserDetails(<?php echo htmlspecialchars(json_encode($user)); ?>)" 
                                                class="action-btn" 
                                                style="background: var(--primary-blue); color: white; padding: 4px 8px; font-size: 0.7rem; border-radius: 4px; border: none; cursor: pointer;">
                                            👁️ View
                                        </button>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php else: ?>
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 40px;">
                            <div style="font-size: 1rem; color: var(--text-light);">No users found</div>
                        </td>
                    </tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
    
    <?php if ($totalPages > 1): ?>
        <div class="pagination">
            <?php for ($i = 1; $i <= $totalPages; $i++): ?>
                <a href="?page=<?php echo $i; ?><?php echo $search ? '&search=' . urlencode($search) : ''; ?>" 
                   class="<?php echo $i == $page ? 'active' : ''; ?>">
                    <?php echo $i; ?>
                </a>
            <?php endfor; ?>
        </div>
    <?php endif; ?>
</div>

<!-- User Details Modal -->
<div id="userModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; justify-content: center; align-items: center;">
    <div style="background: white; border-radius: 12px; max-width: 500px; width: 90%; max-height: 80%; overflow-y: auto; padding: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>User Details</h3>
            <button onclick="closeModal()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        <div id="userModalContent"></div>
    </div>
</div>

<script>
function viewUserDetails(user) {
    const modal = document.getElementById('userModal');
    const modalContent = document.getElementById('userModalContent');
    
    const statusText = user.is_active == 0 ? '🔴 Inactive' : 
                       (user.is_approved == 0 ? '⏳ Pending Approval' : '✅ Active');
    const statusColor = user.is_active == 0 ? '#991b1b' : 
                        (user.is_approved == 0 ? '#92400e' : '#065f46');
    
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
            <label>Current Balance</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px; font-size: 1.3rem; font-weight: bold; color: var(--primary-blue);">
                ${formatCurrency(user.balance)}
            </div>
        </div>
        <div class="form-group">
            <label>Card Number</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">****${user.card_number.slice(-4)}</div>
        </div>
        <div class="form-group">
            <label>Status</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">
                <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
            </div>
        </div>
        <div class="form-group">
            <label>Account Created</label>
            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px;">${new Date(user.created_at).toLocaleDateString()}</div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
            <div style="display: flex; gap: 10px;">
                <a href="add-balance.php?id=${user.id}" class="btn btn-success" style="flex: 1; text-align: center;">💰 Add Balance</a>
                <button onclick="closeModal()" class="btn" style="flex: 1; background: var(--light-bg);">Close</button>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                ${user.is_approved == 0 && user.is_active == 1 ? `
                    <form method="POST" style="flex: 1;">
                        <input type="hidden" name="user_id" value="${user.id}">
                        <input type="hidden" name="action" value="approve">
                        <button type="submit" class="btn btn-success" style="width: 100%; text-align: center; background: #10b981;">✅ Approve User</button>
                    </form>
                ` : ''}
                ${user.is_approved == 1 && user.is_active == 1 ? `
                    <form method="POST" style="flex: 1;">
                        <input type="hidden" name="user_id" value="${user.id}">
                        <input type="hidden" name="action" value="disapprove">
                        <button type="submit" class="btn btn-warning" style="width: 100%; text-align: center; background: #f59e0b; color: white;">⏳ Disapprove</button>
                    </form>
                ` : ''}
                ${user.is_active == 0 ? `
                    <form method="POST" style="flex: 1;">
                        <input type="hidden" name="user_id" value="${user.id}">
                        <input type="hidden" name="action" value="activate">
                        <button type="submit" class="btn btn-primary" style="width: 100%; text-align: center;">▶️ Activate</button>
                    </form>
                ` : `
                    <form method="POST" style="flex: 1;">
                        <input type="hidden" name="user_id" value="${user.id}">
                        <input type="hidden" name="action" value="deactivate">
                        <button type="submit" class="btn btn-danger" style="width: 100%; text-align: center;">⏹️ Deactivate</button>
                    </form>
                `}
                <form method="POST" style="flex: 1;" 
                      onsubmit="return confirm('⚠️ WARNING: This action is permanent!\n\nAre you sure you want to DELETE this user?\nThis will remove all their data including transactions.\n\nUser: ${user.full_name}\nEmail: ${user.email}\n\nThis action CANNOT be undone!')">
                    <input type="hidden" name="user_id" value="${user.id}">
                    <input type="hidden" name="action" value="delete">
                    <button type="submit" class="btn btn-danger" style="width: 100%; text-align: center; background: #dc2626;">🗑️ Delete User</button>
                </form>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('userModal').style.display = 'none';
}

function formatCurrency(amount) {
    return 'TSh ' + parseFloat(amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
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