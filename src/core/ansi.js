'use strict';

// ANSI escape engine — replaces blessed with zero dependencies
const ESC = '\x1b';
const CSI = `${ESC}[`;

const ansi = {
  // Cursor
  moveTo:      (row, col) => `${CSI}${row};${col}H`,
  hide:        () => `${CSI}?25l`,
  show:        () => `${CSI}?25h`,
  save:        () => `${ESC}7`,
  restore:     () => `${ESC}8`,

  // Screen
  clear:       () => `${CSI}2J${CSI}H`,
  clearLine:   () => `${CSI}2K`,
  clearToEnd:  () => `${CSI}0K`,

  // Alternate screen buffer
  altOn:       () => `${CSI}?1049h`,
  altOff:      () => `${CSI}?1049l`,

  // Mouse
  mouseOn:     () => `${CSI}?1000h${CSI}?1002h${CSI}?1006h`,
  mouseOff:    () => `${CSI}?1000l${CSI}?1002l${CSI}?1006l`,

  // SGR attributes
  reset:       () => `${CSI}0m`,
  bold:        () => `${CSI}1m`,
  dim:         () => `${CSI}2m`,
  italic:      () => `${CSI}3m`,
  underline:   () => `${CSI}4m`,
  reverse:     () => `${CSI}7m`,
  strike:      () => `${CSI}9m`,

  // 256-color fg/bg
  fg256: (n)   => `${CSI}38;5;${n}m`,
  bg256: (n)   => `${CSI}48;5;${n}m`,

  // True-color fg/bg
  fg: (r,g,b) => `${CSI}38;2;${r};${g};${b}m`,
  bg: (r,g,b) => `${CSI}48;2;${r};${g};${b}m`,

  // Scrolling region
  scrollRegion: (top, bot) => `${CSI}${top};${bot}r`,
  scrollUp:     (n=1)      => `${CSI}${n}S`,
  scrollDown:   (n=1)      => `${CSI}${n}T`,

  // Compose: write styled text then reset
  styled: (text, ...codes) => codes.join('') + text + `${CSI}0m`,

  // Strip ANSI codes from a string (for length calculations)
  strip: (str) => str.replace(/\x1b\[[0-9;]*[mGKHJlh]/g, '')
                     .replace(/\x1b[78]/g, ''),

  // Pad/truncate to visual width
  pad: (str, width, fill = ' ') => {
    const vis = ansi.strip(str).length;
    if (vis >= width) {
      // truncate raw visible chars
      let cut = 0, count = 0;
      for (const ch of str) {
        if (ch === '\x1b') { cut++; while (str[cut] !== 'm' && cut < str.length) cut++; cut++; continue; }
        count++;
        cut++;
        if (count >= width - 1) break;
      }
      return str.slice(0, cut) + ansi.reset() + fill;
    }
    return str + fill.repeat(width - vis);
  },

  // Write directly to stdout
  write: (str) => process.stdout.write(str),

  // Compose full styled cell: bg + fg + text + reset
  cell: (text, fgR, fgG, fgB, bgR, bgG, bgB) =>
    ansi.bg(bgR,bgG,bgB) + ansi.fg(fgR,fgG,fgB) + text + ansi.reset(),
};

module.exports = ansi;
