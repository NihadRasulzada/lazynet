'use strict';

// Modes
const MODE = {
  NORMAL:   'NORMAL',
  COMMAND:  'COMMAND',
  NUGET:    'NUGET',
  REFS:     'REFS',
};

// Panels
const PANEL = {
  TREE:   'TREE',
  OUTPUT: 'OUTPUT',
  NUGET:  'NUGET',
};

// Build configurations
const CONFIGS = ['Debug', 'Release'];

function createState(cfg) {
  return {
    mode:           MODE.NORMAL,
    activePanel:    PANEL.TREE,
    prevPanel:      PANEL.TREE,

    // Solution / project
    solution:       null,    // { slnPath, dir, projects: [] }
    projects:       [],      // parsed projects with csproj info
    treeItems:      [],      // flat list of visible tree items
    treeIdx:        0,       // cursor in tree
    treeScroll:     0,       // scroll offset

    // Selected
    selectedProject: null,   // project object
    selectedPackage: null,   // {name, version}

    // Build config
    buildConfig:    cfg.buildConfig || 'Debug',

    // Output panel
    outputLines:    [],      // {type, text}[]
    outputScroll:   0,

    // Command mode
    commandBuf:     '',

    // NuGet popup
    nugetQuery:      '',
    nugetResults:    [],
    nugetVersions:   [],
    nugetIdx:        0,
    nugetVersionIdx: 0,
    nugetLoading:    false,
    nugetError:      null,
    nugetStep:       'search',  // 'search' | 'versions'
    nugetTargetProj: null,

    // References view
    refsMode:       false,
    refsItems:      [],
    refsIdx:        0,

    // Status
    statusMsg:      'Press ? for help',
    runnerBusy:     false,

    // Config
    cfg,
  };
}

module.exports = { createState, MODE, PANEL, CONFIGS };
