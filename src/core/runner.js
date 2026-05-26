'use strict';

const { spawn } = require('child_process');
const EventEmitter = require('events');

class Runner extends EventEmitter {
  constructor() {
    super();
    this._proc = null;
    this._running = false;
  }

  get running() { return this._running; }

  // Generic dotnet command executor
  _run(args, cwd, label) {
    if (this._running) {
      this.emit('output', { type: 'warn', text: '⚠  Already running a process. Stop it first (Ctrl+K).' });
      return;
    }

    this._running = true;
    this.emit('start', { label });
    this.emit('output', { type: 'info', text: `\n▶ dotnet ${args.join(' ')}\n` + '─'.repeat(60) });

    this._proc = spawn('dotnet', args, {
      cwd,
      env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', TERM: 'xterm-256color' },
      shell: false,
    });

    this._proc.stdout.on('data', (d) => {
      const text = d.toString();
      this.emit('output', { type: this._classifyLine(text), text });
    });

    this._proc.stderr.on('data', (d) => {
      const text = d.toString();
      this.emit('output', { type: 'error', text });
    });

    this._proc.on('close', (code) => {
      this._running = false;
      this._proc = null;
      const ok = code === 0;
      this.emit('output', {
        type: ok ? 'success' : 'error',
        text: `\n${'─'.repeat(60)}\n${ok ? '✔' : '✘'} ${label} ${ok ? 'succeeded' : `failed (exit ${code})`}\n`
      });
      this.emit('done', { code, ok, label });
    });

    this._proc.on('error', (err) => {
      this._running = false;
      this._proc = null;
      this.emit('output', { type: 'error', text: `\n✘ Failed to run dotnet: ${err.message}\n` +
        '  Is the .NET SDK installed? Run: sudo apt install dotnet-sdk-8.0\n' });
      this.emit('done', { code: -1, ok: false, label });
    });
  }

  _classifyLine(text) {
    if (/error/i.test(text))   return 'error';
    if (/warning/i.test(text)) return 'warn';
    if (/Build succeeded/i.test(text)) return 'success';
    return 'normal';
  }

  // ── Commands ────────────────────────────────────────────────────────────────
  build(projPath, config = 'Debug') {
    this._run(['build', projPath, '-c', config, '--nologo'], process.cwd(), 'Build');
  }

  rebuild(projPath, config = 'Debug') {
    this._run(['build', projPath, '-c', config, '--nologo', '--no-incremental'], process.cwd(), 'Rebuild');
  }

  clean(projPath) {
    this._run(['clean', projPath, '--nologo'], process.cwd(), 'Clean');
  }

  run(projPath, config = 'Debug') {
    this._run(['run', '--project', projPath, '-c', config, '--nologo'], process.cwd(), 'Run');
  }

  publish(projPath, config = 'Release') {
    this._run(['publish', projPath, '-c', config, '--nologo'], process.cwd(), 'Publish');
  }

  restore(projPath) {
    this._run(['restore', projPath, '--nologo'], process.cwd(), 'Restore');
  }

  test(projPath) {
    this._run(['test', projPath, '--nologo', '--logger', 'console;verbosity=normal'], process.cwd(), 'Test');
  }

  addPackageCli(projPath, name, version) {
    this._run(['add', projPath, 'package', name, '--version', version, '--nologo'],
      process.cwd(), `Add package ${name}`);
  }

  removePackageCli(projPath, name) {
    this._run(['remove', projPath, 'package', name],
      process.cwd(), `Remove package ${name}`);
  }

  // Stop current process
  stop() {
    if (this._proc) {
      this._proc.kill('SIGTERM');
      setTimeout(() => {
        if (this._proc) this._proc.kill('SIGKILL');
      }, 2000);
    }
  }
}

module.exports = { Runner };
