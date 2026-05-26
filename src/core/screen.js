'use strict';

const ansi = require('./ansi');

// ─── Theme (Tokyo Night) ──────────────────────────────────────────────────────
const T = {
  // Backgrounds
  bg:          [26, 27, 38],
  bgPanel:     [31, 32, 46],
  bgSelected:  [41, 54, 95],
  bgFocused:   [36, 40, 70],
  bgHeader:    [20, 21, 32],
  bgStatus:    [15, 15, 24],
  bgPopup:     [36, 37, 54],
  bgInput:     [43, 44, 63],

  // Foreground
  fg:          [192, 202, 245],
  fgDim:       [118, 122, 155],
  fgSelected:  [228, 232, 255],
  fgHeader:    [125, 207, 255],
  fgBorder:    [50, 55, 88],
  fgAccent:    [125, 207, 255],
  fgGreen:     [158, 206, 106],
  fgYellow:    [224, 175, 104],
  fgRed:       [247, 118, 142],
  fgOrange:    [255, 158, 100],
  fgCyan:      [125, 240, 230],
  fgMagenta:   [187, 154, 247],
  fgGray:      [86, 95, 137],

  // Mode colors
  modeNormal:  [125, 207, 255],
  modeInsert:  [158, 206, 106],
  modeNuget:   [187, 154, 247],
  modeTest:    [224, 175, 104],
  modeCommand: [255, 158, 100],
};

// ─── Screen ──────────────────────────────────────────────────────────────────
class Screen {
  constructor() {
    this.cols = process.stdout.columns || 220;
    this.rows = process.stdout.rows    || 50;
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

  push(str) { this._buf.push(str); }

  flush() {
    if (this._buf.length) {
      ansi.write(this._buf.join(''));
      this._buf = [];
    }
  }

  fillRect(x, y, w, h, bgR, bgG, bgB, char = ' ') {
    const row = ansi.bg(bgR, bgG, bgB) + char.repeat(w) + ansi.reset();
    for (let r = 0; r < h; r++) {
      this.push(ansi.moveTo(y + r, x) + row);
    }
  }

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

    const bg  = ansi.bg(bgR, bgG, bgB);
    const rst = ansi.reset();

    // Top border
    let topLine = '╭' + '─'.repeat(w - 2) + '╮';
    if (title) {
      const t = ` ${title} `;
      const tColored = ansi.fg(tR, tG, tB) + ansi.bold() + t + rst + borderColor + bg;
      const inner    = w - 2;
      const tLen     = ansi.strip(t).length;
      const pad      = '─'.repeat(Math.max(0, Math.floor((inner - tLen) / 2)));
      const padR     = '─'.repeat(Math.max(0, inner - pad.length * 2 - tLen));
      topLine = '╭' + pad + tColored + pad + padR + '╮';
    }
    this.push(ansi.moveTo(y, x) + bg + borderColor + topLine + rst);

    // Side borders + fill
    const innerFill = bg + ' '.repeat(w - 2) + rst;
    for (let r = 1; r < h - 1; r++) {
      this.push(ansi.moveTo(y + r, x) + bg + borderColor + '│' + innerFill + bg + borderColor + '│' + rst);
    }

    // Bottom border
    this.push(ansi.moveTo(y + h - 1, x) + bg + borderColor + '╰' + '─'.repeat(w - 2) + '╯' + rst);
  }

  text(x, y, str, fgR, fgG, fgB, bgR, bgG, bgB, width = 0) {
    const bg  = bgR !== undefined ? ansi.bg(bgR, bgG, bgB) : '';
    const fg  = fgR !== undefined ? ansi.fg(fgR, fgG, fgB) : '';
    let out = str;
    if (width > 0) {
      const vis = ansi.strip(str).length;
      if (vis > width) {
        out = str.slice(0, width - 1) + '…';
      } else {
        out = str + ' '.repeat(width - vis);
      }
    }
    this.push(ansi.moveTo(y, x) + bg + fg + out + ansi.reset());
  }

  hline(x, y, w, char = '─', fgR, fgG, fgB, bgR, bgG, bgB) {
    const bg = bgR !== undefined ? ansi.bg(bgR, bgG, bgB) : '';
    const fg = fgR !== undefined ? ansi.fg(fgR, fgG, fgB) : '';
    this.push(ansi.moveTo(y, x) + bg + fg + char.repeat(w) + ansi.reset());
  }

  onResize(fn) { this._onResize = fn; }
}

module.exports = { Screen, T, ansi };
