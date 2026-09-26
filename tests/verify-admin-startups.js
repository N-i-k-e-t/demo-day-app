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
  { n: 1, name: 'Shraddha Farms', subSector: 'Dairy', hasTagline: false },
  { n: 2, name: 'Mecco', subSector: 'Farm Mechanisation', hasTagline: false },
  { n: 3, name: 'Kumbhargaon Agro', subSector: 'FPO', hasTagline: false },
  { n: 4, name: 'Neoperk', subSector: 'Soil & Precision Agriculture', hasTagline: false },
  { n: 5, name: 'WhatsLoan', subSector: 'Agri-Fintech', hasTagline: true },
  { n: 6, name: 'GAON NASP', subSector: 'Rural Operating System', hasTagline: false },
  { n: 7, name: 'EarthSaathi', subSector: 'Clean Energy - Climate Tech', hasTagline: false },
  { n: 8, name: 'Deccan Pack', subSector: 'Packaging', hasTagline: false },
  { n: 9, name: 'Poshaqq', subSector: 'Food Processing', hasTagline: true },
  { n: 10, name: 'NxtQube', subSector: 'Agentic Drones', hasTagline: false },
  { n: 11, name: 'SP Agro', subSector: 'Farm Mechanisation', hasTagline: false },
  { n: 12, name: 'Borse Automotive', subSector: 'Agri Robotics', hasTagline: false }
];

let allMatch = true;
expectedOrder.forEach((exp, i) => {
  const actual = startups[i];
  if (!actual || actual.name !== exp.name || actual.subSector !== exp.subSector) {
    console.error('Mismatch at #' + (i + 1) + ': expected ' + exp.name + ' (' + exp.subSector + '), got ' + (actual ? actual.name + ' (' + actual.subSector + ')' : 'undefined'));
    allMatch = false;
  } else {
    const taglineStatus = exp.hasTagline ? (actual.tagline ? '✓ Has Tagline' : '✗ Missing Tagline') : (!actual.tagline ? '✓ No Tagline' : '✗ Unexpected Tagline');
    console.log('  Booth ' + (i + 1) + ': ' + actual.name + ' [' + actual.subSector + '] - ' + taglineStatus);
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

// 3. Verify stage & capital removed from renderStartupHeroCard
const heroCardMatch = content.match(/function renderStartupHeroCard\(s\) \{([\s\S]*?)\}\s*function renderDetailScreen/);
if (heroCardMatch) {
  const heroCardCode = heroCardMatch[1];
  if (heroCardCode.includes('s.stage') || heroCardCode.includes('s.capital')) {
    console.error('FAIL: Growth stage or capital still present in renderStartupHeroCard!');
    process.exit(1);
  }
  console.log('✓ Growth stage and capital cleanly removed from startup profile card');

  if (!heroCardCode.includes('s.tagline ?')) {
    console.error('FAIL: Tagline should be conditionally rendered only when present!');
    process.exit(1);
  }
  console.log('✓ Tagline is conditionally rendered (only when present)');
}

// 4. Verify Not my area of interest tooltip in Roster
if (!content.includes('Not my area of interest (👎)')) {
  console.error('FAIL: Tooltip not updated to Not my area of interest');
  process.exit(1);
}
console.log('✓ Tooltip in Admin Roster is updated to Not my area of interest (👎)');

// 5. Verify emojis removed from response buttons
if (content.includes('<span class="response-icon">👍</span>') || content.includes('<span class="response-icon">👎</span>')) {
  console.error('FAIL: Emojis still present in response-btn!');
  process.exit(1);
}
console.log('✓ Emojis cleanly removed from startup profile response buttons');

// 6. Verify responseIcon returns empty string (no emojis in pills/modals)
if (!content.includes('function responseIcon(value) {\n    return \'\';\n  }')) {
  console.error('FAIL: responseIcon should return empty string');
  process.exit(1);
}
console.log('✓ responseIcon returns empty string (no emojis in pills or confirm boxes)');

console.log('\n🎉 ALL ADMIN & STARTUP PROFILE CHECKS PASSED PERFECTLY!');
