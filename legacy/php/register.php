<?php
require_once 'config/database.php';

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

// Get security questions
$questions_query = "SELECT * FROM security_questions WHERE is_active = 1";
$questions_stmt = $db->prepare($questions_query);
$questions_stmt->execute();
$security_questions = $questions_stmt->fetchAll(PDO::FETCH_ASSOC);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $full_name = sanitizeInput($_POST['full_name']);
    $email = sanitizeInput($_POST['email']);
    $phone = sanitizeInput($_POST['phone']);
    $password = $_POST['password'];
    $confirm_password = $_POST['confirm_password'];
    $card_number = sanitizeInput($_POST['card_number']);
    
    // Remove spaces from card number
    $card_number = preg_replace('/\s+/', '', $card_number);
    
    // Get security answers
    $security_answers = [];
    $answer_count = 0;
    
    foreach ($security_questions as $question) {
        $answer = sanitizeInput($_POST['answer_' . $question['id']] ?? '');
        if (!empty($answer)) {
            $security_answers[$question['question_key']] = password_hash($answer, PASSWORD_DEFAULT);
            $answer_count++;
        }
    }
    
    // Validation
    $errors = [];
    
    if (empty($full_name)) {
        $errors[] = "Full name is required";
    } elseif (strlen($full_name) < 3) {
        $errors[] = "Full name must be at least 3 characters";
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = "Valid email is required";
    }
    
    if (empty($phone)) {
        $errors[] = "Phone number is required";
    } elseif (!preg_match('/^\+?[0-9]{10,15}$/', $phone)) {
        $errors[] = "Please enter a valid phone number (10-15 digits)";
    }
    
    if (strlen($password) < 6) {
        $errors[] = "Password must be at least 6 characters";
    }
    
    if ($password !== $confirm_password) {
        $errors[] = "Passwords do not match";
    }
    
    if (empty($card_number)) {
        $errors[] = "Card number is required";
    } elseif (strlen($card_number) < 16 || strlen($card_number) > 20) {
        $errors[] = "Card number must be 16-20 digits";
    } elseif (!ctype_digit($card_number)) {
        $errors[] = "Card number must contain only numbers";
    }
    
    // Validate security answers - at least 3 required
    if ($answer_count < 3) {
        $errors[] = "Please answer at least 3 security questions";
    }
    
    // Check if email, phone, or card already exists
    $checkQuery = "SELECT id FROM users WHERE email = ? OR card_number = ? OR phone = ?";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->execute([$email, $card_number, $phone]);
    
    if ($checkStmt->rowCount() > 0) {
        $errors[] = "Email, phone number, or card number already exists";
    }
    
    if (empty($errors)) {
        $hashed_password = password_hash($password, PASSWORD_DEFAULT);
        $security_json = json_encode($security_answers);
        
        $query = "INSERT INTO users (full_name, email, phone, password, balance, card_number, security_answers, is_approved, created_at) 
                  VALUES (?, ?, ?, ?, 0, ?, ?, 0, NOW())";
        $stmt = $db->prepare($query);
        
        $result = $stmt->execute([
            $full_name,
            $email,
            $phone,
            $hashed_password,
            $card_number,
            $security_json
        ]);
        
        if ($result) {
            $success = "Registration successful. Your account is pending admin approval — you'll be notified once it's reviewed.";
            // Clear form
            $_POST = [];
        } else {
            $error = "Registration failed. Please try again.";
        }
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
<title>Create account &mdash; Sentinel</title>
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
    max-width:640px; margin:0 auto 28px; position:relative; z-index:1;
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
  .page-head a.back{
    font-size:13.5px; color:var(--text-dim); text-decoration:none;
  }
  .page-head a.back:hover{ color:var(--text); }

  .panel{
    max-width:640px; margin:0 auto;
    background:linear-gradient(180deg, var(--panel), var(--panel-2));
    border:1px solid var(--line);
    border-radius:var(--radius);
    padding:40px;
    position:relative; z-index:1;
    animation: fadeIn .4s ease both;
  }
  @keyframes fadeIn{ from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:translateY(0);} }

  .panel-head{ margin-bottom:30px; }
  .eyebrow{
    display:inline-flex; align-items:center; gap:8px;
    font-family:'IBM Plex Mono', monospace;
    font-size:12px; color:var(--teal);
    border:1px solid rgba(63,216,176,0.3);
    background:rgba(63,216,176,0.06);
    padding:5px 11px; border-radius:99px;
    margin-bottom:18px;
  }
  .panel-head h1{
    font-family:'Space Grotesk', sans-serif;
    font-weight:700; font-size:28px; letter-spacing:-0.3px;
    margin-bottom:8px;
  }
  .panel-head p{ color:var(--text-dim); font-size:14.5px; }

  /* Alerts */
  .alert{
    border-radius:8px; padding:14px 16px; margin-bottom:24px;
    font-size:14px; border:1px solid;
  }
  .alert-success{
    background:rgba(63,216,176,0.08); border-color:rgba(63,216,176,0.3); color:var(--teal);
  }
  .alert-error{
    background:rgba(229,72,77,0.08); border-color:rgba(229,72,77,0.3); color:#ff8e92;
  }
  .alert a.btn-primary{ margin-top:12px; }

  /* Form */
  .form-group{ margin-bottom:20px; }
  .form-row{ display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  label{
    display:block; font-size:13.5px; font-weight:500;
    color:var(--text); margin-bottom:7px;
  }
  label .opt{ color:var(--text-dim); font-weight:400; }
  input[type="text"], input[type="email"], input[type="tel"], input[type="password"]{
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
  input:focus{
    outline:none; border-color:var(--teal);
    background:rgba(63,216,176,0.04);
  }
  .hint{ font-size:12px; color:var(--text-dim); margin-top:6px; display:block; }
  .status-line{ font-size:12.5px; margin-top:6px; font-family:'IBM Plex Mono', monospace; }

  /* Security section */
  .security-section{
    background:rgba(255,255,255,0.02);
    border:1px solid var(--line);
    border-left:3px solid var(--amber);
    border-radius:8px;
    padding:22px;
    margin:24px 0;
  }
  .security-section h4{
    font-family:'Space Grotesk', sans-serif; font-size:15.5px; font-weight:600;
    margin-bottom:6px; display:flex; align-items:center; gap:8px;
  }
  .security-section > p{ font-size:13.5px; color:var(--text-dim); margin-bottom:14px; }
  .security-question{
    background:rgba(255,255,255,0.02);
    border:1px solid var(--line);
    border-radius:7px;
    padding:14px;
    margin-bottom:10px;
  }
  .security-question label{ margin-bottom:8px; }
  .required-count{ margin-bottom:16px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .answer-counter{
    font-family:'IBM Plex Mono', monospace;
    display:inline-flex; align-items:center; gap:6px;
    padding:4px 11px; border-radius:99px; font-size:12px; font-weight:500;
  }
  .counter-good{ background:rgba(63,216,176,0.12); color:var(--teal); }
  .counter-bad{ background:rgba(242,169,59,0.14); color:var(--amber); }
  .answer-counter .sdot{ width:5px; height:5px; border-radius:50%; background:currentColor; }
  .tip{ font-size:12.5px; color:var(--text-dim); margin-top:8px; }

  /* Buttons */
  .btn-primary{
    font-size:15px; font-weight:600;
    padding:13px 24px; border-radius:8px;
    background:var(--text); color:var(--bg);
    text-decoration:none; border:none; cursor:pointer;
    transition:transform .15s, opacity .15s;
    width:100%; text-align:center; display:block;
  }
  .btn-primary:hover{ transform:translateY(-1px); opacity:.92; }

  .terms{
    font-size:12.5px; color:var(--text-dim); text-align:center; margin:20px 0;
  }
  .terms a{ color:var(--teal); text-decoration:none; }
  .terms a:hover{ text-decoration:underline; }

  .switch-link{
    text-align:center; margin-top:22px; padding-top:22px;
    border-top:1px solid var(--line);
    font-size:14px; color:var(--text-dim);
  }
  .switch-link a{ color:var(--teal); text-decoration:none; font-weight:500; }
  .switch-link a:hover{ text-decoration:underline; }

  @media (max-width: 600px){
    .panel{ padding:26px; }
    .form-row{ grid-template-columns:1fr; gap:0; }
  }
</style>
</head>
<body>

<div class="page-head">
  <a class="brand" href="index.php"><span class="dot"></span> Sentinel</a>
  <a class="back" href="login.php">Already have an account? Sign in &rarr;</a>
</div>

<div class="panel">
  <div class="panel-head">
    <span class="eyebrow">SECURE REGISTRATION</span>
    <h1>Create your account</h1>
    <p>Join the platform Sentinel monitors for you, transaction by transaction.</p>
  </div>

  <?php if ($success): ?>
    <div class="alert alert-success">
      <?php echo $success; ?>
      <a href="login.php" class="btn-primary" style="margin-top:14px;">Go to sign in &rarr;</a>
    </div>
  <?php endif; ?>

  <?php if ($error): ?>
    <div class="alert alert-error">
      <?php echo $error; ?>
    </div>
  <?php endif; ?>

  <?php if (!$success): ?>
  <form method="POST" action="" onsubmit="return validateForm()">
    <div class="form-group">
      <label for="full_name">Full name</label>
      <input type="text" id="full_name" name="full_name" required
             value="<?php echo htmlspecialchars($_POST['full_name'] ?? ''); ?>"
             placeholder="John Doe">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="email">Email address</label>
        <input type="email" id="email" name="email" required
               value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>"
               placeholder="john@example.com">
      </div>
      <div class="form-group">
        <label for="phone">Phone number</label>
        <input type="tel" id="phone" name="phone" required
               value="<?php echo htmlspecialchars($_POST['phone'] ?? ''); ?>"
               placeholder="+255712345678">
        <span class="hint">Include country code, e.g. +255XXXXXXXXX</span>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required
               onkeyup="checkPasswordStrength()" placeholder="Enter password">
        <div id="passwordStrength" class="status-line"></div>
        <span class="hint">At least 6 characters</span>
      </div>
      <div class="form-group">
        <label for="confirm_password">Confirm password</label>
        <input type="password" id="confirm_password" name="confirm_password" required
               onkeyup="checkPasswordMatch()" placeholder="Confirm password">
        <div id="passwordMatch" class="status-line"></div>
      </div>
    </div>

    <div class="form-group">
      <label for="card_number">Card number</label>
      <input type="text" id="card_number" name="card_number" maxlength="23" required
             value="<?php echo htmlspecialchars($_POST['card_number'] ?? ''); ?>"
             placeholder="4111 1111 1111 1111"
             onkeyup="formatCardNumber(this)">
      <span class="hint">16&ndash;20 digits, numbers only &mdash; spaces are added automatically</span>
    </div>

    <div class="security-section">
      <h4>Security questions</h4>
      <p>Answer at least 3 &mdash; these are used to verify it's you if you ever need to recover your account.</p>

      <div class="required-count">
        <span class="answer-counter counter-bad" id="counterDisplay"><span class="sdot"></span>0/3 answered</span>
        <span class="hint" style="margin:0;">Minimum 3 required</span>
      </div>

      <?php foreach ($security_questions as $question): ?>
      <div class="security-question">
        <label for="answer_<?php echo $question['id']; ?>">
          <?php echo htmlspecialchars($question['question_text']); ?>
          <span class="opt">(optional)</span>
        </label>
        <input type="text"
               id="answer_<?php echo $question['id']; ?>"
               name="answer_<?php echo $question['id']; ?>"
               placeholder="Enter your answer"
               onkeyup="countAnswers()"
               autocomplete="off"
               value="<?php echo htmlspecialchars($_POST['answer_' . $question['id']] ?? ''); ?>">
      </div>
      <?php endforeach; ?>

      <p class="tip">Tip: choose answers you'll remember. They're case-sensitive and stored securely hashed, never in plain text.</p>
    </div>

    <div class="terms">
      By creating an account, you agree to our
      <a href="#">Terms of Service</a> and
      <a href="#">Privacy Policy</a>
    </div>

    <button type="submit" class="btn-primary">Register account</button>
  </form>

  <div class="switch-link">
    Already have an account? <a href="login.php">Sign in</a>
  </div>
  <?php endif; ?>
</div>

<script>
    let answeredCount = 0;
    
    function countAnswers() {
        const inputs = document.querySelectorAll('.security-question input');
        answeredCount = 0;
        inputs.forEach(input => {
            if (input.value.trim() !== '') {
                answeredCount++;
            }
        });
        
        const counter = document.getElementById('counterDisplay');
        counter.innerHTML = '<span class="sdot"></span>' + answeredCount + '/3 answered';
        
        if (answeredCount >= 3) {
            counter.className = 'answer-counter counter-good';
        } else {
            counter.className = 'answer-counter counter-bad';
        }
    }
    
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
        
        // Length check
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        
        // Complexity checks
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
        
        // Also check password match
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
    
    function formatCardNumber(input) {
        // Remove all non-digit characters
        let value = input.value.replace(/\D/g, '');
        
        // Limit to 20 digits
        if (value.length > 20) {
            value = value.slice(0, 20);
        }
        
        // Format in groups of 4 for better readability
        let formatted = '';
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) {
                formatted += ' ';
            }
            formatted += value[i];
        }
        
        input.value = formatted;
    }
    
    function validateForm() {
        const full_name = document.getElementById('full_name').value.trim();
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const password = document.getElementById('password').value;
        const confirm = document.getElementById('confirm_password').value;
        const card_number_input = document.getElementById('card_number');
        const card_number = card_number_input.value.replace(/\s/g, ''); // Remove spaces
        
        // Validate full name
        if (full_name.length < 3) {
            alert('Full name must be at least 3 characters long!');
            document.getElementById('full_name').focus();
            return false;
        }
        
        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address!');
            document.getElementById('email').focus();
            return false;
        }
        
        // Validate phone
        const phoneRegex = /^\+?[0-9]{10,15}$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
            alert('Please enter a valid phone number (10-15 digits, can start with +)!');
            document.getElementById('phone').focus();
            return false;
        }
        
        // Validate password
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
        
        // Validate card number (after removing spaces)
        const cardNumberClean = card_number.replace(/\s/g, '');
        if (cardNumberClean.length < 16 || cardNumberClean.length > 20) {
            alert('Card number must be 16-20 digits!');
            document.getElementById('card_number').focus();
            return false;
        }
        
        if (!/^\d+$/.test(cardNumberClean)) {
            alert('Card number must contain only numbers!');
            document.getElementById('card_number').focus();
            return false;
        }
        
        // Count security answers
        const inputs = document.querySelectorAll('.security-question input');
        let count = 0;
        inputs.forEach(input => {
            if (input.value.trim() !== '') {
                count++;
            }
        });
        
        if (count < 3) {
            alert('Please answer at least 3 security questions!');
            document.querySelector('.security-question input').focus();
            return false;
        }
        
        return confirm('By creating an account, you confirm that the information provided is accurate and you agree to our terms of service.');
    }
    
    // Real-time validation for card number
    document.addEventListener('DOMContentLoaded', function() {
        const cardNumberInput = document.getElementById('card_number');
        if (cardNumberInput) {
            cardNumberInput.addEventListener('input', function(e) {
                let value = this.value.replace(/\s/g, '');
                if (value.length > 0 && !/^\d+$/.test(value)) {
                    this.setCustomValidity('Card number must contain only numbers');
                } else {
                    this.setCustomValidity('');
                }
            });
        }
        
        // Initialize answer counter
        countAnswers();
    });
</script>
</body>
</html>