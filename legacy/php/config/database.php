<?php
// Database configuration
class Database {
    private $host = "localhost";
    private $db_name = "fraud_detection_system";
    private $username = "root";
    private $password = "";
    private $charset = "utf8mb4";
    public $conn;

    public function getConnection() {
        $this->conn = null;
        try {
            $dsn = "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=" . $this->charset;
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . $this->charset
            ];
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
        } catch(PDOException $exception) {
            error_log("Connection error: " . $exception->getMessage());
            die("Database connection failed. Please try again later.");
        }
        return $this->conn;
    }
}

// Start session if not started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ==================== AUTHENTICATION FUNCTIONS ====================

function isLoggedIn() {
    if (session_status() === PHP_SESSION_NONE) {
        return false;
    }
    $is_admin_logged = isset($_SESSION['admin_id']) && isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
    $is_user_logged = isset($_SESSION['user_id']) && isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
    return $is_admin_logged || $is_user_logged;
}

function isAdminLoggedIn() {
    if (session_status() === PHP_SESSION_NONE) {
        return false;
    }
    return isset($_SESSION['admin_id']) && 
           isset($_SESSION['is_admin']) && 
           $_SESSION['is_admin'] === true &&
           isset($_SESSION['logged_in']) && 
           $_SESSION['logged_in'] === true;
}

function isUserLoggedIn() {
    if (session_status() === PHP_SESSION_NONE) {
        return false;
    }
    return isset($_SESSION['user_id']) && 
           isset($_SESSION['is_admin']) && 
           $_SESSION['is_admin'] === false &&
           isset($_SESSION['logged_in']) && 
           $_SESSION['logged_in'] === true;
}

function redirectIfNotAdmin() {
    if (!isAdminLoggedIn()) {
        header("Location: ../login.php");
        exit();
    }
}

function redirectIfNotUser() {
    if (!isUserLoggedIn()) {
        header("Location: ../login.php");
        exit();
    }
}

function logout() {
    $_SESSION = array();
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
}

// ==================== SANITIZATION FUNCTIONS ====================

function sanitizeInput($data) {
    if ($data === null) {
        return '';
    }
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    return $data;
}

function sanitizeArray($array) {
    if (!is_array($array)) {
        return sanitizeInput($array);
    }
    return array_map('sanitizeArray', $array);
}

// ==================== TRANSACTION FUNCTIONS ====================

function generateTransactionId() {
    return 'TXN' . date('YmdHis') . rand(1000, 9999);
}

function formatCurrency($amount) {
    if ($amount === null) {
        $amount = 0;
    }
    return 'TSh ' . number_format((float)$amount, 2, '.', ',');
}

function formatAmount($amount) {
    return number_format((float)$amount, 2, '.', ',');
}

// ==================== FRAUD DETECTION FUNCTIONS ====================

function logForAIAnalysis($transaction_id, $data) {
    $log_dir = __DIR__ . '/../logs/';
    $log_file = $log_dir . 'ai_transactions.log';
    
    if (!file_exists($log_dir)) {
        mkdir($log_dir, 0755, true);
    }
    
    $log_entry = date('Y-m-d H:i:s') . " | Transaction: $transaction_id | Data: " . json_encode($data) . PHP_EOL;
    file_put_contents($log_file, $log_entry, FILE_APPEND | LOCK_EX);
}

// ==================== AUDIT FUNCTIONS ====================

function logAdminAction($admin_id, $admin_name, $action_type, $user_id = null, $user_name = null, $amount = null, $reason = null, $details = null) {
    $database = new Database();
    $db = $database->getConnection();
    
    try {
        $table_check = "SHOW TABLES LIKE 'admin_actions'";
        $table_stmt = $db->prepare($table_check);
        $table_stmt->execute();
        
        if ($table_stmt->rowCount() > 0) {
            $query = "INSERT INTO admin_actions (admin_id, admin_name, action_type, user_id, user_name, amount, reason, details, ip_address, created_at) 
                      VALUES (:admin_id, :admin_name, :action_type, :user_id, :user_name, :amount, :reason, :details, :ip_address, NOW())";
            
            $stmt = $db->prepare($query);
            $stmt->execute([
                ':admin_id' => $admin_id,
                ':admin_name' => $admin_name,
                ':action_type' => $action_type,
                ':user_id' => $user_id,
                ':user_name' => $user_name,
                ':amount' => $amount,
                ':reason' => $reason,
                ':details' => $details,
                ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null
            ]);
        }
        return true;
    } catch (Exception $e) {
        error_log("Failed to log admin action: " . $e->getMessage());
        return false;
    }
}

