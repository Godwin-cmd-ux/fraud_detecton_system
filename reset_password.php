<?php
require_once 'config/database.php';

// Set timezone to East Africa Time
date_default_timezone_set('Africa/Dar_es_Salaam');

// Check if user is already logged in
if (isLoggedIn()) {
    if (isAdminLoggedIn()) {
        header("Location: admin/dashboard.php");
    } else {
        header("Location: User/dashboard.php");
    }
    exit();
}

$database = new Database();
$db = $database->getConnection();
$error = '';
$success = '';
$token = isset($_GET['token']) ? sanitizeInput($_GET['token']) : '';

// If no token in URL, check session
if (empty($token) && isset($_SESSION['reset_token'])) {
    $token = $_SESSION['reset_token'];
}

// Verify token
if (empty($token)) {
    header("Location: forgot_password.php");
    exit();
}

// Check token validity - Check if token exists and is NOT expired
$query = "SELECT id, full_name, email, reset_token_expiry FROM users WHERE reset_token = ?";
$stmt = $db->prepare($query);
$stmt->execute([$token]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    $error = "Invalid reset token. Please request a new password reset.";
} else {
    // Check if token has expired
    $now = new DateTime();
    $expiry = new DateTime($user['reset_token_expiry']);
    
    if ($now > $expiry) {
        $error = "Your reset token has expired (valid for 5 minutes). Please request a new password reset.";
    } else {
        // Token is valid
        $_SESSION['reset_user_id'] = $user['id'];
        $_SESSION['reset_user_name'] = $user['full_name'];
        $_SESSION['reset_user_email'] = $user['email'];
        
        // Calculate remaining time for display
        $remaining = $now->diff($expiry);
        $minutes_remaining = $remaining->i;
        $seconds_remaining = $remaining->s;
        $time_left = $minutes_remaining . ' minute' . ($minutes_remaining != 1 ? 's' : '') . 
                     ($seconds_remaining > 0 ? ' and ' . $seconds_remaining . ' second' . ($seconds_remaining != 1 ? 's' : '') : '');
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['reset_password'])) {
    $password = $_POST['password'];
    $confirm_password = $_POST['confirm_password'];
    $user_id = $_SESSION['reset_user_id'] ?? 0;
    
    $errors = [];
    
    if (strlen($password) < 6) {
        $errors[] = "Password must be at least 6 characters";
    }
    
    if ($password !== $confirm_password) {
        $errors[] = "Passwords do not match";
    }
    
    if (empty($errors)) {
        $hashed_password = password_hash($password, PASSWORD_DEFAULT);
        
        // Clear reset_token and reset_token_expiry after password reset
        $update_query = "UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?";
        $update_stmt = $db->prepare($update_query);
        $update_stmt->execute([$hashed_password, $user_id]);
        
        $success = "Password reset successfully. You can now sign in with your new password.";
        
        // Clear session
        unset($_SESSION['reset_user_id']);
        unset($_SESSION['reset_user_name']);
        unset($_SESSION['reset_user_email']);
        unset($_SESSION['reset_token']);
        unset($_SESSION['reset_expiry']);
    } else {
        $error = implode("<br>", $errors);
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset password &mdash; Sentinel</title>
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

  .panel-head{ margin-bottom:24px; }
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

  /* Alerts */
  .alert{
    border-radius:8px; padding:14px 16px; margin-bottom:22px;
    font-size:13.5px; border:1px solid;
  }
  .alert-error{ background:rgba(229,72,77,0.08); border-color:rgba(229,72,77,0.3); color:#ff8e92; }
  .alert-success{ background:rgba(63,216,176,0.08); border-color:rgba(63,216,176,0.3); color:var(--teal); }

  .alert .btn-primary{ margin-top:14px; }
  .alert .btn-amber{
    background:var(--amber); color:#1a1304;
  }

  .user-info{
    background:rgba(255,255,255,0.02);
    border:1px solid var(--line);
    border-left:3px solid var(--teal);
    border-radius:8px;
    padding:14px 16px;
    margin-bottom:18px;
    font-size:13.5px;
  }
  .user-info strong{ color:var(--text); font-weight:600; }
  .user-info .row{ color:var(--text-dim); margin-top:4px; }
  .user-info .row:first-child{ margin-top:0; }

  .time-left{
    background:rgba(242,169,59,0.08);
    border:1px solid rgba(242,169,59,0.25);
    color:var(--amber);
    padding:10px 14px;
    border-radius:8px;
    font-size:13px;
    margin-bottom:18px;
    text-align:center;
    font-family:'IBM Plex Mono', monospace;
  }

  /* Form */
  .form-group{ margin-bottom:18px; }
  label{
    display:block; font-size:13.5px; font-weight:500;
    color:var(--text); margin-bottom:7px;
  }
  input[type="password"]{
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
  .hint{ font-size:12px; color:var(--text-dim); margin-top:6px; display:block; }
  .status-line{ font-size:12.5px; margin-top:6px; font-family:'IBM Plex Mono', monospace; }

  .btn-primary{
    font-size:15px; font-weight:600;
    padding:13px 24px; border-radius:8px;
    background:var(--text); color:var(--bg);
    text-decoration:none; border:none; cursor:pointer;
    transition:transform .15s, opacity .15s;
    width:100%; text-align:center; display:block;
  }
  .btn-primary:hover{ transform:translateY(-1px); opacity:.92; }

  .back-link{
    text-align:center; margin-top:20px;
    font-size:13.5px;
  }
  .back-link a{ color:var(--teal); text-decoration:none; }
  .back-link a:hover{ text-decoration:underline; }

  @media (max-width:480px){
    .panel{ padding:26px; }
  }
</style>
</head>
<body>

<div class="page-head">
  <a class="brand" href="index.php"><span class="dot"></span> Sentinel</a>
  <a class="back" href="login.php">Back to sign in &rarr;</a>
</div>

<div class="panel">
  <div class="panel-head">
    <span class="eyebrow">SECURE RESET</span>
    <h1>Reset password</h1>
    <p>Set a new password for your account.</p>
  </div>

  <?php if ($success): ?>
    <div class="alert alert-success">
        <?php echo $success; ?>
        <a href="login.php" class="btn-primary">Sign in now &rarr;</a>
    </div>
  <?php endif; ?>

  <?php if ($error): ?>
    <div class="alert alert-error">
        <?php echo $error; ?>
        <a href="forgot_password.php" class="btn-primary btn-amber">Request new reset</a>
    </div>
  <?php endif; ?>

  <?php if (!$success && !$error && isset($user) && $user): ?>
    <div class="user-info">
        <div class="row"><strong>Account:</strong> <?php echo htmlspecialchars($user['full_name']); ?></div>
        <div class="row"><strong>Email:</strong> <?php echo htmlspecialchars($user['email']); ?></div>
    </div>

    <?php if (isset($time_left)): ?>
        <div class="time-left">
            This reset link expires in <strong><?php echo $time_left; ?></strong>
        </div>
    <?php endif; ?>

    <form method="POST" action="" onsubmit="return validateForm()">
        <div class="form-group">
            <label for="password">New password</label>
            <input type="password" id="password" name="password" required
                   onkeyup="checkPasswordStrength()" placeholder="Enter new password">
            <div id="passwordStrength" class="status-line"></div>
            <span class="hint">Minimum 6 characters</span>
        </div>

        <div class="form-group">
            <label for="confirm_password">Confirm password</label>
            <input type="password" id="confirm_password" name="confirm_password" required
                   onkeyup="checkPasswordMatch()" placeholder="Confirm new password">
            <div id="passwordMatch" class="status-line"></div>
        </div>

        <input type="hidden" name="reset_password" value="1">

        <button type="submit" class="btn-primary">Reset password</button>
    </form>

    <div class="back-link">
        <a href="login.php">&larr; Back to sign in</a>
    </div>
  <?php endif; ?>

  <?php if (!$success && $error && !isset($user)): ?>
    <div class="back-link">
        <a href="forgot_password.php">&larr; Request new password reset</a>
    </div>
  <?php endif; ?>
</div>

<script>
    function checkPasswordStrength() {
        const password = document.getElementById('password').value;
        const strengthDiv = document.getElementById('passwordStrength');
        
        if (password.length === 0) {
            strengthDiv.innerHTML = '';
            return;
        }
        
        let strength = 0;
        let message = '';
        let color = '';
        
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]+/)) strength++;
        if (password.match(/[A-Z]+/)) strength++;
        if (password.match(/[0-9]+/)) strength++;
        if (password.match(/[$@#&!]+/)) strength++;
        
        if (strength <= 2) {
            message = 'Weak password';
            color = '#E5484D';
        } else if (strength <= 4) {
            message = 'Medium password';
            color = '#F2A93B';
        } else {
            message = 'Strong password';
            color = '#3FD8B0';
        }
        
        strengthDiv.innerHTML = message;
        strengthDiv.style.color = color;
        checkPasswordMatch();
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
            matchDiv.style.color = '#3FD8B0';
        } else {
            matchDiv.innerHTML = '✗ Passwords do not match';
            matchDiv.style.color = '#E5484D';
        }
    }
    
    function validateForm() {
        const password = document.getElementById('password').value;
        const confirm = document.getElementById('confirm_password').value;
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters long!');
            document.getElementById('password').focus();
            return false;
        }
        
        if (password !== confirm) {
            alert('Passwords do not match!');
            document.getElementById('confirm_password').focus();
            return false;
        }
        
        return confirm('Are you sure you want to reset your password?');
    }
    
    // Auto-focus on password field
    document.addEventListener('DOMContentLoaded', function() {
        const passwordField = document.getElementById('password');
        if (passwordField) {
            passwordField.focus();
        }
    });
</script>
</body>
</html>