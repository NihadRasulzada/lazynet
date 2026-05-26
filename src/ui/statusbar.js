'use strict';

const { T, ansi } = require('../core/screen');

const MODE_LABEL = {
  NORMAL:  ' NORMAL ',
  COMMAND: ' CMD    ',
  NUGET:   ' NUGET  ',
  REFS:    ' REFS   ',
};

const MODE_COLOR = {
  NORMAL:  T.modeNormal,
  COMMAND: T.modeCommand,
  NUGET:   T.modeNuget,
  REFS:    T.modeTest,
};

// ─── Header bar ───────────────────────────────────────────────────────────────
function renderHeader(screen, state, y, w) {
  const bgR = T.bgHeader[0], bgG = T.bgHeader[1], bgB = T.bgHeader[2];

  // Fill background
  screen.fillRect(1, y, w, 1, bgR, bgG, bgB);

  // Left: app name
  const appName = ' ◈ dotnet-tui ';
  screen.push(
    ansi.moveTo(y, 1) +
    ansi.bg(bgR, bgG, bgB) +
    ansi.fg(T.fgAccent[0], T.fgAccent[1], T.fgAccent[2]) +
    ansi.bold() +
    appName +
    ansi.reset()
  );

  // Right: current working directory
  const cwd  = process.cwd();
  const home = process.env.HOME || '';
  const cwdDisplay = home && cwd.startsWith(home)
    ? '~' + cwd.slice(home.length)
    : cwd;
  const cwdStr = ` ⌂ ${cwdDisplay} `;
  const cwdX   = w - cwdStr.length + 1;
  if (cwdX > appName.length + 2) {
    screen.push(
      ansi.moveTo(y, cwdX) +
      ansi.bg(bgR, bgG, bgB) +
      ansi.fg(T.fgGray[0], T.fgGray[1], T.fgGray[2]) +
      cwdStr +
      ansi.reset()
    );
  }

}

// ─── Status bar ───────────────────────────────────────────────────────────────
function renderStatusBar(screen, state, y, w) {
  const bgR = T.bgStatus[0], bgG = T.bgStatus[1], bgB = T.bgStatus[2];

  // Fill background
  screen.fillRect(1, y, w, 1, bgR, bgG, bgB);

  const modeColor = MODE_COLOR[state.mode] || T.modeNormal;
  const modeLabel = MODE_LABEL[state.mode] || ' NORMAL ';

  let col = 1;

  // ── Mode pill (colored bg) ──
  screen.push(
    ansi.moveTo(y, col) +
    ansi.bg(modeColor[0], modeColor[1], modeColor[2]) +
    ansi.fg(15, 15, 25) +
    ansi.bold() +
    modeLabel +
    ansi.reset()
  );
  col += modeLabel.length;

  // Powerline separator: ▐ (mode color → status bg)
  screen.push(
    ansi.moveTo(y, col) +
    ansi.bg(bgR, bgG, bgB) +
    ansi.fg(modeColor[0], modeColor[1], modeColor[2]) +
    '▐' +
    ansi.reset()
  );
  col += 1;

  // ── Build config ──
  const cfg      = state.buildConfig || 'Debug';
  const cfgColor = cfg === 'Release' ? T.fgGreen : T.fgYellow;
  screen.push(
    ansi.moveTo(y, col) +
    ansi.bg(bgR, bgG, bgB) +
    ansi.fg(cfgColor[0], cfgColor[1], cfgColor[2]) +
    ` ${cfg} ` +
    ansi.reset()
  );
  col += cfg.length + 2;

  // Separator
  screen.push(
    ansi.moveTo(y, col) +
    ansi.bg(bgR, bgG, bgB) +
    ansi.fg(T.fgBorder[0] + 20, T.fgBorder[1] + 20, T.fgBorder[2] + 20) +
    ' │ ' +
    ansi.reset()
  );
  col += 3;

  // ── Solution name ──
  const slnName = state.solution
    ? state.solution.slnPath.split('/').pop()
    : 'No solution';
  screen.push(
    ansi.moveTo(y, col) +
    ansi.bg(bgR, bgG, bgB) +
    ansi.fg(T.fgAccent[0], T.fgAccent[1], T.fgAccent[2]) +
    slnName +
    ansi.reset()
  );
  col += slnName.length;

  // ── Runner busy ──
  if (state.runnerBusy) {
    screen.push(
      ansi.moveTo(y, col) +
      ansi.bg(bgR, bgG, bgB) +
      ansi.fg(T.fgYellow[0], T.fgYellow[1], T.fgYellow[2]) +
      '  ⟳ running… ' +
      ansi.reset()
    );
    col += 14;
  }

  // ── Status message (center) ──
  const msg = state.statusMsg || '';
  if (msg) {
    const statusColor = msg.startsWith('✘') ? T.fgRed
      : msg.startsWith('✔') ? T.fgGreen
      : T.fgDim;
    const msgX = Math.max(col + 2, Math.floor(w / 2) - Math.floor(msg.length / 2));
    screen.push(
      ansi.moveTo(y, msgX) +
      ansi.bg(bgR, bgG, bgB) +
      ansi.fg(statusColor[0], statusColor[1], statusColor[2]) +
      msg +
      ansi.reset()
    );
  }

  // ── Right hint (powerline-style) ──
  const hintBg  = [24, 25, 38];
  const hint    = ' ? help  :cmd  n NuGet  Tab panel ';
  const hintX   = w - hint.length + 1;
  if (hintX > col + 4) {
    // Left edge of hint segment
    screen.push(
      ansi.moveTo(y, hintX - 1) +
      ansi.bg(bgR, bgG, bgB) +
      ansi.fg(hintBg[0], hintBg[1], hintBg[2]) +
      '▌' +
      ansi.reset()
    );
    screen.push(
      ansi.moveTo(y, hintX) +
      ansi.bg(hintBg[0], hintBg[1], hintBg[2]) +
      ansi.fg(T.fgGray[0], T.fgGray[1], T.fgGray[2]) +
      hint +
      ansi.reset()
    );
  }
}

