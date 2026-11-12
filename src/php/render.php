<?php
// Executes one PHP page the way the web server would (read-only) and prints the HTML it produces.
// usage: php render.php <absolute page file> <document root> <host>
$file = $argv[1];
$root = rtrim(str_replace('\\', '/', $argv[2]), '/');
$host = $argv[3] ?? 'localhost';
$file = str_replace('\\', '/', $file);
$uri = '/' . ltrim(substr($file, strlen($root)), '/');

$_SERVER['HTTP_HOST'] = $host;
$_SERVER['SERVER_NAME'] = $host;
$_SERVER['DOCUMENT_ROOT'] = $root;
$_SERVER['REQUEST_URI'] = $uri;
$_SERVER['SCRIPT_NAME'] = $uri;
$_SERVER['PHP_SELF'] = $uri;
$_SERVER['SCRIPT_FILENAME'] = $file;
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['HTTPS'] = 'on';
$_SERVER['SERVER_PORT'] = '443';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_USER_AGENT'] = 'SiteModernizerScan/0.1';

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', '0');
chdir(dirname($file));
ob_start();
try {
    include $file;
} catch (Throwable $e) {
    ob_end_clean();
    fwrite(STDERR, 'RENDER_ERROR: ' . $e->getMessage());
    exit(2);
}
echo ob_get_clean();
