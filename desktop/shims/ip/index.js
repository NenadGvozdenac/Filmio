'use strict';

/**
 * Converts a 4-byte (IPv4) or 16-byte (IPv6) buffer to its string form.
 * Same behaviour as ip.toString() from the original 'ip' package.
 */
function toString(buff, offset, length) {
  offset = ~~offset;
  length = length || buff.length - offset;

  if (length === 4) {
    const parts = [];
    for (let i = 0; i < length; i++) parts.push(buff[offset + i]);
    return parts.join('.');
  }

  if (length === 16) {
    const groups = [];
    for (let i = 0; i < length; i += 2) groups.push(buff.readUInt16BE(offset + i).toString(16));
    return groups
      .join(':')
      .replace(/(^|:)0(:0)*:0(:|$)/, '$1::$3')
      .replace(/:{3,4}/, '::');
  }

  throw new Error('Unsupported IP buffer length');
}

module.exports = { toString };
