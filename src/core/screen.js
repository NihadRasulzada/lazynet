'use strict';

const ansi = require('./ansi');

// ─── Theme ───────────────────────────────────────────────────────────────────
const T = {
  // Base
  bg:          [18, 18, 24],
  bgPanel:     [24, 24, 32],
  bgSelected:  [40, 60, 100],
  bgFocused:   [30, 40, 70],
  bgHeader:    [28, 28, 40],
  bgStatus:    [20, 20, 30],
  bgPopup:     [30, 32, 48],
  bgInput:     [36, 38, 56],

  // Foreground
  fg:          [200, 200, 210],
  fgDim:       [120, 120, 140],
  fgSelected:  [255, 255, 255],
  fgHeader:    [160, 180, 255],
  fgBorder:    [60, 70, 110],
  fgAccent:    [100, 180, 255],
  fgGreen:     [100, 220, 140],
  fgYellow:    [255, 210, 80],
  fgRed:       [255, 100, 100],
  fgOrange:    [255, 160, 60],
  fgCyan:      [80, 220, 220],
  fgMagenta:   [200, 130, 255],
  fgGray:      [90, 95, 115],

  // Mode colors
  modeNormal:  [100, 180, 255],
  modeInsert:  [100, 220, 140],
  modeNuget:   [200, 130, 255],
  modeTest:    [255, 210, 80],
  modeCommand: [255, 160, 60],
};

// ─── Screen ──────────────────────────────────────────────────────────────────
class Screen {
  constructor() {
    this.cols = process.stdout.columns || 220;
    this.rows = process.stdout.rows || 50;
    this._buf = [];
    this._onResize = null;

    process.stdout.on('resize', () => {
      this.cols = process.stdout.columns;
      this.rows = process.stdout.rows;
      if (this._onResize) this._onResize(this.cols, this.rows);
    });
  }

  init() {
    ansi.write(ansi.altOn());
    ansi.write(ansi.hide());
    ansi.write(ansi.mouseOn());
    ansi.write(ansi.clear());
  }

  destroy() {
    ansi.write(ansi.mouseOff());
    ansi.write(ansi.show());
    ansi.write(ansi.altOff());
  }

  // Buffer a write
  push(str) { this._buf.push(str); }

  // Flush buffer
  flush() {
    if (this._buf.length) {
      ansi.write(this._buf.join(''));
      this._buf = [];
    }
  }

  // Draw a filled rectangle
  fillRect(x, y, w, h, bgR, bgG, bgB, char = ' ') {
    const row = ansi.bg(bgR, bgG, bgB) + char.repeat(w) + ansi.reset();
    for (let r = 0; r < h; r++) {
      this.push(ansi.moveTo(y + r, x) + row);
    }
  }

  // Draw a box with border
  drawBox(x, y, w, h, opts = {}) {
    const {
      bgR = T.bgPanel[0], bgG = T.bgPanel[1], bgB = T.bgPanel[2],
      bR  = T.fgBorder[0], bG = T.fgBorder[1], bB = T.fgBorder[2],
      title = '', focused = false,
      tR = T.fgHeader[0], tG = T.fgHeader[1], tB = T.fgHeader[2],
    } = opts;

    const borderColor = focused
      ? ansi.fg(T.fgAccent[0], T.fgAccent[1], T.fgAccent[2])
      : ansi.fg(bR, bG, bB);

    const bg = ansi.bg(bgR, bgG, bgB);
    const rst = ansi.reset();

    // Top border
    let topLine = '╭' + '─'.repeat(w - 2) + '╮';
    if (title) {
      const t = ` ${title} `;
      const tColored = ansi.fg(tR, tG, tB) + ansi.bold() + t + rst + borderColor + bg;
      const pad = '─'.repeat(Math.max(0, Math.floor((w - 2 - ansi.strip(t).length) / 2)));
      const padR = '─'.repeat(Math.max(0, w - 2 - pad.length * 2 - ansi.strip(t).length));
      topLine = '╭' + pad + tColored + pad + padR + '╮';
    }
    this.push(ansi.moveTo(y, x) + bg + borderColor + topLine + rst);

    // Side borders + fill
    const innerFill = bg + ansi.fg(bgR+10,bgG+10,bgB+10) + ' '.repeat(w - 2) + rst;
    for (let r = 1; r < h - 1; r++) {
      this.push(ansi.moveTo(y + r, x) + bg + borderColor + '│' + innerFill + bg + borderColor + '│' + rst);
    }

    // Bottom border
    this.push(ansi.moveTo(y + h - 1, x) + bg + borderColor + '╰' + '─'.repeat(w - 2) + '╯' + rst);
  }

  // Write text at position with colors
  text(x, y, str, fgR, fgG, fgB, bgR, bgG, bgB, width = 0) {
    const bg = bgR !== undefined ? ansi.bg(bgR, bgG, bgB) : '';
    const fg = fgR !== undefined ? ansi.fg(fgR, fgG, fgB) : '';
    let out = str;
    if (width > 0) {
      const vis = ansi.strip(str).length;
      if (vis > width) {
        // Truncate
        out = str.slice(0, width - 1) + '…';
      } else {
        out = str + ' '.repeat(width - vis);
      }
    }
    this.push(ansi.moveTo(y, x) + bg + fg + out + ansi.reset());
  }

  // Horizontal line
  hline(x, y, w, char = '─', fgR, fgG, fgB, bgR, bgG, bgB) {
    const bg = bgR !== undefined ? ansi.bg(bgR, bgG, bgB) : '';
    const fg = fgR !== undefined ? ansi.fg(fgR, fgG, fgB) : '';
    this.push(ansi.moveTo(y, x) + bg + fg + char.repeat(w) + ansi.reset());
  }

  onResize(fn) { this._onResize = fn; }
}

module.exports = { Screen, T, ansi };
