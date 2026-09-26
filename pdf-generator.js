/**
 * PDF Generator for Demo Day Startup Reports
 * Generates executive-grade vector PDF reports and printable HTML
 * using live database metrics from metrics-service.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUTPUT_DIR = path.join(__dirname, 'exports', 'pdf');
const HTML_TMP_DIR = path.join(__dirname, 'exports', 'tmp_html');
const ZIP_PATH = path.join(__dirname, 'exports', 'Demo-Day-All-13-Startup-PDF-Reports.zip');

function getBrowserBinary() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(edgePath)) return edgePath;
  if (fs.existsSync(chromePath)) return chromePath;
  return null;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateStartupHtml(startup, cutoffDisplay) {
  const voters = startup.voters || [];
  const nonVoters = startup.nonVoters || [];
  const dist = startup.voteDistribution || { interestedPct: 0, explorePct: 0, notInterestedPct: 0 };
  const nowIst = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }) + ' IST';

  const voterRows = voters.length === 0 
    ? `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">No votes recorded from eligible investors yet.</td></tr>`
    : voters.map((v, idx) => {
        const badgeColor = v.voteSelection === 'INTERESTED' ? '#059669' 
                         : v.voteSelection === 'EXPLORE' ? '#0284c7' 
                         : '#64748b';
        const badgeBg = v.voteSelection === 'INTERESTED' ? '#ecfdf5' 
                      : v.voteSelection === 'EXPLORE' ? '#f0f9ff' 
                      : '#f1f5f9';
        const badgeBorder = v.voteSelection === 'INTERESTED' ? '#a7f3d0' 
                          : v.voteSelection === 'EXPLORE' ? '#bae6fd' 
                          : '#cbd5e1';

        const historyNote = v.voteChangesCount > 0 
          ? `<span style="font-size: 10px; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; padding: 1px 5px; border-radius: 4px; margin-left: 4px;">Changed (${v.voteChangesCount}x)</span>`
          : '';

        return `
        <tr>
          <td style="color: #64748b; font-size: 11px; text-align: center;">${idx + 1}</td>
          <td>
            <div style="font-weight: 600; color: #0f172a; font-size: 12px;">${escapeHtml(v.investorName)}</div>
            <div style="font-size: 10px; color: #64748b;">${escapeHtml(v.investorKey || '')}</div>
          </td>
          <td style="color: #334155; font-size: 11px;">${escapeHtml(v.investorEmail)}</td>
          <td style="font-size: 11px; color: #475569;">${escapeHtml(v.signupAtFormatted)}</td>
          <td>
            <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
              ${escapeHtml(v.voteSelection)}
            </span>
            ${historyNote}
          </td>
          <td style="font-size: 11px; color: #0f172a; font-weight: 500;">${escapeHtml(v.voteTimestampFormatted || '—')}</td>
          <td style="font-size: 11px; color: #475569;">${escapeHtml(v.durationSignupToVoteFormatted || '—')}</td>
        </tr>`;
      }).join('\n');

  const nonVoterRows = nonVoters.length === 0
    ? `<tr><td colspan="4" style="text-align: center; color: #059669; padding: 16px; font-size: 11px;">100% participation! All eligible investors have cast their evaluation.</td></tr>`
    : nonVoters.map((nv, idx) => `
        <tr>
          <td style="color: #64748b; font-size: 11px; text-align: center;">${idx + 1}</td>
          <td style="font-weight: 600; color: #0f172a; font-size: 11px;">${escapeHtml(nv.investorName)}</td>
          <td style="color: #334155; font-size: 11px;">${escapeHtml(nv.investorEmail)}</td>
          <td style="font-size: 11px; color: #64748b;">${escapeHtml(nv.signupAtFormatted)}</td>
        </tr>
      `).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pitch #${startup.pitchNumber} — ${escapeHtml(startup.startupName)} Report</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 14mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .brand-sub {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #475569;
      line-height: 1.5;
    }
    .meta-box strong {
      color: #0f172a;
    }
    .hero-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .pitch-badge {
      display: inline-block;
      background: #0284c7;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .startup-name {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      margin: 0;
      line-height: 1.1;
    }
    .startup-sub {
      color: #94a3b8;
      font-size: 12px;
      margin-top: 4px;
    }
    .hero-stats {
      display: flex;
      gap: 20px;
      text-align: right;
    }
    .hero-stat-item .val {
      font-size: 24px;
      font-weight: 800;
      color: #38bdf8;
    }
    .hero-stat-item .lbl {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
    }
    .kpi-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-sub {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }
    .sentiment-bar-wrap {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .sentiment-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #334155;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
    }
    .bar-track {
      height: 12px;
      border-radius: 6px;
      background: #e2e8f0;
      display: flex;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .bar-segment-interested {
      background: #059669;
      height: 100%;
    }
    .bar-segment-explore {
      background: #0284c7;
      height: 100%;
    }
    .bar-segment-not-interested {
      background: #94a3b8;
      height: 100%;
    }
    .sentiment-legend {
      display: flex;
      gap: 16px;
      font-size: 11px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin: 16px 0 8px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      text-align: left;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 9px;
    }
    @media print {
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <!-- Top Header -->
  <div class="header">
    <div>
      <div class="brand-title">Demo Day Investor Evaluation OS</div>
      <div class="brand-sub">Official Startup Voting Analytics Report • Powered by Sprint Ecosystem</div>
    </div>
    <div class="meta-box">
      <div><strong>Eligibility Cutoff:</strong> ${escapeHtml(cutoffDisplay)}</div>
      <div><strong>Generated At:</strong> ${escapeHtml(nowIst)}</div>
      <div><strong>Data Source:</strong> Production Supabase DB (Live)</div>
    </div>
  </div>

  <!-- Startup Hero Box -->
  <div class="hero-banner">
    <div>
      <div class="pitch-badge">Pitch #${startup.pitchNumber} • Booth ${startup.pitchNumber}</div>
      <h1 class="startup-name">${escapeHtml(startup.startupName)}</h1>
      <div class="startup-sub">Sector: ${escapeHtml(startup.subSector || 'Agritech / Technology')} • ID: ${escapeHtml(startup.startupId)}</div>
    </div>
    <div class="hero-stats">
      <div class="hero-stat-item">
        <div class="val">${startup.totalActiveVotes}</div>
        <div class="lbl">Total Votes</div>
      </div>
      <div class="hero-stat-item">
        <div class="val" style="color: #34d399;">${startup.participationPct}%</div>
        <div class="lbl">Turnout</div>
      </div>
    </div>
  </div>

  <!-- Top KPIs -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Eligible Investors</div>
      <div class="kpi-value">${startup.eligibleInvestorCount}</div>
      <div class="kpi-sub">Signed up after 3:55 PM IST</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Voted / Turnout</div>
      <div class="kpi-value" style="color: #0284c7;">${startup.votedCount} <span style="font-size: 13px; font-weight: normal; color: #64748b;">(${startup.participationPct}%)</span></div>
      <div class="kpi-sub">${startup.notVotedCount} yet to vote</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Interested Votes</div>
      <div class="kpi-value" style="color: #059669;">${startup.interestedVotes} <span style="font-size: 13px; font-weight: normal; color: #64748b;">(${dist.interestedPct}%)</span></div>
      <div class="kpi-sub">High conviction backers</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Explore / Soft Backing</div>
      <div class="kpi-value" style="color: #0284c7;">${startup.exploreVotes} <span style="font-size: 13px; font-weight: normal; color: #64748b;">(${dist.explorePct}%)</span></div>
      <div class="kpi-sub">${startup.notInterestedVotes} Not Interested (${dist.notInterestedPct}%)</div>
    </div>
  </div>

  <!-- Sentiment Bar -->
  <div class="sentiment-bar-wrap">
    <div class="sentiment-title">
      <span>Investor Sentiment Breakdown</span>
      <span>${startup.totalActiveVotes} Total Active Responses</span>
    </div>
    <div class="bar-track">
      <div class="bar-segment-interested" style="width: ${dist.interestedPct}%;"></div>
      <div class="bar-segment-explore" style="width: ${dist.explorePct}%;"></div>
      <div class="bar-segment-not-interested" style="width: ${dist.notInterestedPct}%;"></div>
    </div>
    <div class="sentiment-legend">
      <div class="legend-item">
        <div class="legend-dot" style="background: #059669;"></div>
        <div><strong>Interested:</strong> ${startup.interestedVotes} (${dist.interestedPct}%)</div>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background: #0284c7;"></div>
        <div><strong>Explore:</strong> ${startup.exploreVotes} (${dist.explorePct}%)</div>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background: #94a3b8;"></div>
        <div><strong>Not Interested:</strong> ${startup.notInterestedVotes} (${dist.notInterestedPct}%)</div>
      </div>
      <div class="legend-item" style="margin-left: auto; color: #64748b;">
        First Vote: <strong>${escapeHtml(startup.firstVoteAtFormatted || '—')}</strong> • Last Vote: <strong>${escapeHtml(startup.lastVoteAtFormatted || '—')}</strong>
      </div>
    </div>
  </div>

  <!-- Investor-level Voting Roster -->
  <div class="section-title">
    <span>Investor-Level Voting Roster (${voters.length} Verified Votes)</span>
    <span style="font-size: 10px; color: #64748b; text-transform: none;">Sorted by vote timestamp</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 25px; text-align: center;">#</th>
        <th style="width: 170px;">Investor</th>
        <th>Email Address</th>
        <th style="width: 140px;">Signup Time (IST)</th>
        <th style="width: 120px;">Vote Selection</th>
        <th style="width: 140px;">Vote Time (IST)</th>
        <th style="width: 70px;">Duration</th>
      </tr>
    </thead>
    <tbody>
      ${voterRows}
    </tbody>
  </table>

  <!-- Eligible Investors Pending Vote -->
  ${nonVoters.length > 0 ? `
  <div class="section-title" style="margin-top: 20px;">
    <span>Eligible Investors Pending Vote (${nonVoters.length} Investors)</span>
    <span style="font-size: 10px; color: #64748b; text-transform: none;">Eligible voters who have not evaluated this pitch yet</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 25px; text-align: center;">#</th>
        <th style="width: 200px;">Investor Name</th>
        <th>Email Address</th>
        <th style="width: 180px;">Signup Time (IST)</th>
      </tr>
    </thead>
    <tbody>
      ${nonVoterRows}
    </tbody>
  </table>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    <div>CONFIDENTIAL • FOR DEMO DAY ORGANIZERS & FOUNDERS ONLY</div>
    <div>Demo Day Live Pitch OS • Production Verified</div>
  </div>

</body>
</html>`;
}

function findPdfForStartup(startupId, pitchNumber, startupName) {
  if (!fs.existsSync(OUTPUT_DIR)) return null;

  const files = fs.readdirSync(OUTPUT_DIR);
  const pitchPrefix = `Pitch-${String(pitchNumber).padStart(2, '0')}`;
  
  // Try matching by pitch prefix first
  const match = files.find(f => f.startsWith(pitchPrefix) && f.endsWith('.pdf'));
  if (match) {
    return path.join(OUTPUT_DIR, match);
  }

  // Try matching by slug
  const slug = (startupName || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const slugMatch = files.find(f => f.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(slug) && f.endsWith('.pdf'));
  if (slugMatch) {
    return path.join(OUTPUT_DIR, slugMatch);
  }

  return null;
}

module.exports = {
  OUTPUT_DIR,
  ZIP_PATH,
  getBrowserBinary,
  generateStartupHtml,
  findPdfForStartup
};
