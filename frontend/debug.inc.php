<?php
/**
 * LandlordGuru — logger + debug page
 *
 * Include this file in any PHP entry point. It immediately sets up
 * the log buffer and auto-records common App context entries.
 *
 * Recording API (always-on, safe to call in normal operation):
 *   lg('info' | 'warn' | 'error', section, label, value)
 *   lg_add_transport(callable $fn)   // fn(array $entry) — called per entry;
 *                                    // existing buffer is replayed on registration
 *
 * Debug page (rendered on ?debug or ?debug=<level>):
 *   landlordguru_debug_page()        // reads level from $_GET['debug']
 *
 * Level hierarchy (most severe → most verbose): error > warn > info
 *   ?debug          → show all  (defaults to info)
 *   ?debug=warn     → warn + error
 *   ?debug=error    → error only
 */

// ── Internal state ────────────────────────────────────────

$_lg_buffer     = [];
$_lg_transports = [];

// ── lg() — record an entry ────────────────────────────────

function lg(string $level, string $section, string $label, $value): void {
    global $_lg_buffer, $_lg_transports;

    $entry = [
        'level'     => $level,
        'section'   => $section,
        'label'     => $label,
        'value'     => (string) $value,
        'timestamp' => date('c'),
    ];

    $_lg_buffer[] = $entry;

    foreach ($_lg_transports as $fn) {
        try { $fn($entry); } catch (Throwable $e) { /* swallow — never let a transport break the app */ }
    }
}

// ── lg_add_transport() — register an output destination ──
//  Existing buffer is replayed so no entries are missed.

function lg_add_transport(callable $fn): void {
    global $_lg_buffer, $_lg_transports;
    $_lg_transports[] = $fn;
    foreach ($_lg_buffer as $entry) {
        try { $fn($entry); } catch (Throwable $e) {}
    }
}

// ── Auto-record common App context on include ─────────────

(function () {
    $vf  = __DIR__ . '/version.json';
    $ver = file_exists($vf) ? json_decode(file_get_contents($vf), true) : [];
    lg('info', 'App', 'Version',    $ver['version'] ?? 'unknown');
    lg('info', 'App', 'Build date', $ver['date']    ?? '');
    lg('info', 'App', 'PHP',        phpversion());
    lg('info', 'App', 'File',       basename($_SERVER['SCRIPT_FILENAME'] ?? ''));
    lg('info', 'App', 'Host',       $_SERVER['HTTP_HOST'] ?? '');
})();

// ── landlordguru_debug_page() — render and exit ───────────

function landlordguru_debug_page(): void {
    global $_lg_buffer;

    $levels = ['info' => 0, 'warn' => 1, 'error' => 2];
    $param  = $_GET['debug'] ?? '';
    $active = isset($levels[$param]) ? $param : 'info';

    // Filter by level, deduplicate per section+label (last write wins)
    $sections = [];
    foreach ($_lg_buffer as $e) {
        if (($levels[$e['level']] ?? 0) >= $levels[$active]) {
            $sections[$e['section']][$e['label']] = $e;
        }
    }

    $levelColor  = ['error' => '#a32020', 'warn' => '#7a5200', 'info' => '#5a5a55'];
    $levelBg     = ['error' => '#fceaea', 'warn' => '#fef3db', 'info' => 'transparent'];
    $activeBg    = ['error' => '#a32020', 'warn' => '#7a5200', 'info' => '#1a1a18'];

    $base = strtok($_SERVER['REQUEST_URI'] ?? '', '?');

    header('Content-Type: text/html; charset=utf-8');
?><!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Debug — LandlordGuru</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body     { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
               font-size: 13px; background: #f7f7f5; color: #1a1a18; padding: 24px 16px; }
    h1       { font-size: 15px; font-weight: 600; margin-bottom: 16px; display: flex;
               align-items: center; gap: 10px; flex-wrap: wrap; }
    .badge   { font-size: 11px; padding: 2px 10px; border-radius: 20px; background: #efefeb;
               color: #8a8a85; border: 0.5px solid rgba(0,0,0,0.18); }
    .levels  { display: flex; gap: 5px; }
    .lvl-btn { font-size: 11px; padding: 3px 10px; border-radius: 20px; text-decoration: none;
               border: 0.5px solid rgba(0,0,0,0.18); color: #8a8a85; background: transparent; }
    .lvl-btn.active { color: #fff; }
    .wrap    { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
    .card    { background: #fff; border: 0.5px solid rgba(0,0,0,0.10); border-radius: 8px;
               padding: 12px 14px; min-width: 200px; }
    .card h2 { font-size: 10px; font-weight: 600; color: #8a8a85; text-transform: uppercase;
               letter-spacing: 0.06em; margin-bottom: 10px; }
    table    { border-collapse: collapse; }
    .lbl     { font-size: 11px; color: #5a5a55; padding: 2px 12px 2px 0;
               white-space: nowrap; vertical-align: top; }
    .val     { font-size: 12px; font-family: monospace; word-break: break-all;
               padding: 2px 0; vertical-align: top; }
    .empty   { color: #8a8a85; font-size: 12px; }
  </style>
</head>
<body>
  <h1>
    LandlordGuru
    <span class="badge">v<?= htmlspecialchars($sections['App']['Version']['value'] ?? '?') ?> &middot; debug</span>
    <nav class="levels">
      <?php foreach (['info','warn','error'] as $l): ?>
        <a href="<?= htmlspecialchars($base) ?>?debug=<?= $l ?>"
           class="lvl-btn<?= $l === $active ? ' active' : '' ?>"
           style="<?= $l === $active ? 'background:' . $activeBg[$l] . ';border-color:' . $activeBg[$l] : '' ?>">
          <?= $l ?>
        </a>
      <?php endforeach ?>
    </nav>
  </h1>

  <?php if (empty($sections)): ?>
    <p class="empty">No entries at <strong><?= htmlspecialchars($active) ?></strong> level or above.</p>
  <?php else: ?>
  <div class="wrap">
    <?php foreach ($sections as $sectionName => $labels): ?>
    <div class="card">
      <h2><?= htmlspecialchars($sectionName) ?></h2>
      <table>
        <?php foreach ($labels as $entry): ?>
        <tr>
          <td class="lbl"><?= htmlspecialchars($entry['label']) ?></td>
          <td class="val" style="color:<?= $levelColor[$entry['level']] ?>;background:<?= $levelBg[$entry['level']] ?>">
            <?= htmlspecialchars($entry['value']) ?>
          </td>
        </tr>
        <?php endforeach ?>
      </table>
    </div>
    <?php endforeach ?>
  </div>
  <?php endif ?>
</body>
</html>
<?php
    exit;
}
