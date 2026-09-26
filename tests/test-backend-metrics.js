const service = require('../metrics-service');

async function testBackend() {
  console.log('--- 1. Testing getMetricsOverview() ---');
  const overview = await service.getMetricsOverview();
  console.log('Active Cutoff:', overview.cutoff.display);
  console.log('Total Investors in DB:', overview.investors.totalInDatabase);
  console.log('Eligible Investors (> cutoff):', overview.investors.eligibleCount);
  console.log('Excluded Pre-Cutoff (<= cutoff):', overview.investors.excludedPreCutoffCount);
  console.log('Eligible Voted Count:', overview.investors.votedCount);
  console.log('Participation %:', overview.investors.participationPct + '%');
  console.log('Total Active Votes:', overview.voting.totalActiveVotes);
  console.log('Interested:', overview.voting.interestedCount);
  console.log('Explore:', overview.voting.exploreCount);
  console.log('Not Interested:', overview.voting.notInterestedCount);
  console.log('Vote Changes Recorded:', overview.voting.totalVoteChanges);

  console.log('\n--- 2. Testing getStartupMetrics() ---');
  const startupsData = await service.getStartupMetrics();
  console.log('Startups returned:', startupsData.startups.length);
  if (startupsData.startups.length !== 13) {
    throw new Error(`Expected 13 startups, got ${startupsData.startups.length}`);
  }
  const s1 = startupsData.startups[0];
  console.log(`Startup #1: ${s1.startupName} (Booth ${s1.pitchNumber}) - Total Votes: ${s1.totalActiveVotes}, Voters list length: ${s1.voters.length}`);
  if (s1.voters.length > 0) {
    const v1 = s1.voters[0];
    console.log(`Sample voter on Startup #1: ${v1.investorName} (${v1.investorEmail}) -> ${v1.voteSelection} at ${v1.voteTimestampFormatted} (Duration: ${v1.durationSignupToVoteFormatted})`);
  }

  console.log('\n--- 3. Testing getStartupMetrics single startup drilldown ---');
  const sSingle = await service.getStartupMetrics('s07');
  console.log(`Single startup result: ${sSingle.startupName}, Voters count: ${sSingle.voters.length}`);

  console.log('\n--- 4. Testing getInvestorMetrics() ---');
  const investorsData = await service.getInvestorMetrics();
  console.log('Eligible investors count:', investorsData.investors.length);
  if (investorsData.investors.length !== 57) {
    throw new Error(`Expected 57 eligible investors, got ${investorsData.investors.length}`);
  }
  const inv1 = investorsData.investors[0];
  console.log(`Top active investor: ${inv1.name} (${inv1.email}) - Voted: ${inv1.startupsVotedCount}/13, Evaluations count: ${inv1.evaluations.length}`);

  console.log('\n--- 5. Testing getActivityStream() ---');
  const activity = await service.getActivityStream();
  console.log('Activity events count:', activity.events.length);
  if (activity.events.length > 0) {
    console.log(`Latest event: [${activity.events[0].timeFormattedIST}] ${activity.events[0].detail}`);
  }

  console.log('\n--- 6. Testing generateCsvExport() ---');
  const csvVotes = await service.generateCsvExport('startup-votes');
  console.log('Startup votes CSV length:', csvVotes.data.length, 'filename:', csvVotes.filename);
  console.log('Startup votes CSV sample row 1-3:\n' + csvVotes.data.split('\r\n').slice(0, 3).join('\n'));

  const csvInv = await service.generateCsvExport('investor-activity');
  console.log('Investor activity CSV length:', csvInv.data.length, 'filename:', csvInv.filename);
  console.log('Investor activity CSV sample row 1-3:\n' + csvInv.data.split('\r\n').slice(0, 3).join('\n'));

  console.log('\n--- 7. Testing Cutoff Edge Cases ---');
  const mockInvestors = [
    { investor_key: 'i1', full_name: 'Before', email: 'b@test.com', joined_at: '2026-09-26T10:24:59.000Z' }, // 3:54:59 PM IST
    { investor_key: 'i2', full_name: 'Exact', email: 'e@test.com', joined_at: '2026-09-26T10:25:00.000Z' },  // 3:55:00 PM IST
    { investor_key: 'i3', full_name: 'After', email: 'a@test.com', joined_at: '2026-09-26T10:25:01.000Z' }   // 3:55:01 PM IST
  ];
  const eligibilityTest = service.getEligibleInvestors(mockInvestors, '2026-09-26T15:55:00+05:30');
  console.log('Mock eligibility test:');
  console.log('- User at 3:54:59 PM IST is eligible?', eligibilityTest.eligibleInvestors.some(i => i.investor_key === 'i1') ? 'YES' : 'NO (Correct, excluded)');
  console.log('- User at 3:55:00 PM IST is eligible?', eligibilityTest.eligibleInvestors.some(i => i.investor_key === 'i2') ? 'YES' : 'NO (Correct, excluded)');
  console.log('- User at 3:55:01 PM IST is eligible?', eligibilityTest.eligibleInvestors.some(i => i.investor_key === 'i3') ? 'YES (Correct, included)' : 'NO');

  if (eligibilityTest.eligibleInvestors.length !== 1 || eligibilityTest.eligibleInvestors[0].investor_key !== 'i3') {
    throw new Error('Eligibility boundary check failed!');
  }

  console.log('\n🎉 ALL BACKEND METRICS SERVICE CHECKS PASSED WITH 100% ACCURACY!');
}

testBackend().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
