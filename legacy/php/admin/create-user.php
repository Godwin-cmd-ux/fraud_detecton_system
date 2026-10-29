<?php
require_once '../config/database.php';
redirectIfNotAdmin();

$database = new Database();
$db = $database->getConnection();
$message = '';
$error = '';

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
    $initial_balance = floatval($_POST['initial_balance']);
    $card_number = sanitizeInput($_POST['card_number']);
    $is_approved = isset($_POST['is_approved']) ? 1 : 0;
    
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
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = "Valid email is required";
    }
    if (empty($phone)) {
        $errors[] = "Phone number is required";
    }
    if (strlen($password) < 6) {
        $errors[] = "Password must be at least 6 characters";
    }
    if ($initial_balance < 0) {
        $errors[] = "Initial balance cannot be negative";
    }
    if (empty($card_number) || strlen($card_number) < 16) {
        $errors[] = "Valid card number is required (16-20 digits)";
    }
    if (!ctype_digit($card_number)) {
        $errors[] = "Card number must contain only numbers";
    }
    
    // Validate security answers - at least 3 required
    if ($answer_count < 3) {
        $errors[] = "Please answer at least 3 security questions";
    }
    
    // Check if email exists
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
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())";
        $stmt = $db->prepare($query);
        
        $result = $stmt->execute([
            $full_name,
            $email,
            $phone,
            $hashed_password,
            $initial_balance,
            $card_number,
            $security_json,
            $is_approved
        ]);
        
        if ($result) {
            // Log admin action
            logAdminAction(
                $_SESSION['admin_id'],
                $_SESSION['admin_name'],
                'create_user',
                $db->lastInsertId(),
                $full_name,
                $initial_balance,
                'User created by admin',
                'Security questions set: ' . $answer_count . ' answered'
            );
            
            $message = "✅ User created successfully! " . ($is_approved ? "Account is active." : "Account requires approval.");
            // Clear form
            $_POST = [];
        } else {
            $error = "❌ Failed to create user";
        }
    } else {
        $error = implode("<br>", $errors);
    }
}

include 'partials/sidebar.php';
?>

