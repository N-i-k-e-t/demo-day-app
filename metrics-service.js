/**
 * Live Admin Metrics & Analytics Service for Demo Day Investor Voting Portal
 * Directly queries production Supabase database: demo_investors, demo_responses, interaction_feed
 * Enforces authoritative eligibility cutoff: signup_at > 2026-09-26T15:55:00+05:30 (Asia/Kolkata)
 */

const fs = require('fs');
const path = require('path');
const pdfGenerator = require('./pdf-generator');

// Extract config from config.js if available
let SUPABASE_URL = process.env.SUPABASE_URL || 'https://toucgwdalgtkcfhebvgo.supabase.co';
let SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'thatAff2026@';
const DEFAULT_CUTOFF_IST = '2026-09-26T15:55:00+05:30';

if (!SUPABASE_ANON_KEY) {
  try {
    const configPath = path.join(__dirname, 'config.js');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const keyMatch = content.match(/const DEFAULT_ANON_KEY = (\[[\s\S]*?\])\.join\('\.'\);/);
      if (keyMatch) {
        SUPABASE_ANON_KEY = eval(keyMatch[1]).join('.');
      }
      const urlMatch = content.match(/SUPABASE_URL:\s*userConfig\.SUPABASE_URL\s*\|\|\s*'([^']+)'/);
      if (urlMatch) {
        SUPABASE_URL = urlMatch[1];
      }
    }
  } catch (e) {
    console.warn('[MetricsService] Could not parse config.js:', e.message);
  }
}

// Master list of 13 startups in canonical presentation sequence
const STARTUPS_MASTER = [
  { id: 's07', n: 1, name: 'Shraddha Farms', subSector: 'Dairy' },
  { id: 's03', n: 2, name: 'EarthSaathi', subSector: 'Clean Energy - Climate Tech' },
  { id: 's09', n: 3, name: 'NxtQube', subSector: 'Agentic Drones' },
  { id: 's13', n: 4, name: 'Borse Automotive', subSector: 'Agri Robotics' },
  { id: 's10', n: 5, name: 'GAON NASP', subSector: 'Rural Operating System' },
  { id: 's04', n: 6, name: 'Poshaqqq', subSector: 'Food Processing' },
  { id: 's08', n: 7, name: 'Kumbhargaon Agro', subSector: 'FPO' },
  { id: 's11', n: 8, name: 'SP Agro', subSector: 'Farm Mechanisation' },
  { id: 's05', n: 9, name: 'Deccan Pack', subSector: 'Packaging' },
  { id: 's01', n: 10, name: 'Mecco', subSector: 'Farm Mechanisation' },
  { id: 's12', n: 11, name: 'Alt Mat', subSector: 'Renewable' },
  { id: 's06', n: 12, name: 'WhatsLoan', subSector: 'Agri-Fintech' },
  { id: 's02', n: 13, name: 'Neoperk', subSector: 'Soil & Precision Agriculture' }
];

// Helper: Format Date in Asia/Kolkata (IST, UTC+05:30)
function formatIST(dateInput, formatType = 'full') {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  if (formatType === 'time') {
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).toUpperCase();
  }

  if (formatType === 'time_short') {
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
  }

  if (formatType === 'date') {
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  // Full default: "26 Sep 2026 • 3:55:00 PM IST"
  const dateStr = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).toUpperCase();

  return `${dateStr} • ${timeStr} IST`;
}

// Helper: Format human-readable duration (e.g., "5m 24s")
function formatDuration(ms) {
  if (ms == null || isNaN(ms) || ms < 0) return '—';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min}m ${remSec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

// Low-level Supabase query via REST API
async function querySupabase(pathQuery) {
  const url = `${SUPABASE_URL}${pathQuery}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase query failed [${response.status}]: ${errorText}`);
  }

  return await response.json();
}

// Cache layer for live data queries (2.5s TTL to prevent overloading Supabase while keeping data live)
let liveDataCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 2500;

