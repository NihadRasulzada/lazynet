'use strict';
// Minimal XML parser — only used for reading, writing done via regex on raw content
function parseString(xml) {
  // For .csproj we just read it as text, no need for full parsing
  // This is a stub for compatibility
  return xml;
}
module.exports = { parseString };