// ==================== USER FUNCTIONS ====================

function getUserById($user_id) {
    $database = new Database();
    $db = $database->getConnection();
    $query = "SELECT * FROM users WHERE id = ? AND is_active = 1";
    $stmt = $db->prepare($query);
    $stmt->execute([$user_id]);
    return $stmt->fetch();
}

function getUserBalance($user_id) {
    $database = new Database();
    $db = $database->getConnection();
    $query = "SELECT balance FROM users WHERE id = ?";
    $stmt = $db->prepare($query);
    $stmt->execute([$user_id]);
    $result = $stmt->fetch();
    return $result ? (float)$result['balance'] : 0;
}

function updateUserBalance($user_id, $new_balance) {
    $database = new Database();
    $db = $database->getConnection();
    $query = "UPDATE users SET balance = ?, updated_at = NOW() WHERE id = ?";
    $stmt = $db->prepare($query);
    return $stmt->execute([$new_balance, $user_id]);
}

// ==================== VALIDATION FUNCTIONS ====================

function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function validatePhone($phone) {
    $phone = preg_replace('/\s+/', '', $phone);
    return preg_match('/^(\+255|0)[0-9]{9}$/', $phone);
}

function validateAmount($amount) {
    return is_numeric($amount) && $amount > 0;
}

function validateCardNumber($card_number) {
    $card_number = preg_replace('/\s+/', '', $card_number);
    if (!ctype_digit($card_number) || strlen($card_number) < 16 || strlen($card_number) > 20) {
        return false;
    }
    $sum = 0;
    $numDigits = strlen($card_number);
    $parity = $numDigits % 2;
    for ($i = 0; $i < $numDigits; $i++) {
        $digit = $card_number[$i];
        if ($i % 2 == $parity) {
            $digit *= 2;
            if ($digit > 9) {
                $digit -= 9;
            }
        }
        $sum += $digit;
    }
    return ($sum % 10) == 0;
}

// ==================== PAGINATION FUNCTIONS ====================

function paginate($current_page, $total_pages, $url, $params = []) {
    if ($total_pages <= 1) {
        return '';
    }
    $html = '<div class="pagination">';
    if ($current_page > 1) {
        $params['page'] = $current_page - 1;
        $query = http_build_query($params);
        $html .= '<a href="' . $url . '?' . $query . '">← Previous</a>';
    }
    $start = max(1, $current_page - 2);
    $end = min($total_pages, $current_page + 2);
    if ($start > 1) {
        $params['page'] = 1;
        $query = http_build_query($params);
        $html .= '<a href="' . $url . '?' . $query . '">1</a>';
        if ($start > 2) $html .= '<span>...</span>';
    }
    for ($i = $start; $i <= $end; $i++) {
        $params['page'] = $i;
        $query = http_build_query($params);
        $active_class = ($i == $current_page) ? 'active' : '';
        $html .= '<a href="' . $url . '?' . $query . '" class="' . $active_class . '">' . $i . '</a>';
    }
    if ($end < $total_pages) {
        if ($end < $total_pages - 1) $html .= '<span>...</span>';
        $params['page'] = $total_pages;
        $query = http_build_query($params);
        $html .= '<a href="' . $url . '?' . $query . '">' . $total_pages . '</a>';
    }
    if ($current_page < $total_pages) {
        $params['page'] = $current_page + 1;
        $query = http_build_query($params);
        $html .= '<a href="' . $url . '?' . $query . '">Next →</a>';
    }
    $html .= '</div>';
    return $html;
}

// ==================== NOTIFICATION FUNCTIONS ====================

function setFlashMessage($type, $message) {
    $_SESSION['flash_message'] = [
        'type' => $type,
        'message' => $message,
        'timestamp' => time()
    ];
}

function getFlashMessage() {
    if (isset($_SESSION['flash_message'])) {
        $message = $_SESSION['flash_message'];
        unset($_SESSION['flash_message']);
        return $message;
    }
    return null;
}