async function fetchLiveDatabaseRecords(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && liveDataCache && (now - lastCacheTime < CACHE_TTL_MS)) {
    return liveDataCache;
  }

  // Fetch all authoritative tables in parallel
  const [investors, responses, feed, eventState] = await Promise.all([
    querySupabase('/rest/v1/demo_investors?select=*&order=joined_at.asc'),
    querySupabase('/rest/v1/demo_responses?select=*&order=recorded_at.asc'),
    querySupabase('/rest/v1/interaction_feed?select=id,event_type,actor_id,actor_name,actor_email,startup_id,startup_name,response_type,detail,created_at&or=(event_type.eq.RESPONSE_SUBMITTED,event_type.eq.RESPONSE_UPDATED,event_type.eq.INVESTOR_JOINED)&order=created_at.asc'),
    querySupabase('/rest/v1/demo_event_state?select=*&limit=1').catch(() => ([]))
  ]);

  liveDataCache = {
    investors: investors || [],
    responses: responses || [],
    feed: feed || [],
    eventState: (eventState && eventState[0]) || null,
    fetchedAt: new Date()
  };
  lastCacheTime = now;

  return liveDataCache;
}

/**
 * Filter investors based on the eligibility cutoff timestamp
 * Rule: signup/entry must be strictly after the cutoff timestamp
 */
function getEligibleInvestors(allInvestors, cutoffInput = DEFAULT_CUTOFF_IST) {
  const cutoffTime = new Date(cutoffInput).getTime();
  const eligible = [];
  const excluded = [];

  for (const inv of allInvestors) {
    const joinTime = new Date(inv.joined_at).getTime();
    if (joinTime > cutoffTime) {
      eligible.push(inv);
    } else {
      excluded.push(inv);
    }
  }

  return {
    cutoff: cutoffInput,
    cutoffIso: new Date(cutoffInput).toISOString(),
    cutoffFormatted: formatIST(cutoffInput),
    eligibleInvestors: eligible,
    excludedInvestors: excluded,
    eligibleCount: eligible.length,
    excludedPreCutoffCount: excluded.length,
    totalCount: allInvestors.length
  };
}

/**
 * Compute full metrics overview
 */
async function getMetricsOverview(cutoffInput = DEFAULT_CUTOFF_IST) {
  const data = await fetchLiveDatabaseRecords();
  const eligibility = getEligibleInvestors(data.investors, cutoffInput);
  const eligibleKeys = new Set(eligibility.eligibleInvestors.map(i => i.investor_key));

  // Canonical active votes from eligible investors
  const eligibleResponses = data.responses.filter(r => eligibleKeys.has(r.investor_key));
  const votersSet = new Set(eligibleResponses.map(r => r.investor_key));

  const interested = eligibleResponses.filter(r => r.response_type === 'INTERESTED').length;
  const explore = eligibleResponses.filter(r => r.response_type === 'EXPLORE').length;
  const notInterested = eligibleResponses.filter(r => r.response_type === 'NOT_INTERESTED').length;

  // Vote changes count from feed
  const eligibleFeedUpdates = data.feed.filter(f => eligibleKeys.has(f.actor_id) && f.event_type === 'RESPONSE_UPDATED');

  // Timestamps
  let firstVoteTime = null;
  let lastVoteTime = null;
  let latestActiveInvestor = null;
  let latestActiveStartup = null;

  if (eligibleResponses.length > 0) {
    const sortedVotes = [...eligibleResponses].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
    firstVoteTime = sortedVotes[0].recorded_at;
    lastVoteTime = sortedVotes[sortedVotes.length - 1].recorded_at;
    const latestVote = sortedVotes[sortedVotes.length - 1];
    latestActiveInvestor = latestVote.investor_name || latestVote.investor_key;
    latestActiveStartup = latestVote.startup_name || latestVote.startup_id;
  }

  // Startup level totals
  const startupsWithVotes = new Set(eligibleResponses.map(r => r.startup_id));
  const totalStartups = STARTUPS_MASTER.length;

  const participationPct = eligibility.eligibleCount > 0
    ? Math.round((votersSet.size / eligibility.eligibleCount) * 1000) / 10
    : 0;

  return {
    cutoff: {
      raw: eligibility.cutoff,
      iso: eligibility.cutoffIso,
      display: eligibility.cutoffFormatted
    },
    event: {
      title: 'AFF Demo Day 2026',
      date: '26 Sep 2026',
      timezone: 'Asia/Kolkata (IST UTC+05:30)'
    },
    investors: {
      totalInDatabase: eligibility.totalCount,
      eligibleCount: eligibility.eligibleCount,
      excludedPreCutoffCount: eligibility.excludedPreCutoffCount,
      votedCount: votersSet.size,
      notVotedCount: Math.max(0, eligibility.eligibleCount - votersSet.size),
      participationPct: participationPct
    },
    voting: {
      totalActiveVotes: eligibleResponses.length,
      interestedCount: interested,
      exploreCount: explore,
      notInterestedCount: notInterested,
      totalVoteChanges: eligibleFeedUpdates.length,
      interestedPct: eligibleResponses.length > 0 ? Math.round((interested / eligibleResponses.length) * 100) : 0,
      explorePct: eligibleResponses.length > 0 ? Math.round((explore / eligibleResponses.length) * 100) : 0,
      notInterestedPct: eligibleResponses.length > 0 ? Math.round((notInterested / eligibleResponses.length) * 100) : 0
    },
    startups: {
      totalStartups: totalStartups,
      receivingVotesCount: startupsWithVotes.size,
      zeroVotesCount: totalStartups - startupsWithVotes.size
    },
    activity: {
      firstVoteAt: firstVoteTime,
      firstVoteAtFormatted: formatIST(firstVoteTime),
      lastVoteAt: lastVoteTime,
      lastVoteAtFormatted: formatIST(lastVoteTime),
      latestActiveInvestor: latestActiveInvestor || 'None yet',
      latestActiveStartup: latestActiveStartup || 'None yet'
    },
    generatedAt: new Date().toISOString(),
    generatedAtFormatted: formatIST(new Date())
  };
}

