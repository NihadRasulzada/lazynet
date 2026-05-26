#!/usr/bin/env node
'use strict';

const path = require('path');
const fs   = require('fs');

const { Screen, T, ansi } = require('./src/core/screen');
const { Input }            = require('./src/core/input');
const { Runner }           = require('./src/core/runner');
const { createState, MODE, PANEL } = require('./src/state');
const { buildTreeItems, renderTree } = require('./src/ui/tree');
const { renderOutput, addOutputLine } = require('./src/ui/output');
const { renderNuget }    = require('./src/ui/nuget');
const { renderStatusBar, renderCommandLine, renderHelp } = require('./src/ui/statusbar');
const keybindings        = require('./src/keybindings');
const solutionCore       = require('./src/core/solution');
const configMod          = require('./src/core/config');

// ─── App class ───────────────────────────────────────────────────────────────
class App {
  constructor() {
    this.cfg      = configMod.load();
    this.state    = createState(this.cfg);
    this.screen   = new Screen();
    this.input    = new Input();
    this.runner   = new Runner();
    this._expanded = {};
    this._renderPending = false;
    this._renderTimer   = null;
  }

  start() {
    this.screen.init();

    // Handle resize
    this.screen.onResize((w, h) => {
      this.render();
    });

    // Runner events
    this.runner.on('start', ({ label }) => {
      this.state.runnerBusy = true;
      this.state.statusMsg  = `Running: ${label}…`;
      this._outputAutoScroll = true;
      this.render();
    });

    this.runner.on('output', ({ type, text }) => {
      addOutputLine(this.state, type, text);
      this.scheduleRender();
    });

    this.runner.on('done', ({ ok, label }) => {
      this.state.runnerBusy = false;
      this.state.statusMsg  = `${ok ? '✔' : '✘'} ${label} ${ok ? 'done' : 'failed'}`;
      this.render();
    });

    // Input
    this.input.on('key', (key) => {
      keybindings.handleKey(key, this.state, this.runner, () => this.render(), this);
    });

    this.input.on('quit', () => this.quit());

    this.input.start();

    // Check if a .sln was passed as argument
    const arg = process.argv[2];
    if (arg) {
      const resolved = path.resolve(arg);
      if (resolved.endsWith('.sln') && fs.existsSync(resolved)) {
        this.openSolution(resolved);
      } else if (fs.statSync(resolved).isDirectory()) {
        const found = solutionCore.findSlnFiles(resolved);
        if (found.length === 1) this.openSolution(found[0]);
        else if (found.length > 1) {
          addOutputLine(this.state, 'info', `Multiple .sln files found:`);
          found.forEach(f => addOutputLine(this.state, 'normal', `  ${f}`));
          addOutputLine(this.state, 'info', 'Use :open <path> to select one');
        } else {
          addOutputLine(this.state, 'warn', `No .sln found in ${resolved}`);
        }
      }
    } else {
      // Try cwd
      const found = solutionCore.findSlnFiles(process.cwd());
      if (found.length === 1) {
        this.openSolution(found[0]);
      } else {
        addOutputLine(this.state, 'info', 'Welcome to dotnet-tui!');
        addOutputLine(this.state, 'info', 'Press ? for help, or :open <path> to open a solution');
        addOutputLine(this.state, 'info', ':find will search current directory for .sln files');
      }
    }

    this.render();
  }

  scheduleRender() {
    if (this._renderPending) return;
    this._renderPending = true;
    setImmediate(() => {
      this._renderPending = false;
      this.render();
    });
  }

