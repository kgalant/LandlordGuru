<?php
$keyPath = '/volume1/homes/Kim/private/landlord-guru.pem';

if (isset($_GET['debug'])) {
    echo 'LandlordGuru key fetcher — PHP ' . phpversion();
    exit;
}

if (($_SERVER['HTTP_X_LANDLORDGURU'] ?? '') !== 'key-request') {
    echo 'LandlordGuru key fetcher — PHP ' . phpversion();
    exit;
}

if (!file_exists($keyPath)) {
    http_response_code(404);
    exit('Key file not found');
}

header('Content-Type: text/plain');
readfile($keyPath);