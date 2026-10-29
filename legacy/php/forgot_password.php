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
$step = isset($_GET['step']) ? (int)$_GET['step'] : 1;
$user_email = '';
$security_questions = [];

// Step 1: Enter email
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['email'])) {
    $email = sanitizeInput($_POST['email']);
    
    // Check if user exists and is active
    $query = "SELECT id, full_name, security_answers, is_active, is_approved FROM users WHERE email = ?";
    $stmt = $db->prepare($query);
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user) {
        // Check if user is active
        if ($user['is_active'] == 0) {
            $error = "Your account has been deactivated. Please contact support.";
        }
        // Check if user is approved
        elseif ($user['is_approved'] == 0) {
            $error = "Your account is pending admin approval. Please wait for confirmation before resetting your password.";
        }
        else {
            // Check if user has security answers
            $security_answers = json_decode($user['security_answers'], true);
            
            if (empty($security_answers) || count($security_answers) < 3) {
                $error = "Your account doesn't have sufficient security questions set up. Please contact support.";
            } else {
                $user_email = $email;
                $_SESSION['reset_user_id'] = $user['id'];
                $_SESSION['reset_user_email'] = $email;
                
                // Get security questions
                $questions_query = "SELECT * FROM security_questions WHERE is_active = 1";
                $questions_stmt = $db->prepare($questions_query);
                $questions_stmt->execute();
                $all_questions = $questions_stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Get answered questions
                $security_questions = [];
                foreach ($all_questions as $q) {
                    if (isset($security_answers[$q['question_key']])) {
                        $security_questions[] = $q;
                    }
                }
                
                if (count($security_questions) < 3) {
                    $error = "Your account doesn't have sufficient security questions set up. Please contact support.";
                } else {
                    $_SESSION['reset_questions'] = $security_questions;
                    header("Location: forgot_password.php?step=2");
                    exit();
                }
            }
        }
    } else {
        $error = "Email not found. Please check your email address.";
    }
}

// Step 2: Verify security answers
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['verify_answers'])) {
    $answers = [];
    foreach ($_POST as $key => $value) {
        if (strpos($key, 'answer_') === 0) {
            $question_key = str_replace('answer_', '', $key);
            $answers[$question_key] = sanitizeInput($value);
        }
    }
    
    $user_id = $_SESSION['reset_user_id'] ?? 0;
    $query = "SELECT security_answers FROM users WHERE id = ?";
    $stmt = $db->prepare($query);
    $stmt->execute([$user_id]);
    $user_data = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user_data) {
        $stored_answers = json_decode($user_data['security_answers'], true);
        $correct_count = 0;
        $total_answered = 0;
        
        foreach ($answers as $key => $value) {
            if (!empty($value)) {
                $total_answered++;
                if (isset($stored_answers[$key]) && password_verify($value, $stored_answers[$key])) {
                    $correct_count++;
                }
            }
        }
        
        if ($total_answered < 3) {
            $error = "Please answer at least 3 security questions.";
        } elseif ($correct_count >= 3) {
            // Generate reset token - FIXED: 5 minutes expiry
            $reset_token = bin2hex(random_bytes(32));
            
            // Get current time and add 5 minutes
            $now = new DateTime();
            $expiry = $now->modify('+5 minutes')->format('Y-m-d H:i:s');
            
            // Clear any existing tokens first
            $clear_query = "UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?";
            $clear_stmt = $db->prepare($clear_query);
            $clear_stmt->execute([$user_id]);
            
            // Set the new token
            $update_query = "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?";
            $update_stmt = $db->prepare($update_query);
            $result = $update_stmt->execute([$reset_token, $expiry, $user_id]);
            
            // Check if update was successful
            if ($result) {
                // Store token in session as backup
                $_SESSION['reset_token'] = $reset_token;
                $_SESSION['reset_user_id'] = $user_id;
                $_SESSION['reset_expiry'] = $expiry;
                
                // Log the token for debugging
                error_log("Reset token generated for user $user_id: $reset_token, expires at: $expiry");
                
                // Redirect to reset password page
                header("Location: reset_password.php?token=" . $reset_token);
                exit();
            } else {
                $error = "Failed to generate reset token. Please try again.";
            }
        } else {
            $error = "Incorrect answers. Please try again. (" . $correct_count . "/3 correct)";
        }
    } else {
        $error = "Invalid user session. Please start over.";
        header("Location: forgot_password.php");
        exit();
    }
}

