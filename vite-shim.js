import util from 'node:util';
if (!util.styleText) {
  util.styleText = (style, text) => text;
}
// Now run vite
import('file:///' + process.cwd().replace(/\\/g, '/') + '/node_modules/vite/bin/vite.js');
