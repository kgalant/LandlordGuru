<?php
require_once __DIR__ . '/debug.inc.php';

$keyPath = '/volume1/homes/Kim/private/landlord-guru.pem';

// Always record key file status — transports see this whether or not ?debug is present
lg('info',                                              'Key File', 'Path',     $keyPath);
lg(file_exists($keyPath)  ? 'info' : 'error',          'Key File', 'Exists',   file_exists($keyPath)  ? 'yes' : 'no');
lg(is_readable($keyPath)  ? 'info' : 'warn',           'Key File', 'Readable', is_readable($keyPath)  ? 'yes' : 'no');

if (isset($_GET['debug'])) {
    landlordguru_debug_page();
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
