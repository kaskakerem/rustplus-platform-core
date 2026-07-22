const assert = require('node:assert/strict');
const path = require('node:path');

async function verifyDist() {
  const packageRoot = path.resolve(__dirname, '..');
  const sdk = require(packageRoot);

  assert.equal(typeof sdk.RustClient, 'function');
  assert.equal(typeof sdk.ProtoLoader, 'function');
  assert.equal(typeof sdk.Connection, 'function');

  const protoLoader = new sdk.ProtoLoader();
  await protoLoader.load();
  assert.equal(protoLoader.isLoaded(), true);

  process.stdout.write('dist package verification passed\n');
}

verifyDist().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