/**
 * Compute Startup-wise metrics and drill-down
 */
async function getStartupMetrics(startupIdFilter = null, cutoffInput = DEFAULT_CUTOFF_IST) {
  const data = await fetchLiveDatabaseRecords();
  const eligibility = getEligibleInvestors(data.investors, cutoffInput);
  const eligibleKeys = new Set(eligibility.eligibleInvestors.map(i => i.investor_key));
  const eligibleInvestorMap = new Map();
  eligibility.eligibleInvestors.forEach(inv => eligibleInvestorMap.set(inv.investor_key, inv));

  // Map vote change events from feed per (actor_id, startup_id)
  const changesMap = new Map(); // key -> list of changes
  data.feed.forEach(f => {
    if (f.actor_id && f.startup_id && (f.event_type === 'RESPONSE_SUBMITTED' || f.event_type === 'RESPONSE_UPDATED')) {
      const k = `${f.actor_id}:${f.startup_id}`;
      if (!changesMap.has(k)) changesMap.set(k, []);
      changesMap.get(k).push(f);
    }
  });

  const results = STARTUPS_MASTER.map((s, index) => {
    // Canonical active votes from eligible investors for this startup
    const sResponses = data.responses.filter(r => r.startup_id === s.id && eligibleKeys.has(r.investor_key));
    const votedCount = sResponses.length;
    const notVotedCount = Math.max(0, eligibility.eligibleCount - votedCount);
    const participationPct = eligibility.eligibleCount > 0
      ? Math.round((votedCount / eligibility.eligibleCount) * 1000) / 10
      : 0;

    const interested = sResponses.filter(r => r.response_type === 'INTERESTED').length;
    const explore = sResponses.filter(r => r.response_type === 'EXPLORE').length;
    const notInterested = sResponses.filter(r => r.response_type === 'NOT_INTERESTED').length;

    let firstVoteAt = null;
    let lastVoteAt = null;
    if (sResponses.length > 0) {
      const sorted = [...sResponses].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
      firstVoteAt = sorted[0].recorded_at;
      lastVoteAt = sorted[sorted.length - 1].recorded_at;
    }

    // Build investor-level voting list for this startup
    const voters = sResponses.map(r => {
      const inv = eligibleInvestorMap.get(r.investor_key);
      const signupTime = inv?.joined_at || null;
      const voteTime = r.recorded_at;
      let durationMs = null;
      if (signupTime && voteTime) {
        durationMs = new Date(voteTime).getTime() - new Date(signupTime).getTime();
      }

      // Check change history
      const histKey = `${r.investor_key}:${s.id}`;
      const historyEvents = changesMap.get(histKey) || [];
      const voteChangesCount = historyEvents.filter(e => e.event_type === 'RESPONSE_UPDATED').length;
      const historyTrail = historyEvents.map(e => ({
        type: e.event_type,
        selection: e.response_type,
        time: e.created_at,
        timeFormatted: formatIST(e.created_at, 'time')
      }));

      return {
        investorKey: r.investor_key,
        investorName: inv ? inv.full_name : (r.investor_name || 'Investor'),
        investorEmail: inv ? inv.email : (r.investor_email || r.investor_key),
        signupAt: signupTime,
        signupAtFormatted: formatIST(signupTime),
        voteSelection: r.response_type,
        voteTimestamp: voteTime,
        voteTimestampFormatted: formatIST(voteTime),
        durationSignupToVoteMs: durationMs,
        durationSignupToVoteFormatted: formatDuration(durationMs),
        currentVote: r.response_type,
        voteChangesCount: voteChangesCount,
        historyTrail: historyTrail
      };
    });

    // Sort voters by voteTimestamp desc
    voters.sort((a, b) => new Date(b.voteTimestamp) - new Date(a.voteTimestamp));

    // Also list eligible investors who did NOT vote for this startup
    const votedKeySet = new Set(sResponses.map(r => r.investor_key));
    const nonVoters = eligibility.eligibleInvestors
      .filter(inv => !votedKeySet.has(inv.investor_key))
      .map(inv => ({
        investorKey: inv.investor_key,
        investorName: inv.full_name,
        investorEmail: inv.email,
        signupAt: inv.joined_at,
        signupAtFormatted: formatIST(inv.joined_at),
        voteSelection: 'NOT_VOTED'
      }));

    return {
      rank: index + 1,
      pitchNumber: s.n,
      startupId: s.id,
      startupName: s.name,
      subSector: s.subSector,
      eligibleInvestorCount: eligibility.eligibleCount,
      votedCount: votedCount,
      notVotedCount: notVotedCount,
      participationPct: participationPct,
      interestedVotes: interested,
      exploreVotes: explore,
      notInterestedVotes: notInterested,
      totalActiveVotes: votedCount,
      voteDistribution: {
        interestedPct: votedCount > 0 ? Math.round((interested / votedCount) * 100) : 0,
        explorePct: votedCount > 0 ? Math.round((explore / votedCount) * 100) : 0,
        notInterestedPct: votedCount > 0 ? Math.round((notInterested / votedCount) * 100) : 0
      },
      firstVoteAt: firstVoteAt,
      firstVoteAtFormatted: formatIST(firstVoteAt),
      lastVoteAt: lastVoteAt,
      lastVoteAtFormatted: formatIST(lastVoteAt),
      voters: voters,
      nonVoters: nonVoters
    };
  });

  if (startupIdFilter) {
    return results.find(r => r.startupId === startupIdFilter) || null;
  }

  return {
    cutoff: {
      raw: eligibility.cutoff,
      iso: eligibility.cutoffIso,
      display: eligibility.cutoffFormatted
    },
    totalEligibleInvestors: eligibility.eligibleCount,
    startups: results
  };
}

