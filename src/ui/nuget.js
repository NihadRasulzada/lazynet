'use strict';

const { T, ansi } = require('../core/screen');

function renderNuget(screen, state, scrW, scrH) {
  if (state.mode !== 'NUGET') return;

  const popW = Math.min(92, scrW - 4);
  const popH = Math.min(34, scrH - 4);
  const popX = Math.floor((scrW - popW) / 2);
  const popY = Math.floor((scrH - popH) / 2);

  // Shadow
  screen.fillRect(popX + 2, popY + 1, popW, popH,
    T.bg[0] - 5, T.bg[1] - 5, T.bg[2], ' ');

  // Main popup box
  screen.drawBox(popX, popY, popW, popH, {
    title:   ' NuGet Package Manager ',
    focused: true,
    bgR: T.bgPopup[0], bgG: T.bgPopup[1], bgB: T.bgPopup[2],
    tR: T.fgMagenta[0], tG: T.fgMagenta[1], tB: T.fgMagenta[2],
  });

  const iX = popX + 2;
  const iW = popW - 4;

  // Target project line
  const projName = state.nugetTargetProj
    ? state.nugetTargetProj.name
    : '(select project first)';
  screen.push(
    ansi.moveTo(popY + 1, iX) +
    ansi.bg(T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]) +
    ansi.fg(T.fgDim[0], T.fgDim[1], T.fgDim[2]) +
    `⬡  ${projName}` +
    ansi.reset()
  );

  // Search input box
  screen.drawBox(iX - 1, popY + 2, iW + 2, 3, {
    bgR: T.bgInput[0], bgG: T.bgInput[1], bgB: T.bgInput[2],
    bR: T.fgAccent[0], bG: T.fgAccent[1], bB: T.fgAccent[2],
  });

  const searchDisplay = (state.nugetQuery || '') + (state.nugetStep === 'search' ? '█' : '');
  screen.push(
    ansi.moveTo(popY + 3, iX + 1) +
    ansi.bg(T.bgInput[0], T.bgInput[1], T.bgInput[2]) +
    ansi.fg(T.fgDim[0], T.fgDim[1], T.fgDim[2]) +
    '🔍  ' +
    ansi.fg(T.fgSelected[0], T.fgSelected[1], T.fgSelected[2]) +
    searchDisplay +
    ansi.reset()
  );

  // Divider
  screen.hline(iX, popY + 5, iW, '─',
    T.fgBorder[0], T.fgBorder[1], T.fgBorder[2],
    T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]);

  const listY          = popY + 7;  // +1 for column headers
  const listH          = popH - 11;
  const isVersionStep  = state.nugetStep === 'versions';

  if (state.nugetLoading) {
    screen.push(
      ansi.moveTo(listY, iX) +
      ansi.bg(T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]) +
      ansi.fg(T.fgCyan[0], T.fgCyan[1], T.fgCyan[2]) +
      '  ⟳  Searching…' +
      ansi.reset()
    );
    return;
  }

  if (state.nugetError) {
    screen.push(
      ansi.moveTo(listY, iX) +
      ansi.bg(T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]) +
      ansi.fg(T.fgRed[0], T.fgRed[1], T.fgRed[2]) +
      `  ✘  ${state.nugetError}` +
      ansi.reset()
    );
    return;
  }

  if (!isVersionStep) {
    // Column headers
    const nameW = Math.floor(iW * 0.52);
    const verW  = Math.floor(iW * 0.22);
    const dlW   = iW - nameW - verW - 3;

    screen.push(
      ansi.moveTo(listY - 1, iX) +
      ansi.bg(T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]) +
      ansi.fg(T.fgGray[0], T.fgGray[1], T.fgGray[2]) +
      ` ${'Package'.padEnd(nameW)} ${'Latest'.padEnd(verW)} ${'↓ Downloads'.padEnd(dlW)}` +
      ansi.reset()
    );

    const pkgs = state.nugetResults;
    if (pkgs.length === 0 && state.nugetQuery) {
      screen.push(
        ansi.moveTo(listY, iX) +
        ansi.bg(T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]) +
        ansi.fg(T.fgGray[0], T.fgGray[1], T.fgGray[2]) +
        '  No packages found' +
        ansi.reset()
      );
    }

    for (let i = 0; i < Math.min(listH, pkgs.length); i++) {
      const pkg   = pkgs[i];
      const isCur = i === state.nugetIdx;
      const bgR   = isCur ? T.bgSelected[0] : T.bgPopup[0];
      const bgG   = isCur ? T.bgSelected[1] : T.bgPopup[1];
      const bgB   = isCur ? T.bgSelected[2] : T.bgPopup[2];

      const dl = pkg.downloads >= 1_000_000
        ? `${(pkg.downloads / 1_000_000).toFixed(1)}M`
        : pkg.downloads >= 1_000
        ? `${(pkg.downloads / 1_000).toFixed(0)}K`
        : String(pkg.downloads);

      const verified = pkg.verified ? '✔ ' : '  ';
      const nameCol  = `${verified}${pkg.id}`;
      const nameTrunc = nameCol.length > nameW ? nameCol.slice(0, nameW - 1) + '…' : nameCol.padEnd(nameW);
      const verTrunc  = pkg.version.padEnd(verW).slice(0, verW);
      const dlTrunc   = dl.padEnd(dlW).slice(0, dlW);

      const line = ` ${nameTrunc} ${verTrunc} ${dlTrunc}`;
      const fR   = isCur ? T.fgSelected[0] : (pkg.verified ? T.fgGreen[0] : T.fg[0]);
      const fG   = isCur ? T.fgSelected[1] : (pkg.verified ? T.fgGreen[1] : T.fg[1]);
      const fB   = isCur ? T.fgSelected[2] : (pkg.verified ? T.fgGreen[2] : T.fg[2]);

      screen.push(
        ansi.moveTo(listY + i, iX) +
        ansi.bg(bgR, bgG, bgB) +
        ansi.fg(fR, fG, fB) +
        line.padEnd(iW).slice(0, iW) +
        ansi.reset()
      );
    }

  } else {
    // Version picker
    const pkg = state.nugetResults[state.nugetIdx];
    if (pkg) {
      screen.push(
        ansi.moveTo(listY - 1, iX) +
        ansi.bg(T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]) +
        ansi.fg(T.fgMagenta[0], T.fgMagenta[1], T.fgMagenta[2]) +
        `  ⬥  ${pkg.id}` +
        ansi.reset()
      );
    }

    const versions = state.nugetVersions;
    for (let i = 0; i < Math.min(listH, versions.length); i++) {
      const isCur = i === state.nugetVersionIdx;
      const bgR   = isCur ? T.bgSelected[0] : T.bgPopup[0];
      const bgG   = isCur ? T.bgSelected[1] : T.bgPopup[1];
      const bgB   = isCur ? T.bgSelected[2] : T.bgPopup[2];
      const fR    = isCur ? T.fgSelected[0] : T.fg[0];
      const fG    = isCur ? T.fgSelected[1] : T.fg[1];
      const fB    = isCur ? T.fgSelected[2] : T.fg[2];
      screen.push(
        ansi.moveTo(listY + i, iX) +
        ansi.bg(bgR, bgG, bgB) +
        ansi.fg(fR, fG, fB) +
        `  ${versions[i]}`.padEnd(iW).slice(0, iW) +
        ansi.reset()
      );
    }
  }

  // Footer
  const footerY = popY + popH - 2;
  screen.hline(iX, footerY, iW, '─',
    T.fgBorder[0], T.fgBorder[1], T.fgBorder[2],
    T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]);

  const hint = isVersionStep
    ? '  ↑↓ select version   Enter install   Backspace back   Esc close'
    : '  ↑↓ select   Enter pick version   dd remove   Esc close';
  screen.push(
    ansi.moveTo(footerY + 1, iX) +
    ansi.bg(T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]) +
    ansi.fg(T.fgGray[0], T.fgGray[1], T.fgGray[2]) +
    hint +
    ansi.reset()
  );
}

module.exports = { renderNuget };
