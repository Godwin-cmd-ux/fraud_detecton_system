<?php
require_once 'config/database.php';

// Only redirect if already logged in
if (isLoggedIn()) {
    if (isAdminLoggedIn()) {
        header("Location: admin/dashboard.php");
        exit();
    } elseif (isUserLoggedIn()) {
        header("Location: User/dashboard.php");
        exit();
    }
}

$error = '';
$lockout_info = null;
$remaining_minutes = 0;
$attempt_count = 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $database = new Database();
    $db = $database->getConnection();
    
    $login = sanitizeInput($_POST['login']);
    $password = $_POST['password'];
    $role = $_POST['role'];
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    
    // ========== CHECK IF LOGIN IS LOCKED ==========
    $lock_check = isLoginLocked($login);
    if ($lock_check['locked']) {
        $remaining_minutes = ceil($lock_check['time_remaining']);
        $error = "Your account is locked. Please wait " . $remaining_minutes . " minute(s) before trying again.";
        $info = getLoginAttemptInfo($login);
        $attempt_count = $info['attempt_count'] ?? 0;
    } else {
        if ($role === 'admin') {
            // Admin login
            $query = "SELECT * FROM admins WHERE (username = :username OR email = :email) AND is_active = 1";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':username', $login);
            $stmt->bindParam(':email', $login);
            $stmt->execute();
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user && password_verify($password, $user['password'])) {
                resetLoginAttempts($login, $ip);
                
                session_regenerate_id(true);
                $_SESSION = array();
                
                $_SESSION['admin_id'] = $user['id'];
                $_SESSION['admin_name'] = $user['full_name'];
                $_SESSION['admin_username'] = $user['username'];
                $_SESSION['is_admin'] = true;
                $_SESSION['logged_in'] = true;
                $_SESSION['login_time'] = time();
                
                $updateQuery = "UPDATE admins SET last_login = NOW() WHERE id = :id";
                $updateStmt = $db->prepare($updateQuery);
                $updateStmt->bindParam(':id', $user['id']);
                $updateStmt->execute();
                
                header("Location: admin/dashboard.php");
                exit();
            } else {
                $result = recordFailedLoginAttempt($login, null);
                $attempt_count = $result['attempt_count'];
                
                if ($result['lockout_until']) {
                    $remaining_minutes = ceil((strtotime($result['lockout_until']) - time()) / 60);
                    $error = "Too many failed attempts. Account locked for " . $remaining_minutes . " minute(s).";
                } else {
                    $remaining_attempts = 3 - ($attempt_count % 3);
                    if ($remaining_attempts == 0) $remaining_attempts = 3;
                    $error = "Invalid admin credentials. " . $remaining_attempts . " attempt(s) remaining before lockout.";
                }
            }
        } else {
            // User login
            $query = "SELECT * FROM users WHERE (email = :email OR phone = :phone OR card_number = :card_number) AND is_active = 1";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':email', $login);
            $stmt->bindParam(':phone', $login);
            $stmt->bindParam(':card_number', $login);
            $stmt->execute();
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user && password_verify($password, $user['password'])) {
                if ($user['is_approved'] == 0) {
                    $error = "Your account is pending admin approval. Please wait for confirmation.";
                } else {
                    resetLoginAttempts($login, $ip);
                    
                    session_regenerate_id(true);
                    $_SESSION = array();
                    
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['user_name'] = $user['full_name'];
                    $_SESSION['user_email'] = $user['email'];
                    $_SESSION['is_admin'] = false;
                    $_SESSION['logged_in'] = true;
                    $_SESSION['login_time'] = time();
                    
                    header("Location: User/dashboard.php");
                    exit();
                }
            } else {
                $user_id = $user['id'] ?? null;
                $result = recordFailedLoginAttempt($login, $user_id);
                $attempt_count = $result['attempt_count'];
                
                if ($result['lockout_until']) {
                    $remaining_minutes = ceil((strtotime($result['lockout_until']) - time()) / 60);
                    $error = "Too many failed attempts. Account locked for " . $remaining_minutes . " minute(s).";
                } else {
                    $remaining_attempts = 3 - ($attempt_count % 3);
                    if ($remaining_attempts == 0) $remaining_attempts = 3;
                    $error = "Invalid user credentials. " . $remaining_attempts . " attempt(s) remaining before lockout.";
                }
            }
        }
    }
    
    $info = getLoginAttemptInfo($login);
    $attempt_count = $info['attempt_count'] ?? 0;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign in &mdash; Sentinel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:        #0E1525;
    --panel:     #16203A;
    --panel-2:   #121A30;
    --line:      #25324F;
    --text:      #E8ECF4;
    --text-dim:  #8C97B3;
    --amber:     #F2A93B;
    --teal:      #3FD8B0;
    --red:       #E5484D;
    --radius:    10px;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  body{
    background:var(--bg);
    color:var(--text);
    font-family:'IBM Plex Sans', sans-serif;
    line-height:1.55;
    min-height:100vh;
    -webkit-font-smoothing:antialiased;
    display:flex;
    flex-direction:column;
    align-items:center;
    padding:48px 20px;
  }
  body::before{
    content:"";
    position:fixed; inset:0;
    background:
      radial-gradient(ellipse 900px 500px at 12% -10%, rgba(63,216,176,0.07), transparent 60%),
      radial-gradient(ellipse 700px 500px at 110% 30%, rgba(242,169,59,0.06), transparent 60%);
    pointer-events:none;
    z-index:0;
  }
  a{color:inherit;}
  :focus-visible{outline:2px solid var(--teal); outline-offset:3px;}

  .page-head{
    width:100%; max-width:420px; margin-bottom:28px; position:relative; z-index:1;
    display:flex; align-items:center; justify-content:space-between;
  }
  .brand{
    display:flex; align-items:center; gap:10px;
    font-family:'Space Grotesk', sans-serif;
    font-weight:700; font-size:18px;
    text-decoration:none;
  }
  .brand .dot{
    width:9px; height:9px; border-radius:50%;
    background:var(--teal);
    box-shadow:0 0 0 4px rgba(63,216,176,0.16);
  }
  .page-head a.back{ font-size:13.5px; color:var(--text-dim); text-decoration:none; }
  .page-head a.back:hover{ color:var(--text); }

  .panel{
    width:100%; max-width:420px;
    background:linear-gradient(180deg, var(--panel), var(--panel-2));
    border:1px solid var(--line);
    border-radius:var(--radius);
    padding:36px;
    position:relative; z-index:1;
    animation: fadeIn .4s ease both;
  }
  @keyframes fadeIn{ from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:translateY(0);} }

  .panel-head{ margin-bottom:26px; }
  .eyebrow{
    display:inline-flex; align-items:center; gap:8px;
    font-family:'IBM Plex Mono', monospace;
    font-size:12px; color:var(--teal);
    border:1px solid rgba(63,216,176,0.3);
    background:rgba(63,216,176,0.06);
    padding:5px 11px; border-radius:99px;
    margin-bottom:16px;
  }
  .panel-head h1{
    font-family:'Space Grotesk', sans-serif;
    font-weight:700; font-size:26px; letter-spacing:-0.3px;
    margin-bottom:6px;
  }
  .panel-head p{ color:var(--text-dim); font-size:14px; }

  .alert{
    border-radius:8px; padding:13px 15px; margin-bottom:22px;
    font-size:13.5px; border:1px solid;
  }
  .alert-error{ background:rgba(229,72,77,0.08); border-color:rgba(229,72,77,0.3); color:#ff8e92; }
  .alert-warning{ background:rgba(242,169,59,0.08); border-color:rgba(242,169,59,0.3); color:var(--amber); }

  .role-selector{ display:flex; gap:8px; margin-bottom:22px; }
  .role-btn{
    flex:1; padding:11px; text-align:center;
    border:1px solid var(--line);
    background:rgba(255,255,255,0.02);
    color:var(--text-dim);
    border-radius:7px; cursor:pointer;
    font-family:'IBM Plex Sans', sans-serif;
    font-size:13.5px; font-weight:500;
    transition:border-color .15s, background .15s, color .15s;
  }
  .role-btn.active{
    border-color:var(--teal);
    background:rgba(63,216,176,0.08);
    color:var(--teal);
  }

  .form-group{ margin-bottom:18px; }
  label{
    display:block; font-size:13.5px; font-weight:500;
    color:var(--text); margin-bottom:7px;
  }
  input[type="text"], input[type="password"]{
    width:100%;
    background:rgba(255,255,255,0.02);
    border:1px solid var(--line);
    color:var(--text);
    font-family:'IBM Plex Sans', sans-serif;
    font-size:14px;
    padding:11px 13px;
    border-radius:7px;
    transition:border-color .15s, background .15s;
  }
  input::placeholder{ color:#5b6789; }
  input:focus{ outline:none; border-color:var(--teal); background:rgba(63,216,176,0.04); }

  .forgot-password{ text-align:right; margin-top:8px; margin-bottom:18px; }
  .forgot-password a{
    color:var(--text-dim); text-decoration:none; font-size:12.5px;
    transition:color .15s;
  }
  .forgot-password a:hover{ color:var(--teal); }

  .btn-primary{
    font-size:15px; font-weight:600;
    padding:13px 24px; border-radius:8px;
    background:var(--text); color:var(--bg);
    text-decoration:none; border:none; cursor:pointer;
    transition:transform .15s, opacity .15s;
    width:100%; text-align:center; display:block;
  }
  .btn-primary:hover{ transform:translateY(-1px); opacity:.92; }
  .btn-primary:disabled{
    opacity:0.5;
    cursor:not-allowed;
    transform:none;
  }

  .login-footer{
    margin-top:22px; padding-top:22px;
    border-top:1px solid var(--line);
    text-align:center;
  }
  .login-footer .links{
    display:flex; justify-content:center; align-items:center;
    gap:14px; flex-wrap:wrap; font-size:13.5px;
  }
  .login-footer .links a{ color:var(--text-dim); text-decoration:none; }
  .login-footer .links a:hover{ color:var(--text); }
  .login-footer .links a.register-link{ color:var(--teal); font-weight:500; }
  .login-footer .links a.register-link:hover{ text-decoration:underline; }
  .login-footer .divider{ color:var(--line); }

  .support-line{
    text-align:center; margin-top:16px;
    font-size:12.5px; color:var(--text-dim);
  }
  .support-line a{ color:var(--teal); text-decoration:none; }
  .support-line a:hover{ text-decoration:underline; }

  .lockout-box{
    text-align:center; padding:20px;
    background:rgba(63,216,176,0.05);
    border-radius:8px;
    border:1px solid var(--line);
    margin-bottom:20px;
  }
  .lockout-box .icon{ font-size:48px; margin-bottom:15px; }
  .lockout-box h3{ margin-bottom:10px; }
  .lockout-box p{ color:var(--text-dim); }
  .lockout-box .timer{ margin-top:15px; font-size:13px; color:var(--text-dim); }
  .lockout-box .timer strong{ color:var(--teal); }

  @media (max-width:480px){
    .panel{ padding:26px; }
    .role-selector{ flex-direction:column; }
  }
</style>
</head>
<body>

<div class="page-head">
  <a class="brand" href="index.php"><span class="dot"></span> Sentinel</a>
  <a class="back" href="register.php">Need an account? Register &rarr;</a>
</div>

<div class="panel">
  <div class="panel-head">
    <span class="eyebrow">SECURE SIGN IN</span>
    <h1>Welcome back</h1>
    <p>Sign in to review activity on your account.</p>
  </div>

  <?php if ($error): ?>
    <div class="alert <?php echo strpos($error, 'locked') !== false ? 'alert-warning' : 'alert-error'; ?>">
        <?php if (strpos($error, 'locked') !== false): ?>
            🔒 <?php echo htmlspecialchars($error); ?>
            <div style="margin-top: 10px; font-size: 13px;">
                <strong>Remaining time:</strong> <span id="countdown-timer"><?php echo ($remaining_minutes * 60); ?></span> seconds
            </div>
        <?php else: ?>
            ❌ <?php echo htmlspecialchars($error); ?>
        <?php endif; ?>
    </div>
  <?php endif; ?>

  <?php if (strpos($error, 'locked') !== false): ?>
    <div class="lockout-box">
      <div class="icon">🔒</div>
      <h3>Account Locked</h3>
      <p>Too many failed login attempts. Your account is locked for <strong id="lockout-minutes"><?php echo $remaining_minutes; ?></strong> minute(s).<br>Please wait and try again.</p>
      <div class="timer">
        Attempts remaining after lock: <strong id="attempt-count"><?php echo 3 - ($attempt_count % 3); ?></strong>
      </div>
    </div>
  <?php endif; ?>

  <form method="POST" action="" id="loginForm">
    <div class="role-selector">
      <button type="button" class="role-btn active" onclick="selectRole('user', this)">User login</button>
      <button type="button" class="role-btn" onclick="selectRole('admin', this)">Admin login</button>
    </div>

    <input type="hidden" id="role" name="role" value="user">

    <div class="form-group">
      <label for="login" id="loginLabel">Email / phone / card number</label>
      <input type="text" id="login" name="login" required autofocus
             placeholder="Enter your email, phone, or card number"
             <?php echo (strpos($error, 'locked') !== false) ? 'disabled' : ''; ?>>
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required
             placeholder="Enter your password"
             <?php echo (strpos($error, 'locked') !== false) ? 'disabled' : ''; ?>>
    </div>

    <div class="forgot-password">
      <a href="forgot_password.php">Forgot password?</a>
    </div>

    <?php if (strpos($error, 'locked') !== false): ?>
      <button type="button" class="btn-primary" disabled>
        🔒 Account Locked - Please wait
      </button>
    <?php else: ?>
      <button type="submit" class="btn-primary">Sign in</button>
    <?php endif; ?>
  </form>

  <div class="login-footer">
    <div class="links">
      <a href="register.php" class="register-link">Create new account</a>
      <span class="divider">|</span>
      <a href="forgot_password.php">Reset password</a>
    </div>
  </div>

  <div class="support-line">
    Need help? <a href="#">Contact support</a>
  </div>
</div>

<script>
    <?php if (strpos($error, 'locked') !== false && $remaining_minutes > 0): ?>
    let countdown = <?php echo ($remaining_minutes * 60); ?>;
    const timerElement = document.getElementById('countdown-timer');
    const minutesElement = document.getElementById('lockout-minutes');
    
    const countdownInterval = setInterval(function() {
        countdown--;
        if (timerElement) {
            timerElement.textContent = countdown;
        }
        if (minutesElement) {
            minutesElement.textContent = Math.ceil(countdown / 60);
        }
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            location.reload();
        }
    }, 1000);
    <?php endif; ?>
    
    function selectRole(role, element) {
        document.getElementById('role').value = role;
        const buttons = document.querySelectorAll('.role-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        if(element) {
            element.classList.add('active');
        }
        
        const loginField = document.getElementById('login');
        const loginLabel = document.getElementById('loginLabel');
        
        if (role === 'admin') {
            loginField.placeholder = 'Username or email';
            loginLabel.innerHTML = 'Username or email';
        } else {
            loginField.placeholder = 'Email / phone / card number';
            loginLabel.innerHTML = 'Email / phone / card number';
        }
        loginField.value = '';
    }
    
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        const login = document.getElementById('login').value.trim();
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;
        
        if (!login) {
            e.preventDefault();
            alert('Please enter your login credentials');
            document.getElementById('login').focus();
            return false;
        }
        
        if (!password) {
            e.preventDefault();
            alert('Please enter your password');
            document.getElementById('password').focus();
            return false;
        }
        
        if (role === 'admin' && login.length < 3) {
            e.preventDefault();
            alert('Username must be at least 3 characters');
            document.getElementById('login').focus();
            return false;
        }
        
        return true;
    });
    
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('loginForm').dispatchEvent(new Event('submit'));
        }
    });
</script>
</body>
</html>