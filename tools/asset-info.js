'use strict';

// Check the actual format and dimensions rather than assuming all images are PNG.
function assetInfo(buf) {
  if (buf.length >= 24 && buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return { format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const type = buf.toString('ascii', 12, 16);
    if (type === 'VP8X') return { format: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (type === 'VP8 ' && buf.toString('hex', 23, 26) === '9d012a') return { format: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (type === 'VP8L' && buf[20] === 0x2f) {
      const bits = buf.readUInt32LE(21);
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  const svg = buf.toString('utf8');
  if (/^\s*<svg\s/.test(svg) && !/<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|src)\s*=/i.test(svg)) {
    const width = Number(svg.match(/\bwidth="(\d+)"/)?.[1]);
    const height = Number(svg.match(/\bheight="(\d+)"/)?.[1]);
    if (width > 0 && height > 0) return { format: 'svg', width, height };
  }
  throw new Error('Unsupported or malformed activity artwork');
}

module.exports = { assetInfo };
