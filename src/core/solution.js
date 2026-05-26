'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Supported extensions ─────────────────────────────────────────────────────
const PROJECT_EXTS  = ['.csproj', '.fsproj', '.vbproj'];
const SOLUTION_EXTS = ['.sln', '.slnx'];
const ALL_EXTS      = [...SOLUTION_EXTS, ...PROJECT_EXTS];

function langFromPath(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.fsproj': return 'F#';
    case '.vbproj': return 'VB';
    default:        return 'C#';
  }
}

// ─── Smart opener — detects file type automatically ───────────────────────────
function openProject(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.sln')             return parseSln(filePath);
  if (ext === '.slnx')            return parseSlnx(filePath);
  if (PROJECT_EXTS.includes(ext)) return parseSingleProject(filePath);
  throw new Error(`Unsupported file type: ${ext}. Expected: ${ALL_EXTS.join(', ')}`);
}

// ─── .sln parser ──────────────────────────────────────────────────────────────
function parseSln(slnPath) {
  const content  = fs.readFileSync(slnPath, 'utf8');
  const dir      = path.dirname(slnPath);
  const projects = [];

  const projRe = /Project\("\{([^}]+)\}"\)\s*=\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"\{([^}]+)\}"/g;
  let m;
  while ((m = projRe.exec(content)) !== null) {
    const typeGuid = m[1].toUpperCase();
    // Skip solution folders
    if (typeGuid === '2150E333-8FDC-42A3-9474-1A3956D46DE8') continue;
    const relPath  = m[3].replace(/\\/g, '/');
    const fullPath = path.resolve(dir, relPath);
    const ext      = path.extname(fullPath).toLowerCase();
    if (!PROJECT_EXTS.includes(ext)) continue;
    projects.push({
      typeGuid,
      name:     m[2],
      relPath,
      guid:     m[4].toUpperCase(),
      fullPath,
      lang:     langFromPath(fullPath),
    });
  }
  return { slnPath, dir, projects, format: 'sln' };
}

// ─── .slnx parser (XML solution, .NET 9+) ────────────────────────────────────
// Format:
//   <Solution>
//     <Project Path="src/MyApp/MyApp.csproj" />
//     <Folder Name="/tests/">
//       <Project Path="tests/MyApp.Tests/MyApp.Tests.csproj" />
//     </Folder>
//   </Solution>
function parseSlnx(slnxPath) {
  const content  = fs.readFileSync(slnxPath, 'utf8');
  const dir      = path.dirname(slnxPath);
  const projects = [];

  const projRe = /<Project\s[^>]*Path="([^"]+)"/g;
  let m;
  while ((m = projRe.exec(content)) !== null) {
    const relPath  = m[1].replace(/\\/g, '/');
    const fullPath = path.resolve(dir, relPath);
    const ext      = path.extname(fullPath).toLowerCase();
    if (!PROJECT_EXTS.includes(ext)) continue;
    projects.push({
      typeGuid: null,
      name:     path.basename(fullPath, ext),
      relPath,
      guid:     null,
      fullPath,
      lang:     langFromPath(fullPath),
    });
  }
  return { slnPath: slnxPath, dir, projects, format: 'slnx' };
}

// ─── Single project file (virtual solution) ───────────────────────────────────
function parseSingleProject(projPath) {
  const ext  = path.extname(projPath).toLowerCase();
  const name = path.basename(projPath, ext);
  return {
    slnPath:  projPath,
    dir:      path.dirname(projPath),
    projects: [{
      typeGuid: null,
      name,
      relPath:  path.basename(projPath),
      guid:     null,
      fullPath: projPath,
      lang:     langFromPath(projPath),
    }],
    format: 'single',
  };
}

// ─── .csproj / .fsproj / .vbproj parser ──────────────────────────────────────
function parseCsproj(csprojPath) {
  if (!fs.existsSync(csprojPath)) return null;
  const content = fs.readFileSync(csprojPath, 'utf8');

  const sdk        = content.match(/<Project\s+Sdk="([^"]+)"/);
  const targetFw   = content.match(/<TargetFramework[s]?>([^<]+)<\/TargetFramework[s]?>/);
  const nullable   = content.match(/<Nullable>([^<]+)<\/Nullable>/);
  const outputType = content.match(/<OutputType>([^<]+)<\/OutputType>/);

  // PackageReferences — inline AND multi-line formats
  const packages = [];
  const seen = new Set();

  // Inline:  <PackageReference Include="Name" Version="x.y.z" />
  const pkgInlineRe = /<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g;
  let pm;
  while ((pm = pkgInlineRe.exec(content)) !== null) {
    if (!seen.has(pm[1])) { seen.add(pm[1]); packages.push({ name: pm[1], version: pm[2] }); }
  }

  // Multi-line (no Version= in opening tag):
  //   <PackageReference Include="Name">
  //     <Version>x.y.z</Version>
  //   </PackageReference>
  const pkgBlockRe = /<PackageReference\s+Include="([^"]+)"(?!\s+Version=)[^>]*>\s*<Version>([^<]+)<\/Version>/g;
  while ((pm = pkgBlockRe.exec(content)) !== null) {
    if (!seen.has(pm[1])) { seen.add(pm[1]); packages.push({ name: pm[1], version: pm[2] }); }
  }

  // ProjectReferences
  const projRefs = [];
  const prRe = /<ProjectReference\s+Include="([^"]+)"/g;
  let pr;
  while ((pr = prRe.exec(content)) !== null) {
    projRefs.push(pr[1].replace(/\\/g, '/'));
  }

  return {
    path:       csprojPath,
    sdk:        sdk ? sdk[1] : null,
    isSdkStyle: !!sdk,
    targetFw:   targetFw ? targetFw[1] : 'unknown',
    nullable:   nullable ? nullable[1] : null,
    outputType: outputType ? outputType[1] : 'Library',
    lang:       langFromPath(csprojPath),
    packages,
    projRefs,
    content,
  };
}

