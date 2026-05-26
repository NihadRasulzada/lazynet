'use strict';

const fs   = require('fs');
const path = require('path');
const { parseString, Builder } = require('./xmlparser');

// ─── .sln parser ─────────────────────────────────────────────────────────────
function parseSln(slnPath) {
  const content = fs.readFileSync(slnPath, 'utf8');
  const dir     = path.dirname(slnPath);
  const projects = [];

  const projRe = /Project\("\{([^}]+)\}"\)\s*=\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"\{([^}]+)\}"/g;
  let m;
  while ((m = projRe.exec(content)) !== null) {
    const typeGuid = m[1].toUpperCase();
    // Skip solution folders (2150E333-...)
    if (typeGuid === '2150E333-8FDC-42A3-9474-1A3956D46DE8') continue;
    projects.push({
      typeGuid,
      name:     m[2],
      relPath:  m[3].replace(/\\/g, '/'),
      guid:     m[4].toUpperCase(),
      fullPath: path.resolve(dir, m[3].replace(/\\/g, '/')),
    });
  }
  return { slnPath, dir, projects };
}

// ─── .csproj parser ──────────────────────────────────────────────────────────
function parseCsproj(csprojPath) {
  if (!fs.existsSync(csprojPath)) return null;
  const content = fs.readFileSync(csprojPath, 'utf8');

  // SDK-style .csproj (all modern .NET 5+)
  const sdk = content.match(/<Project\s+Sdk="([^"]+)"/);
  const targetFw = content.match(/<TargetFramework[s]?>([^<]+)<\/TargetFramework[s]?>/);
  const nullable = content.match(/<Nullable>([^<]+)<\/Nullable>/);
  const outputType = content.match(/<OutputType>([^<]+)<\/OutputType>/);

  // PackageReferences
  const packages = [];
  const pkgRe = /<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g;
  let pm;
  while ((pm = pkgRe.exec(content)) !== null) {
    packages.push({ name: pm[1], version: pm[2] });
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
    sdk:        sdk ? sdk[1] : 'Microsoft.NET.Sdk',
    targetFw:   targetFw ? targetFw[1] : 'unknown',
    nullable:   nullable ? nullable[1] : null,
    outputType: outputType ? outputType[1] : 'Library',
    packages,
    projRefs,
    content,
  };
}

// ─── Add/Remove PackageReference ─────────────────────────────────────────────
function addPackage(csprojPath, name, version) {
  let content = fs.readFileSync(csprojPath, 'utf8');

  // Remove existing if present
  const existRe = new RegExp(
    `\\s*<PackageReference\\s+Include="${escapeRe(name)}"[^/]*/?>(?:\\s*<\\/PackageReference>)?`,
    'gi'
  );
  content = content.replace(existRe, '');

  const ref = `\n    <PackageReference Include="${name}" Version="${version}" />`;

  // Find or create ItemGroup for packages
  if (/<ItemGroup>[\s\S]*?<PackageReference/i.test(content)) {
    content = content.replace(/(<ItemGroup>[\s\S]*?<PackageReference[^<]*\/>)/,
      (m) => m + ref);
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
  // Clean empty ItemGroups
  content = content.replace(/<ItemGroup>\s*<\/ItemGroup>\n?/g, '');
  fs.writeFileSync(csprojPath, content, 'utf8');
}

// ─── Add/Remove ProjectReference ─────────────────────────────────────────────
function addProjectRef(csprojPath, refPath) {
  let content = fs.readFileSync(csprojPath, 'utf8');
  const relPath = path.relative(path.dirname(csprojPath), refPath).replace(/\//g, '\\');

  if (content.includes(relPath)) return; // already exists

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

// ─── Find .sln files ─────────────────────────────────────────────────────────
function findSlnFiles(dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.sln')) {
        results.push(path.join(dir, e.name));
      }
    }
  } catch (_) {}
  return results;
}

module.exports = {
  parseSln, parseCsproj,
  addPackage, removePackage,
  addProjectRef, removeProjectRef,
  findSlnFiles,
};