function displayFlashMessage() {
    $flash = getFlashMessage();
    if ($flash) {
        $bg_color = $flash['type'] == 'success' ? '#d1fae5' : ($flash['type'] == 'error' ? '#fee2e2' : '#e0f2fe');
        $text_color = $flash['type'] == 'success' ? '#065f46' : ($flash['type'] == 'error' ? '#991b1b' : '#075985');
        $icon = $flash['type'] == 'success' ? '✅' : ($flash['type'] == 'error' ? '❌' : 'ℹ️');
        echo '<div style="background: ' . $bg_color . '; color: ' . $text_color . '; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ' . ($flash['type'] == 'success' ? '#10b981' : ($flash['type'] == 'error' ? '#ef4444' : '#3b82f6')) . ';">';
        echo $icon . ' ' . htmlspecialchars($flash['message']);
        echo '</div>';
    }
}

// ==================== SECURITY FUNCTIONS ====================

function generateCSRFToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCSRFToken($token) {
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

function initializeDirectories() {
    $directories = [__DIR__ . '/../logs', __DIR__ . '/../temp'];
    foreach ($directories as $dir) {
        if (!file_exists($dir)) {
            mkdir($dir, 0755, true);
        }
    }
}

// ==================== LOGIN ATTEMPT FUNCTIONS ====================

/**
 * Check if login is locked for the given email or IP
 */
function isLoginLocked($email) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        
        // Check lockout for this email/IP
        $query = "SELECT lockout_until FROM login_attempts 
                  WHERE (email = ? OR ip_address = ?) 
                  AND lockout_until > NOW()
                  ORDER BY lockout_until DESC LIMIT 1";
        $stmt = $db->prepare($query);
        $stmt->execute([$email, $ip]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result && $result['lockout_until']) {
            return [
                'locked' => true,
                'lockout_until' => $result['lockout_until'],
                'time_remaining' => ceil((strtotime($result['lockout_until']) - time()) / 60)
            ];
        }
        
        return ['locked' => false];
    } catch (Exception $e) {
        error_log("Error in isLoginLocked: " . $e->getMessage());
        return ['locked' => false];
    }
}

/**
 * Record a failed login attempt
 */
function recordFailedLoginAttempt($email, $user_id = null) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        
        // Get current attempt count for this email/IP
        $query = "SELECT id, attempt_count FROM login_attempts 
                  WHERE email = ? AND ip_address = ? 
                  AND (lockout_until IS NULL OR lockout_until < NOW())
                  ORDER BY created_at DESC LIMIT 1";
        $stmt = $db->prepare($query);
        $stmt->execute([$email, $ip]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $new_count = 1;
        $lockout_until = null;
        
        if ($existing) {
            $new_count = $existing['attempt_count'] + 1;
            
            // If 3 or more failures, lock for 5 minutes
            if ($new_count >= 3) {
                $lockout_until = date('Y-m-d H:i:s', strtotime('+5 minutes'));
            }
            
            // Update existing record
            $update_query = "UPDATE login_attempts 
                             SET attempt_count = ?, 
                                 lockout_until = ?,
                                 user_id = ?,
                                 updated_at = NOW()
                             WHERE id = ?";
            $update_stmt = $db->prepare($update_query);
            $update_stmt->execute([$new_count, $lockout_until, $user_id, $existing['id']]);
        } else {
            // Insert new record
            $insert_query = "INSERT INTO login_attempts 
                             (email, ip_address, user_id, attempt_count, lockout_until, created_at) 
                             VALUES (?, ?, ?, ?, ?, NOW())";
            $insert_stmt = $db->prepare($insert_query);
            $insert_stmt->execute([$email, $ip, $user_id, $new_count, $lockout_until]);
        }
        
        // Also log the failed attempt in a separate table for audit
        $log_query = "INSERT INTO failed_login_log (email, ip_address, user_id, attempted_at) 
                      VALUES (?, ?, ?, NOW())";
        $log_stmt = $db->prepare($log_query);
        $log_stmt->execute([$email, $ip, $user_id]);
        
        return [
            'attempt_count' => $new_count,
            'lockout_until' => $lockout_until
        ];
    } catch (Exception $e) {
        error_log("Error in recordFailedLoginAttempt: " . $e->getMessage());
        return ['attempt_count' => 0, 'lockout_until' => null];
    }
}

/**
 * Reset login attempts after successful login
 */