<style>
    .security-section {
        background: var(--light-bg);
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
        border-left: 4px solid var(--primary-blue);
    }
    .security-section h4 {
        margin-top: 0;
        color: var(--text-dark);
    }
    .security-section small {
        color: var(--text-light);
    }
    .security-question {
        background: white;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 10px;
        border: 1px solid var(--border-color);
    }
    .security-question label {
        font-weight: 600;
        color: var(--text-dark);
        display: block;
        margin-bottom: 8px;
    }
    .security-question input {
        width: 100%;
        padding: 10px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        font-size: 0.9rem;
    }
    .security-question input:focus {
        outline: none;
        border-color: var(--primary-blue);
    }
    .required-count {
        font-size: 0.85rem;
        color: var(--text-light);
        margin-top: 5px;
    }
    .answer-counter {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    .counter-good {
        background: #d1fae5;
        color: #065f46;
    }
    .counter-bad {
        background: #fee2e2;
        color: #991b1b;
    }
    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
    }
    .form-group {
        margin-bottom: 20px;
    }
    .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        color: var(--text-dark);
    }
    .form-group input, .form-group select {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        font-size: 0.9rem;
        transition: border-color 0.3s ease;
    }
    .form-group input:focus, .form-group select:focus {
        outline: none;
        border-color: var(--primary-blue);
    }
    .checkbox-group {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .checkbox-group input[type="checkbox"] {
        width: auto;
        padding: 0;
        margin: 0;
        width: 18px;
        height: 18px;
    }
    .checkbox-group label {
        margin: 0;
        cursor: pointer;
    }
    @media (max-width: 768px) {
        .form-row {
            grid-template-columns: 1fr;
            gap: 0;
        }
    }
</style>

<div class="top-header">
    <div class="header-title">
        <h1>Create New User</h1>
        <p>Add a new customer to the system</p>
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
    
    <form method="POST" action="" onsubmit="return validateForm()">
        <!-- Personal Information -->
        <div class="form-row">
            <div class="form-group">
                <label for="full_name">Full Name *</label>
                <input type="text" id="full_name" name="full_name" required 
                       value="<?php echo htmlspecialchars($_POST['full_name'] ?? ''); ?>"
                       placeholder="John Doe">
            </div>
            
            <div class="form-group">
                <label for="email">Email *</label>
                <input type="email" id="email" name="email" required 
                       value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>"
                       placeholder="john@example.com">
            </div>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="phone">Phone Number *</label>
                <input type="tel" id="phone" name="phone" required 
                       value="<?php echo htmlspecialchars($_POST['phone'] ?? ''); ?>"
                       placeholder="+255712345678">
                <small style="color: var(--text-light);">Tanzanian format: +255XXXXXXXXX</small>
            </div>
            
            <div class="form-group">
                <label for="password">Password *</label>
                <input type="password" id="password" name="password" required 
                       onkeyup="checkPasswordStrength()" placeholder="Enter password">
                <div id="passwordStrength" style="font-size: 0.8rem; margin-top: 5px;"></div>
                <small style="color: var(--text-light);">Minimum 6 characters</small>
            </div>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="initial_balance">Initial Balance (TSh) *</label>
                <input type="number" id="initial_balance" name="initial_balance" step="0.01" required 
                       value="<?php echo htmlspecialchars($_POST['initial_balance'] ?? '0.00'); ?>"
                       placeholder="0.00">
                <small style="color: var(--text-light);">Amount in Tanzanian Shillings</small>
            </div>
            
            <div class="form-group">
                <label for="card_number">Card Number *</label>
                <input type="text" id="card_number" name="card_number" maxlength="20" required 
                       value="<?php echo htmlspecialchars($_POST['card_number'] ?? ''); ?>"
                       placeholder="4111111111111111"
                       onkeyup="formatCardNumber(this)">
                <small style="color: var(--text-light);">16-20 digit card number (numbers only)</small>
            </div>
        </div>
        
        <div class="form-group">
            <div class="checkbox-group">
                <input type="checkbox" id="is_approved" name="is_approved" 
                       <?php echo isset($_POST['is_approved']) ? 'checked' : 'checked'; ?>>
                <label for="is_approved">✅ Activate account immediately (skip approval)</label>
            </div>
            <small style="color: var(--text-light);">If unchecked, user will need admin approval before logging in</small>
        </div>
        
        <!-- Security Questions Section -->
        <div class="security-section">
            <h4>🔐 Security Questions</h4>
            <p style="margin: 0 0 10px 0; color: var(--text-light); font-size: 0.9rem;">
                Please answer at least 3 security questions. These will be used for password recovery.
            </p>
            <div id="answerCounter" class="required-count">
                <span class="answer-counter counter-bad" id="counterDisplay">0/3 answered</span>
                <span style="margin-left: 10px; font-size: 0.8rem;">Minimum 3 required</span>
            </div>
            
            <?php foreach ($security_questions as $question): ?>
            <div class="security-question">
                <label for="answer_<?php echo $question['id']; ?>">
                    <?php echo htmlspecialchars($question['question_text']); ?> 
                    <span style="color: var(--text-light); font-weight: normal;">(Optional)</span>
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
            
            <div style="margin-top: 10px; font-size: 0.8rem; color: var(--text-light);">
                💡 Tip: Choose answers the user will remember. They are case-sensitive and will be securely hashed.
            </div>
        </div>
        
        <div class="form-group">
            <button type="submit" class="btn btn-primary">Create User Account</button>
            <button type="reset" class="btn" style="background: var(--light-bg);" onclick="resetForm()">Reset</button>
        </div>
    </form>
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
    counter.textContent = answeredCount + '/3 answered';
    
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
    
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]+/)) strength++;
    if (password.match(/[A-Z]+/)) strength++;
    if (password.match(/[0-9]+/)) strength++;
    if (password.match(/[$@#&!]+/)) strength++;
    
    if (strength <= 2) {
        message = 'Weak password';
        color = '#ef4444';
    } else if (strength <= 4) {
        message = 'Medium password';
        color = '#f59e0b';
    } else {
        message = 'Strong password';
        color = '#10b981';
    }
    
    strengthDiv.innerHTML = message;
    strengthDiv.style.color = color;
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

function resetForm() {
    document.querySelectorAll('.security-question input').forEach(input => {
        input.value = '';
    });
    countAnswers();
}

function validateForm() {
    const full_name = document.getElementById('full_name').value.trim();
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;
    const card_number_input = document.getElementById('card_number');
    const card_number = card_number_input.value.replace(/\s/g, ''); // Remove spaces
    const initial_balance = parseFloat(document.getElementById('initial_balance').value);
    
    if (full_name.length < 3) {
        alert('Full name must be at least 3 characters long!');
        document.getElementById('full_name').focus();
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address!');
        document.getElementById('email').focus();
        return false;
    }
    
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        alert('Please enter a valid phone number (10-15 digits, can start with +)!');
        document.getElementById('phone').focus();
        return false;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters long!');
        document.getElementById('password').focus();
        return false;
    }
    
    // Check card number after removing spaces
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
    
    if (isNaN(initial_balance) || initial_balance < 0) {
        alert('Initial balance must be a valid positive number!');
        document.getElementById('initial_balance').focus();
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
    
    return confirm('Create this user account with ' + count + ' security questions answered?');
}

// Initialize counter
document.addEventListener('DOMContentLoaded', function() {
    countAnswers();
});

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