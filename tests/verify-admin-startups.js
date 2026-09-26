const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');

// 1. Verify STARTUPS_MASTER
const masterMatch = content.match(/const STARTUPS_MASTER = (\[[\s\S]*?\]);\s*function loadStartupOrder/);
if (!masterMatch) {
  console.error('FAIL: Could not extract STARTUPS_MASTER');
  process.exit(1);
}

const startups = eval(masterMatch[1]);
console.log('✓ Extracted ' + startups.length + ' startups from STARTUPS_MASTER');

const expectedOrder = [
  { n: 1, name: 'Shraddha Farms', subSector: 'Dairy' },
  { n: 2, name: 'Mecco', subSector: 'Farm Mechanisation' },
  { n: 3, name: 'Kumbhargaon Agro', subSector: 'FPO' },
  { n: 4, name: 'Neoperk', subSector: 'Soil & Precision Agriculture' },
  { n: 5, name: 'WhatsLoan', subSector: 'Agri-Fintech' },
  { n: 6, name: 'GAON NASP', subSector: 'Rural Operating System' },
  { n: 7, name: 'EarthSaathi', subSector: 'Clean Energy - Climate Tech' },
  { n: 8, name: 'Deccan Pack', subSector: 'Packaging' },
  { n: 9, name: 'Poshaqq', subSector: 'Food Processing' },
  { n: 10, name: 'NxtQube', subSector: 'Agentic Drones' },
  { n: 11, name: 'SP Agro', subSector: 'Farm Mechanisation' },
  { n: 12, name: 'Borse Automotive', subSector: 'Agri Robotics' }
];

let allMatch = true;
expectedOrder.forEach((exp, i) => {
  const actual = startups[i];
  if (!actual || actual.name !== exp.name || actual.subSector !== exp.subSector) {
    console.error('Mismatch at #' + (i + 1) + ': expected ' + exp.name + ' (' + exp.subSector + '), got ' + (actual ? actual.name + ' (' + actual.subSector + ')' : 'undefined'));
    allMatch = false;
  } else {
    console.log('  Booth ' + (i + 1) + ': ' + actual.name + ' [' + actual.subSector + ']');
  }
});

if (!allMatch) {
  console.error('FAIL: Startup order or subsector mismatch!');
  process.exit(1);
}

// 2. Verify ORDER_STORAGE_KEY is v6
if (!content.includes("ORDER_STORAGE_KEY = 'startup-demo-order-v6'")) {
  console.error('FAIL: ORDER_STORAGE_KEY is not v6');
  process.exit(1);
}
console.log('✓ ORDER_STORAGE_KEY is bumped to v6 to invalidate any stale local order');

// 3. Verify subSector and stage rendering in Admin Completion Matrix
if (!content.includes('${s.subSector} • ${s.stage}')) {
  console.error('FAIL: SubSector not displayed in completion matrix');
  process.exit(1);
}
console.log('✓ Admin Completion Matrix displays subSector and stage');

// 4. Verify Not my area of interest tooltip in Roster
if (!content.includes('Not my area of interest (👎)')) {
  console.error('FAIL: Tooltip not updated to Not my area of interest');
  process.exit(1);
}
console.log('✓ Tooltip in Admin Roster is updated to Not my area of interest (👎)');

console.log('\n🎉 ALL ADMIN STARTUP LIST CHECKS PASSED PERFECTLY!');