function resetLoginAttempts($email, $ip) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        
        $query = "UPDATE login_attempts 
                  SET attempt_count = 0, 
                      lockout_until = NULL,
                      updated_at = NOW()
                  WHERE email = ? AND ip_address = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$email, $ip]);
        
        return true;
    } catch (Exception $e) {
        error_log("Error in resetLoginAttempts: " . $e->getMessage());
        return false;
    }
}

/**
 * Get login attempt info for display
 */
function getLoginAttemptInfo($email) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        
        $query = "SELECT attempt_count, lockout_until FROM login_attempts 
                  WHERE email = ? AND ip_address = ? 
                  ORDER BY created_at DESC LIMIT 1";
        $stmt = $db->prepare($query);
        $stmt->execute([$email, $ip]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result) {
            return [
                'attempt_count' => (int)$result['attempt_count'],
                'lockout_until' => $result['lockout_until']
            ];
        }
        return ['attempt_count' => 0, 'lockout_until' => null];
    } catch (Exception $e) {
        error_log("Error in getLoginAttemptInfo: " . $e->getMessage());
        return ['attempt_count' => 0, 'lockout_until' => null];
    }
}

/**
 * Create login log tables if they don't exist
 */
function createLoginLogTables() {
    try {
        $database = new Database();
        $db = $database->getConnection();
        
        // Create login_attempts table
        $query1 = "CREATE TABLE IF NOT EXISTS login_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            email VARCHAR(100) NOT NULL,
            ip_address VARCHAR(45) NOT NULL,
            attempt_count INT DEFAULT 1,
            lockout_until DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email (email),
            INDEX idx_ip_address (ip_address),
            INDEX idx_lockout_until (lockout_until)
        )";
        $stmt1 = $db->prepare($query1);
        $stmt1->execute();
        
        // Create failed_login_log table
        $query2 = "CREATE TABLE IF NOT EXISTS failed_login_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(100) NOT NULL,
            ip_address VARCHAR(45) NOT NULL,
            user_id INT NULL,
            attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_email (email),
            INDEX idx_ip_address (ip_address),
            INDEX idx_attempted_at (attempted_at)
        )";
        $stmt2 = $db->prepare($query2);
        $stmt2->execute();
        
        return true;
    } catch (Exception $e) {
        error_log("Error creating login log tables: " . $e->getMessage());
        return false;
    }
}

// ==================== FRAUD DETECTION HELPER FUNCTIONS ====================

function getTransactionCountLast5Min($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "SELECT COUNT(*) as count FROM transactions 
                  WHERE sender_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)($result['count'] ?? 0);
    } catch (Exception $e) {
        error_log("Error in getTransactionCountLast5Min: " . $e->getMessage());
        return 0;
    }
}

function getAmountLast5Min($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
                  WHERE sender_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return (float)($result['total'] ?? 0);
    } catch (Exception $e) {
        error_log("Error in getAmountLast5Min: " . $e->getMessage());
        return 0;
    }
}

function getUniqueReceiversLast5Min($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "SELECT COUNT(DISTINCT receiver_id) as count FROM transactions 
                  WHERE sender_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)($result['count'] ?? 0);
    } catch (Exception $e) {
        error_log("Error in getUniqueReceiversLast5Min: " . $e->getMessage());
        return 0;
    }
}

function getUniqueSendersLast5Min($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "SELECT COUNT(DISTINCT sender_id) as count FROM transactions 
                  WHERE receiver_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)($result['count'] ?? 0);
    } catch (Exception $e) {
        error_log("Error in getUniqueSendersLast5Min: " . $e->getMessage());
        return 0;
    }
}

function getFailedWithdrawalsLast10Min($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "SELECT COUNT(*) as count FROM transactions 
                  WHERE sender_id = ? AND transaction_type = 'withdrawal' 
                  AND status = 'ABORTED' 
                  AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)($result['count'] ?? 0);
    } catch (Exception $e) {
        error_log("Error in getFailedWithdrawalsLast10Min: " . $e->getMessage());
        return 0;
    }
}

function getUserAvgAmount($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "SELECT COALESCE(AVG(amount), 0) as avg_amount FROM transactions 
                  WHERE sender_id = ? AND status = 'SUCCESS'";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return (float)($result['avg_amount'] ?? 0);
    } catch (Exception $e) {
        error_log("Error in getUserAvgAmount: " . $e->getMessage());
        return 0;
    }
}

// ==================== PATTERN 1: LARGE TRANSACTION VOLUME FUNCTIONS ====================

