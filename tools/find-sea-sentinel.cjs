const { readFileSync } = require('fs');
const { resolve } = require('path');
const buf = readFileSync(resolve('C:\\Program Files\\nodejs\\node.exe'));
const idx = buf.indexOf('NODE_SEA_FUSE');
if (idx >= 0) {
    let end = idx;
    while (end < buf.length && buf[end] !== 0 && buf[end] !== 58) end++;
    const sentinel = buf.slice(idx, end).toString();
    console.log('SENTINEL=' + sentinel);
} else {
    console.log('SENTINEL=NOT_FOUND');
}
