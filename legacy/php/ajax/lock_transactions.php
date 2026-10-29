<?php
// ajax/lock_transactions.php
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit();
}

// Lock transactions
$_SESSION['transactions_unlocked'] = false;
unset($_SESSION['transactions_unlock_time']);

echo json_encode(['success' => true]);
?>