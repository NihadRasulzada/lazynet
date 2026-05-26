'use strict';

const { T, ansi } = require('../core/screen');

// Color + icon per output type
const TYPE_STYLE = {
  normal:    { color: null,                     icon: '  ' },
  info:      { color: [T.fgCyan[0],    T.fgCyan[1],    T.fgCyan[2]],    icon: '  ' },
  success:   { color: [T.fgGreen[0],   T.fgGreen[1],   T.fgGreen[2]],   icon: '  ' },
  error:     { color: [T.fgRed[0],     T.fgRed[1],     T.fgRed[2]],     icon: '  ' },
  warn:      { color: [T.fgYellow[0],  T.fgYellow[1],  T.fgYellow[2]],  icon: '  ' },
  test_ok:   { color: [T.fgGreen[0],   T.fgGreen[1],   T.fgGreen[2]],   icon: '  ' },
  test_fail: { color: [T.fgRed[0],     T.fgRed[1],     T.fgRed[2]],     icon: '  ' },
};

function renderOutput(screen, state, x, y, w, h) {
  const focused = state.activePanel === 'OUTPUT';

  screen.drawBox(x, y, w, h, {
    title:   ' Output ',
    focused,
    bgR: T.bgPanel[0], bgG: T.bgPanel[1], bgB: T.bgPanel[2],
  });

  // Inner area: 1-char left pad, 1-char right pad, 1-char scrollbar, 1-char border
  const innerX = x + 2;
  const innerW = w - 4;   // border(1) + pad(1) + content + pad(1) + border(1)
  const innerH = h - 2;

  // Expand lines (handle \n in text)
  const allLines = [];
  for (const entry of state.outputLines) {
    const raw   = entry.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = raw.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i === 0 && allLines.length > 0 && !allLines[allLines.length - 1]._newline) {
        allLines[allLines.length - 1].text += parts[i];
        allLines[allLines.length - 1]._newline = false;
      } else {
        allLines.push({ type: entry.type, text: parts[i], _newline: i < parts.length - 1 });
      }
    }
  }

  // Auto-scroll to bottom unless user scrolled up
  const maxScroll = Math.max(0, allLines.length - innerH);
  let scroll = state.outputScroll;
  if (scroll < 0 || state._outputAutoScroll !== false) {
    scroll = maxScroll;
    state.outputScroll = scroll;
  }
  scroll = Math.min(scroll, maxScroll);

  for (let i = 0; i < innerH; i++) {
    const lineIdx = i + scroll;
    const row     = y + 1 + i;

    if (lineIdx >= allLines.length) {
      screen.push(
        ansi.moveTo(row, innerX) +
        ansi.bg(T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]) +
        ' '.repeat(innerW) +
        ansi.reset()
      );
      continue;
    }

    const line   = allLines[lineIdx];
    const style  = TYPE_STYLE[line.type] || TYPE_STYLE.normal;
    const color  = style.color || [T.fg[0], T.fg[1], T.fg[2]];

    let text = line.text;
    const maxText = innerW - 1;  // leave 1 char gap before scrollbar
    if (text.length > maxText) text = text.slice(0, maxText - 1) + '…';
    const padded = text + ' '.repeat(Math.max(0, innerW - text.length));

    screen.push(
      ansi.moveTo(row, innerX) +
      ansi.bg(T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]) +
      ansi.fg(color[0], color[1], color[2]) +
      padded +
      ansi.reset()
    );
  }

  // Scrollbar — correctly inside the border at x+w-2
  if (allLines.length > innerH) {
    const barH = Math.max(1, Math.floor(innerH * innerH / allLines.length));
    const barY = Math.floor(scroll * (innerH - barH) / Math.max(1, allLines.length - innerH));
    for (let i = 0; i < innerH; i++) {
      const inBar = i >= barY && i < barY + barH;
      const ch    = inBar ? '█' : '▒';
      const fR    = inBar ? T.fgAccent[0] : T.fgBorder[0];
      const fG    = inBar ? T.fgAccent[1] : T.fgBorder[1];
      const fB    = inBar ? T.fgAccent[2] : T.fgBorder[2];
      screen.push(
        ansi.moveTo(y + 1 + i, x + w - 2) +
        ansi.bg(T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]) +
        ansi.fg(fR, fG, fB) +
        ch +
        ansi.reset()
      );
    }
  }
}

function addOutputLine(state, type, text) {
  state.outputLines.push({ type, text });
  const max = (state.cfg && state.cfg.outputLines) || 2000;
  if (state.outputLines.length > max) {
    state.outputLines = state.outputLines.slice(-max);
  }
  state._outputAutoScroll = true;
}

module.exports = { renderOutput, addOutputLine };
