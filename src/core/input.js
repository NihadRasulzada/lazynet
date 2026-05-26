'use strict';

const EventEmitter = require('events');

// ─── Key parser ──────────────────────────────────────────────────────────────
function parseKey(buf) {
  const str = buf.toString();

  // Special sequences
  const seqs = {
    '\x1b[A':       { name: 'up' },
    '\x1b[B':       { name: 'down' },
    '\x1b[C':       { name: 'right' },
    '\x1b[D':       { name: 'left' },
    '\x1b[H':       { name: 'home' },
    '\x1b[F':       { name: 'end' },
    '\x1b[5~':      { name: 'pageup' },
    '\x1b[6~':      { name: 'pagedown' },
    '\x1b[3~':      { name: 'delete' },
    '\x1b[2~':      { name: 'insert' },
    '\x1b\r':       { name: 'enter', meta: true },
    '\x1b\n':       { name: 'enter', meta: true },
    '\x1b[Z':       { name: 'tab', shift: true },
    '\r':           { name: 'enter' },
    '\n':           { name: 'enter' },
    '\t':           { name: 'tab' },
    '\x7f':         { name: 'backspace' },
    '\b':           { name: 'backspace' },
    '\x1b':         { name: 'escape' },
    '\x1b[1;2A':    { name: 'up',    shift: true },
    '\x1b[1;2B':    { name: 'down',  shift: true },
    '\x1b[1;2C':    { name: 'right', shift: true },
    '\x1b[1;2D':    { name: 'left',  shift: true },
    '\x1b[1;5A':    { name: 'up',    ctrl: true },
    '\x1b[1;5B':    { name: 'down',  ctrl: true },
    '\x1b[1;5C':    { name: 'right', ctrl: true },
    '\x1b[1;5D':    { name: 'left',  ctrl: true },
  };

  // F-keys
  for (let i = 1; i <= 12; i++) {
    const codes = [
      null,
      '\x1bOP', '\x1bOQ', '\x1bOR', '\x1bOS',
      '\x1b[15~', '\x1b[17~', '\x1b[18~', '\x1b[19~',
      '\x1b[20~', '\x1b[21~', '\x1b[23~', '\x1b[24~',
    ];
    if (codes[i] && str === codes[i]) return { name: `f${i}` };
  }

  if (seqs[str]) return seqs[str];

  // Ctrl+letter
  if (str.length === 1) {
    const code = str.charCodeAt(0);
    if (code >= 1 && code <= 26) {
      const letter = String.fromCharCode(code + 96);
      return { name: letter, ctrl: true, char: str };
    }
    return { name: str, char: str };
  }

  // Meta+letter (ESC + char)
  if (str.length === 2 && str[0] === '\x1b') {
    return { name: str[1], meta: true, char: str[1] };
  }

  return { name: str, char: str };
}

// ─── Mouse parser ─────────────────────────────────────────────────────────────
function parseMouse(str) {
  // SGR format: ESC[<Pb;Px;PyM or m
  const sgr = str.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
  if (sgr) {
    const btn = parseInt(sgr[1]);
    const col = parseInt(sgr[2]);
    const row = parseInt(sgr[3]);
    const release = sgr[4] === 'm';
    return {
      button: btn & 3,
      shift: !!(btn & 4),
      meta:  !!(btn & 8),
      ctrl:  !!(btn & 16),
      scroll: btn >= 64 ? (btn === 65 ? -1 : 1) : 0,
      col, row, release,
    };
  }
  return null;
}

// ─── Input class ─────────────────────────────────────────────────────────────
class Input extends EventEmitter {
  constructor() {
    super();
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._running = true;

    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('binary');

    stdin.on('data', (data) => {
      const str = data.toString('binary')
        .split('').map(c => String.fromCharCode(c.charCodeAt(0))).join('');

      // Ctrl+C / Ctrl+Q → quit
      if (str === '\x03' || str === '\x11') {
        this.emit('quit');
        return;
      }

      // Mouse?
      const mouse = parseMouse(str);
      if (mouse) {
        this.emit('mouse', mouse);
        return;
      }

      // Key
      const key = parseKey(Buffer.from(str, 'binary'));
      this.emit('key', key);
    });
  }

  stop() {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    this._running = false;
  }
}

module.exports = { Input };
