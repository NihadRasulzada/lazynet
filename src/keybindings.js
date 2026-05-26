'use strict';

const { MODE, PANEL } = require('./state');
const solutionCore    = require('./core/solution');
const nugetCore       = require('./core/nuget');
const { addOutputLine } = require('./ui/output');
const path = require('path');
const fs   = require('fs');

// Pending key for two-key combos (e.g. 'dd', 'gg')
let _pendingKey = null;
let _pendingTimer = null;

function clearPending() {
  _pendingKey = null;
  if (_pendingTimer) { clearTimeout(_pendingTimer); _pendingTimer = null; }
}

function setPending(key, cb) {
  clearPending();
  _pendingKey = key;
  _pendingTimer = setTimeout(clearPending, 1000);
}

// ─── Main dispatcher ─────────────────────────────────────────────────────────
function handleKey(key, state, runner, render, app) {
  switch (state.mode) {
    case MODE.NORMAL:   return handleNormal(key, state, runner, render, app);
    case MODE.COMMAND:  return handleCommand(key, state, runner, render, app);
    case MODE.NUGET:    return handleNuget(key, state, runner, render, app);
  }
}

// ─── NORMAL mode ─────────────────────────────────────────────────────────────
function handleNormal(key, state, runner, render, app) {
  const k = key.name || key.char;
  const panel = state.activePanel;

  // Global
  if (k === '?' && !key.ctrl) { state._showHelp = !state._showHelp; render(); return; }
  if (k === 'escape') { state._showHelp = false; render(); return; }
  if (k === 'q' && !key.ctrl) { app.quit(); return; }
  if (k === ':') { state.mode = MODE.COMMAND; state.commandBuf = ''; render(); return; }
  if (k === 'tab') {
    state.activePanel = panel === PANEL.TREE ? PANEL.OUTPUT : PANEL.TREE;
    state.statusMsg = `Panel: ${state.activePanel}`;
    render(); return;
  }

  // Toggle build config
  if (k === 'C' || (key.char === 'C')) {
    const configs = ['Debug', 'Release'];
    const idx = configs.indexOf(state.buildConfig);
    state.buildConfig = configs[(idx + 1) % configs.length];
    state.statusMsg = `Build config: ${state.buildConfig}`;
    render(); return;
  }

  // Kill process
  if (k === 'k' && key.ctrl) {
    if (runner.running) { runner.stop(); state.statusMsg = 'Process killed'; }
    else state.statusMsg = 'No running process';
    render(); return;
  }

  // Panel-specific
  if (panel === PANEL.TREE) {
    handleTreeKeys(k, key, state, runner, render, app);
  } else if (panel === PANEL.OUTPUT) {
    handleOutputKeys(k, key, state, render);
  }
}