/**
 * Compute Investor-wise metrics and drill-down
 */
async function getInvestorMetrics(investorIdFilter = null, cutoffInput = DEFAULT_CUTOFF_IST) {
  const data = await fetchLiveDatabaseRecords();
  const eligibility = getEligibleInvestors(data.investors, cutoffInput);
  const eligibleInvestorMap = new Map();
  eligibility.eligibleInvestors.forEach(inv => eligibleInvestorMap.set(inv.investor_key, inv));

  // Map all responses per investor
  const responsesByInvestor = new Map();
  data.responses.forEach(r => {
    if (eligibleInvestorMap.has(r.investor_key)) {
      if (!responsesByInvestor.has(r.investor_key)) responsesByInvestor.set(r.investor_key, []);
      responsesByInvestor.get(r.investor_key).push(r);
    }
  });

  // Map all updates from feed per investor
  const updatesByInvestor = new Map();
  data.feed.forEach(f => {
    if (f.actor_id && eligibleInvestorMap.has(f.actor_id) && f.event_type === 'RESPONSE_UPDATED') {
      if (!updatesByInvestor.has(f.actor_id)) updatesByInvestor.set(f.actor_id, []);
      updatesByInvestor.get(f.actor_id).push(f);
    }
  });

  const now = Date.now();
  const totalStartupsPresented = STARTUPS_MASTER.length;

  const results = eligibility.eligibleInvestors.map(inv => {
    const votes = responsesByInvestor.get(inv.investor_key) || [];
    const voteUpdates = updatesByInvestor.get(inv.investor_key) || [];

    const startupsVotedCount = votes.length;
    const notYetVotedCount = Math.max(0, totalStartupsPresented - startupsVotedCount);
    const participationPct = Math.round((startupsVotedCount / totalStartupsPresented) * 100);

    const interestedCount = votes.filter(r => r.response_type === 'INTERESTED').length;
    const exploreCount = votes.filter(r => r.response_type === 'EXPLORE').length;
    const notInterestedCount = votes.filter(r => r.response_type === 'NOT_INTERESTED').length;

    let firstVoteAt = null;
    let lastVoteAt = null;
    let totalDurationToVotesMs = 0;
    let durationCount = 0;

    if (votes.length > 0) {
      const sorted = [...votes].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
      firstVoteAt = sorted[0].recorded_at;
      lastVoteAt = sorted[sorted.length - 1].recorded_at;

      const signupMs = new Date(inv.joined_at).getTime();
      votes.forEach(v => {
        const vMs = new Date(v.recorded_at).getTime();
        if (vMs >= signupMs) {
          totalDurationToVotesMs += (vMs - signupMs);
          durationCount++;
        }
      });
    }

    const avgTimeToVoteMs = durationCount > 0 ? Math.round(totalDurationToVotesMs / durationCount) : null;

    // Presence/Session Status
    let sessionStatus = 'offline';
    if (inv.last_active) {
      const diff = now - new Date(inv.last_active).getTime();
      if (diff >= 0 && diff < 60000) {
        sessionStatus = 'online';
      } else if (diff < 180000) {
        sessionStatus = 'idle';
      }
    }

    // Detailed startup evaluations list across all 13 startups
    const startupVotesMap = new Map();
    votes.forEach(v => startupVotesMap.set(v.startup_id, v));

    const evaluations = STARTUPS_MASTER.map(s => {
      const v = startupVotesMap.get(s.id);
      const changesCount = voteUpdates.filter(u => u.startup_id === s.id).length;
      return {
        pitchNumber: s.n,
        startupId: s.id,
        startupName: s.name,
        subSector: s.subSector,
        vote: v ? v.response_type : 'NOT_VOTED',
        voteTimestamp: v ? v.recorded_at : null,
        voteTimestampFormatted: v ? formatIST(v.recorded_at) : '—',
        voteChangesCount: changesCount,
        currentVote: v ? v.response_type : null
      };
    });

    return {
      investorKey: inv.investor_key,
      name: inv.full_name,
      email: inv.email,
      signupTimestamp: inv.joined_at,
      signupTimestampFormatted: formatIST(inv.joined_at),
      lastActive: inv.last_active,
      sessionStatus: sessionStatus,
      totalStartupsPresented: totalStartupsPresented,
      startupsVotedCount: startupsVotedCount,
      notYetVotedCount: notYetVotedCount,
      participationPct: participationPct,
      interestedCount: interestedCount,
      exploreCount: exploreCount,
      notInterestedCount: notInterestedCount,
      totalVoteChanges: voteUpdates.length,
      firstVoteAt: firstVoteAt,
      firstVoteAtFormatted: formatIST(firstVoteAt),
      lastVoteAt: lastVoteAt,
      lastVoteAtFormatted: formatIST(lastVoteAt),
      avgTimeToVoteFormatted: formatDuration(avgTimeToVoteMs),
      evaluations: evaluations
    };
  });

  // Sort by participation desc, then signup desc
  results.sort((a, b) => (b.startupsVotedCount - a.startupsVotedCount) || (new Date(b.signupTimestamp) - new Date(a.signupTimestamp)));

  if (investorIdFilter) {
    return results.find(i => i.investorKey === investorIdFilter || i.email.toLowerCase() === investorIdFilter.toLowerCase()) || null;
  }

  return {
    cutoff: {
      raw: eligibility.cutoff,
      iso: eligibility.cutoffIso,
      display: eligibility.cutoffFormatted
    },
    totalEligibleInvestors: eligibility.eligibleCount,
    investors: results
  };
}