// ─── Add/Remove PackageReference ─────────────────────────────────────────────
function addPackage(csprojPath, name, version) {
  let content = fs.readFileSync(csprojPath, 'utf8');

  const existRe = new RegExp(
    `\\s*<PackageReference\\s+Include="${escapeRe(name)}"[^/]*/?>(?:\\s*<\\/PackageReference>)?`,
    'gi'
  );
  content = content.replace(existRe, '');

  const ref = `\n    <PackageReference Include="${name}" Version="${version}" />`;
  if (/<ItemGroup>[\s\S]*?<PackageReference/i.test(content)) {
    content = content.replace(/(<ItemGroup>[\s\S]*?<PackageReference[^<]*\/>)/, m => m + ref);
  } else if (/<ItemGroup>/i.test(content)) {
    content = content.replace(/<ItemGroup>/, `<ItemGroup>${ref}`);
  } else {
    content = content.replace(/<\/Project>/, `  <ItemGroup>${ref}\n  </ItemGroup>\n</Project>`);
  }
  fs.writeFileSync(csprojPath, content, 'utf8');
}

function removePackage(csprojPath, name) {
  let content = fs.readFileSync(csprojPath, 'utf8');
  const re = new RegExp(
    `\\s*<PackageReference\\s+Include="${escapeRe(name)}"[^/]*/?>(?:\\s*<\\/PackageReference>)?`,
    'gi'
  );
  content = content.replace(re, '');
  content = content.replace(/<ItemGroup>\s*<\/ItemGroup>\n?/g, '');
  fs.writeFileSync(csprojPath, content, 'utf8');
}

// ─── Add/Remove ProjectReference ─────────────────────────────────────────────
function addProjectRef(csprojPath, refPath) {
  let content = fs.readFileSync(csprojPath, 'utf8');
  const relPath = path.relative(path.dirname(csprojPath), refPath).replace(/\//g, '\\');
  if (content.includes(relPath)) return;

  const ref = `\n    <ProjectReference Include="${relPath}" />`;
  if (/<ProjectReference/i.test(content)) {
    content = content.replace(/(<ProjectReference[^>]+\/>)/, `$1${ref}`);
  } else if (/<ItemGroup>/i.test(content)) {
    content = content.replace(/<ItemGroup>/, `<ItemGroup>${ref}`);
  } else {
    content = content.replace(/<\/Project>/, `  <ItemGroup>${ref}\n  </ItemGroup>\n</Project>`);
  }
  fs.writeFileSync(csprojPath, content, 'utf8');
}

function removeProjectRef(csprojPath, refPath) {
  let content = fs.readFileSync(csprojPath, 'utf8');
  const relPath = path.relative(path.dirname(csprojPath), refPath).replace(/\//g, '\\');
  const re = new RegExp(`\\s*<ProjectReference\\s+Include="${escapeRe(relPath)}"[^/]*/?>`, 'gi');
  content = content.replace(re, '');
  content = content.replace(/<ItemGroup>\s*<\/ItemGroup>\n?/g, '');
  fs.writeFileSync(csprojPath, content, 'utf8');
}

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Find project files in a directory ───────────────────────────────────────
function findProjectFiles(dir) {
  const solutions = [];
  const projects  = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext  = path.extname(e.name).toLowerCase();
      const full = path.join(dir, e.name);
      if (SOLUTION_EXTS.includes(ext))     solutions.push(full);
      else if (PROJECT_EXTS.includes(ext)) projects.push(full);
    }
  } catch (_) {}
  return { solutions, projects, all: [...solutions, ...projects] };
}

// Backward-compat alias
function findSlnFiles(dir) {
  return findProjectFiles(dir).solutions;
}

module.exports = {
  openProject,
  parseSln, parseSlnx, parseSingleProject,
  parseCsproj,
  addPackage, removePackage,
  addProjectRef, removeProjectRef,
  findProjectFiles, findSlnFiles,
  PROJECT_EXTS, SOLUTION_EXTS, ALL_EXTS, langFromPath,
};
