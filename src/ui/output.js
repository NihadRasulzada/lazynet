'use strict';

const { T, ansi } = require('../core/screen');

// Color per output type
const TYPE_COLOR = {
  normal:  null,
  info:    [T.fgCyan[0],    T.fgCyan[1],    T.fgCyan[2]],
  success: [T.fgGreen[0],   T.fgGreen[1],   T.fgGreen[2]],
  error:   [T.fgRed[0],     T.fgRed[1],     T.fgRed[2]],
  warn:    [T.fgYellow[0],  T.fgYellow[1],  T.fgYellow[2]],
  test_ok: [T.fgGreen[0],   T.fgGreen[1],   T.fgGreen[2]],
  test_fail:[T.fgRed[0],    T.fgRed[1],     T.fgRed[2]],
};

function renderOutput(screen, state, x, y, w, h) {
  const focused = state.activePanel === 'OUTPUT';

  screen.drawBox(x, y, w, h, {
    title:   '  Output ',
    focused,
    bgR: T.bgPanel[0], bgG: T.bgPanel[1], bgB: T.bgPanel[2],
  });

  const innerX = x + 1;
  const innerW = w - 2;
  const innerH = h - 2;

  // Expand lines (handle \n in text)
  const allLines = [];
  for (const entry of state.outputLines) {
    const raw = entry.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = raw.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i === 0 && allLines.length > 0 && !allLines[allLines.length - 1]._newline) {
        // Continuation
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
    if (lineIdx >= allLines.length) {
      screen.text(innerX, y + 1 + i, ' '.repeat(innerW),
        T.fg[0], T.fg[1], T.fg[2], T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]);
      continue;
    }

    const line  = allLines[lineIdx];
    const color = TYPE_COLOR[line.type] || [T.fg[0], T.fg[1], T.fg[2]];
    let text = line.text;

    // Truncate
    if (text.length > innerW) text = text.slice(0, innerW - 1) + '…';
    const padded = text + ' '.repeat(Math.max(0, innerW - text.length));

    screen.text(innerX, y + 1 + i, padded,
      color[0], color[1], color[2],
      T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]);
  }

  // Scrollbar
  if (allLines.length > innerH) {
    const barH = Math.max(1, Math.floor(innerH * innerH / allLines.length));
    const barY = Math.floor(scroll * (innerH - barH) / Math.max(1, allLines.length - innerH));
    for (let i = 0; i < innerH; i++) {
      const inBar = i >= barY && i < barY + barH;
      const ch  = inBar ? '█' : '░';
      const fR  = inBar ? T.fgAccent[0] : T.fgGray[0];
      const fG  = inBar ? T.fgAccent[1] : T.fgGray[1];
      const fB  = inBar ? T.fgAccent[2] : T.fgGray[2];
      screen.text(x + w - 1, y + 1 + i, ch, fR, fG, fB, T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]);
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