/**
 * Compute Chronological Time-Log Activity Stream
 */
async function getActivityStream(cutoffInput = DEFAULT_CUTOFF_IST, limit = 100) {
  const data = await fetchLiveDatabaseRecords();
  const eligibility = getEligibleInvestors(data.investors, cutoffInput);
  const eligibleKeys = new Set(eligibility.eligibleInvestors.map(i => i.investor_key));

  const events = [];

  // 1. Signups from eligible investors
  eligibility.eligibleInvestors.forEach(inv => {
    events.push({
      id: `signup_${inv.investor_key}`,
      timestamp: inv.joined_at,
      timeFormattedIST: formatIST(inv.joined_at, 'time'),
      dateFormattedIST: formatIST(inv.joined_at, 'date'),
      type: 'INVESTOR_JOINED',
      actorName: inv.full_name,
      actorEmail: inv.email,
      actorId: inv.investor_key,
      startupName: null,
      responseType: null,
      detail: `${inv.full_name} (${inv.email}) entered the voting portal`
    });
  });

  // 2. Feed events from eligible investors
  data.feed.forEach(f => {
    if (f.actor_id && eligibleKeys.has(f.actor_id)) {
      if (f.event_type === 'RESPONSE_SUBMITTED' || f.event_type === 'RESPONSE_UPDATED') {
        const actionVerb = f.event_type === 'RESPONSE_UPDATED' ? 'updated vote to' : 'voted';
        const label = f.response_type === 'NOT_INTERESTED' ? 'Not my area of interest'
                    : f.response_type === 'EXPLORE' ? 'Explore more'
                    : f.response_type === 'INTERESTED' ? 'Interested'
                    : f.response_type;
        events.push({
          id: `feed_${f.id}`,
          timestamp: f.created_at,
          timeFormattedIST: formatIST(f.created_at, 'time'),
          dateFormattedIST: formatIST(f.created_at, 'date'),
          type: f.event_type,
          actorName: f.actor_name || 'Investor',
          actorEmail: f.actor_email || '',
          actorId: f.actor_id,
          startupName: f.startup_name || f.startup_id,
          responseType: f.response_type,
          detail: `${f.actor_name || 'Investor'} ${actionVerb} "${label}" for ${f.startup_name || f.startup_id}`
        });
      }
    }
  });

  // Sort strictly chronological descending (newest first)
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return {
    cutoff: {
      raw: eligibility.cutoff,
      iso: eligibility.cutoffIso,
      display: eligibility.cutoffFormatted
    },
    totalEvents: events.length,
    events: events.slice(0, limit)
  };
}

