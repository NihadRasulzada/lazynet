'use strict';

const { T, ansi } = require('../core/screen');
const path = require('path');

// Icons
const ICONS = {
  solution:  '◈',
  project:   '⬡',
  packages:  '⊞',
  package:   '⬥',
  refs:      '⊟',
  ref:       '⊸',
  folder:    '▸',
  folderOpen:'▾',
};

// Build flat tree item list from solution state
function buildTreeItems(solution, projects, expanded) {
  if (!solution) return [];
  const items = [];

  // Solution root
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

      // Packages
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

      // Project references
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

// Render tree into screen buffer
function renderTree(screen, state, x, y, w, h) {
  const { treeItems, treeIdx, treeScroll, activePanel } = state;
  const focused = activePanel === 'TREE';

  // Draw border
  screen.drawBox(x, y, w, h, {
    title:   '  Solution Explorer ',
    focused,
    bgR: T.bgPanel[0], bgG: T.bgPanel[1], bgB: T.bgPanel[2],
  });

  const innerX = x + 2;
  const innerW = w - 4;
  const innerH = h - 2;

  if (!state.solution) {
    screen.text(innerX, y + 2, 'No solution loaded', T.fgDim[0], T.fgDim[1], T.fgDim[2],
      T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]);
    screen.text(innerX, y + 3, ':open <path>  to open a .sln', T.fgGray[0], T.fgGray[1], T.fgGray[2],
      T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]);
    screen.text(innerX, y + 4, ':find         to find in cwd', T.fgGray[0], T.fgGray[1], T.fgGray[2],
      T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]);
    return;
  }

  // Adjust scroll so cursor is visible
  const visStart = treeScroll;
  const visEnd   = treeScroll + innerH - 1;
  let scroll = treeScroll;
  if (treeIdx < visStart) scroll = treeIdx;
  if (treeIdx > visEnd)   scroll = treeIdx - innerH + 1;

  for (let i = 0; i < innerH; i++) {
    const idx = i + scroll;
    if (idx >= treeItems.length) {
      // Clear line
      screen.text(innerX, y + 1 + i, ' '.repeat(innerW),
        T.bgPanel[0], T.bgPanel[1], T.bgPanel[2],
        T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]);
      continue;
    }

    const item    = treeItems[idx];
    const isCursor = idx === treeIdx && focused;
    const isSelected = idx === treeIdx;

    const bgR = isCursor ? T.bgSelected[0] : T.bgPanel[0];
    const bgG = isCursor ? T.bgSelected[1] : T.bgPanel[1];
    const bgB = isCursor ? T.bgSelected[2] : T.bgPanel[2];

    // Build line
    const indent = '  '.repeat(item.depth);
    let icon  = '';
    let fgR = T.fg[0], fgG = T.fg[1], fgB = T.fg[2];

    switch (item.type) {
      case 'solution':
        icon = ICONS.solution + ' ';
        fgR = T.fgAccent[0]; fgG = T.fgAccent[1]; fgB = T.fgAccent[2];
        break;
      case 'project':
        icon = (item.expanded ? '▾ ' : '▸ ') + ICONS.project + ' ';
        fgR = T.fgCyan[0]; fgG = T.fgCyan[1]; fgB = T.fgCyan[2];
        break;
      case 'info':
        icon = '  ';
        fgR = T.fgGray[0]; fgG = T.fgGray[1]; fgB = T.fgGray[2];
        break;
      case 'folder':
        icon = (item.expanded ? '▾ ' : '▸ ');
        fgR = T.fgYellow[0]; fgG = T.fgYellow[1]; fgB = T.fgYellow[2];
        break;
      case 'package':
        icon = '  ' + ICONS.package + ' ';
        fgR = T.fgMagenta[0]; fgG = T.fgMagenta[1]; fgB = T.fgMagenta[2];
        break;
      case 'ref':
        icon = '  ' + ICONS.ref + ' ';
        fgR = T.fgOrange[0]; fgG = T.fgOrange[1]; fgB = T.fgOrange[2];
        break;
    }

    if (isCursor) { fgR = 255; fgG = 255; fgB = 255; }

    const prefix = indent + icon;
    const label  = item.label;
    const avail  = innerW - prefix.length;
    const text   = prefix + (label.length > avail ? label.slice(0, avail - 1) + '…' : label);
    const padded = text + ' '.repeat(Math.max(0, innerW - text.length));

    screen.text(innerX, y + 1 + i, padded, fgR, fgG, fgB, bgR, bgG, bgB);
  }

  // Scrollbar
  if (treeItems.length > innerH) {
    const barH  = Math.max(1, Math.floor(innerH * innerH / treeItems.length));
    const barY  = Math.floor(scroll * (innerH - barH) / Math.max(1, treeItems.length - innerH));
    for (let i = 0; i < innerH; i++) {
      const ch  = (i >= barY && i < barY + barH) ? '█' : '░';
      const fR  = i >= barY && i < barY + barH ? T.fgAccent[0] : T.fgGray[0];
      const fG  = i >= barY && i < barY + barH ? T.fgAccent[1] : T.fgGray[1];
      const fB  = i >= barY && i < barY + barH ? T.fgAccent[2] : T.fgGray[2];
      screen.text(x + w - 2, y + 1 + i, ch, fR, fG, fB, T.bgPanel[0], T.bgPanel[1], T.bgPanel[2]);
    }
  }

  return scroll; // return adjusted scroll
}

module.exports = { buildTreeItems, renderTree };
