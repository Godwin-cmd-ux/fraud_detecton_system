<?php
// ajax/verify_password.php
session_start();
require_once '../config/database.php';

// Check if user is logged in
if (!isUserLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit();
}

$database = new Database();
$db = $database->getConnection();

// Get POST data
$user_id = isset($_POST['user_id']) ? (int)$_POST['user_id'] : 0;
$password = isset($_POST['password']) ? $_POST['password'] : '';

// Validate
if (empty($password) || $user_id <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit();
}

// Verify user exists
$query = "SELECT password FROM users WHERE id = ? AND is_active = 1";
$stmt = $db->prepare($query);
$stmt->execute([$user_id]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'User not found']);
    exit();
}

// Verify password
if (password_verify($password, $user['password'])) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => 'Incorrect password']);
}
?>