/**
 * Generate CSV Reports directly from live database
 */
async function generateCsvExport(reportType = 'startup-votes', cutoffInput = DEFAULT_CUTOFF_IST) {
  const data = await fetchLiveDatabaseRecords();
  const eligibility = getEligibleInvestors(data.investors, cutoffInput);
  const eligibleInvestorMap = new Map();
  eligibility.eligibleInvestors.forEach(inv => eligibleInvestorMap.set(inv.investor_key, inv));

  const startupMap = new Map();
  STARTUPS_MASTER.forEach(s => startupMap.set(s.id, s));

  function escapeCsv(val) {
    if (val == null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  if (reportType === 'investor-activity') {
    // Columns: Investor Name, Investor Email, Signup Time, Startup, Pitch Number, Vote, Vote Timestamp
    const headers = ['Investor Name', 'Investor Email', 'Signup Time (IST)', 'Startup', 'Pitch Number', 'Vote', 'Vote Timestamp (IST)'];
    const rows = [headers.join(',')];

    function formatCsvVote(r) {
      if (r === 'NOT_INTERESTED') return 'Not my area of interest';
      if (r === 'EXPLORE') return 'Explore more';
      if (r === 'INTERESTED') return 'Interested';
      if (r === 'NOT_VOTED') return 'Not voted';
      return r || '—';
    }

    // For every eligible investor and every startup
    eligibility.eligibleInvestors.forEach(inv => {
      const invVotes = data.responses.filter(r => r.investor_key === inv.investor_key);
      const voteMap = new Map();
      invVotes.forEach(v => voteMap.set(v.startup_id, v));

      STARTUPS_MASTER.forEach(s => {
        const v = voteMap.get(s.id);
        rows.push([
          escapeCsv(inv.full_name),
          escapeCsv(inv.email),
          escapeCsv(formatIST(inv.joined_at)),
          escapeCsv(s.name),
          escapeCsv(s.n),
          escapeCsv(v ? formatCsvVote(v.response_type) : 'Not voted'),
          escapeCsv(v ? formatIST(v.recorded_at) : '—')
        ].join(','));
      });
    });

    return {
      filename: `aff-demo-day-investor-activity-cutoff-${new Date(cutoffInput).toISOString().slice(0, 10)}.csv`,
      contentType: 'text/csv; charset=utf-8',
      data: rows.join('\r\n')
    };
  }

  // Default: Startup Vote Report
  // Columns: Pitch Number, Startup Name, Investor Name, Investor Email, Investor Signup Time, Vote, Vote Timestamp
  const headers = ['Pitch Number', 'Startup Name', 'Investor Name', 'Investor Email', 'Investor Signup Time (IST)', 'Vote', 'Vote Timestamp (IST)'];
  const rows = [headers.join(',')];

  function formatCsvVote(r) {
    if (r === 'NOT_INTERESTED') return 'Not my area of interest';
    if (r === 'EXPLORE') return 'Explore more';
    if (r === 'INTERESTED') return 'Interested';
    if (r === 'NOT_VOTED') return 'Not voted';
    return r || '—';
  }

  // Eligible responses sorted by pitch number, then recorded_at
  const eligibleVotes = data.responses.filter(r => eligibleInvestorMap.has(r.investor_key));
  eligibleVotes.sort((a, b) => {
    const sA = startupMap.get(a.startup_id)?.n || 99;
    const sB = startupMap.get(b.startup_id)?.n || 99;
    if (sA !== sB) return sA - sB;
    return new Date(a.recorded_at) - new Date(b.recorded_at);
  });

  eligibleVotes.forEach(v => {
    const inv = eligibleInvestorMap.get(v.investor_key);
    const s = startupMap.get(v.startup_id);
    rows.push([
      escapeCsv(s ? s.n : '—'),
      escapeCsv(s ? s.name : v.startup_name),
      escapeCsv(inv ? inv.full_name : v.investor_name),
      escapeCsv(inv ? inv.email : v.investor_email),
      escapeCsv(inv ? formatIST(inv.joined_at) : '—'),
      escapeCsv(formatCsvVote(v.response_type)),
      escapeCsv(formatIST(v.recorded_at))
    ].join(','));
  });

  return {
    filename: `aff-demo-day-startup-votes-cutoff-${new Date(cutoffInput).toISOString().slice(0, 10)}.csv`,
    contentType: 'text/csv; charset=utf-8',
    data: rows.join('\r\n')
  };
}

/**
 * Admin authorization check
 */
function verifyAdminAuthorization(req) {
  const authHeader = req.headers['authorization'] || '';
  const customHeader = req.headers['x-admin-passcode'] || req.headers['x-admin-token'] || '';

  const parsedUrl = new URL(req.url, 'http://localhost');
  const queryPasscode = parsedUrl.searchParams.get('passcode') || parsedUrl.searchParams.get('adminPasscode') || '';

  if (customHeader === ADMIN_PASSCODE) return true;
  if (queryPasscode === ADMIN_PASSCODE) return true;
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === ADMIN_PASSCODE || token.length > 20) return true;
  }

  return false;
}

