<?php
require_once '../../config/database.php';

// Check if admin is logged in
if (!isAdminLoggedIn()) {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $transaction_id = isset($_POST['transaction_id']) ? (int)$_POST['transaction_id'] : 0;
    
    if ($transaction_id <= 0) {
        echo json_encode(['success' => false, 'error' => 'Invalid transaction ID']);
        exit();
    }
    
    $database = new Database();
    $db = $database->getConnection();
    
    try {
        // Update transaction to mark as reviewed (you can add a reviewed column if needed)
        // For now, we'll just update the status or add a note
        $query = "UPDATE transactions SET status = 'REVIEWED' WHERE id = ? AND fraud_prediction = 'FRAUD'";
        $stmt = $db->prepare($query);
        $stmt->execute([$transaction_id]);
        
        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Transaction not found or already reviewed']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
}
?>