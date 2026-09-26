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
  { n: 2, name: 'WhatsLoan', subSector: 'Agri-Fintech', hasTagline: true },
  { n: 3, name: 'EarthSaathi', subSector: 'Clean Energy - Climate Tech', hasTagline: false },
  { n: 4, name: 'NxtQube', subSector: 'Agentic Drones', hasTagline: false },
  { n: 5, name: 'Borse Automotive', subSector: 'Agri Robotics', hasTagline: false },
  { n: 6, name: 'Poshaqqq', subSector: 'Food Processing', hasTagline: true },
  { n: 7, name: 'Kumbhargaon Agro', subSector: 'FPO', hasTagline: false },
  { n: 8, name: 'SP Agro', subSector: 'Farm Mechanisation', hasTagline: false },
  { n: 9, name: 'Deccan Pack', subSector: 'Packaging', hasTagline: false },
  { n: 10, name: 'GAON NASP', subSector: 'Rural Operating System', hasTagline: false },
  { n: 11, name: 'Mecco', subSector: 'Farm Mechanisation', hasTagline: false },
  { n: 12, name: 'Alt Mat', subSector: 'Renewable', hasTagline: false },
  { n: 13, name: 'Neoperk', subSector: 'Soil & Precision Agriculture', hasTagline: false }
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

// 2. Verify ORDER_STORAGE_KEY is v9
if (!content.includes("ORDER_STORAGE_KEY = 'startup-demo-order-v9'")) {
  console.error('FAIL: ORDER_STORAGE_KEY is not v9');
  process.exit(1);
}
console.log('✓ ORDER_STORAGE_KEY is bumped to v9 to invalidate any stale local order');

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

// 7. Verify My Responses filter button label is Not my area of interest
if (!content.includes('Not my area of interest (${notInterestedList.length})')) {
  console.error('FAIL: My Responses filter button not updated to Not my area of interest (${notInterestedList.length})');
  process.exit(1);
}
console.log('✓ My Responses filter button is updated to Not my area of interest');

// 8. Verify styles.css does not restrict choice-pill with small max-width
const stylesCss = fs.readFileSync('styles.css', 'utf8');
if (stylesCss.includes('max-width:85px') || stylesCss.includes('max-width:95px')) {
  console.error('FAIL: styles.css still contains restrictive max-width (85px/95px) on choice-pill!');
  process.exit(1);
}
console.log('✓ styles.css choice-pill has no restrictive max-width overflow bottlenecks');

console.log('\n🎉 ALL ADMIN & STARTUP PROFILE CHECKS PASSED PERFECTLY!');
