#!/usr/bin/env node
'use strict';

const path = require('path');
const fs   = require('fs');

const { Screen, T, ansi }  = require('./src/core/screen');
const { Input }             = require('./src/core/input');
const { Runner }            = require('./src/core/runner');
const { createState, MODE, PANEL } = require('./src/state');
const { buildTreeItems, renderTree } = require('./src/ui/tree');
const { renderOutput, addOutputLine } = require('./src/ui/output');
const { renderNuget }       = require('./src/ui/nuget');
const { renderHeader, renderStatusBar, renderCommandLine, renderHelp } = require('./src/ui/statusbar');
const keybindings           = require('./src/keybindings');
const solutionCore          = require('./src/core/solution');
const configMod             = require('./src/core/config');

// ─── App ──────────────────────────────────────────────────────────────────────
class App {
  constructor() {
    this.cfg      = configMod.load();
    this.state    = createState(this.cfg);
    this.screen   = new Screen();
    this.input    = new Input();
    this.runner   = new Runner();
    this._expanded = {};
    this._renderPending = false;
  }

  start() {
    this.screen.init();

    this.screen.onResize(() => this.render());

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

    // Open project from argument or auto-detect in cwd
    const arg = process.argv[2];
    if (arg) {
      const resolved = path.resolve(arg);
      if (!fs.existsSync(resolved)) {
        addOutputLine(this.state, 'warn', `Not found: ${resolved}`);
      } else if (fs.statSync(resolved).isDirectory()) {
        this._autoOpen(resolved);
      } else {
        this.openSolution(resolved);
      }
    } else {
      this._autoOpen(process.cwd());
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

    // ── Layout ────────────────────────────────────────────────────────────────
    //  Row 1     : header bar
    //  Row 2     : header separator (part of header)
    //  Row 3…H-2 : main panels (tree + output)
    //  Row H-1   : status bar
    //  Row H     : command line
    const HEADER_H = 1;       // header bar row
    const panelY   = 1 + HEADER_H;          // panels start at row 2
    const mainH    = H - HEADER_H - 2;      // rows available for panels

    const treeW = Math.max(28, Math.min(42, Math.floor(W * 0.28)));
    const outW  = W - treeW - 1;

    // Clear screen
    sc.fillRect(1, 1, W, H, T.bg[0], T.bg[1], T.bg[2]);

    // Header
    renderHeader(sc, st, 1, W);

    // Tree panel
    const newScroll = renderTree(sc, st, 1, panelY, treeW, mainH);
    if (newScroll !== undefined) st.treeScroll = newScroll;

    // Vertical divider between tree and output
    for (let r = panelY; r < panelY + mainH; r++) {
      sc.push(
        ansi.moveTo(r, treeW + 1) +
        ansi.bg(T.bg[0], T.bg[1], T.bg[2]) +
        ansi.fg(T.fgBorder[0], T.fgBorder[1], T.fgBorder[2]) +
        '│' +
        ansi.reset()
      );
    }

    // Output panel
    renderOutput(sc, st, treeW + 2, panelY, outW, mainH);

    // Status bar
    renderStatusBar(sc, st, H - 1, W);

    // Command line (overwrites status bar row when in CMD mode)
    renderCommandLine(sc, st, H, W);

    // Overlays
    if (st.mode === MODE.NUGET) renderNuget(sc, st, W, H);
    if (st._showHelp)           renderHelp(sc, st, W, H);

    sc.flush();
  }

  // ── Auto-detect and open in a directory ───────────────────────────────────
  _autoOpen(dir) {
    const { solutions, projects } = solutionCore.findProjectFiles(dir);

    // Prefer solution files; fall back to standalone project files
    const candidates = solutions.length > 0 ? solutions : projects;

    if (candidates.length === 1) {
      this.openSolution(candidates[0]);
    } else if (candidates.length > 1) {
      addOutputLine(this.state, 'info', `Found ${candidates.length} project files:`);
      candidates.forEach(f => addOutputLine(this.state, 'normal', `  ${f}`));
      addOutputLine(this.state, 'info', 'Use :open <path> to select one');
    } else {
      addOutputLine(this.state, 'info', 'Welcome to lazynet!');
      addOutputLine(this.state, 'info', 'Press ? for help, or :open <path> to open a project');
      addOutputLine(this.state, 'info', ':find searches the current directory  (.sln .slnx .csproj .fsproj .vbproj)');
    }
  }

  // ── Open any supported project/solution file ───────────────────────────────
  openSolution(slnPath) {
    try {
      if (!fs.existsSync(slnPath)) {
        this.state.statusMsg = `✘ File not found: ${slnPath}`;
        this.render(); return;
      }

      const ext = path.extname(slnPath).toLowerCase();
      if (![...solutionCore.SOLUTION_EXTS, ...solutionCore.PROJECT_EXTS].includes(ext)) {
        this.state.statusMsg = `✘ Unsupported: ${ext}`;
        this.render(); return;
      }

      const solution = solutionCore.openProject(slnPath);
      this.state.solution  = solution;
      this.state.treeIdx   = 0;
      this.state.treeScroll = 0;
      this._expanded = {};

      this.state.projects = solution.projects.map(p => {
        const csproj = solutionCore.parseCsproj(p.fullPath);
        return { ...p, csproj };
      });

      this.rebuildTree();
      configMod.addRecentSln(this.cfg, slnPath);

      const fmt = solution.format === 'single' ? 'project' : solution.format;
      this.state.statusMsg = `✔ Opened: ${path.basename(slnPath)}`;
      addOutputLine(this.state, 'success', `Opened ${fmt}: ${slnPath}`);
      addOutputLine(this.state, 'info',    `  ${this.state.projects.length} project(s) found`);
      this.state.projects.forEach(p => {
        const fw   = p.csproj ? p.csproj.targetFw : 'unknown';
        const lang = p.lang   ? `  ${p.lang}`     : '';
        addOutputLine(this.state, 'normal', `  • ${p.name}  [${fw}${lang}]`);
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