// ─── Tree panel keys ──────────────────────────────────────────────────────────
function handleTreeKeys(k, key, state, runner, render, app) {
  const items = state.treeItems;
  const len   = items.length;
  if (!len && ![':', 'n'].includes(k)) return;

  // Navigation
  if (k === 'j' || k === 'down') {
    state.treeIdx = Math.min(state.treeIdx + 1, len - 1); clearPending(); render(); return;
  }
  if (k === 'k' || k === 'up') {
    state.treeIdx = Math.max(state.treeIdx - 1, 0); clearPending(); render(); return;
  }
  if (k === 'g') {
    if (_pendingKey === 'g') { state.treeIdx = 0; clearPending(); render(); return; }
    setPending('g'); return;
  }
  if (k === 'G') { state.treeIdx = Math.max(0, len - 1); render(); return; }
  if (k === 'u' && key.ctrl) {
    state.treeIdx = Math.max(0, state.treeIdx - 10); render(); return;
  }
  if (k === 'd' && key.ctrl) {
    state.treeIdx = Math.min(len - 1, state.treeIdx + 10); render(); return;
  }

  // Expand/collapse
  if (k === 'enter' || k === 'l' || k === 'right') {
    const item = items[state.treeIdx];
    if (item && (item.type === 'project' || item.type === 'folder')) {
      if (!app._expanded) app._expanded = {};
      app._expanded[item.key] = !app._expanded[item.key];
      app.rebuildTree();
      render();
    }
    return;
  }
  if (k === 'h' || k === 'left') {
    // Collapse current or go to parent
    const item = items[state.treeIdx];
    if (item && item.type === 'folder' && app._expanded && app._expanded[item.key]) {
      app._expanded[item.key] = false;
      app.rebuildTree(); render(); return;
    }
    if (item && item.type !== 'solution') {
      // Find parent project
      for (let i = state.treeIdx - 1; i >= 0; i--) {
        if (items[i].type === 'project') { state.treeIdx = i; render(); return; }
      }
    }
    return;
  }

  // Set selected project from cursor
  const selItem = items[state.treeIdx];
  const selProj = selItem ? getProjectFromItem(selItem) : null;

  // Build/Run commands
  if (k === 'b') {
    if (!selProj) { state.statusMsg = '✘ No project selected'; render(); return; }
    state.statusMsg = `Building ${selProj.name}…`;
    state.activePanel = PANEL.OUTPUT;
    render();
    runner.build(selProj.fullPath, state.buildConfig);
    return;
  }
  if (k === 'B') {
    if (!state.solution) { state.statusMsg = '✘ No solution loaded'; render(); return; }
    state.statusMsg = 'Building solution…';
    state.activePanel = PANEL.OUTPUT;
    render();
    runner.build(state.solution.slnPath, state.buildConfig);
    return;
  }
  if (k === 'R') {
    if (!selProj) { state.statusMsg = '✘ No project selected'; render(); return; }
    state.statusMsg = `Rebuilding ${selProj.name}…`;
    state.activePanel = PANEL.OUTPUT;
    render();
    runner.rebuild(selProj.fullPath, state.buildConfig);
    return;
  }
  if (k === 'c') {
    const target = selProj ? selProj.fullPath : state.solution && state.solution.slnPath;
    if (!target) { state.statusMsg = '✘ Nothing to clean'; render(); return; }
    state.statusMsg = 'Cleaning…';
    state.activePanel = PANEL.OUTPUT;
    render();
    runner.clean(target);
    return;
  }
  if (k === 'r') {
    if (!selProj) { state.statusMsg = '✘ No project selected'; render(); return; }
    state.statusMsg = `Running ${selProj.name}…`;
    state.activePanel = PANEL.OUTPUT;
    render();
    runner.run(selProj.fullPath, state.buildConfig);
    return;
  }
  if (k === 't') {
    const target = selProj ? selProj.fullPath : state.solution && state.solution.slnPath;
    if (!target) { state.statusMsg = '✘ No target'; render(); return; }
    state.statusMsg = 'Running tests…';
    state.activePanel = PANEL.OUTPUT;
    render();
    runner.test(target);
    return;
  }
  if (k === 'p') {
    if (!selProj) { state.statusMsg = '✘ No project selected'; render(); return; }
    state.statusMsg = `Publishing ${selProj.name}…`;
    state.activePanel = PANEL.OUTPUT;
    render();
    runner.publish(selProj.fullPath, 'Release');
    return;
  }
  if (k === 'e') {
    const target = selProj ? selProj.fullPath : state.solution && state.solution.slnPath;
    if (!target) { state.statusMsg = '✘ Nothing to restore'; render(); return; }
    state.statusMsg = 'Restoring…';
    state.activePanel = PANEL.OUTPUT;
    render();
    runner.restore(target);
    return;
  }

  // NuGet
  if (k === 'n') {
    const proj = selProj || (state.projects.length === 1 ? state.projects[0] : null);
    if (!proj) { state.statusMsg = '✘ Select a project first'; render(); return; }
    openNuget(state, proj, render);
    return;
  }

  // Remove package (dd)
  if (k === 'd') {
    if (_pendingKey === 'd') {
      clearPending();
      const item = items[state.treeIdx];
      if (item && item.type === 'package') {
        const { proj, pkg } = item.data;
        try {
          solutionCore.removePackage(proj.csproj.path, pkg.name);
          app.reloadProject(proj);
          state.statusMsg = `✔ Removed ${pkg.name}`;
          addOutputLine(state, 'success', `Removed package ${pkg.name} from ${proj.name}`);
        } catch (e) {
          state.statusMsg = `✘ ${e.message}`;
        }
        render();
      } else {
        state.statusMsg = 'dd: select a package to remove';
        render();
      }
      return;
    }
    setPending('d');
    return;
  }

  // Project reference remove (D on ref item)
  if (key.char === 'D') {
    const item = items[state.treeIdx];
    if (item && item.type === 'ref') {
      const { proj, ref } = item.data;
      const absRef = path.resolve(path.dirname(proj.fullPath), ref);
      try {
        solutionCore.removeProjectRef(proj.csproj.path, absRef);
        app.reloadProject(proj);
        state.statusMsg = `✔ Removed reference`;
        addOutputLine(state, 'success', `Removed project reference from ${proj.name}`);
      } catch (e) {
        state.statusMsg = `✘ ${e.message}`;
      }
      render();
    }
    return;
  }
}

