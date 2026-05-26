'use strict';

const { T, ansi } = require('../core/screen');

function renderNuget(screen, state, scrW, scrH) {
  if (state.mode !== 'NUGET') return;

  const popW = Math.min(90, scrW - 4);
  const popH = Math.min(32, scrH - 4);
  const popX = Math.floor((scrW - popW) / 2);
  const popY = Math.floor((scrH - popH) / 2);

  // Shadow
  screen.fillRect(popX + 2, popY + 1, popW, popH, 10, 10, 15, ' ');

  // Main popup box
  screen.drawBox(popX, popY, popW, popH, {
    title:   '  NuGet Package Manager ',
    focused: true,
    bgR: T.bgPopup[0], bgG: T.bgPopup[1], bgB: T.bgPopup[2],
    tR: T.fgMagenta[0], tG: T.fgMagenta[1], tB: T.fgMagenta[2],
  });

  const iX = popX + 2;
  const iW = popW - 4;

  // Target project line
  const projName = state.nugetTargetProj ? state.nugetTargetProj.name : '(select project first)';
  screen.text(iX, popY + 1,
    `Project: ${projName}`,
    T.fgGray[0], T.fgGray[1], T.fgGray[2],
    T.bgPopup[0], T.bgPopup[1], T.bgPopup[2], iW);

  // Search input box
  screen.drawBox(iX - 1, popY + 2, iW + 2, 3, {
    bgR: T.bgInput[0], bgG: T.bgInput[1], bgB: T.bgInput[2],
    bR: T.fgAccent[0], bG: T.fgAccent[1], bB: T.fgAccent[2],
  });

  const searchPrompt = '🔍 ';
  const searchDisplay = (state.nugetQuery || '') + (state.nugetStep === 'search' ? '█' : '');
  screen.text(iX + 1, popY + 3, searchPrompt + searchDisplay,
    T.fgSelected[0], T.fgSelected[1], T.fgSelected[2],
    T.bgInput[0], T.bgInput[1], T.bgInput[2], iW);

  // Divider
  screen.hline(iX, popY + 5, iW, '─', T.fgBorder[0], T.fgBorder[1], T.fgBorder[2],
    T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]);

  const listY     = popY + 6;
  const listH     = popH - 10;
  const isVersionStep = state.nugetStep === 'versions';

  if (state.nugetLoading) {
    screen.text(iX, listY, '  Loading…',
      T.fgCyan[0], T.fgCyan[1], T.fgCyan[2],
      T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]);
    return;
  }

  if (state.nugetError) {
    screen.text(iX, listY, `  ✘ ${state.nugetError}`,
      T.fgRed[0], T.fgRed[1], T.fgRed[2],
      T.bgPopup[0], T.bgPopup[1], T.bgPopup[2], iW);
    return;
  }

  if (!isVersionStep) {
    // Package list
    const pkgs = state.nugetResults;
    if (pkgs.length === 0 && state.nugetQuery) {
      screen.text(iX, listY, '  No packages found',
        T.fgGray[0], T.fgGray[1], T.fgGray[2],
        T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]);
    }

    for (let i = 0; i < Math.min(listH, pkgs.length); i++) {
      const pkg = pkgs[i];
      const isCur = i === state.nugetIdx;
      const bgR = isCur ? T.bgSelected[0] : T.bgPopup[0];
      const bgG = isCur ? T.bgSelected[1] : T.bgPopup[1];
      const bgB = isCur ? T.bgSelected[2] : T.bgPopup[2];

      const dl = pkg.downloads >= 1000000
        ? `${(pkg.downloads / 1000000).toFixed(1)}M`
        : pkg.downloads >= 1000
        ? `${(pkg.downloads / 1000).toFixed(0)}K`
        : String(pkg.downloads);

      const verified = pkg.verified ? '✔ ' : '';
      const nameCol  = `${verified}${pkg.id}`;
      const verCol   = pkg.version;
      const dlCol    = dl;

      const nameW = Math.floor(iW * 0.52);
      const verW  = Math.floor(iW * 0.22);
      const dlW   = iW - nameW - verW - 3;

      const nameTrunc = nameCol.length > nameW ? nameCol.slice(0, nameW - 1) + '…' : nameCol.padEnd(nameW);
      const verTrunc  = verCol.padEnd(verW).slice(0, verW);
      const dlTrunc   = dlCol.padEnd(dlW).slice(0, dlW);

      const line = ` ${nameTrunc} ${verTrunc} ${dlTrunc}`;
      const fR = isCur ? 255 : (pkg.verified ? T.fgGreen[0] : T.fg[0]);
      const fG = isCur ? 255 : (pkg.verified ? T.fgGreen[1] : T.fg[1]);
      const fB = isCur ? 255 : (pkg.verified ? T.fgGreen[2] : T.fg[2]);

      screen.text(iX, listY + i, line, fR, fG, fB, bgR, bgG, bgB, iW);
    }

    // Column headers
    screen.text(iX, listY - 1,
      ` ${'Package'.padEnd(Math.floor(iW*0.52))} ${'Latest'.padEnd(Math.floor(iW*0.22))} Downloads`,
      T.fgGray[0], T.fgGray[1], T.fgGray[2],
      T.bgPopup[0], T.bgPopup[1], T.bgPopup[2], iW);

  } else {
    // Version picker
    const pkg = state.nugetResults[state.nugetIdx];
    if (pkg) {
      screen.text(iX, listY - 1,
        ` Versions for: ${pkg.id}`,
        T.fgMagenta[0], T.fgMagenta[1], T.fgMagenta[2],
        T.bgPopup[0], T.bgPopup[1], T.bgPopup[2], iW);
    }

    const versions = state.nugetVersions;
    for (let i = 0; i < Math.min(listH, versions.length); i++) {
      const isCur = i === state.nugetVersionIdx;
      const bgR = isCur ? T.bgSelected[0] : T.bgPopup[0];
      const bgG = isCur ? T.bgSelected[1] : T.bgPopup[1];
      const bgB = isCur ? T.bgSelected[2] : T.bgPopup[2];
      const fR  = isCur ? 255 : T.fg[0];
      const fG  = isCur ? 255 : T.fg[1];
      const fB  = isCur ? 255 : T.fg[2];
      screen.text(iX, listY + i,
        `  ${versions[i]}`, fR, fG, fB, bgR, bgG, bgB, iW);
    }
  }

  // Footer
  const footerY = popY + popH - 2;
  screen.hline(iX, footerY, iW, '─', T.fgBorder[0], T.fgBorder[1], T.fgBorder[2],
    T.bgPopup[0], T.bgPopup[1], T.bgPopup[2]);

  const hint = isVersionStep
    ? '  ↑↓ select version   Enter install   Backspace back   Esc close'
    : '  ↑↓ select   Enter pick version   dd remove   Esc close';
  screen.text(iX, footerY + 1, hint,
    T.fgGray[0], T.fgGray[1], T.fgGray[2],
    T.bgPopup[0], T.bgPopup[1], T.bgPopup[2], iW);
}

module.exports = { renderNuget };
