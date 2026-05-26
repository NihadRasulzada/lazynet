'use strict';

const { T, ansi } = require('../core/screen');
const path = require('path');

// ─── Icons ────────────────────────────────────────────────────────────────────
const ICONS = {
  solution:   '◈',
  project:    '⬡',
  packages:   '⊞',
  package:    '⬥',
  refs:       '⊟',
  ref:        '⊸',
  folder:     '▸',
  folderOpen: '▾',
};

// ─── Build flat tree item list ────────────────────────────────────────────────
function buildTreeItems(solution, projects, expanded) {
  if (!solution) return [];
  const items = [];

  const slnName = path.basename(solution.slnPath);
  items.push({ type: 'solution', label: slnName, depth: 0, data: solution });

  for (const proj of projects) {
    const projKey = proj.fullPath;
    items.push({
      type:     'project',
      label:    proj.name,
      depth:    1,
      data:     proj,
      expanded: !!expanded[projKey],
      key:      projKey,
    });

    if (expanded[projKey] && proj.csproj) {
      // Target framework info
      items.push({
        type:  'info',
        label: `${proj.csproj.targetFw}  ${proj.csproj.outputType}`,
        depth: 2,
        data:  proj,
      });

      // Packages folder
      const pkgKey = projKey + ':packages';
      items.push({
        type:     'folder',
        label:    `Packages (${proj.csproj.packages.length})`,
        depth:    2,
        data:     proj,
        expanded: !!expanded[pkgKey],
        key:      pkgKey,
        parent:   projKey,
      });
      if (expanded[pkgKey]) {
        for (const pkg of proj.csproj.packages) {
          items.push({
            type:  'package',
            label: `${pkg.name}  ${pkg.version}`,
            depth: 3,
            data:  { proj, pkg },
          });
        }
      }

      // References folder
      const refKey = projKey + ':refs';
      items.push({
        type:     'folder',
        label:    `References (${proj.csproj.projRefs.length})`,
        depth:    2,
        data:     proj,
        expanded: !!expanded[refKey],
        key:      refKey,
        parent:   projKey,
      });
      if (expanded[refKey]) {
        for (const ref of proj.csproj.projRefs) {
          items.push({
            type:  'ref',
            label: path.basename(ref, '.csproj'),
            depth: 3,
            data:  { proj, ref },
          });
        }
      }
    }
  }

  return items;
}

