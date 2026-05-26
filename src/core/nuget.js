'use strict';

const https  = require('https');
const http   = require('http');

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function httpGet(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'dotnet-tui/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

// ─── NuGet API ───────────────────────────────────────────────────────────────
const SEARCH_URL  = 'https://azuresearch-usnc.nuget.org/query';
const VERSIONS_URL = 'https://api.nuget.org/v3-flatcontainer';

async function searchPackages(query, skip = 0, take = 20) {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&skip=${skip}&take=${take}&prerelease=false&semVerLevel=2.0.0`;
  const data = await httpGet(url);
  return (data.data || []).map(p => ({
    id:          p.id,
    version:     p.version,
    description: p.description || '',
    downloads:   p.totalDownloads || 0,
    authors:     Array.isArray(p.authors) ? p.authors.join(', ') : (p.authors || ''),
    tags:        p.tags || [],
    verified:    p.verified || false,
  }));
}

async function getVersions(packageId) {
  const url = `${VERSIONS_URL}/${packageId.toLowerCase()}/index.json`;
  const data = await httpGet(url);
  // Return versions newest-first, filter out preview unless they're the only option
  const all = (data.versions || []).reverse();
  const stable = all.filter(v => !/[-]/.test(v));
  return stable.length > 0 ? stable : all;
}

async function getLatestVersion(packageId) {
  const versions = await getVersions(packageId);
  return versions[0] || null;
}

module.exports = { searchPackages, getVersions, getLatestVersion };
