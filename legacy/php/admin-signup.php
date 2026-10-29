<?php
require_once 'config/database.php';

// Check if admins table is empty or if it's first time setup
$database = new Database();
$db = $database->getConnection();

// Check if any admin exists
$checkQuery = "SELECT COUNT(*) as count FROM admins";
$checkStmt = $db->prepare($checkQuery);
$checkStmt->execute();
$adminCount = $checkStmt->fetch(PDO::FETCH_ASSOC)['count'];

// If admins exist, require secret key for additional admin creation
$require_secret_key = ($adminCount > 0);
$error = '';
$success = '';

// Secret key for additional admin creation (CHANGE THIS TO A STRONG KEY)
$SECRET_KEY = 'AdminSetupTZ';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = sanitizeInput($_POST['username']);
    $email = sanitizeInput($_POST['email']);
    $full_name = sanitizeInput($_POST['full_name']);
    $password = $_POST['password'];
    $confirm_password = $_POST['confirm_password'];
    $secret_key = isset($_POST['secret_key']) ? sanitizeInput($_POST['secret_key']) : '';
    
    // Validate secret key if required
    if ($require_secret_key && $secret_key !== $SECRET_KEY) {
        $error = "❌ Invalid secret key. You don't have permission to create admin accounts.";
    } else {
        // Validation
        $errors = [];
        
        if (empty($username)) {
            $errors[] = "Username is required";
        } elseif (strlen($username) < 3) {
            $errors[] = "Username must be at least 3 characters";
        } elseif (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
            $errors[] = "Username can only contain letters, numbers, and underscores";
        }
        
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = "Valid email is required";
        }
        
        if (empty($full_name)) {
            $errors[] = "Full name is required";
        } elseif (strlen($full_name) < 3) {
            $errors[] = "Full name must be at least 3 characters";
        }
        
        if (strlen($password) < 8) {
            $errors[] = "Password must be at least 8 characters";
        }
        
        if (!preg_match('/[A-Z]/', $password)) {
            $errors[] = "Password must contain at least one uppercase letter";
        }
        
        if (!preg_match('/[a-z]/', $password)) {
            $errors[] = "Password must contain at least one lowercase letter";
        }
        
        if (!preg_match('/[0-9]/', $password)) {
            $errors[] = "Password must contain at least one number";
        }
        
        if (!preg_match('/[!@#$%^&*(),.?":{}|<>]/', $password)) {
            $errors[] = "Password must contain at least one special character";
        }
        
        if ($password !== $confirm_password) {
            $errors[] = "Passwords do not match";
        }
        
        // Check if username or email already exists
        $checkUserQuery = "SELECT id FROM admins WHERE username = :username OR email = :email";
        $checkUserStmt = $db->prepare($checkUserQuery);
        $checkUserStmt->execute([':username' => $username, ':email' => $email]);
        
        if ($checkUserStmt->rowCount() > 0) {
            $errors[] = "Username or email already exists";
        }
        
        if (empty($errors)) {
            $hashed_password = password_hash($password, PASSWORD_DEFAULT);
            
            $query = "INSERT INTO admins (username, email, password, full_name, created_at) 
                      VALUES (:username, :email, :password, :full_name, NOW())";
            $stmt = $db->prepare($query);
            
            $result = $stmt->execute([
                ':username' => $username,
                ':email' => $email,
                ':password' => $hashed_password,
                ':full_name' => $full_name
            ]);
            
            if ($result) {
                $success = "✅ Admin account created successfully! You can now <a href='login.php'>login here</a>.";
                // Clear form
                $_POST = [];
            } else {
                $error = "❌ Failed to create admin account. Please try again.";
            }
        } else {
            $error = implode("<br>", $errors);
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Signup - Fraud Detection System</title>
    <link rel="stylesheet" href="assets/css/style.css">
    <style>
        body {
            background: linear-gradient(135deg, var(--primary-blue) 0%, var(--primary-dark) 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }
        .signup-container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            width: 100%;
            max-width: 550px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: fadeIn 0.5s ease;
        }
        .signup-header {
            text-align: center;
            margin-bottom: 30px;
        }
        .signup-header h1 {
            color: var(--primary-blue);
            margin-bottom: 10px;
        }
        .signup-header p {
            color: var(--text-light);
            font-size: 0.9rem;
        }
        .info-box {
            background: #e0f2fe;
            border-left: 4px solid var(--primary-blue);
            padding: 12px;
            margin-bottom: 20px;
            border-radius: 8px;
            font-size: 0.85rem;
            color: var(--primary-dark);
        }
        .info-box.warning {
            background: #fed7aa;
            border-left-color: var(--warning-yellow);
            color: #92400e;
        }
        .info-box.success {
            background: #d1fae5;
            border-left-color: var(--success-green);
            color: #065f46;
        }
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .password-strength {
            margin-top: 8px;
            font-size: 0.8rem;
        }
        .strength-weak { color: var(--danger-red); }
        .strength-medium { color: var(--warning-yellow); }
        .strength-strong { color: var(--success-green); }
        .requirements {
            font-size: 0.75rem;
            color: var(--text-light);
            margin-top: 5px;
        }
        .requirements ul {
            margin: 5px 0 0 20px;
        }
        .requirements li {
            margin: 2px 0;
        }
        .requirements li.valid {
            color: var(--success-green);
            text-decoration: line-through;
        }
    </style>
</head>
<body>
    <div class="signup-container">
        <div class="signup-header">
            <h1>🛡️ FraudDetect</h1>
            <p>Create Administrator Account</p>
        </div>
        
        <?php if ($adminCount == 0): ?>
            <div class="info-box">
                📌 <strong>First Time Setup</strong><br>
                This is the first admin account setup. No secret key required.
            </div>
        <?php else: ?>
            <div class="info-box warning">
                ⚠️ <strong>Additional Admin Account</strong><br>
                A secret key is required to create additional admin accounts. Contact your system administrator.
            </div>
        <?php endif; ?>
        
        <?php if ($success): ?>
            <div class="info-box success">
                <?php echo $success; ?>
            </div>
        <?php endif; ?>
        
        <?php if ($error): ?>
            <div style="background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                <?php echo $error; ?>
            </div>
        <?php endif; ?>
        
        <form method="POST" action="" onsubmit="return validateForm()">
            <div class="form-group">
                <label for="full_name">Full Name *</label>
                <input type="text" id="full_name" name="full_name" required 
                       value="<?php echo htmlspecialchars($_POST['full_name'] ?? ''); ?>"
                       placeholder="John Doe">
            </div>
            
            <div class="form-group">
                <label for="username">Username *</label>
                <input type="text" id="username" name="username" required 
                       value="<?php echo htmlspecialchars($_POST['username'] ?? ''); ?>"
                       placeholder="johndoe">
                <small style="color: var(--text-light);">3+ characters, letters/numbers/underscores only</small>
            </div>
            
            <div class="form-group">
                <label for="email">Email Address *</label>
                <input type="email" id="email" name="email" required 
                       value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>"
                       placeholder="admin@example.com">
            </div>
            
            <div class="form-group">
                <label for="password">Password *</label>
                <input type="password" id="password" name="password" required 
                       onkeyup="checkPasswordStrength(this.value); updateRequirements(this.value)">
                <div id="passwordStrength" class="password-strength"></div>
                <div class="requirements">
                    <small>Password must contain:</small>
                    <ul id="passwordRequirements">
                        <li id="req-length">✓ At least 8 characters</li>
                        <li id="req-upper">✓ At least one uppercase letter</li>
                        <li id="req-lower">✓ At least one lowercase letter</li>
                        <li id="req-number">✓ At least one number</li>
                        <li id="req-special">✓ At least one special character</li>
                    </ul>
                </div>
            </div>
            
            <div class="form-group">
                <label for="confirm_password">Confirm Password *</label>
                <input type="password" id="confirm_password" name="confirm_password" required 
                       onkeyup="checkPasswordMatch()">
                <div id="passwordMatch" style="font-size: 0.8rem; margin-top: 5px;"></div>
            </div>
            
            <?php if ($require_secret_key): ?>
                <div class="form-group">
                    <label for="secret_key">Secret Key *</label>
                    <input type="password" id="secret_key" name="secret_key" required 
                           placeholder="Enter the admin secret key">
                    <small style="color: var(--text-light);">Required for additional admin accounts</small>
                </div>
            <?php endif; ?>
            
            <button type="submit" class="btn btn-primary" style="width: 100%;">Create Admin Account</button>
        </form>
        
        <div style="text-align: center; margin-top: 20px;">
            <a href="login.php" style="color: var(--primary-blue); text-decoration: none;">← Back to Login</a>
        </div>
    </div>
    
    <script>
        function checkPasswordStrength(password) {
            const strengthDiv = document.getElementById('passwordStrength');
            if (password.length === 0) {
                strengthDiv.innerHTML = '';
                return;
            }
            
            let strength = 0;
            let message = '';
            let className = '';
            
            // Length check
            if (password.length >= 8) strength++;
            if (password.length >= 12) strength++;
            
            // Complexity checks
            if (password.match(/[a-z]+/)) strength++;
            if (password.match(/[A-Z]+/)) strength++;
            if (password.match(/[0-9]+/)) strength++;
            if (password.match(/[$@#&!]+/)) strength++;
            
            if (strength <= 2) {
                message = 'Weak password';
                className = 'strength-weak';
            } else if (strength <= 4) {
                message = 'Medium password';
                className = 'strength-medium';
            } else {
                message = 'Strong password';
                className = 'strength-strong';
            }
            
            strengthDiv.innerHTML = message;
            strengthDiv.className = 'password-strength ' + className;
        }
        
        function updateRequirements(password) {
            // Length requirement
            const lengthReq = document.getElementById('req-length');
            if (password.length >= 8) {
                lengthReq.style.color = '#10b981';
                lengthReq.style.textDecoration = 'line-through';
            } else {
                lengthReq.style.color = '';
                lengthReq.style.textDecoration = '';
            }
            
            // Uppercase requirement
            const upperReq = document.getElementById('req-upper');
            if (password.match(/[A-Z]/)) {
                upperReq.style.color = '#10b981';
                upperReq.style.textDecoration = 'line-through';
            } else {
                upperReq.style.color = '';
                upperReq.style.textDecoration = '';
            }
            
            // Lowercase requirement
            const lowerReq = document.getElementById('req-lower');
            if (password.match(/[a-z]/)) {
                lowerReq.style.color = '#10b981';
                lowerReq.style.textDecoration = 'line-through';
            } else {
                lowerReq.style.color = '';
                lowerReq.style.textDecoration = '';
            }
            
            // Number requirement
            const numberReq = document.getElementById('req-number');
            if (password.match(/[0-9]/)) {
                numberReq.style.color = '#10b981';
                numberReq.style.textDecoration = 'line-through';
            } else {
                numberReq.style.color = '';
                numberReq.style.textDecoration = '';
            }
            
            // Special character requirement
            const specialReq = document.getElementById('req-special');
            if (password.match(/[!@#$%^&*(),.?":{}|<>]/)) {
                specialReq.style.color = '#10b981';
                specialReq.style.textDecoration = 'line-through';
            } else {
                specialReq.style.color = '';
                specialReq.style.textDecoration = '';
            }
        }
        
        function checkPasswordMatch() {
            const password = document.getElementById('password').value;
            const confirm = document.getElementById('confirm_password').value;
            const matchDiv = document.getElementById('passwordMatch');
            
            if (confirm.length === 0) {
                matchDiv.innerHTML = '';
                return;
            }
            
            if (password === confirm) {
                matchDiv.innerHTML = '✓ Passwords match';
                matchDiv.style.color = '#10b981';
            } else {
                matchDiv.innerHTML = '✗ Passwords do not match';
                matchDiv.style.color = '#ef4444';
            }
        }
        
        function validateForm() {
            const password = document.getElementById('password').value;
            const confirm = document.getElementById('confirm_password').value;
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const full_name = document.getElementById('full_name').value;
            
            if (password !== confirm) {
                alert('Passwords do not match!');
                return false;
            }
            
            if (password.length < 8) {
                alert('Password must be at least 8 characters long!');
                return false;
            }
            
            if (!password.match(/[A-Z]/)) {
                alert('Password must contain at least one uppercase letter!');
                return false;
            }
            
            if (!password.match(/[a-z]/)) {
                alert('Password must contain at least one lowercase letter!');
                return false;
            }
            
            if (!password.match(/[0-9]/)) {
                alert('Password must contain at least one number!');
                return false;
            }
            
            if (!password.match(/[!@#$%^&*(),.?":{}|<>]/)) {
                alert('Password must contain at least one special character!');
                return false;
            }
            
            if (username.length < 3) {
                alert('Username must be at least 3 characters long!');
                return false;
            }
            
            if (!username.match(/^[a-zA-Z0-9_]+$/)) {
                alert('Username can only contain letters, numbers, and underscores!');
                return false;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('Please enter a valid email address!');
                return false;
            }
            
            if (full_name.length < 3) {
                alert('Full name must be at least 3 characters long!');
                return false;
            }
            
            return true;
        }
    </script>
</body>
</html>