// ─── Render tree ──────────────────────────────────────────────────────────────
function renderTree(screen, state, x, y, w, h) {
  const { treeItems, treeIdx, treeScroll, activePanel } = state;
  const focused = activePanel === 'TREE';

  screen.drawBox(x, y, w, h, {
    title:   ' Solution Explorer ',
    focused,
    bgR: T.bgPanel[0], bgG: T.bgPanel[1], bgB: T.bgPanel[2],
  });

  const innerX = x + 2;
  const innerW = w - 4;
  const innerH = h - 2;

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!state.solution) {
    const cx = innerX;
    const row = y + 2;
    screen.push(
      ansi.moveTo(row, cx) +
      ansi.bg(T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]) +
      ansi.fg(T.fgAccent[0], T.fgAccent[1], T.fgAccent[2]) +
      '◈  No solution loaded' +
      ansi.reset()
    );
    screen.push(
      ansi.moveTo(row + 2, cx) +
      ansi.bg(T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]) +
      ansi.fg(T.fgDim[0], T.fgDim[1], T.fgDim[2]) +
      ':open <path>  open .sln file' +
      ansi.reset()
    );
    screen.push(
      ansi.moveTo(row + 3, cx) +
      ansi.bg(T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]) +
      ansi.fg(T.fgDim[0], T.fgDim[1], T.fgDim[2]) +
      ':find         find in cwd' +
      ansi.reset()
    );
    return;
  }

  // Adjust scroll so cursor stays visible
  let scroll = treeScroll;
  if (treeIdx < scroll) scroll = treeIdx;
  if (treeIdx > scroll + innerH - 1) scroll = treeIdx - innerH + 1;

  for (let i = 0; i < innerH; i++) {
    const idx = i + scroll;
    const row = y + 1 + i;

    if (idx >= treeItems.length) {
      // Clear line
      screen.push(
        ansi.moveTo(row, innerX) +
        ansi.bg(T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]) +
        ' '.repeat(innerW) +
        ansi.reset()
      );
      continue;
    }

    const item     = treeItems[idx];
    const isCursor = idx === treeIdx && focused;

    const bgR = isCursor ? T.bgSelected[0] : T.bgPanel[0];
    const bgG = isCursor ? T.bgSelected[1] : T.bgPanel[1];
    const bgB = isCursor ? T.bgSelected[2] : T.bgPanel[2];

    // 1. Fill line background
    screen.push(
      ansi.moveTo(row, innerX) +
      ansi.bg(bgR, bgG, bgB) +
      ' '.repeat(innerW) +
      ansi.reset()
    );

    // 2. Indent guides — dim │ at each ancestor depth column
    //    Guide at column: innerX + d*2  for d in [1 .. item.depth-1]
    for (let d = 1; d < item.depth; d++) {
      screen.push(
        ansi.moveTo(row, innerX + d * 2) +
        ansi.bg(bgR, bgG, bgB) +
        ansi.fg(T.fgBorder[0], T.fgBorder[1], T.fgBorder[2]) +
        '│' +
        ansi.reset()
      );
    }

    // 3. Selection accent bar on left edge
    if (isCursor) {
      screen.push(
        ansi.moveTo(row, innerX) +
        ansi.bg(T.bgSelected[0], T.bgSelected[1], T.bgSelected[2]) +
        ansi.fg(T.fgAccent[0], T.fgAccent[1], T.fgAccent[2]) +
        '▌' +
        ansi.reset()
      );
    }

    // 4. Determine icon + color for item type
    let fgR = T.fg[0], fgG = T.fg[1], fgB = T.fg[2];
    let icon  = '';
    let bold  = false;

    switch (item.type) {
      case 'solution':
        icon = ICONS.solution + ' ';
        fgR = T.fgAccent[0]; fgG = T.fgAccent[1]; fgB = T.fgAccent[2];
        bold = true;
        break;
      case 'project':
        icon = (item.expanded ? '▾ ' : '▸ ') + ICONS.project + ' ';
        fgR = T.fgCyan[0]; fgG = T.fgCyan[1]; fgB = T.fgCyan[2];
        break;
      case 'info':
        icon = '';
        fgR = T.fgDim[0]; fgG = T.fgDim[1]; fgB = T.fgDim[2];
        break;
      case 'folder':
        icon = (item.expanded ? '▾ ' : '▸ ');
        fgR = T.fgYellow[0]; fgG = T.fgYellow[1]; fgB = T.fgYellow[2];
        break;
      case 'package':
        icon = ICONS.package + ' ';
        fgR = T.fgMagenta[0]; fgG = T.fgMagenta[1]; fgB = T.fgMagenta[2];
        break;
      case 'ref':
        icon = ICONS.ref + ' ';
        fgR = T.fgOrange[0]; fgG = T.fgOrange[1]; fgB = T.fgOrange[2];
        break;
    }

    if (isCursor) { fgR = T.fgSelected[0]; fgG = T.fgSelected[1]; fgB = T.fgSelected[2]; }

    // 5. Draw icon + label at content column
    const contentX = innerX + item.depth * 2;
    const avail    = innerW - item.depth * 2 - 1; // -1 for scrollbar gap
    const label    = item.label;
    const iconLen  = icon.length;
    const labelAvail = Math.max(0, avail - iconLen);
    const labelStr   = label.length > labelAvail
      ? label.slice(0, labelAvail - 1) + '…'
      : label;

    screen.push(
      ansi.moveTo(row, contentX) +
      ansi.bg(bgR, bgG, bgB) +
      ansi.fg(fgR, fgG, fgB) +
      (bold ? ansi.bold() : '') +
      icon + labelStr +
      ansi.reset()
    );
  }

  // ── Scrollbar ──────────────────────────────────────────────────────────────
  if (treeItems.length > innerH) {
    const barH = Math.max(1, Math.floor(innerH * innerH / treeItems.length));
    const barY = Math.floor(scroll * (innerH - barH) / Math.max(1, treeItems.length - innerH));
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

  return scroll;
}

module.exports = { buildTreeItems, renderTree };