// ─── Command input line ────────────────────────────────────────────────────────
function renderCommandLine(screen, state, y, w) {
  if (state.mode !== 'COMMAND') return;

  const bgR = T.bgInput[0], bgG = T.bgInput[1], bgB = T.bgInput[2];
  screen.fillRect(1, y, w, 1, bgR, bgG, bgB);

  const prompt = ':';
  const text   = state.commandBuf;
  screen.push(
    ansi.moveTo(y, 1) +
    ansi.bg(bgR, bgG, bgB) +
    ansi.fg(T.fgYellow[0], T.fgYellow[1], T.fgYellow[2]) +
    ansi.bold() + prompt + ansi.reset() +
    ansi.bg(bgR, bgG, bgB) +
    ansi.fg(T.fgSelected[0], T.fgSelected[1], T.fgSelected[2]) +
    text + '█' +
    ansi.reset()
  );
}

// ─── Help overlay ─────────────────────────────────────────────────────────────
function renderHelp(screen, state, scrW, scrH) {
  if (!state._showHelp) return;

  const w = Math.min(72, scrW - 4);
  const h = Math.min(38, scrH - 2);
  const x = Math.floor((scrW - w) / 2);
  const y = Math.floor((scrH - h) / 2);

  // Shadow
  screen.fillRect(x + 2, y + 1, w, h, 10, 10, 18, ' ');

  screen.drawBox(x, y, w, h, {
    title: ' Keyboard Shortcuts ',
    focused: true,
    bgR: T.bgPopup[0], bgG: T.bgPopup[1], bgB: T.bgPopup[2],
    tR: T.fgAccent[0], tG: T.fgAccent[1], tB: T.fgAccent[2],
  });

  const iX = x + 3;
  const iW = w - 6;

  const sections = [
    { title: '  Navigation', items: [
      ['hjkl / ↑↓←→',    'Move cursor'],
      ['Tab / Shift+Tab', 'Switch panel  (Tree ↔ Output)'],
      ['Enter',           'Expand / collapse tree node'],
      ['g / G',           'Go to top / bottom'],
      ['Ctrl+U / Ctrl+D', 'Page up / page down'],
    ]},
    { title: '  Build & Run', items: [
      ['b',       'Build selected project'],
      ['B',       'Build solution'],
      ['R',       'Rebuild (no-incremental)'],
      ['c',       'Clean'],
      ['r',       'Run project'],
      ['t',       'Run tests'],
      ['p',       'Publish  (Release)'],
      ['e',       'Restore packages'],
      ['Ctrl+K',  'Kill running process'],
    ]},
    { title: '  NuGet', items: [
      ['n',                   'Open NuGet manager for selected project'],
      ['(in NuGet) type',     'Search packages'],
      ['(in NuGet) Enter',    'Select & pick version'],
      ['(in NuGet) Enter on version', 'Install package'],
      ['(in NuGet) dd',       'Remove selected package'],
    ]},
    { title: '  References', items: [
      ['A', 'Add project reference'],
      ['D', 'Remove selected reference'],
    ]},
    { title: '  Config', items: [
      ['C',           'Toggle Debug / Release build config'],
      [':open <path>','Open a .sln file'],
      [':find',       'Find .sln in current directory'],
      [':cd <path>',  'Change working directory'],
      [':clear',      'Clear output panel'],
      ['?',           'Toggle this help'],
      ['q / Ctrl+Q',  'Quit'],
    ]},
  ];

  let row = y + 1;
  for (const sec of sections) {
    if (row >= y + h - 1) break;
    screen.push(
      ansi.moveTo(row, iX) +
      ansi.bg(T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]) +
      ansi.fg(T.fgAccent[0], T.fgAccent[1], T.fgAccent[2]) +
      ansi.bold() +
      sec.title +
      ansi.reset()
    );
    row++;
    for (const [key, desc] of sec.items) {
      if (row >= y + h - 1) break;
      const keyW   = 28;
      const keyStr = key.padEnd(keyW).slice(0, keyW);
      screen.push(
        ansi.moveTo(row, iX) +
        ansi.bg(T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]) +
        ansi.fg(T.fgYellow[0], T.fgYellow[1], T.fgYellow[2]) +
        keyStr +
        ansi.fg(T.fg[0], T.fg[1], T.fg[2]) +
        desc +
        ansi.reset()
      );
      row++;
    }
    if (row < y + h - 1) row++; // blank line between sections
  }
}

module.exports = { renderHeader, renderStatusBar, renderCommandLine, renderHelp };