function getLargeTransactionCountLast5Min($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        
        $query = "SELECT COUNT(*) as count 
                  FROM transactions 
                  WHERE sender_id = ? 
                  AND amount > 1000000 
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        return (int)($result['count'] ?? 0);
    } catch (Exception $e) {
        error_log("Error in getLargeTransactionCountLast5Min: " . $e->getMessage());
        return 0;
    }
}

function getLargeTransactionAmountLast5Min($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        
        $query = "SELECT COALESCE(SUM(amount), 0) as total 
                  FROM transactions 
                  WHERE sender_id = ? 
                  AND amount > 1000000 
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        return (float)($result['total'] ?? 0);
    } catch (Exception $e) {
        error_log("Error in getLargeTransactionAmountLast5Min: " . $e->getMessage());
        return 0;
    }
}

function isUserBlockedByLargeVolume($user_id) {
    $count = getLargeTransactionCountLast5Min($user_id);
    $amount = getLargeTransactionAmountLast5Min($user_id);
    return ($count >= 3 && $amount > 10000000);
}

function getLargeTransactionStats($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        
        $query = "SELECT 
                    COUNT(*) as large_count,
                    COALESCE(SUM(amount), 0) as total_amount,
                    MAX(amount) as max_amount,
                    MIN(amount) as min_amount
                  FROM transactions 
                  WHERE sender_id = ? 
                  AND amount > 1000000 
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        return [
            'large_count' => (int)($result['large_count'] ?? 0),
            'total_amount' => (float)($result['total_amount'] ?? 0),
            'max_amount' => (float)($result['max_amount'] ?? 0),
            'min_amount' => (float)($result['min_amount'] ?? 0)
        ];
    } catch (Exception $e) {
        error_log("Error in getLargeTransactionStats: " . $e->getMessage());
        return [
            'large_count' => 0,
            'total_amount' => 0,
            'max_amount' => 0,
            'min_amount' => 0
        ];
    }
}

// ==================== PATTERN 2: MANY RECEIVERS FUNCTIONS ====================

function getUniqueReceiverCountLast5Min($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        
        $query = "SELECT COUNT(DISTINCT receiver_id) as unique_count 
                  FROM transactions 
                  WHERE sender_id = ? 
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                  AND receiver_id IS NOT NULL";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        return (int)($result['unique_count'] ?? 0);
    } catch (Exception $e) {
        error_log("Error in getUniqueReceiverCountLast5Min: " . $e->getMessage());
        return 0;
    }
}

function isUserBlockedByReceivers($user_id) {
    $unique_count = getUniqueReceiverCountLast5Min($user_id);
    return $unique_count >= 4;
}

function getReceiverStats($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        
        $query = "SELECT 
                    COUNT(DISTINCT receiver_id) as unique_receivers,
                    COUNT(*) as total_transactions,
                    SUM(amount) as total_amount
                  FROM transactions 
                  WHERE sender_id = ? 
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        return [
            'unique_receivers' => (int)($result['unique_receivers'] ?? 0),
            'total_transactions' => (int)($result['total_transactions'] ?? 0),
            'total_amount' => (float)($result['total_amount'] ?? 0)
        ];
    } catch (Exception $e) {
        error_log("Error in getReceiverStats: " . $e->getMessage());
        return [
            'unique_receivers' => 0,
            'total_transactions' => 0,
            'total_amount' => 0
        ];
    }
}

// ==================== PATTERN 3: MANY SENDERS FUNCTIONS ====================

function getUniqueSenderCountLast7Min($receiver_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        
        $query = "SELECT COUNT(DISTINCT sender_id) as unique_count 
                  FROM transactions 
                  WHERE receiver_id = ? 
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 7 MINUTE)
                  AND sender_id IS NOT NULL";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$receiver_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        return (int)($result['unique_count'] ?? 0);
    } catch (Exception $e) {
        error_log("Error in getUniqueSenderCountLast7Min: " . $e->getMessage());
        return 0;
    }
}

function isReceiverFlooded($receiver_id) {
    $unique_count = getUniqueSenderCountLast7Min($receiver_id);
    return $unique_count >= 3;
}