// ─── Output panel keys ────────────────────────────────────────────────────────
function handleOutputKeys(k, key, state, render) {
  if (k === 'j' || k === 'down') {
    state.outputScroll++;
    state._outputAutoScroll = false;
    render(); return;
  }
  if (k === 'k' || k === 'up') {
    state.outputScroll = Math.max(0, state.outputScroll - 1);
    state._outputAutoScroll = false;
    render(); return;
  }
  if (k === 'u' && key.ctrl) {
    state.outputScroll = Math.max(0, state.outputScroll - 10);
    state._outputAutoScroll = false;
    render(); return;
  }
  if (k === 'd' && key.ctrl) {
    state.outputScroll += 10;
    state._outputAutoScroll = false;
    render(); return;
  }
  if (k === 'G') {
    state._outputAutoScroll = true;
    render(); return;
  }
  if (k === 'g') {
    if (_pendingKey === 'g') { state.outputScroll = 0; state._outputAutoScroll = false; clearPending(); render(); return; }
    setPending('g'); return;
  }
}

// ─── COMMAND mode ─────────────────────────────────────────────────────────────
function handleCommand(key, state, runner, render, app) {
  const k = key.name || key.char;

  if (k === 'escape') {
    state.mode = MODE.NORMAL;
    state.commandBuf = '';
    render(); return;
  }
  if (k === 'enter') {
    execCommand(state.commandBuf.trim(), state, runner, render, app);
    state.mode = MODE.NORMAL;
    state.commandBuf = '';
    render(); return;
  }
  if (k === 'backspace') {
    state.commandBuf = state.commandBuf.slice(0, -1);
    render(); return;
  }
  if (key.char && !key.ctrl && !key.meta) {
    state.commandBuf += key.char;
    render(); return;
  }
}

function execCommand(cmd, state, runner, render, app) {
  if (!cmd) return;

  const parts = cmd.split(/\s+/);
  const verb  = parts[0];
  const arg   = parts.slice(1).join(' ');

  if (verb === 'q' || verb === 'quit') { app.quit(); return; }
  if (verb === 'clear') { state.outputLines = []; state.statusMsg = 'Output cleared'; render(); return; }

  if (verb === 'open') {
    const slnPath = arg || process.cwd();
    app.openSolution(slnPath);
    return;
  }

  if (verb === 'find') {
    const dir = arg || process.cwd();
    const found = solutionCore.findSlnFiles(dir);
    if (found.length === 0) {
      state.statusMsg = `✘ No .sln found in ${dir}`;
    } else if (found.length === 1) {
      app.openSolution(found[0]);
    } else {
      // Show in output
      addOutputLine(state, 'info', `Found ${found.length} solution files:`);
      found.forEach((f, i) => addOutputLine(state, 'normal', `  [${i+1}] ${f}`));
      addOutputLine(state, 'info', `Use :open <path> to open one`);
      state.activePanel = PANEL.OUTPUT;
      state.statusMsg = `Found ${found.length} solutions — see output`;
    }
    render(); return;
  }

  if (verb === 'cd') {
    try {
      process.chdir(arg || os.homedir());
      state.statusMsg = `cwd: ${process.cwd()}`;
    } catch (e) {
      state.statusMsg = `✘ ${e.message}`;
    }
    render(); return;
  }

  if (verb === 'config') {
    if (arg === 'debug' || arg === 'Debug') state.buildConfig = 'Debug';
    else if (arg === 'release' || arg === 'Release') state.buildConfig = 'Release';
    state.statusMsg = `Build config: ${state.buildConfig}`;
    render(); return;
  }

  state.statusMsg = `✘ Unknown command: ${verb}`;
  render();
}