  render() {
    const sc = this.screen;
    const st = this.state;
    const W  = sc.cols;
    const H  = sc.rows;

    // Layout dimensions
    const treeW  = Math.max(28, Math.min(42, Math.floor(W * 0.28)));
    const outW   = W - treeW - 1;
    const mainH  = H - 2;  // minus statusbar (1) + command line (1)

    // Clear everything first
    sc.fillRect(1, 1, W, H, T.bg[0], T.bg[1], T.bg[2]);

    // Tree panel
    const newScroll = renderTree(sc, st, 1, 1, treeW, mainH);
    if (newScroll !== undefined) st.treeScroll = newScroll;

    // Vertical divider
    sc.push(ansi.fg(T.fgBorder[0], T.fgBorder[1], T.fgBorder[2]));
    for (let r = 1; r <= mainH; r++) {
      sc.push(ansi.moveTo(r, treeW + 1) + ansi.bg(T.bg[0], T.bg[1], T.bg[2]) + '│' + ansi.reset());
    }
    sc.push(ansi.reset());

    // Output panel
    renderOutput(sc, st, treeW + 2, 1, outW, mainH);

    // Status bar
    renderStatusBar(sc, st, H - 1, W);

    // Command line (overwrites status bar when in CMD mode)
    renderCommandLine(sc, st, H, W);

    // Overlays
    if (st.mode === MODE.NUGET) renderNuget(sc, st, W, H);
    if (st._showHelp) renderHelp(sc, st, W, H);

    sc.flush();
  }

  // ── Solution management ────────────────────────────────────────────────────
  openSolution(slnPath) {
    try {
      if (!slnPath.endsWith('.sln')) {
        this.state.statusMsg = `✘ Not a .sln file: ${slnPath}`;
        this.render(); return;
      }
      if (!fs.existsSync(slnPath)) {
        this.state.statusMsg = `✘ File not found: ${slnPath}`;
        this.render(); return;
      }

      const solution = solutionCore.parseSln(slnPath);
      this.state.solution = solution;
      this.state.treeIdx  = 0;
      this.state.treeScroll = 0;
      this._expanded = {};

      // Load all projects
      this.state.projects = solution.projects.map(p => {
        const csproj = solutionCore.parseCsproj(p.fullPath);
        return { ...p, csproj };
      });

      this.rebuildTree();
      configMod.addRecentSln(this.cfg, slnPath);
      this.state.statusMsg = `✔ Opened: ${path.basename(slnPath)}`;
      addOutputLine(this.state, 'success', `Opened solution: ${slnPath}`);
      addOutputLine(this.state, 'info', `  ${this.state.projects.length} project(s) found`);
      this.state.projects.forEach(p => {
        const fw = p.csproj ? p.csproj.targetFw : 'unknown';
        addOutputLine(this.state, 'normal', `  • ${p.name}  [${fw}]`);
      });
    } catch (e) {
      this.state.statusMsg = `✘ Error: ${e.message}`;
      addOutputLine(this.state, 'error', `Error opening solution: ${e.message}`);
    }
    this.render();
  }

  rebuildTree() {
    this.state.treeItems = buildTreeItems(
      this.state.solution,
      this.state.projects,
      this._expanded
    );
    // Clamp cursor
    if (this.state.treeIdx >= this.state.treeItems.length) {
      this.state.treeIdx = Math.max(0, this.state.treeItems.length - 1);
    }
  }

  reloadProject(proj) {
    const idx = this.state.projects.findIndex(p => p.fullPath === proj.fullPath);
    if (idx < 0) return;
    const csproj = solutionCore.parseCsproj(proj.fullPath);
    this.state.projects[idx] = { ...proj, csproj };
    this.rebuildTree();
    this.render();
  }

  quit() {
    this.screen.destroy();
    this.input.stop();
    if (this.runner.running) this.runner.stop();
    console.log('\nGoodbye!');
    process.exit(0);
  }
}

// ─── Error safety ─────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  // Restore terminal before crashing
  process.stdout.write('\x1b[?1049l\x1b[?25h\x1b[?1000l');
  console.error('\n[dotnet-tui] Uncaught error:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('SIGTERM', () => {
  process.stdout.write('\x1b[?1049l\x1b[?25h\x1b[?1000l');
  process.exit(0);
});

// ─── Start ────────────────────────────────────────────────────────────────────
const app = new App();
app.start();