// Step 2 display
if ($step == 2) {
    $security_questions = $_SESSION['reset_questions'] ?? [];
    if (empty($security_questions)) {
        header("Location: forgot_password.php");
        exit();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Password recovery &mdash; Sentinel</title>
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
    width:100%; max-width:460px; margin-bottom:28px; position:relative; z-index:1;
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
    width:100%; max-width:460px;
    background:linear-gradient(180deg, var(--panel), var(--panel-2));
    border:1px solid var(--line);
    border-radius:var(--radius);
    padding:38px;
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

  /* Step indicator */
  .step-indicator{
    display:flex; align-items:center; justify-content:center;
    gap:8px; margin-bottom:28px;
  }
  .step-dot{
    width:32px; height:32px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-family:'IBM Plex Mono', monospace; font-size:13px; font-weight:500;
    color:var(--text-dim);
    background:rgba(255,255,255,0.02);
    border:1px solid var(--line);
    transition:all .15s;
  }
  .step-dot.active{
    background:rgba(63,216,176,0.1);
    color:var(--teal);
    border-color:var(--teal);
  }
  .step-dot.completed{
    background:var(--teal);
    color:var(--bg);
    border-color:var(--teal);
  }
  .step-line{ width:32px; height:1px; background:var(--line); }
  .step-line.completed{ background:var(--teal); }

  /* Alerts */
  .alert{
    border-radius:8px; padding:13px 15px; margin-bottom:22px;
    font-size:13.5px; border:1px solid;
  }
  .alert-error{ background:rgba(229,72,77,0.08); border-color:rgba(229,72,77,0.3); color:#ff8e92; }
  .alert-warning{ background:rgba(242,169,59,0.08); border-color:rgba(242,169,59,0.3); color:var(--amber); }
  .alert-success{ background:rgba(63,216,176,0.08); border-color:rgba(63,216,176,0.3); color:var(--teal); }

  /* Form */
  .form-group{ margin-bottom:18px; }
  label{
    display:block; font-size:13.5px; font-weight:500;
    color:var(--text); margin-bottom:7px;
  }
  input[type="email"], input[type="text"]{
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

  .security-question-item{
    background:rgba(255,255,255,0.02);
    border:1px solid var(--line);
    border-radius:7px;
    padding:14px;
    margin-bottom:12px;
  }
  .security-question-item label{ margin-bottom:8px; }

  .intro-text{ color:var(--text-dim); font-size:14px; margin-bottom:20px; }
  .tip{ margin-top:16px; font-size:12.5px; color:var(--text-dim); }

  .btn-primary{
    font-size:15px; font-weight:600;
    padding:13px 24px; border-radius:8px;
    background:var(--text); color:var(--bg);
    text-decoration:none; border:none; cursor:pointer;
    transition:transform .15s, opacity .15s;
    width:100%; text-align:center; display:block;
    margin-top:6px;
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
    .step-dot{ width:28px; height:28px; font-size:12px; }
    .step-line{ width:20px; }
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
    <span class="eyebrow">IDENTITY VERIFICATION</span>
    <h1>Password recovery</h1>
    <p>Reset your account password in a few steps.</p>
  </div>

  <div class="step-indicator">
    <div class="step-dot <?php echo $step >= 1 ? 'active' : ''; ?>">1</div>
    <div class="step-line <?php echo $step >= 2 ? 'completed' : ''; ?>"></div>
    <div class="step-dot <?php echo $step >= 2 ? 'active' : ''; ?>">2</div>
    <div class="step-line <?php echo $step >= 3 ? 'completed' : ''; ?>"></div>
    <div class="step-dot <?php echo $step >= 3 ? 'active' : ''; ?>">3</div>
  </div>

  <?php if ($error): ?>
    <div class="alert <?php echo strpos($error, 'pending admin approval') !== false ? 'alert-warning' : 'alert-error'; ?>">
        <?php echo htmlspecialchars($error); ?>
    </div>
  <?php endif; ?>

  <?php if ($success): ?>
    <div class="alert alert-success">
        <?php echo htmlspecialchars($success); ?>
    </div>
  <?php endif; ?>

  <!-- Step 1: Email Input -->
  <?php if ($step == 1): ?>
  <form method="POST" action="">
    <div class="form-group">
      <label for="email">Email address</label>
      <input type="email" id="email" name="email" required
             placeholder="Enter your registered email"
             value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>">
      <span class="hint">We'll verify your identity using security questions</span>
    </div>

    <button type="submit" class="btn-primary">Continue &rarr;</button>
  </form>

  <div class="back-link">
    <a href="login.php">&larr; Back to sign in</a>
  </div>
  <?php endif; ?>

  <!-- Step 2: Security Questions -->
  <?php if ($step == 2): ?>
  <form method="POST" action="" onsubmit="return validateAnswers()">
    <p class="intro-text">Answer the following security questions to verify your identity.</p>

    <input type="hidden" name="verify_answers" value="1">

    <?php foreach ($security_questions as $question): ?>
    <div class="security-question-item">
      <label for="answer_<?php echo $question['question_key']; ?>">
        <?php echo htmlspecialchars($question['question_text']); ?>
      </label>
      <input type="text"
             id="answer_<?php echo $question['question_key']; ?>"
             name="answer_<?php echo $question['question_key']; ?>"
             required
             placeholder="Enter your answer">
    </div>
    <?php endforeach; ?>

    <p class="tip">You need to answer at least 3 questions correctly.</p>

    <button type="submit" class="btn-primary">Verify identity &rarr;</button>
  </form>

  <div class="back-link">
    <a href="forgot_password.php">&larr; Start over</a>
  </div>
  <?php endif; ?>
</div>

<script>
    function validateAnswers() {
        const inputs = document.querySelectorAll('.security-question-item input');
        let allFilled = true;
        let filledCount = 0;
        
        inputs.forEach(input => {
            if (input.value.trim() === '') {
                allFilled = false;
                input.style.borderColor = '#E5484D';
            } else {
                input.style.borderColor = '';
                filledCount++;
            }
        });
        
        if (filledCount < 3) {
            alert('Please answer at least 3 security questions.');
            return false;
        }
        
        if (!allFilled) {
            alert('Please answer all security questions.');
            return false;
        }
        
        return true;
    }
    
    // Auto-focus on first input
    document.addEventListener('DOMContentLoaded', function() {
        const firstInput = document.querySelector('input');
        if (firstInput) {
            firstInput.focus();
        }
    });
</script>
</body>
</html>