function getSenderStats($receiver_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        
        $query = "SELECT 
                    COUNT(DISTINCT sender_id) as unique_senders,
                    COUNT(*) as total_transactions,
                    SUM(amount) as total_amount
                  FROM transactions 
                  WHERE receiver_id = ? 
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 7 MINUTE)";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$receiver_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        return [
            'unique_senders' => (int)($result['unique_senders'] ?? 0),
            'total_transactions' => (int)($result['total_transactions'] ?? 0),
            'total_amount' => (float)($result['total_amount'] ?? 0)
        ];
    } catch (Exception $e) {
        error_log("Error in getSenderStats: " . $e->getMessage());
        return [
            'unique_senders' => 0,
            'total_transactions' => 0,
            'total_amount' => 0
        ];
    }
}

// ==================== FAILED WITHDRAWAL ATTEMPTS FUNCTIONS ====================

function getFailedAttemptCount($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "SELECT attempt_count FROM failed_withdrawal_attempts WHERE user_id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($result) {
            return (int)$result['attempt_count'];
        }
        return 0;
    } catch (Exception $e) {
        error_log("Error in getFailedAttemptCount: " . $e->getMessage());
        return 0;
    }
}

function incrementFailedAttempt($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $check_query = "SELECT id FROM failed_withdrawal_attempts WHERE user_id = ?";
        $check_stmt = $db->prepare($check_query);
        $check_stmt->execute([$user_id]);
        if ($check_stmt->rowCount() > 0) {
            $query = "UPDATE failed_withdrawal_attempts 
                      SET attempt_count = attempt_count + 1, 
                          last_attempt_time = NOW() 
                      WHERE user_id = ?";
            $stmt = $db->prepare($query);
            $stmt->execute([$user_id]);
        } else {
            $query = "INSERT INTO failed_withdrawal_attempts (user_id, attempt_count, last_attempt_time) 
                      VALUES (?, 1, NOW())";
            $stmt = $db->prepare($query);
            $stmt->execute([$user_id]);
        }
        error_log("Failed attempt incremented for user $user_id. New count: " . getFailedAttemptCount($user_id));
        return true;
    } catch (Exception $e) {
        error_log("Error in incrementFailedAttempt: " . $e->getMessage());
        return false;
    }
}

function resetFailedAttempts($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $check_query = "SELECT id FROM failed_withdrawal_attempts WHERE user_id = ?";
        $check_stmt = $db->prepare($check_query);
        $check_stmt->execute([$user_id]);
        if ($check_stmt->rowCount() > 0) {
            $query = "UPDATE failed_withdrawal_attempts 
                      SET attempt_count = 0, 
                          last_attempt_time = NULL 
                      WHERE user_id = ?";
            $stmt = $db->prepare($query);
            $stmt->execute([$user_id]);
        } else {
            $query = "INSERT INTO failed_withdrawal_attempts (user_id, attempt_count, last_attempt_time) 
                      VALUES (?, 0, NULL)";
            $stmt = $db->prepare($query);
            $stmt->execute([$user_id]);
        }
        error_log("Failed attempts reset for user $user_id");
        return true;
    } catch (Exception $e) {
        error_log("Error in resetFailedAttempts: " . $e->getMessage());
        return false;
    }
}

function isUserBlockedFromWithdrawals($user_id) {
    $count = getFailedAttemptCount($user_id);
    return $count >= 3;
}

function getFailedAttemptDetails($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "SELECT attempt_count, last_attempt_time FROM failed_withdrawal_attempts WHERE user_id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($result) {
            return ['count' => (int)$result['attempt_count'], 'last_attempt' => $result['last_attempt_time']];
        }
        return ['count' => 0, 'last_attempt' => null];
    } catch (Exception $e) {
        error_log("Error in getFailedAttemptDetails: " . $e->getMessage());
        return ['count' => 0, 'last_attempt' => null];
    }
}

function cleanOldFailedAttempts() {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "UPDATE failed_withdrawal_attempts 
                  SET attempt_count = 0, 
                      last_attempt_time = NULL 
                  WHERE last_attempt_time < DATE_SUB(NOW(), INTERVAL 24 HOUR) 
                  AND attempt_count > 0";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $affected = $stmt->rowCount();
        if ($affected > 0) {
            error_log("Cleaned $affected old failed attempt records");
        }
        return true;
    } catch (Exception $e) {
        error_log("Error in cleanOldFailedAttempts: " . $e->getMessage());
        return false;
    }
}

// ==================== LOCATION HELPER FUNCTIONS ====================

