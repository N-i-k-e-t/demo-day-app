const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. Verify app.js syntax
const appJsPath = path.join(root, 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');
try {
  new Function(appJsContent);
  console.log('✓ app.js syntax OK');
} catch (err) {
  console.error('✗ app.js syntax error:', err);
  process.exit(1);
}

// 2. Verify critical files
const requiredFiles = [
  'index.html',
  'styles.css',
  'schema.sql',
  'realtime-contract.json'
];

requiredFiles.forEach(file => {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) {
    console.error(`✗ Missing required file: ${file}`);
    process.exit(1);
  }
  console.log(`✓ ${file} exists`);
});

// 3. Verify assets/ui-reference directory
const assetDir = path.join(root, 'assets', 'ui-reference');
if (!fs.existsSync(assetDir) || !fs.statSync(assetDir).isDirectory()) {
  console.error('✗ Missing assets/ui-reference directory');
  process.exit(1);
}
console.log('✓ assets/ui-reference directory exists');

console.log('\nAll smoke tests passed successfully!');
