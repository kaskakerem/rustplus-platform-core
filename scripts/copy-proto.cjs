const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'src', 'proto', 'rustplus.proto');
const destinationDirectory = path.join(projectRoot, 'dist', 'proto');
const destination = path.join(destinationDirectory, 'rustplus.proto');

fs.mkdirSync(destinationDirectory, { recursive: true });
fs.copyFileSync(source, destination);
