'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const CONFIG_DIR  = path.join(os.homedir(), '.config', 'dotnet-tui');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  recentSolutions:  [],    // [{path, name, lastOpened}]
  buildConfig:      'Debug',
  maxRecentSln:     10,
  outputLines:      2000,  // max lines kept in output panel
  nugetPageSize:    15,
};

function load() {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    if (!fs.existsSync(CONFIG_FILE)) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

function save(cfg) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (_) {}
}

function addRecentSln(cfg, slnPath) {
  const name = path.basename(slnPath);
  cfg.recentSolutions = cfg.recentSolutions.filter(r => r.path !== slnPath);
  cfg.recentSolutions.unshift({ path: slnPath, name, lastOpened: new Date().toISOString() });
  if (cfg.recentSolutions.length > cfg.maxRecentSln) {
    cfg.recentSolutions = cfg.recentSolutions.slice(0, cfg.maxRecentSln);
  }
  save(cfg);
}

module.exports = { load, save, addRecentSln, CONFIG_DIR };
