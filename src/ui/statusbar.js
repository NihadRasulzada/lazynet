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

function renderStatusBar(screen, state, y, w) {
  const bgR = T.bgStatus[0], bgG = T.bgStatus[1], bgB = T.bgStatus[2];

  // Left: mode pill
  const modeColor = MODE_COLOR[state.mode] || T.modeNormal;
  const modeLabel = MODE_LABEL[state.mode] || ' NORMAL ';

  // Build config
  const cfg = ` ${state.buildConfig} `;

  // Runner status
  const busy = state.runnerBusy
    ? ansi.fg(T.fgYellow[0], T.fgYellow[1], T.fgYellow[2]) + ' ⟳ running… '
    : '';

  // Solution name
  const slnName = state.solution
    ? ` ${state.solution.slnPath.split('/').pop()} `
    : ' No solution ';

  // Right: help hint
  const hint = ' ? help  :cmd  n NuGet  Tab panel ';

  // Status message
  const msg = state.statusMsg || '';

  // Draw background
  screen.fillRect(1, y, w, 1, bgR, bgG, bgB);

  let col = 1;

  // Mode pill (colored bg)
  screen.push(
    ansi.moveTo(y, col) +
    ansi.bg(modeColor[0], modeColor[1], modeColor[2]) +
    ansi.fg(10, 10, 20) +
    ansi.bold() +
    modeLabel +
    ansi.reset()
  );
  col += modeLabel.length;

  // Build config
  screen.push(
    ansi.moveTo(y, col) +
    ansi.bg(bgR, bgG, bgB) +
    ansi.fg(T.fgGray[0], T.fgGray[1], T.fgGray[2]) +
    ' │' + cfg + '│ ' +
    ansi.reset()
  );
  col += 3 + cfg.length + 2;

  // Solution name
  screen.push(
    ansi.moveTo(y, col) +
    ansi.bg(bgR, bgG, bgB) +
    ansi.fg(T.fgAccent[0], T.fgAccent[1], T.fgAccent[2]) +
    slnName +
    ansi.reset()
  );
  col += slnName.length;

  // Runner busy
  if (state.runnerBusy) {
    screen.push(
      ansi.moveTo(y, col) +
      ansi.bg(bgR, bgG, bgB) +
      ansi.fg(T.fgYellow[0], T.fgYellow[1], T.fgYellow[2]) +
      '⟳ running…  ' +
      ansi.reset()
    );
    col += 13;
  }

  // Status message (middle)
  const statusColor = state.statusMsg && state.statusMsg.startsWith('✘')
    ? T.fgRed
    : state.statusMsg && state.statusMsg.startsWith('✔')
    ? T.fgGreen
    : T.fg;
  const statusX = Math.max(col + 2, Math.floor(w / 2) - Math.floor(msg.length / 2));
  screen.push(
    ansi.moveTo(y, statusX) +
    ansi.bg(bgR, bgG, bgB) +
    ansi.fg(statusColor[0], statusColor[1], statusColor[2]) +
    msg +
    ansi.reset()
  );

  // Right: hint
  const hintX = w - hint.length;
  if (hintX > col) {
    screen.push(
      ansi.moveTo(y, hintX) +
      ansi.bg(bgR, bgG, bgB) +
      ansi.fg(T.fgGray[0], T.fgGray[1], T.fgGray[2]) +
      hint +
      ansi.reset()
    );
  }
}

// Command input line (at bottom)
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

// Help overlay
function renderHelp(screen, state, scrW, scrH) {
  if (!state._showHelp) return;

  const w = Math.min(70, scrW - 4);
  const h = 36;
  const x = Math.floor((scrW - w) / 2);
  const y = Math.floor((scrH - h) / 2);

  screen.fillRect(x + 2, y + 1, w, h, 10, 10, 15, ' ');
  screen.drawBox(x, y, w, h, {
    title: '  Keyboard Shortcuts ',
    focused: true,
    bgR: T.bgPopup[0], bgG: T.bgPopup[1], bgB: T.bgPopup[2],
    tR: T.fgAccent[0], tG: T.fgAccent[1], tB: T.fgAccent[2],
  });

  const iX = x + 3;
  const iW = w - 6;

  const sections = [
    { title: '── Navigation', items: [
      ['hjkl / ↑↓←→', 'Move cursor'],
      ['Tab / Shift+Tab', 'Switch panel (Tree ↔ Output)'],
      ['Enter', 'Expand/collapse tree node'],
      ['g / G', 'Go to top / bottom'],
      ['Ctrl+U / Ctrl+D', 'Page up / down'],
    ]},
    { title: '── Build & Run', items: [
      ['b', 'Build selected project'],
      ['B', 'Build solution'],
      ['R', 'Rebuild (no-incremental)'],
      ['c', 'Clean'],
      ['r', 'Run project'],
      ['t', 'Run tests'],
      ['p', 'Publish (Release)'],
      ['e', 'Restore packages'],
      ['Ctrl+K', 'Kill running process'],
    ]},
    { title: '── NuGet', items: [
      ['n', 'Open NuGet manager for selected project'],
      ['(in NuGet) type', 'Search packages'],
      ['(in NuGet) Enter', 'Select & pick version'],
      ['(in NuGet) Enter on version', 'Install package'],
      ['(in NuGet) dd', 'Remove selected package'],
    ]},
    { title: '── References', items: [
      ['A', 'Add project reference'],
      ['D', 'Remove selected reference'],
    ]},
    { title: '── Config', items: [
      ['C', 'Toggle Debug/Release build config'],
      [':open <path>', 'Open a .sln file'],
      [':find', 'Find .sln in current directory'],
      [':cd <path>', 'Change working directory'],
      [':clear', 'Clear output panel'],
      ['?', 'Toggle this help'],
      ['q / Ctrl+Q', 'Quit'],
    ]},
  ];

  let row = y + 1;
  for (const sec of sections) {
    screen.text(iX, row, sec.title,
      T.fgAccent[0], T.fgAccent[1], T.fgAccent[2],
      T.bgPopup[0], T.bgPopup[1], T.bgPopup[2], iW);
    row++;
    for (const [key, desc] of sec.items) {
      const keyW = 26;
      const keyStr = key.padEnd(keyW).slice(0, keyW);
      screen.text(iX, row, keyStr,
        T.fgYellow[0], T.fgYellow[1], T.fgYellow[2],
        T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]);
      screen.text(iX + keyW, row, desc,
        T.fg[0], T.fg[1], T.fg[2],
        T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]);
      row++;
      if (row >= y + h - 1) break;
    }
    if (row >= y + h - 1) break;
  }
}

module.exports = { renderStatusBar, renderCommandLine, renderHelp };