function getUserLocation($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "SELECT last_known_location FROM users WHERE id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['last_known_location'] ?? 'Dar es Salaam';
    } catch (Exception $e) {
        error_log("Error in getUserLocation: " . $e->getMessage());
        return 'Dar es Salaam';
    }
}

function getPreviousTransactionLocation($user_id) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "SELECT transaction_location FROM transactions 
                  WHERE sender_id = ? AND transaction_location IS NOT NULL
                  ORDER BY created_at DESC LIMIT 1";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['transaction_location'] ?? null;
    } catch (Exception $e) {
        error_log("Error in getPreviousTransactionLocation: " . $e->getMessage());
        return null;
    }
}

function checkLocationRapidChange($user_id, $new_location, $time_window_minutes = 5) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "SELECT transaction_location, created_at FROM transactions 
                  WHERE sender_id = ? 
                  AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
                  AND transaction_location IS NOT NULL
                  ORDER BY created_at DESC LIMIT 1";
        $stmt = $db->prepare($query);
        $stmt->execute([$user_id, $time_window_minutes]);
        $last = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($last && $last['transaction_location'] !== $new_location) {
            return [
                'changed' => true,
                'previous_location' => $last['transaction_location'],
                'new_location' => $new_location,
                'time_elapsed' => $time_window_minutes,
                'distance' => estimateDistance($last['transaction_location'] ?? 'Unknown', $new_location)
            ];
        }
        return ['changed' => false];
    } catch (Exception $e) {
        error_log("Error in checkLocationRapidChange: " . $e->getMessage());
        return ['changed' => false];
    }
}

function estimateDistance($location1, $location2) {
    $locations = [
        'Dar es Salaam' => ['lat' => -6.7924, 'lng' => 39.2083],
        'Mwanza' => ['lat' => -2.5164, 'lng' => 32.9171],
        'Arusha' => ['lat' => -3.3869, 'lng' => 36.6829],
        'Dodoma' => ['lat' => -6.1629, 'lng' => 35.7516],
        'Mbeya' => ['lat' => -8.9067, 'lng' => 33.4508],
        'Morogoro' => ['lat' => -6.8225, 'lng' => 37.6612],
        'Tanga' => ['lat' => -5.0689, 'lng' => 39.0966],
        'Moshi' => ['lat' => -3.3333, 'lng' => 37.3333],
        'Zanzibar' => ['lat' => -6.1602, 'lng' => 39.1910],
        'Kigoma' => ['lat' => -4.8820, 'lng' => 29.6290]
    ];
    if (!isset($locations[$location1]) || !isset($locations[$location2])) {
        return 'Unknown';
    }
    $lat1 = $locations[$location1]['lat'];
    $lng1 = $locations[$location1]['lng'];
    $lat2 = $locations[$location2]['lat'];
    $lng2 = $locations[$location2]['lng'];
    $earthRadius = 6371;
    $dlat = deg2rad($lat2 - $lat1);
    $dlng = deg2rad($lng2 - $lng1);
    $a = sin($dlat/2) * sin($dlat/2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dlng/2) * sin($dlng/2);
    $c = 2 * atan2(sqrt($a), sqrt(1-$a));
    $distance = $earthRadius * $c;
    return round($distance, 0) . ' km';
}

function getLocationFraudScore($user_id, $location) {
    $score = 0;
    $location_check = checkLocationRapidChange($user_id, $location);
    if ($location_check['changed']) {
        $distance = intval($location_check['distance'] ?? 0);
        if ($distance > 500) {
            $score += 50;
        } elseif ($distance > 200) {
            $score += 30;
        } elseif ($distance > 50) {
            $score += 15;
        }
        $score += 10;
    }
    return $score;
}

function getAvailableLocations() {
    return [
        'Dar es Salaam', 'Mwanza', 'Arusha', 'Dodoma', 'Mbeya',
        'Morogoro', 'Tanga', 'Moshi', 'Zanzibar', 'Kigoma'
    ];
}

function updateUserLocation($user_id, $location) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $query = "UPDATE users SET 
                  last_known_location = ?, 
                  location_updated_at = NOW() 
                  WHERE id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$location, $user_id]);
        return true;
    } catch (Exception $e) {
        error_log("Error in updateUserLocation: " . $e->getMessage());
        return false;
    }
}

// ==================== INITIALIZATION ====================

// Create login log tables
createLoginLogTables();

// Initialize directories
initializeDirectories();

// Clean old failed attempts
cleanOldFailedAttempts();
?>