// ─── NuGet mode ───────────────────────────────────────────────────────────────
function openNuget(state, proj, render) {
  state.mode = MODE.NUGET;
  state.nugetTargetProj  = proj;
  state.nugetQuery       = '';
  state.nugetResults     = [];
  state.nugetVersions    = [];
  state.nugetIdx         = 0;
  state.nugetVersionIdx  = 0;
  state.nugetLoading     = false;
  state.nugetError       = null;
  state.nugetStep        = 'search';
  render();
}

let _nugetSearchTimer = null;

function handleNuget(key, state, runner, render, app) {
  const k = key.name || key.char;

  if (k === 'escape') {
    if (state.nugetStep === 'versions') {
      state.nugetStep = 'search';
      render();
    } else {
      state.mode = MODE.NORMAL;
      render();
    }
    return;
  }

  if (state.nugetStep === 'search') {
    // Typing → update query
    if (k === 'backspace') {
      state.nugetQuery = state.nugetQuery.slice(0, -1);
      scheduleSearch(state, render);
      render(); return;
    }
    if (k === 'up' || k === 'k') {
      state.nugetIdx = Math.max(0, state.nugetIdx - 1);
      render(); return;
    }
    if (k === 'down' || k === 'j') {
      state.nugetIdx = Math.min(state.nugetResults.length - 1, state.nugetIdx + 1);
      render(); return;
    }
    if (k === 'enter') {
      if (state.nugetResults.length === 0) return;
      loadVersions(state, render);
      return;
    }
    // 'dd' to remove (only when on a package in the tree, here it's a no-op in search step)
    if (key.char && !key.ctrl && !key.meta && key.char.length === 1) {
      state.nugetQuery += key.char;
      scheduleSearch(state, render);
      render(); return;
    }
  } else {
    // versions step
    if (k === 'up' || k === 'k') {
      state.nugetVersionIdx = Math.max(0, state.nugetVersionIdx - 1);
      render(); return;
    }
    if (k === 'down' || k === 'j') {
      state.nugetVersionIdx = Math.min(state.nugetVersions.length - 1, state.nugetVersionIdx + 1);
      render(); return;
    }
    if (k === 'backspace') {
      state.nugetStep = 'search';
      render(); return;
    }
    if (k === 'enter') {
      installSelectedPackage(state, runner, render, app);
      return;
    }
  }
}

function scheduleSearch(state, render) {
  if (_nugetSearchTimer) clearTimeout(_nugetSearchTimer);
  if (!state.nugetQuery.trim()) {
    state.nugetResults = [];
    render();
    return;
  }
  _nugetSearchTimer = setTimeout(async () => {
    state.nugetLoading = true;
    state.nugetError   = null;
    render();
    try {
      state.nugetResults = await nugetCore.searchPackages(state.nugetQuery);
      state.nugetIdx     = 0;
    } catch (e) {
      state.nugetError   = e.message;
      state.nugetResults = [];
    }
    state.nugetLoading = false;
    render();
  }, 350);
}

async function loadVersions(state, render) {
  const pkg = state.nugetResults[state.nugetIdx];
  if (!pkg) return;
  state.nugetLoading = true;
  state.nugetError   = null;
  render();
  try {
    state.nugetVersions   = await nugetCore.getVersions(pkg.id);
    state.nugetVersionIdx = 0;
    state.nugetStep       = 'versions';
  } catch (e) {
    state.nugetError = e.message;
  }
  state.nugetLoading = false;
  render();
}

function installSelectedPackage(state, runner, render, app) {
  const pkg     = state.nugetResults[state.nugetIdx];
  const version = state.nugetVersions[state.nugetVersionIdx];
  const proj    = state.nugetTargetProj;
  if (!pkg || !version || !proj) return;

  state.mode = MODE.NORMAL;
  state.activePanel = PANEL.OUTPUT;
  state.statusMsg   = `Installing ${pkg.id} ${version}…`;
  render();

  runner.addPackageCli(proj.fullPath, pkg.id, version);

  runner.once('done', ({ ok }) => {
    if (ok) app.reloadProject(proj);
  });
}

function getProjectFromItem(item) {
  if (!item) return null;
  if (item.type === 'project') return item.data;
  if (item.type === 'info')    return item.data;
  if (item.type === 'folder')  return item.data;
  if (item.type === 'package') return item.data.proj;
  if (item.type === 'ref')     return item.data.proj;
  return null;
}

module.exports = { handleKey };