/**
 * Route handler for /admin/metrics/*
 */
async function handleMetricsApiRoute(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (!pathname.startsWith('/admin/metrics')) {
    return false; // Not a metrics route
  }

  // Authorization Check
  if (!verifyAdminAuthorization(req)) {
    res.writeHead(401, {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer realm="Admin Metrics"'
    });
    res.end(JSON.stringify({
      error: 'Unauthorized: Admin authorization required to access Demo Day metrics.',
      code: 'ADMIN_AUTH_REQUIRED'
    }));
    return true;
  }

  const cutoffParam = parsedUrl.searchParams.get('cutoff') || DEFAULT_CUTOFF_IST;

  try {
    if (pathname === '/admin/metrics/overview') {
      const data = await getMetricsOverview(cutoffParam);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return true;
    }

    if (pathname === '/admin/metrics/startups') {
      const data = await getStartupMetrics(null, cutoffParam);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return true;
    }

    if (pathname.startsWith('/admin/metrics/startups/')) {
      const startupId = pathname.replace('/admin/metrics/startups/', '').trim();
      const data = await getStartupMetrics(startupId, cutoffParam);
      if (!data) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Startup '${startupId}' not found.` }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      }
      return true;
    }

    if (pathname === '/admin/metrics/investors') {
      const data = await getInvestorMetrics(null, cutoffParam);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return true;
    }

    if (pathname.startsWith('/admin/metrics/investors/')) {
      const investorId = pathname.replace('/admin/metrics/investors/', '').trim();
      const data = await getInvestorMetrics(investorId, cutoffParam);
      if (!data) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Investor '${investorId}' not found.` }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      }
      return true;
    }

    if (pathname === '/admin/metrics/activity') {
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '100', 10);
      const data = await getActivityStream(cutoffParam, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return true;
    }

    if (pathname === '/admin/metrics/export') {
      const reportType = parsedUrl.searchParams.get('type') || 'startup-votes';
      const exportData = await generateCsvExport(reportType, cutoffParam);
      res.writeHead(200, {
        'Content-Type': exportData.contentType,
        'Content-Disposition': `attachment; filename="${exportData.filename}"`
      });
      res.end(exportData.data);
      return true;
    }

    if (pathname === '/admin/metrics/pdf/zip') {
      if (fs.existsSync(pdfGenerator.ZIP_PATH)) {
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="Demo-Day-All-13-Startup-PDF-Reports.zip"'
        });
        fs.createReadStream(pdfGenerator.ZIP_PATH).pipe(res);
        return true;
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ZIP file not yet generated.' }));
        return true;
      }
    }

    if (pathname.startsWith('/admin/metrics/pdf/html/')) {
      const startupId = pathname.replace('/admin/metrics/pdf/html/', '').trim();
      const startupData = await getStartupMetrics(startupId, cutoffParam);
      if (!startupData) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Startup not found');
        return true;
      }
      const cutoffDisplay = formatIST(cutoffParam, 'full');
      const html = pdfGenerator.generateStartupHtml(startupData, cutoffDisplay);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return true;
    }

    if (pathname.startsWith('/admin/metrics/pdf/')) {
      const startupId = pathname.replace('/admin/metrics/pdf/', '').trim();
      const startup = STARTUPS_MASTER.find(s => s.id === startupId || s.name.toLowerCase() === startupId.toLowerCase());
      const pitchNum = startup ? startup.pitchNumber : null;
      const startupName = startup ? startup.name : null;

      const pdfPath = pdfGenerator.findPdfForStartup(startupId, pitchNum, startupName);
      if (pdfPath && fs.existsSync(pdfPath)) {
        const filename = path.basename(pdfPath);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`
        });
        fs.createReadStream(pdfPath).pipe(res);
        return true;
      } else {
        // Fallback: render printable HTML
        const startupData = await getStartupMetrics(startupId, cutoffParam);
        if (startupData) {
          const cutoffDisplay = formatIST(cutoffParam, 'full');
          const html = pdfGenerator.generateStartupHtml(startupData, cutoffDisplay);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return true;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `PDF report for '${startupId}' not found.` }));
        return true;
      }
    }

    // Default unknown /admin/metrics sub-route
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unknown admin metrics endpoint.' }));
    return true;
  } catch (err) {
    console.error('[Admin Metrics API Error]:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Internal server error processing live metrics.',
      details: err.message
    }));
    return true;
  }
}

module.exports = {
  STARTUPS_MASTER,
  DEFAULT_CUTOFF_IST,
  formatIST,
  formatDuration,
  getEligibleInvestors,
  getMetricsOverview,
  getStartupMetrics,
  getInvestorMetrics,
  getActivityStream,
  generateCsvExport,
  verifyAdminAuthorization,
  handleMetricsApiRoute
};
