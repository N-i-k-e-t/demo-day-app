/**
 * Live Admin Metrics & Analytics Module
 * Production-grade dashboard for Demo Day investor voting portal.
 * Direct database connectivity to Supabase, eligibility cutoff filtering,
 * startup-wise & investor-wise analytics, drilldowns, real-time sync, and CSV exports.
 */

(function () {
  'use strict';

  const DEFAULT_CUTOFF_IST = '2026-09-26T15:55:00+05:30';
  const ADMIN_PASSCODE = 'thatAff2026@';

  // Canonical presentation order of all 13 startups
  const MASTER_STARTUPS = [
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

  // Helper: Format duration (e.g., "5m 24s")
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

  // Helper: Format vote to friendly response button label
  function formatVoteLabel(vote) {
    if (vote === 'INTERESTED') return 'Interested';
    if (vote === 'EXPLORE') return 'Explore more';
    if (vote === 'NOT_INTERESTED') return 'Not my area of interest';
    if (vote === 'NOT_VOTED') return 'Not voted';
    return vote || '—';
  }

  // Module State
  const state = {
    cutoff: sessionStorage.getItem('startup-demo-metrics-cutoff') || DEFAULT_CUTOFF_IST,
    activeTab: 'overview', // 'overview' | 'startups' | 'investors' | 'activity' | 'export'
    data: null,
    isLoading: false,
    lastUpdated: null,
    lastError: null,
    startupSort: { col: 'pitchNumber', dir: 'asc' },
    startupSearch: '',
    expandedStartups: new Set(),
    startupVoterFilters: {}, // startupId -> 'all'|'INTERESTED'|'EXPLORE'|'NOT_INTERESTED'|'NOT_VOTED'
    startupVoterSearch: {}, // startupId -> query
    investorSearch: '',
    investorFilter: 'all', // 'all' | 'complete' | 'progress' | 'unvoted' | 'online'
    expandedInvestors: new Set(),
    activityFilter: 'all', // 'all' | 'votes' | 'updates' | 'signups'
    showCutoffModal: false
  };

  /**
   * Directly calculate metrics from client database state / Supabase tables
   */
  async function computeClientMetrics(cutoffIso) {
    const supabase = window.supabaseClient || window.supabase;
    const cutoffTime = new Date(cutoffIso).getTime();

    // Query investors and responses from live Supabase client if available, or fall back to window.adminLiveStats
    let investors = [];
    let responses = [];
    let feed = [];

    if (supabase) {
      try {
        const [invRes, respRes, feedRes] = await Promise.all([
          supabase.from('demo_investors').select('*').order('joined_at', { ascending: true }),
          supabase.from('demo_responses').select('*').order('recorded_at', { ascending: true }),
          supabase.from('interaction_feed')
            .select('id, event_type, actor_id, actor_name, actor_email, startup_id, startup_name, response_type, detail, created_at')
            .or('event_type.eq.RESPONSE_SUBMITTED,event_type.eq.RESPONSE_UPDATED,event_type.eq.INVESTOR_JOINED')
            .order('created_at', { ascending: true })
        ]);
        if (invRes.data) investors = invRes.data;
        if (respRes.data) responses = respRes.data;
        if (feedRes.data) feed = feedRes.data;
      } catch (err) {
        console.warn('[Metrics] Supabase client fetch warning:', err);
      }
    }

    // Fallback to window.adminLiveStats if available
    if (investors.length === 0 && window.adminLiveStats?.investors?.length > 0) {
      investors = window.adminLiveStats.investors;
    }
    if (responses.length === 0 && window.adminLiveStats?.responses?.length > 0) {
      responses = window.adminLiveStats.responses;
    }

    // Filter eligible investors: joined_at > cutoffTime
    const eligibleInvestors = [];
    const excludedInvestors = [];
    for (const inv of investors) {
      const jTime = new Date(inv.joined_at).getTime();
      if (jTime > cutoffTime) {
        eligibleInvestors.push(inv);
      } else {
        excludedInvestors.push(inv);
      }
    }

    const eligibleKeys = new Set(eligibleInvestors.map(i => i.investor_key));
    const eligibleInvestorMap = new Map();
    eligibleInvestors.forEach(i => eligibleInvestorMap.set(i.investor_key, i));

    // Filter responses from eligible investors only
    const eligibleResponses = responses.filter(r => eligibleKeys.has(r.investor_key));
    const votersSet = new Set(eligibleResponses.map(r => r.investor_key));

    const interested = eligibleResponses.filter(r => r.response_type === 'INTERESTED').length;
    const explore = eligibleResponses.filter(r => r.response_type === 'EXPLORE').length;
    const notInterested = eligibleResponses.filter(r => r.response_type === 'NOT_INTERESTED').length;

    // History and changes map
    const changesMap = new Map();
    feed.forEach(f => {
      if (f.actor_id && f.startup_id && (f.event_type === 'RESPONSE_SUBMITTED' || f.event_type === 'RESPONSE_UPDATED')) {
        const k = `${f.actor_id}:${f.startup_id}`;
        if (!changesMap.has(k)) changesMap.set(k, []);
        changesMap.get(k).push(f);
      }
    });

    const eligibleUpdates = feed.filter(f => eligibleKeys.has(f.actor_id) && f.event_type === 'RESPONSE_UPDATED');

    // Timestamps
    let firstVoteTime = null;
    let lastVoteTime = null;
    let latestActiveInvestor = null;
    let latestActiveStartup = null;
    if (eligibleResponses.length > 0) {
      const sorted = [...eligibleResponses].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
      firstVoteTime = sorted[0].recorded_at;
      lastVoteTime = sorted[sorted.length - 1].recorded_at;
      latestActiveInvestor = sorted[sorted.length - 1].investor_name || sorted[sorted.length - 1].investor_key;
      latestActiveStartup = sorted[sorted.length - 1].startup_name || sorted[sorted.length - 1].startup_id;
    }

    // Startup Metrics
    const startupsWithVotes = new Set(eligibleResponses.map(r => r.startup_id));
    const startupsList = MASTER_STARTUPS.map((s, idx) => {
      const sResps = eligibleResponses.filter(r => r.startup_id === s.id);
      const vCount = sResps.length;
      const nvCount = Math.max(0, eligibleInvestors.length - vCount);
      const partPct = eligibleInvestors.length > 0 ? Math.round((vCount / eligibleInvestors.length) * 1000) / 10 : 0;
      const sInt = sResps.filter(r => r.response_type === 'INTERESTED').length;
      const sExp = sResps.filter(r => r.response_type === 'EXPLORE').length;
      const sNot = sResps.filter(r => r.response_type === 'NOT_INTERESTED').length;

      let sFirst = null;
      let sLast = null;
      if (sResps.length > 0) {
        const sSorted = [...sResps].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
        sFirst = sSorted[0].recorded_at;
        sLast = sSorted[sSorted.length - 1].recorded_at;
      }

      const voters = sResps.map(r => {
        const inv = eligibleInvestorMap.get(r.investor_key);
        const signupTime = inv?.joined_at || null;
        const voteTime = r.recorded_at;
        let durationMs = null;
        if (signupTime && voteTime) {
          durationMs = new Date(voteTime).getTime() - new Date(signupTime).getTime();
        }
        const histKey = `${r.investor_key}:${s.id}`;
        const histEvents = changesMap.get(histKey) || [];
        const changeCount = histEvents.filter(e => e.event_type === 'RESPONSE_UPDATED').length;
        const historyTrail = histEvents.map(e => ({
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
          voteChangesCount: changeCount,
          historyTrail: historyTrail
        };
      });

      voters.sort((a, b) => new Date(b.voteTimestamp) - new Date(a.voteTimestamp));

      const votedKeySet = new Set(sResps.map(r => r.investor_key));
      const nonVoters = eligibleInvestors
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
        rank: idx + 1,
        pitchNumber: s.n,
        startupId: s.id,
        startupName: s.name,
        subSector: s.subSector,
        eligibleInvestorCount: eligibleInvestors.length,
        votedCount: vCount,
        notVotedCount: nvCount,
        participationPct: partPct,
        interestedVotes: sInt,
        exploreVotes: sExp,
        notInterestedVotes: sNot,
        totalActiveVotes: vCount,
        voteDistribution: {
          interestedPct: vCount > 0 ? Math.round((sInt / vCount) * 100) : 0,
          explorePct: vCount > 0 ? Math.round((sExp / vCount) * 100) : 0,
          notInterestedPct: vCount > 0 ? Math.round((sNot / vCount) * 100) : 0
        },
        firstVoteAt: sFirst,
        firstVoteAtFormatted: formatIST(sFirst),
        lastVoteAt: sLast,
        lastVoteAtFormatted: formatIST(sLast),
        voters: voters,
        nonVoters: nonVoters
      };
    });

    // Investor Metrics
    const now = Date.now();
    const responsesByInvestor = new Map();
    eligibleResponses.forEach(r => {
      if (!responsesByInvestor.has(r.investor_key)) responsesByInvestor.set(r.investor_key, []);
      responsesByInvestor.get(r.investor_key).push(r);
    });

    const updatesByInvestor = new Map();
    eligibleUpdates.forEach(f => {
      if (!updatesByInvestor.has(f.actor_id)) updatesByInvestor.set(f.actor_id, []);
      updatesByInvestor.get(f.actor_id).push(f);
    });

    const investorsList = eligibleInvestors.map(inv => {
      const votes = responsesByInvestor.get(inv.investor_key) || [];
      const updates = updatesByInvestor.get(inv.investor_key) || [];
      const vCount = votes.length;
      const nvCount = Math.max(0, MASTER_STARTUPS.length - vCount);
      const partPct = Math.round((vCount / MASTER_STARTUPS.length) * 100);
      const intCount = votes.filter(r => r.response_type === 'INTERESTED').length;
      const expCount = votes.filter(r => r.response_type === 'EXPLORE').length;
      const notCount = votes.filter(r => r.response_type === 'NOT_INTERESTED').length;

      let fVote = null;
      let lVote = null;
      let totalDur = 0;
      let durC = 0;
      if (votes.length > 0) {
        const sorted = [...votes].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
        fVote = sorted[0].recorded_at;
        lVote = sorted[sorted.length - 1].recorded_at;
        const sMs = new Date(inv.joined_at).getTime();
        votes.forEach(v => {
          const vMs = new Date(v.recorded_at).getTime();
          if (vMs >= sMs) {
            totalDur += (vMs - sMs);
            durC++;
          }
        });
      }

      let sessionStatus = 'offline';
      if (inv.last_active) {
        const diff = now - new Date(inv.last_active).getTime();
        if (diff >= 0 && diff < 60000) sessionStatus = 'online';
        else if (diff < 180000) sessionStatus = 'idle';
      }

      const voteMap = new Map();
      votes.forEach(v => voteMap.set(v.startup_id, v));

      const evaluations = MASTER_STARTUPS.map(s => {
        const v = voteMap.get(s.id);
        const chCount = updates.filter(u => u.startup_id === s.id).length;
        return {
          pitchNumber: s.n,
          startupId: s.id,
          startupName: s.name,
          subSector: s.subSector,
          vote: v ? v.response_type : 'NOT_VOTED',
          voteTimestamp: v ? v.recorded_at : null,
          voteTimestampFormatted: v ? formatIST(v.recorded_at) : '—',
          voteChangesCount: chCount,
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
        totalStartupsPresented: MASTER_STARTUPS.length,
        startupsVotedCount: vCount,
        notYetVotedCount: nvCount,
        participationPct: partPct,
        interestedCount: intCount,
        exploreCount: expCount,
        notInterestedCount: notCount,
        totalVoteChanges: updates.length,
        firstVoteAt: fVote,
        firstVoteAtFormatted: formatIST(fVote),
        lastVoteAt: lVote,
        lastVoteAtFormatted: formatIST(lVote),
        avgTimeToVoteFormatted: durC > 0 ? formatDuration(Math.round(totalDur / durC)) : '—',
        evaluations: evaluations
      };
    });

    investorsList.sort((a, b) => (b.startupsVotedCount - a.startupsVotedCount) || (new Date(b.signupTimestamp) - new Date(a.signupTimestamp)));

    // Chronological Activity Feed
    const events = [];
    eligibleInvestors.forEach(inv => {
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

    feed.forEach(f => {
      if (f.actor_id && eligibleKeys.has(f.actor_id)) {
        if (f.event_type === 'RESPONSE_SUBMITTED' || f.event_type === 'RESPONSE_UPDATED') {
          const actionVerb = f.event_type === 'RESPONSE_UPDATED' ? 'updated vote to' : 'voted';
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
            detail: `${f.actor_name || 'Investor'} ${actionVerb} ${f.response_type} for ${f.startup_name || f.startup_id}`
          });
        }
      }
    });

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      cutoff: {
        raw: cutoffIso,
        iso: new Date(cutoffIso).toISOString(),
        display: formatIST(cutoffIso)
      },
      overview: {
        event: {
          title: 'AFF Demo Day 2026',
          date: '26 Sep 2026',
          timezone: 'Asia/Kolkata (IST UTC+05:30)'
        },
        investors: {
          totalInDatabase: investors.length,
          eligibleCount: eligibleInvestors.length,
          excludedPreCutoffCount: excludedInvestors.length,
          votedCount: votersSet.size,
          notVotedCount: Math.max(0, eligibleInvestors.length - votersSet.size),
          participationPct: eligibleInvestors.length > 0 ? Math.round((votersSet.size / eligibleInvestors.length) * 1000) / 10 : 0
        },
        voting: {
          totalActiveVotes: eligibleResponses.length,
          interestedCount: interested,
          exploreCount: explore,
          notInterestedCount: notInterested,
          totalVoteChanges: eligibleUpdates.length,
          interestedPct: eligibleResponses.length > 0 ? Math.round((interested / eligibleResponses.length) * 100) : 0,
          explorePct: eligibleResponses.length > 0 ? Math.round((explore / eligibleResponses.length) * 100) : 0,
          notInterestedPct: eligibleResponses.length > 0 ? Math.round((notInterested / eligibleResponses.length) * 100) : 0
        },
        startups: {
          totalStartups: MASTER_STARTUPS.length,
          receivingVotesCount: startupsWithVotes.size,
          zeroVotesCount: MASTER_STARTUPS.length - startupsWithVotes.size
        },
        activity: {
          firstVoteAt: firstVoteTime,
          firstVoteAtFormatted: formatIST(firstVoteTime),
          lastVoteAt: lastVoteTime,
          lastVoteAtFormatted: formatIST(lastVoteTime),
          latestActiveInvestor: latestActiveInvestor || 'None yet',
          latestActiveStartup: latestActiveStartup || 'None yet'
        }
      },
      startups: startupsList,
      investors: investorsList,
      activity: events
    };
  }

  /**
   * Fetch data from /admin/metrics API or fallback to direct client computation
   */
  async function loadData(forceRefresh = false) {
    if (state.isLoading) return;
    state.isLoading = true;

    try {
      // 1. Try server endpoints first if available
      const cutoffParam = encodeURIComponent(state.cutoff);
      const headers = { 'x-admin-passcode': ADMIN_PASSCODE };

      let overviewRes = null;
      let startupsRes = null;
      let investorsRes = null;
      let activityRes = null;

      try {
        const [oRes, sRes, iRes, aRes] = await Promise.all([
          fetch(`/admin/metrics/overview?cutoff=${cutoffParam}`, { headers }),
          fetch(`/admin/metrics/startups?cutoff=${cutoffParam}`, { headers }),
          fetch(`/admin/metrics/investors?cutoff=${cutoffParam}`, { headers }),
          fetch(`/admin/metrics/activity?cutoff=${cutoffParam}&limit=120`, { headers })
        ]);

        if (oRes.ok && sRes.ok && iRes.ok && aRes.ok) {
          overviewRes = await oRes.json();
          startupsRes = await sRes.json();
          investorsRes = await iRes.json();
          activityRes = await aRes.json();
        }
      } catch (_) {
        // Server endpoint not reachable (e.g. running on GitHub Pages or static host)
      }

      if (overviewRes && startupsRes && investorsRes && activityRes) {
        state.data = {
          cutoff: overviewRes.cutoff,
          overview: overviewRes,
          startups: startupsRes.startups || [],
          investors: investorsRes.investors || [],
          activity: activityRes.events || []
        };
      } else {
        // Fallback: direct client-side evaluation against Supabase
        state.data = await computeClientMetrics(state.cutoff);
      }

      state.lastUpdated = new Date();
      state.lastError = null;
    } catch (err) {
      console.error('[Admin Metrics] Load error:', err);
      state.lastError = err.message || 'Error loading live metrics';
    } finally {
      state.isLoading = false;
    }
  }

  /**
   * Export CSV Reports
   */
  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportStartupVotesReport() {
    if (!state.data) return;
    const headers = ['Pitch Number', 'Startup Name', 'Investor Name', 'Investor Email', 'Investor Signup Time (IST)', 'Vote', 'Vote Timestamp (IST)'];
    const rows = [headers.join(',')];

    function esc(val) {
      if (val == null) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    }

    state.data.startups.forEach(s => {
      s.voters.forEach(v => {
        rows.push([
          esc(s.pitchNumber),
          esc(s.startupName),
          esc(v.investorName),
          esc(v.investorEmail),
          esc(v.signupAtFormatted),
          esc(formatVoteLabel(v.voteSelection)),
          esc(v.voteTimestampFormatted)
        ].join(','));
      });
    });

    const dateStr = new Date(state.cutoff).toISOString().slice(0, 10);
    downloadCsv(rows.join('\r\n'), `aff-demo-day-startup-votes-cutoff-${dateStr}.csv`);
  }

  function exportInvestorActivityReport() {
    if (!state.data) return;
    const headers = ['Investor Name', 'Investor Email', 'Signup Time (IST)', 'Startup', 'Pitch Number', 'Vote', 'Vote Timestamp (IST)'];
    const rows = [headers.join(',')];

    function esc(val) {
      if (val == null) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    }

    state.data.investors.forEach(inv => {
      inv.evaluations.forEach(ev => {
        rows.push([
          esc(inv.name),
          esc(inv.email),
          esc(inv.signupTimestampFormatted),
          esc(ev.startupName),
          esc(ev.pitchNumber),
          esc(formatVoteLabel(ev.vote)),
          esc(ev.voteTimestampFormatted)
        ].join(','));
      });
    });

    const dateStr = new Date(state.cutoff).toISOString().slice(0, 10);
    downloadCsv(rows.join('\r\n'), `aff-demo-day-investor-activity-cutoff-${dateStr}.csv`);
  }

  function exportJsonSnapshot() {
    if (!state.data) return;
    const str = JSON.stringify(state.data, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `aff-demo-day-metrics-snapshot-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadStartupPdf(startupId) {
    const adminPasscode = window.AdminSession?.passcode || 'thatAff2026@';
    const downloadUrl = `/admin/metrics/pdf/${startupId}?adminPasscode=${encodeURIComponent(adminPasscode)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function printStartupReport(startupId) {
    const adminPasscode = window.AdminSession?.passcode || 'thatAff2026@';
    const printUrl = `/admin/metrics/pdf/html/${startupId}?adminPasscode=${encodeURIComponent(adminPasscode)}`;
    const win = window.open(printUrl, '_blank');
    if (win) {
      win.focus();
    }
  }

  function downloadAllPdfsZip() {
    const adminPasscode = window.AdminSession?.passcode || 'thatAff2026@';
    const downloadUrl = `/admin/metrics/pdf/zip?adminPasscode=${encodeURIComponent(adminPasscode)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', 'Demo-Day-All-13-Startup-PDF-Reports.zip');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ══════════════════════════════════════════════════════════════
  // UI RENDERERS
  // ══════════════════════════════════════════════════════════════

  function render(container) {
    if (!container) return;

    if (!state.data && !state.isLoading) {
      loadData().then(() => render(container));
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#64748b">
          <div class="spinner" style="margin:0 auto 16px"></div>
          <strong>Loading Live Database Metrics...</strong>
          <p style="font-size:12px;margin-top:4px">Connecting directly to Supabase with eligibility cutoff evaluation...</p>
        </div>`;
      return;
    }

    if (state.isLoading && !state.data) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#64748b">
          <div class="spinner" style="margin:0 auto 16px"></div>
          <strong>Synchronizing live portal data...</strong>
        </div>`;
      return;
    }

    const d = state.data;
    const ov = d.overview;
    const isOnline = window.realtimeConnected !== false;

    container.innerHTML = `
      <!-- Top Mode Switcher -->
      <div class="admin-mode-tabs">
        <button class="admin-mode-tab-btn active" data-admin-mode="metrics">
          📊 Live Metrics & Analytics <span class="metrics-badge-pill">${ov.investors.eligibleCount} Voters</span>
        </button>
        <button class="admin-mode-tab-btn" data-admin-mode="controls">
          🎛️ Command Center & Controls
        </button>
      </div>

      <!-- Live Header -->
      <section class="metrics-header">
        <div class="metrics-header-top">
          <div class="metrics-header-meta">
            <span class="eyebrow" style="color:#38bdf8;background:rgba(56,189,248,0.12);padding:4px 12px;border-radius:999px;border:1px solid rgba(56,189,248,0.25);display:inline-block;margin-bottom:6px">
              LIVE DEMO DAY ANALYTICS • DATABASE GROUND TRUTH
            </span>
            <h2>Live Metrics & Investor Analytics</h2>
            <p>Authoritative live database evaluation for ${ov.event.title} across all 13 startup booths.</p>
          </div>
          <div>
            <span class="metrics-live-status ${isOnline ? 'live' : 'reconnecting'}">
              <span class="metrics-pulse-dot"></span>
              ${isOnline ? `● LIVE Last updated: ${formatIST(state.lastUpdated, 'time')} IST` : '○ RECONNECTING'}
            </span>
          </div>
        </div>

        <div class="metrics-actions-row">
          <button class="metrics-btn secondary" data-metrics-action="refresh">
            ↻ Refresh Live Data
          </button>
          <button class="metrics-btn secondary" data-metrics-action="set-cutoff">
            ⚙️ Configure Cutoff
          </button>
          <button class="metrics-btn secondary" data-metrics-export="startup-votes">
            📥 Export Startup Votes (CSV)
          </button>
          <button class="metrics-btn secondary" data-metrics-export="investor-activity">
            📥 Export Investor Activity (CSV)
          </button>
        </div>
      </section>

      <!-- Active Cutoff Configuration Banner -->
      <div class="metrics-cutoff-banner">
        <div class="metrics-cutoff-info">
          <strong>Investor Eligibility Cutoff: ${d.cutoff.display}</strong>
          <span>
            <span>👥 <strong>${ov.investors.eligibleCount}</strong> Eligible Investors (&gt; 3:55 PM)</span>
            <span>•</span>
            <span>🚫 <strong>${ov.investors.excludedPreCutoffCount}</strong> Excluded Pre-Cutoff (&le; 3:55 PM)</span>
            <span>•</span>
            <span>📊 <strong>${ov.investors.totalInDatabase}</strong> Total in Database</span>
          </span>
        </div>
        <div class="metrics-cutoff-actions">
          <button class="cutoff-preset-btn ${state.cutoff === DEFAULT_CUTOFF_IST ? 'active' : ''}" data-cutoff-preset="default">
            🎯 3:55 PM IST (Default)
          </button>
          <button class="cutoff-preset-btn ${state.cutoff === '1970-01-01T00:00:00Z' ? 'active' : ''}" data-cutoff-preset="all">
            🌐 All Signups
          </button>
          <button class="cutoff-preset-btn ${state.cutoff !== DEFAULT_CUTOFF_IST && state.cutoff !== '1970-01-01T00:00:00Z' ? 'active' : ''}" data-cutoff-preset="custom">
            ⚙️ Custom Cutoff...
          </button>
        </div>
      </div>

      <!-- Sub-Navigation Tabs -->
      <nav class="metrics-subnav">
        <button class="metrics-subnav-btn ${state.activeTab === 'overview' ? 'active' : ''}" data-metrics-tab="overview">
          📊 Overview
        </button>
        <button class="metrics-subnav-btn ${state.activeTab === 'startups' ? 'active' : ''}" data-metrics-tab="startups">
          🏢 Startups (13)
        </button>
        <button class="metrics-subnav-btn ${state.activeTab === 'investors' ? 'active' : ''}" data-metrics-tab="investors">
          👥 Investors (${ov.investors.eligibleCount})
        </button>
        <button class="metrics-subnav-btn ${state.activeTab === 'activity' ? 'active' : ''}" data-metrics-tab="activity">
          ⏱️ Time Activity
        </button>
        <button class="metrics-subnav-btn ${state.activeTab === 'export' ? 'active' : ''}" data-metrics-tab="export">
          📥 Export & Reports
        </button>
      </nav>

      <!-- Active Tab Content -->
      <div id="metrics-tab-content">
        ${renderTabContent()}
      </div>

      <!-- Custom Cutoff Modal Dialog -->
      ${state.showCutoffModal ? renderCutoffModal() : ''}
    `;

    bindTabEvents(container);
  }

  function renderTabContent() {
    switch (state.activeTab) {
      case 'startups':
        return renderStartupsTab();
      case 'investors':
        return renderInvestorsTab();
      case 'activity':
        return renderActivityTab();
      case 'export':
        return renderExportTab();
      case 'overview':
      default:
        return renderOverviewTab();
    }
  }

  /* ── 1. Overview Tab ────────────────────────────────────────── */
  function renderOverviewTab() {
    const ov = state.data.overview;
    const inv = ov.investors;
    const vot = ov.voting;
    const stu = ov.startups;
    const act = ov.activity;

    return `
      <!-- KPI Cards Grid -->
      <div class="metrics-kpi-grid">
        <!-- Event Card -->
        <div class="metrics-card accent-blue">
          <div class="metrics-card-header">
            <small>🏛️ Event</small>
            <span class="live-stat-chip blue" style="font-size:10px">Live</span>
          </div>
          <div class="metrics-card-val">${ov.event.title}</div>
          <div style="font-size:12px;color:#64748b">Event Date: <strong>${ov.event.date}</strong></div>
          <div class="metrics-card-footer">
            <span>Cutoff: <strong>${ov.activity.lastVoteAt ? 'Active' : 'Standby'}</strong></span>
            <span>IST (UTC+05:30)</span>
          </div>
        </div>

        <!-- Investors Card -->
        <div class="metrics-card accent-green">
          <div class="metrics-card-header">
            <small>👥 Eligible Investors</small>
            <span class="live-stat-chip green" style="font-size:10px">${inv.participationPct}% Voted</span>
          </div>
          <div class="metrics-card-val">${inv.eligibleCount} <span class="sub-val">/ ${inv.totalInDatabase} total</span></div>
          <div style="font-size:12.5px;color:#0f172a;margin-bottom:4px">
            <strong>${inv.votedCount}</strong> voted • <strong>${inv.notVotedCount}</strong> pending
          </div>
          <div class="metrics-card-footer">
            <span>Participation: <strong>${inv.participationPct}%</strong></span>
            <span>${inv.excludedPreCutoffCount} pre-cutoff excluded</span>
          </div>
        </div>

        <!-- Voting Card -->
        <div class="metrics-card accent-purple">
          <div class="metrics-card-header">
            <small>🗳️ Active Votes</small>
            <span class="live-stat-chip blue" style="font-size:10px">${vot.totalVoteChanges} Changes</span>
          </div>
          <div class="metrics-card-val">${vot.totalActiveVotes} <span class="sub-val">votes</span></div>
          <div class="sentiment-bar-wrap">
            <div class="sentiment-bar-fill interested" style="width:${vot.interestedPct}%" title="Interested: ${vot.interestedCount}"></div>
            <div class="sentiment-bar-fill explore" style="width:${vot.explorePct}%" title="Explore: ${vot.exploreCount}"></div>
            <div class="sentiment-bar-fill not-interested" style="width:${vot.notInterestedPct}%" title="Not my area of interest: ${vot.notInterestedCount}"></div>
          </div>
          <div class="metrics-card-footer">
            <span style="color:#16a34a;font-weight:800">👍 ${vot.interestedCount} (${vot.interestedPct}%)</span>
            <span style="color:#d97706;font-weight:800">? ${vot.exploreCount} (${vot.explorePct}%)</span>
            <span style="color:#2563eb;font-weight:800">👎 ${vot.notInterestedCount} (${vot.notInterestedPct}%)</span>
          </div>
        </div>

        <!-- Startups Card -->
        <div class="metrics-card accent-indigo">
          <div class="metrics-card-header">
            <small>🏢 Startup Booths</small>
            <span class="live-stat-chip green" style="font-size:10px">100% Active</span>
          </div>
          <div class="metrics-card-val">${stu.totalStartups} <span class="sub-val">booths</span></div>
          <div style="font-size:12.5px;color:#0f172a;margin-bottom:4px">
            <strong>${stu.receivingVotesCount}</strong> receiving votes • <strong>${stu.zeroVotesCount}</strong> zero votes
          </div>
          <div class="metrics-card-footer">
            <span>Booths B1 – B13</span>
            <span>All 13 presenting</span>
          </div>
        </div>

        <!-- Activity Card -->
        <div class="metrics-card accent-amber">
          <div class="metrics-card-header">
            <small>⏱️ Live Activity</small>
            <span class="live-stat-chip yellow" style="font-size:10px">Active</span>
          </div>
          <div class="metrics-card-val" style="font-size:22px;margin:8px 0">${act.latestActiveInvestor}</div>
          <div style="font-size:12px;color:#64748b">Voted for: <strong>${act.latestActiveStartup}</strong></div>
          <div class="metrics-card-footer">
            <span>First: <strong>${act.firstVoteAtFormatted ? act.firstVoteAtFormatted.split('•')[1] || act.firstVoteAtFormatted : '—'}</strong></span>
            <span>Latest: <strong>${act.lastVoteAtFormatted ? act.lastVoteAtFormatted.split('•')[1] || act.lastVoteAtFormatted : '—'}</strong></span>
          </div>
        </div>
      </div>

      <!-- Quick Summary Matrix -->
      <div class="panel" style="margin-top:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0 0 4px">Live Startup Sentiment Leaderboard (All 13 Startups)</h3>
            <p class="detail-label" style="margin:0">Active eligible votes recorded directly from the portal database.</p>
          </div>
          <button class="metrics-btn light" data-metrics-tab="startups">View Detailed Startups Table →</button>
        </div>
        <div class="roster-wrap">
          <table class="metrics-table">
            <thead>
              <tr>
                <th style="width:60px">Pitch</th>
                <th>Startup Name</th>
                <th>Sub-Sector</th>
                <th style="width:120px">Active Votes</th>
                <th style="width:150px">Participation</th>
                <th>Sentiment Distribution</th>
                <th>Last Vote</th>
              </tr>
            </thead>
            <tbody>
              ${state.data.startups.map(s => `
                <tr class="metrics-row">
                  <td><strong>B${s.pitchNumber}</strong></td>
                  <td><strong>${s.startupName}</strong></td>
                  <td style="color:#64748b;font-size:11.5px">${s.subSector}</td>
                  <td><strong>${s.totalActiveVotes}</strong> <span style="color:#94a3b8">/ ${s.eligibleInvestorCount}</span></td>
                  <td>
                    <div class="mini-prog">
                      <div class="mini-prog-bar"><div class="mini-prog-fill" style="width:${s.participationPct}%"></div></div>
                      <span style="font-weight:800;font-size:11.5px">${s.participationPct}%</span>
                    </div>
                  </td>
                  <td>
                    <span class="live-stat-chip green" style="padding:2px 7px;font-size:10px;font-weight:800">👍 ${s.interestedVotes} (${s.voteDistribution.interestedPct}%)</span>
                    <span class="live-stat-chip yellow" style="padding:2px 7px;font-size:10px;font-weight:800">? ${s.exploreVotes} (${s.voteDistribution.explorePct}%)</span>
                    <span class="live-stat-chip blue" style="padding:2px 7px;font-size:10px;font-weight:800">👎 ${s.notInterestedVotes} (${s.voteDistribution.notInterestedPct}%)</span>
                  </td>
                  <td style="color:#64748b;font-size:11px">${s.lastVoteAtFormatted ? s.lastVoteAtFormatted.split('•')[1] || s.lastVoteAtFormatted : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* ── 2. Startups Tab (Startup-wise metrics & Drill-down) ────── */
  function renderStartupsTab() {
    let startups = [...state.data.startups];

    // Search filter
    if (state.startupSearch) {
      const q = state.startupSearch.toLowerCase().trim();
      startups = startups.filter(s =>
        s.startupName.toLowerCase().includes(q) ||
        s.subSector.toLowerCase().includes(q) ||
        String(s.pitchNumber).includes(q)
      );
    }

    // Sort
    const col = state.startupSort.col;
    const dir = state.startupSort.dir === 'asc' ? 1 : -1;
    startups.sort((a, b) => {
      if (col === 'pitchNumber') return (a.pitchNumber - b.pitchNumber) * dir;
      if (col === 'startupName') return a.startupName.localeCompare(b.startupName) * dir;
      if (col === 'votedCount') return (a.votedCount - b.votedCount) * dir;
      if (col === 'participationPct') return (a.participationPct - b.participationPct) * dir;
      if (col === 'interestedVotes') return (a.interestedVotes - b.interestedVotes) * dir;
      if (col === 'exploreVotes') return (a.exploreVotes - b.exploreVotes) * dir;
      if (col === 'notInterestedVotes') return (a.notInterestedVotes - b.notInterestedVotes) * dir;
      if (col === 'lastVoteAt') {
        const tA = a.lastVoteAt ? new Date(a.lastVoteAt).getTime() : 0;
        const tB = b.lastVoteAt ? new Date(b.lastVoteAt).getTime() : 0;
        return (tA - tB) * dir;
      }
      return 0;
    });

    const sortIndicator = (c) => state.startupSort.col === c ? (state.startupSort.dir === 'asc' ? ' ▲' : ' ▼') : '';

    return `
      <!-- Search & Controls -->
      <div class="metrics-toolbar">
        <input type="text" class="metrics-search-input" id="startup-search-input"
          placeholder="🔍 Search startups by name, sector or pitch #..." value="${state.startupSearch}">
        <div style="font-size:12px;color:#64748b">
          Showing <strong>${startups.length}</strong> of 13 startups • Click any row or [Voters] to expand investor drill-down
        </div>
      </div>

      <!-- Startups Table -->
      <div class="roster-wrap" style="max-height:640px">
        <table class="metrics-table">
          <thead>
            <tr>
              <th style="width:45px">Rank</th>
              <th class="sortable" data-sort-startup="pitchNumber" style="width:70px">Pitch #${sortIndicator('pitchNumber')}</th>
              <th class="sortable" data-sort-startup="startupName">Startup Name${sortIndicator('startupName')}</th>
              <th style="width:110px">Eligible Voters</th>
              <th class="sortable" data-sort-startup="votedCount" style="width:90px">Voted${sortIndicator('votedCount')}</th>
              <th class="sortable" data-sort-startup="participationPct" style="width:140px">Participation${sortIndicator('participationPct')}</th>
              <th class="sortable" data-sort-startup="interestedVotes">Interested${sortIndicator('interestedVotes')}</th>
              <th class="sortable" data-sort-startup="exploreVotes">Explore${sortIndicator('exploreVotes')}</th>
              <th class="sortable" data-sort-startup="notInterestedVotes">Not my area of interest${sortIndicator('notInterestedVotes')}</th>
              <th>Total Votes</th>
              <th class="sortable" data-sort-startup="lastVoteAt">Last Vote${sortIndicator('lastVoteAt')}</th>
              <th style="width:100px;text-align:center">Drill-Down</th>
            </tr>
          </thead>
          <tbody>
            ${startups.map(s => {
              const isExpanded = state.expandedStartups.has(s.startupId);
              return `
                <tr class="metrics-row ${isExpanded ? 'expanded-row' : ''}" style="cursor:pointer" data-toggle-startup-expand="${s.startupId}">
                  <td><strong>#${s.rank}</strong></td>
                  <td><span class="booth-tag">B${s.pitchNumber}</span></td>
                  <td>
                    <div>
                      <strong style="font-size:14px;color:#0f172a">${s.startupName}</strong>
                      <div style="font-size:11px;color:#64748b">${s.subSector}</div>
                    </div>
                  </td>
                  <td>${s.eligibleInvestorCount}</td>
                  <td><strong>${s.votedCount}</strong></td>
                  <td>
                    <div class="mini-prog">
                      <div class="mini-prog-bar"><div class="mini-prog-fill" style="width:${s.participationPct}%"></div></div>
                      <span style="font-weight:800;font-size:11px">${s.participationPct}%</span>
                    </div>
                  </td>
                  <td><span class="live-stat-chip green" style="padding:2px 8px;font-size:11px;font-weight:800">👍 ${s.interestedVotes}</span></td>
                  <td><span class="live-stat-chip yellow" style="padding:2px 8px;font-size:11px;font-weight:800">? ${s.exploreVotes}</span></td>
                  <td><span class="live-stat-chip blue" style="padding:2px 8px;font-size:11px;font-weight:800">👎 ${s.notInterestedVotes}</span></td>
                  <td><strong>${s.totalActiveVotes}</strong></td>
                  <td style="color:#64748b;font-size:11px">${s.lastVoteAtFormatted ? s.lastVoteAtFormatted.split('•')[1] || s.lastVoteAtFormatted : '—'}</td>
                  <td style="text-align:center;white-space:nowrap">
                    <button class="metrics-btn light" style="padding:4px 8px;font-size:11px;margin-right:4px" data-toggle-startup-expand="${s.startupId}">
                      ${isExpanded ? '▲ Hide' : `▼ Voters (${s.votedCount})`}
                    </button>
                    <button class="metrics-btn primary" style="padding:4px 8px;font-size:11px" data-download-startup-pdf="${s.startupId}" title="Download Official PDF Report">
                      📄 PDF
                    </button>
                  </td>
                </tr>
                ${isExpanded ? renderStartupDrilldownRow(s) : ''}
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderStartupDrilldownRow(startup) {
    const voterFilter = state.startupVoterFilters[startup.startupId] || 'all';
    const voterQuery = (state.startupVoterSearch[startup.startupId] || '').toLowerCase().trim();

    let list = voterFilter === 'NOT_VOTED' ? startup.nonVoters : startup.voters;
    if (voterFilter !== 'all' && voterFilter !== 'NOT_VOTED') {
      list = startup.voters.filter(v => v.voteSelection === voterFilter);
    }

    if (voterQuery) {
      list = list.filter(v =>
        v.investorName.toLowerCase().includes(voterQuery) ||
        v.investorEmail.toLowerCase().includes(voterQuery) ||
        v.investorKey.toLowerCase().includes(voterQuery)
      );
    }

    return `
      <tr>
        <td colspan="12" style="padding:0;background:#f8fafc">
          <div class="drilldown-container">
            <div class="drilldown-header">
              <div>
                <span class="drilldown-title">
                  👥 Investor Votes for <strong>${startup.startupName}</strong> (Pitch #${startup.pitchNumber})
                </span>
                <span style="font-size:12px;color:#64748b;margin-left:8px">
                  ${startup.votedCount} voted out of ${startup.eligibleInvestorCount} eligible investors
                </span>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <input type="text" placeholder="Search investor..." class="metrics-search-input"
                  style="font-size:12px;padding:5px 10px;width:180px"
                  data-startup-voter-search="${startup.startupId}"
                  value="${state.startupVoterSearch[startup.startupId] || ''}">
                <div class="metrics-filter-group">
                  <button class="metrics-filter-chip ${voterFilter === 'all' ? 'active' : ''}" data-startup-voter-filter="all" data-startup-id="${startup.startupId}">
                    All (${startup.voters.length})
                  </button>
                  <button class="metrics-filter-chip ${voterFilter === 'INTERESTED' ? 'active' : ''}" data-startup-voter-filter="INTERESTED" data-startup-id="${startup.startupId}">
                    👍 Interested (${startup.interestedVotes})
                  </button>
                  <button class="metrics-filter-chip ${voterFilter === 'EXPLORE' ? 'active' : ''}" data-startup-voter-filter="EXPLORE" data-startup-id="${startup.startupId}">
                    ? Explore (${startup.exploreVotes})
                  </button>
                  <button class="metrics-filter-chip ${voterFilter === 'NOT_INTERESTED' ? 'active' : ''}" data-startup-voter-filter="NOT_INTERESTED" data-startup-id="${startup.startupId}">
                    👎 Not my area of interest (${startup.notInterestedVotes})
                  </button>
                  <button class="metrics-filter-chip ${voterFilter === 'NOT_VOTED' ? 'active' : ''}" data-startup-voter-filter="NOT_VOTED" data-startup-id="${startup.startupId}">
                    ⏳ Not Voted (${startup.nonVoters.length})
                  </button>
                </div>
                <div style="display:flex;gap:6px;margin-left:auto">
                  <button class="metrics-btn primary" style="font-size:11px;padding:4px 10px" data-download-startup-pdf="${startup.startupId}" title="Download Official Startup PDF Report">
                    📄 Download PDF
                  </button>
                  <button class="metrics-btn light" style="font-size:11px;padding:4px 10px" data-print-startup-report="${startup.startupId}" title="Print or Save to PDF">
                    🖨️ Print
                  </button>
                </div>
              </div>
            </div>

            <div style="max-height:360px;overflow-y:auto;border-radius:12px;border:1px solid #e2e8f0">
              <table class="drilldown-table">
                <thead>
                  <tr>
                    <th>Investor Name</th>
                    <th>Email Address</th>
                    <th>User ID (Key)</th>
                    <th>Signup Time (IST)</th>
                    <th>Vote Selection</th>
                    <th>Vote Timestamp (IST)</th>
                    <th>Time from Signup to Vote</th>
                    <th>Current Vote</th>
                    <th>Vote Changes</th>
                  </tr>
                </thead>
                <tbody>
                  ${list.length > 0 ? list.map(v => {
                    const badgeClass = v.voteSelection === 'INTERESTED' ? 'green' : v.voteSelection === 'EXPLORE' ? 'yellow' : v.voteSelection === 'NOT_INTERESTED' ? 'blue' : 'gray';
                    const badgeIcon = v.voteSelection === 'INTERESTED' ? '👍' : v.voteSelection === 'EXPLORE' ? '?' : v.voteSelection === 'NOT_INTERESTED' ? '👎' : '⏳';
                    return `
                      <tr>
                        <td><strong>${v.investorName}</strong></td>
                        <td style="color:#475569">${v.investorEmail}</td>
                        <td style="font-family:monospace;font-size:10.5px;color:#64748b">${v.investorKey}</td>
                        <td style="color:#64748b;font-size:11px">${v.signupAtFormatted || '—'}</td>
                        <td>
                          <span class="live-stat-chip ${badgeClass}" style="padding:2px 8px;font-size:10.5px;font-weight:800">
                            ${badgeIcon} ${formatVoteLabel(v.voteSelection)}
                          </span>
                        </td>
                        <td style="color:#64748b;font-size:11px">${v.voteTimestampFormatted || '—'}</td>
                        <td style="color:#0f172a;font-weight:700">${v.durationSignupToVoteFormatted || '—'}</td>
                        <td><strong>${formatVoteLabel(v.currentVote)}</strong></td>
                        <td>
                          ${v.voteChangesCount > 0 ? `
                            <span class="live-stat-chip yellow" style="padding:2px 8px;font-size:10px;font-weight:800" title="${v.historyTrail?.map(h => `${h.type}: ${h.selection}`).join(' ➔ ') || ''}">
                              ${v.voteChangesCount} change${v.voteChangesCount > 1 ? 's' : ''}
                            </span>
                          ` : '<span style="color:#94a3b8;font-size:11px">0 changes</span>'}
                        </td>
                      </tr>
                    `;
                  }).join('') : `
                    <tr><td colspan="9" style="text-align:center;padding:24px;color:#94a3b8">No investors found matching filter.</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  /* ── 3. Investors Tab (Investor-wise metrics & Drill-down) ───── */
  function renderInvestorsTab() {
    let investors = [...state.data.investors];

    // Search filter
    if (state.investorSearch) {
      const q = state.investorSearch.toLowerCase().trim();
      investors = investors.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        i.investorKey.toLowerCase().includes(q)
      );
    }

    // Cohort filter
    if (state.investorFilter === 'complete') {
      investors = investors.filter(i => i.startupsVotedCount === 13);
    } else if (state.investorFilter === 'progress') {
      investors = investors.filter(i => i.startupsVotedCount > 0 && i.startupsVotedCount < 13);
    } else if (state.investorFilter === 'unvoted') {
      investors = investors.filter(i => i.startupsVotedCount === 0);
    } else if (state.investorFilter === 'online') {
      investors = investors.filter(i => i.sessionStatus === 'online');
    }

    const allCount = state.data.investors.length;
    const compCount = state.data.investors.filter(i => i.startupsVotedCount === 13).length;
    const progCount = state.data.investors.filter(i => i.startupsVotedCount > 0 && i.startupsVotedCount < 13).length;
    const unvCount = state.data.investors.filter(i => i.startupsVotedCount === 0).length;
    const onlCount = state.data.investors.filter(i => i.sessionStatus === 'online').length;

    return `
      <!-- Search & Filters -->
      <div class="metrics-toolbar">
        <input type="text" class="metrics-search-input" id="investor-search-input"
          placeholder="🔍 Search eligible investors by name, email or ID..." value="${state.investorSearch}">
        <div class="metrics-filter-group">
          <button class="metrics-filter-chip ${state.investorFilter === 'all' ? 'active' : ''}" data-investor-filter="all">All (${allCount})</button>
          <button class="metrics-filter-chip ${state.investorFilter === 'complete' ? 'active' : ''}" data-investor-filter="complete">All 13 Done (${compCount})</button>
          <button class="metrics-filter-chip ${state.investorFilter === 'progress' ? 'active' : ''}" data-investor-filter="progress">In Progress (${progCount})</button>
          <button class="metrics-filter-chip ${state.investorFilter === 'unvoted' ? 'active' : ''}" data-investor-filter="unvoted">No Votes (${unvCount})</button>
          <button class="metrics-filter-chip ${state.investorFilter === 'online' ? 'active' : ''}" data-investor-filter="online">Online Now (${onlCount})</button>
        </div>
      </div>

      <!-- Investors Table -->
      <div class="roster-wrap" style="max-height:640px">
        <table class="metrics-table">
          <thead>
            <tr>
              <th>Investor Name</th>
              <th>Email Address</th>
              <th>User ID (Key)</th>
              <th>Signup Time (IST)</th>
              <th style="width:130px">Evaluated (/13)</th>
              <th style="width:110px">Participation</th>
              <th>Sentiment (👍 / ? / 👎)</th>
              <th>Vote Changes</th>
              <th>First Vote</th>
              <th>Last Vote</th>
              <th>Status</th>
              <th style="width:100px;text-align:center">Drill-Down</th>
            </tr>
          </thead>
          <tbody>
            ${investors.map(inv => {
              const isExpanded = state.expandedInvestors.has(inv.investorKey);
              const initials = (inv.name || 'Inv').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
              const statusPill = inv.sessionStatus === 'online'
                ? '<span class="live-stat-chip green" style="padding:2px 7px;font-size:10px"><span class="metrics-pulse-dot" style="width:5px;height:5px"></span> Online</span>'
                : inv.sessionStatus === 'idle'
                ? '<span class="live-stat-chip yellow" style="padding:2px 7px;font-size:10px">Idle</span>'
                : '<span class="live-stat-chip gray" style="padding:2px 7px;font-size:10px">Offline</span>';

              return `
                <tr class="metrics-row ${isExpanded ? 'expanded-row' : ''}" style="cursor:pointer" data-toggle-investor-expand="${inv.investorKey}">
                  <td>
                    <div style="display:flex;align-items:center;gap:10px">
                      <div class="investor-avatar" style="width:32px;height:32px;font-size:11px">${initials}</div>
                      <strong style="font-size:13.5px;color:#0f172a">${inv.name}</strong>
                    </div>
                  </td>
                  <td style="color:#475569">${inv.email}</td>
                  <td style="font-family:monospace;font-size:10.5px;color:#64748b">${inv.investorKey}</td>
                  <td style="color:#64748b;font-size:11px">${inv.signupTimestampFormatted}</td>
                  <td><strong>${inv.startupsVotedCount}</strong> <span style="color:#94a3b8">/ 13</span></td>
                  <td>
                    <div class="mini-prog">
                      <div class="mini-prog-bar"><div class="mini-prog-fill" style="width:${inv.participationPct}%"></div></div>
                      <span style="font-weight:800;font-size:11px">${inv.participationPct}%</span>
                    </div>
                  </td>
                  <td>
                    <span class="live-stat-chip green" style="padding:1px 6px;font-size:10px;font-weight:800">👍 ${inv.interestedCount}</span>
                    <span class="live-stat-chip yellow" style="padding:1px 6px;font-size:10px;font-weight:800">? ${inv.exploreCount}</span>
                    <span class="live-stat-chip blue" style="padding:1px 6px;font-size:10px;font-weight:800">👎 ${inv.notInterestedCount}</span>
                  </td>
                  <td>
                    ${inv.totalVoteChanges > 0
                      ? `<span class="live-stat-chip yellow" style="padding:1px 6px;font-size:10px;font-weight:800">${inv.totalVoteChanges} changes</span>`
                      : '<span style="color:#94a3b8;font-size:11px">0</span>'}
                  </td>
                  <td style="color:#64748b;font-size:11px">${inv.firstVoteAtFormatted ? inv.firstVoteAtFormatted.split('•')[1] || inv.firstVoteAtFormatted : '—'}</td>
                  <td style="color:#64748b;font-size:11px">${inv.lastVoteAtFormatted ? inv.lastVoteAtFormatted.split('•')[1] || inv.lastVoteAtFormatted : '—'}</td>
                  <td>${statusPill}</td>
                  <td style="text-align:center">
                    <button class="metrics-btn light" style="padding:4px 10px;font-size:11px" data-toggle-investor-expand="${inv.investorKey}">
                      ${isExpanded ? '▲ Hide' : '▼ Startups'}
                    </button>
                  </td>
                </tr>
                ${isExpanded ? renderInvestorDrilldownRow(inv) : ''}
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderInvestorDrilldownRow(investor) {
    return `
      <tr>
        <td colspan="12" style="padding:0;background:#f8fafc">
          <div class="drilldown-container">
            <div class="drilldown-header">
              <div>
                <span class="drilldown-title">
                  🏢 Startups Evaluated by <strong>${investor.name}</strong> (${investor.email})
                </span>
                <span style="font-size:12px;color:#64748b;margin-left:8px">
                  ${investor.startupsVotedCount} of 13 startups voted • Avg time to vote: <strong>${investor.avgTimeToVoteFormatted}</strong>
                </span>
              </div>
            </div>

            <div style="max-height:360px;overflow-y:auto;border-radius:12px;border:1px solid #e2e8f0">
              <table class="drilldown-table">
                <thead>
                  <tr>
                    <th style="width:70px">Pitch #</th>
                    <th>Startup Name</th>
                    <th>Sub-Sector</th>
                    <th>Vote Selection</th>
                    <th>Vote Timestamp (IST)</th>
                    <th>Vote Changes</th>
                    <th>Current Active Vote</th>
                  </tr>
                </thead>
                <tbody>
                  ${investor.evaluations.map(ev => {
                    const badgeClass = ev.vote === 'INTERESTED' ? 'green' : ev.vote === 'EXPLORE' ? 'yellow' : ev.vote === 'NOT_INTERESTED' ? 'blue' : 'gray';
                    const badgeIcon = ev.vote === 'INTERESTED' ? '👍' : ev.vote === 'EXPLORE' ? '?' : ev.vote === 'NOT_INTERESTED' ? '👎' : '⏳';
                    return `
                      <tr>
                        <td><span class="booth-tag">Booth ${ev.pitchNumber}</span></td>
                        <td><strong>${ev.startupName}</strong></td>
                        <td style="color:#64748b">${ev.subSector}</td>
                        <td>
                          <span class="live-stat-chip ${badgeClass}" style="padding:2px 8px;font-size:10.5px;font-weight:800">
                            ${badgeIcon} ${formatVoteLabel(ev.vote)}
                          </span>
                        </td>
                        <td style="color:#64748b;font-size:11px">${ev.voteTimestampFormatted}</td>
                        <td>
                          ${ev.voteChangesCount > 0 ? `
                            <span class="live-stat-chip yellow" style="padding:1px 6px;font-size:10px;font-weight:800">
                              ${ev.voteChangesCount} change${ev.voteChangesCount > 1 ? 's' : ''}
                            </span>
                          ` : '<span style="color:#94a3b8;font-size:11px">0</span>'}
                        </td>
                        <td><strong>${formatVoteLabel(ev.currentVote)}</strong></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  /* ── 4. Time Activity Tab ───────────────────────────────────── */
  function renderActivityTab() {
    let events = [...state.data.activity];

    if (state.activityFilter === 'votes') {
      events = events.filter(e => e.type === 'RESPONSE_SUBMITTED');
    } else if (state.activityFilter === 'updates') {
      events = events.filter(e => e.type === 'RESPONSE_UPDATED');
    } else if (state.activityFilter === 'signups') {
      events = events.filter(e => e.type === 'INVESTOR_JOINED');
    }

    const allCount = state.data.activity.length;
    const voteCount = state.data.activity.filter(e => e.type === 'RESPONSE_SUBMITTED').length;
    const updCount = state.data.activity.filter(e => e.type === 'RESPONSE_UPDATED').length;
    const signCount = state.data.activity.filter(e => e.type === 'INVESTOR_JOINED').length;

    return `
      <!-- Activity Filters -->
      <div class="metrics-toolbar">
        <div style="font-weight:850;font-size:13.5px;color:#0f172a">
          Chronological Activity Stream (${events.length} events recorded)
        </div>
        <div class="metrics-filter-group">
          <button class="metrics-filter-chip ${state.activityFilter === 'all' ? 'active' : ''}" data-activity-filter="all">All (${allCount})</button>
          <button class="metrics-filter-chip ${state.activityFilter === 'votes' ? 'active' : ''}" data-activity-filter="votes">Votes (${voteCount})</button>
          <button class="metrics-filter-chip ${state.activityFilter === 'updates' ? 'active' : ''}" data-activity-filter="updates">Vote Changes (${updCount})</button>
          <button class="metrics-filter-chip ${state.activityFilter === 'signups' ? 'active' : ''}" data-activity-filter="signups">Portal Signups (${signCount})</button>
        </div>
      </div>

      <!-- Activity Cards Feed -->
      <div class="activity-stream-wrap">
        ${events.length > 0 ? events.map(e => {
          let icon = '⚡';
          let iconClass = 'signup';
          if (e.type === 'INVESTOR_JOINED') {
            icon = '👤';
            iconClass = 'signup';
          } else if (e.type === 'RESPONSE_UPDATED') {
            icon = '🔄';
            iconClass = 'update';
          } else if (e.responseType === 'INTERESTED') {
            icon = '👍';
            iconClass = 'vote-interested';
          } else if (e.responseType === 'EXPLORE') {
            icon = '?';
            iconClass = 'vote-explore';
          } else if (e.responseType === 'NOT_INTERESTED') {
            icon = '👎';
            iconClass = 'vote-not-interested';
          }

          return `
            <div class="activity-stream-card">
              <div class="activity-stream-icon ${iconClass}">${icon}</div>
              <div class="activity-stream-content">
                <strong>${e.actorName}</strong>
                <span>${e.detail}</span>
              </div>
              <div class="activity-stream-time">
                ${e.timeFormattedIST} IST<br>
                <small style="color:#94a3b8;font-size:10px">${e.dateFormattedIST}</small>
              </div>
            </div>
          `;
        }).join('') : `
          <div style="text-align:center;padding:40px;color:#94a3b8">No events found matching selected filter.</div>
        `}
      </div>
    `;
  }

  /* ── 5. Export & Reports Tab ────────────────────────────────── */
  function renderExportTab() {
    return `
      <div style="margin-bottom:20px">
        <h3 style="margin:0 0 4px;font-size:18px">Official Demo Day Reports Export</h3>
        <p class="detail-label" style="margin:0">
          Direct database reports generated using the active eligibility cutoff (${state.data.cutoff.display}).
        </p>
      </div>

      <div class="metrics-kpi-grid">
        <!-- Startup Vote Report -->
        <div class="metrics-card accent-blue">
          <div class="metrics-card-header">
            <small>📊 Startup Vote Report</small>
            <span class="live-stat-chip blue" style="font-size:10px">CSV Download</span>
          </div>
          <p style="font-size:13px;color:#475569;line-height:1.45;margin:10px 0 16px">
            Comprehensive voting report sorted by startup booth. Contains pitch number, startup name, investor name, email, signup time, vote choice, and exact vote timestamp in IST.
          </p>
          <button class="metrics-btn primary" style="width:100%;justify-content:center" data-metrics-export="startup-votes">
            📥 Download Startup Vote Report (CSV)
          </button>
        </div>

        <!-- Investor Activity Report -->
        <div class="metrics-card accent-green">
          <div class="metrics-card-header">
            <small>👥 Investor Activity Report</small>
            <span class="live-stat-chip green" style="font-size:10px">CSV Download</span>
          </div>
          <p style="font-size:13px;color:#475569;line-height:1.45;margin:10px 0 16px">
            Full participation matrix for every eligible investor who signed up after the cutoff. Contains investor name, email, portal signup time, startup evaluated, pitch number, vote, and vote timestamp.
          </p>
          <button class="metrics-btn primary" style="width:100%;justify-content:center;background:#16a34a" data-metrics-export="investor-activity">
            📥 Download Investor Activity Report (CSV)
          </button>
        </div>

        <!-- JSON Metrics Backup -->
        <div class="metrics-card accent-purple">
          <div class="metrics-card-header">
            <small>🗄️ JSON Data Snapshot</small>
            <span class="live-stat-chip yellow" style="font-size:10px">JSON Raw</span>
          </div>
          <p style="font-size:13px;color:#475569;line-height:1.45;margin:10px 0 16px">
            Complete database snapshot containing all computed overview cards, startup totals, voter lists, evaluations, and activity stream for archiving and offline audits.
          </p>
          <button class="metrics-btn light" style="width:100%;justify-content:center" data-metrics-export="json">
            📥 Download Raw Metrics Snapshot (JSON)
          </button>
        </div>

        <!-- All PDFs ZIP Package -->
        <div class="metrics-card accent-indigo">
          <div class="metrics-card-header">
            <small>📑 Startup PDF Reports (All 13)</small>
            <span class="live-stat-chip green" style="font-size:10px">ZIP Archive</span>
          </div>
          <p style="font-size:13px;color:#475569;line-height:1.45;margin:10px 0 16px">
            Download all 13 official startup-wise PDF reports in a single compressed ZIP package. Ready for distribution to founders and investment committees.
          </p>
          <button class="metrics-btn primary" style="width:100%;justify-content:center;background:#4f46e5" data-download-all-pdfs-zip="true">
            📦 Download All 13 Startup PDFs (.ZIP)
          </button>
        </div>
      </div>

      <!-- Individual Startup PDF Reports Panel -->
      <div class="panel" style="margin-top:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0 0 4px">Startup-Wise PDF Reports (13 Startups)</h3>
            <p class="detail-label" style="margin:0">
              Executive-grade PDF reports with investor breakdowns, sentiment distribution, and verification timestamps.
            </p>
          </div>
          <button class="metrics-btn primary" data-download-all-pdfs-zip="true" style="background:#4f46e5">
            📦 Download All 13 PDFs (.ZIP)
          </button>
        </div>

        <div class="pdf-export-grid">
          ${state.data.startups.map(s => `
            <div class="pdf-export-card">
              <div>
                <div class="pdf-export-card-header">
                  <div>
                    <span class="booth-tag" style="margin-bottom:6px">Booth B${s.pitchNumber}</span>
                    <div class="pdf-export-card-title">${s.startupName}</div>
                    <div class="pdf-export-card-sub">${s.subSector}</div>
                  </div>
                  <span class="live-stat-chip ${s.totalActiveVotes > 0 ? 'green' : 'blue'}" style="font-size:10.5px">
                    ${s.totalActiveVotes} Votes
                  </span>
                </div>
                <div class="pdf-export-stats">
                  <div>Voted: <strong>${s.votedCount}</strong>/${s.eligibleInvestorCount}</div>
                  <div>Turnout: <strong>${s.participationPct}%</strong></div>
                  <div>Interested: <strong style="color:#16a34a">${s.interestedVotes}</strong></div>
                </div>
              </div>
              <div class="pdf-export-actions">
                <button class="metrics-btn primary" data-download-startup-pdf="${s.startupId}">
                  📥 Download PDF
                </button>
                <button class="metrics-btn light" data-print-startup-report="${s.startupId}">
                  🖨️ View / Print
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* ── Custom Cutoff Modal ────────────────────────────────────── */
  function renderCutoffModal() {
    return `
      <div class="cutoff-modal-overlay">
        <div class="cutoff-modal-box">
          <h3>Configure Investor Eligibility Cutoff</h3>
          <p>
            Filter investors by their portal signup/entry timestamp. Only investors who joined strictly after this time will be considered in metrics.
          </p>

          <div class="cutoff-modal-form-group">
            <label for="custom-cutoff-datetime">Cutoff Date & Time (Asia/Kolkata / IST):</label>
            <input type="datetime-local" id="custom-cutoff-datetime" class="cutoff-modal-input"
              value="${new Date(state.cutoff).toISOString().slice(0, 16)}">
          </div>

          <div style="font-size:12px;color:#64748b;margin-bottom:16px">
            Current Active: <strong>${formatIST(state.cutoff)}</strong>
          </div>

          <div class="cutoff-modal-actions">
            <button class="metrics-btn light" data-action="close-cutoff-modal">Cancel</button>
            <button class="metrics-btn primary" data-action="apply-custom-cutoff">Apply Cutoff</button>
          </div>
        </div>
      </div>
    `;
  }

  // ══════════════════════════════════════════════════════════════
  // EVENT BINDINGS
  // ══════════════════════════════════════════════════════════════

  function bindTabEvents(container) {
    // Mode Switcher
    container.querySelectorAll('[data-admin-mode]').forEach(btn => {
      btn.onclick = () => {
        const mode = btn.dataset.adminMode;
        if (window.switchAdminMode) {
          window.switchAdminMode(mode);
        }
      };
    });

    // Subnav Tab Switcher
    container.querySelectorAll('[data-metrics-tab]').forEach(btn => {
      btn.onclick = () => {
        state.activeTab = btn.dataset.metricsTab;
        render(container);
      };
    });

    // Refresh Action
    const refreshBtn = container.querySelector('[data-metrics-action="refresh"]');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        loadData(true).then(() => {
          render(container);
          if (window.toast) window.toast('✓ Live database metrics updated');
        });
      };
    }

    // Set Cutoff Action
    const setCutoffBtn = container.querySelector('[data-metrics-action="set-cutoff"]');
    if (setCutoffBtn) {
      setCutoffBtn.onclick = () => {
        state.showCutoffModal = true;
        render(container);
      };
    }

    // Cutoff Presets
    container.querySelectorAll('[data-cutoff-preset]').forEach(btn => {
      btn.onclick = () => {
        const preset = btn.dataset.cutoffPreset;
        if (preset === 'default') {
          state.cutoff = DEFAULT_CUTOFF_IST;
        } else if (preset === 'all') {
          state.cutoff = '1970-01-01T00:00:00Z';
        } else if (preset === 'custom') {
          state.showCutoffModal = true;
          render(container);
          return;
        }
        sessionStorage.setItem('startup-demo-metrics-cutoff', state.cutoff);
        loadData(true).then(() => render(container));
      };
    });

    // Cutoff Modal Actions
    const closeCutoffBtn = container.querySelector('[data-action="close-cutoff-modal"]');
    if (closeCutoffBtn) {
      closeCutoffBtn.onclick = () => {
        state.showCutoffModal = false;
        render(container);
      };
    }

    const applyCutoffBtn = container.querySelector('[data-action="apply-custom-cutoff"]');
    if (applyCutoffBtn) {
      applyCutoffBtn.onclick = () => {
        const input = document.getElementById('custom-cutoff-datetime');
        if (input && input.value) {
          state.cutoff = new Date(input.value).toISOString();
          sessionStorage.setItem('startup-demo-metrics-cutoff', state.cutoff);
          state.showCutoffModal = false;
          loadData(true).then(() => render(container));
        }
      };
    }

    // Startup Sort
    container.querySelectorAll('[data-sort-startup]').forEach(th => {
      th.onclick = () => {
        const col = th.dataset.sortStartup;
        if (state.startupSort.col === col) {
          state.startupSort.dir = state.startupSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          state.startupSort.col = col;
          state.startupSort.dir = 'desc';
        }
        render(container);
      };
    });

    // Startup Search Input
    const sSearch = document.getElementById('startup-search-input');
    if (sSearch) {
      sSearch.oninput = (e) => {
        state.startupSearch = e.target.value;
        render(container);
        const input = document.getElementById('startup-search-input');
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      };
    }

    // Toggle Startup Drilldown Expand
    container.querySelectorAll('[data-toggle-startup-expand]').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const sId = el.dataset.toggleStartupExpand;
        if (state.expandedStartups.has(sId)) {
          state.expandedStartups.delete(sId);
        } else {
          state.expandedStartups.add(sId);
        }
        render(container);
      };
    });

    // Startup Voter Filter
    container.querySelectorAll('[data-startup-voter-filter]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sId = btn.dataset.startupId;
        const filter = btn.dataset.startupVoterFilter;
        state.startupVoterFilters[sId] = filter;
        render(container);
      };
    });

    // Startup Voter Search
    container.querySelectorAll('[data-startup-voter-search]').forEach(input => {
      input.oninput = (e) => {
        e.stopPropagation();
        const sId = input.dataset.startupVoterSearch;
        state.startupVoterSearch[sId] = e.target.value;
        render(container);
        const freshInput = container.querySelector(`[data-startup-voter-search="${sId}"]`);
        if (freshInput) {
          freshInput.focus();
          freshInput.setSelectionRange(freshInput.value.length, freshInput.value.length);
        }
      };
    });

    // Investor Search Input
    const iSearch = document.getElementById('investor-search-input');
    if (iSearch) {
      iSearch.oninput = (e) => {
        state.investorSearch = e.target.value;
        render(container);
        const input = document.getElementById('investor-search-input');
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      };
    }

    // Investor Cohort Filters
    container.querySelectorAll('[data-investor-filter]').forEach(btn => {
      btn.onclick = () => {
        state.investorFilter = btn.dataset.investorFilter;
        render(container);
      };
    });

    // Toggle Investor Drilldown Expand
    container.querySelectorAll('[data-toggle-investor-expand]').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const key = el.dataset.toggleInvestorExpand;
        if (state.expandedInvestors.has(key)) {
          state.expandedInvestors.delete(key);
        } else {
          state.expandedInvestors.add(key);
        }
        render(container);
      };
    });

    // Activity Stream Filter
    container.querySelectorAll('[data-activity-filter]').forEach(btn => {
      btn.onclick = () => {
        state.activityFilter = btn.dataset.activityFilter;
        render(container);
      };
    });

    // Export Buttons
    container.querySelectorAll('[data-metrics-export]').forEach(btn => {
      btn.onclick = () => {
        const type = btn.dataset.metricsExport;
        if (type === 'startup-votes') exportStartupVotesReport();
        else if (type === 'investor-activity') exportInvestorActivityReport();
        else if (type === 'json') exportJsonSnapshot();
      };
    });

    // Individual Startup PDF Download
    container.querySelectorAll('[data-download-startup-pdf]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sId = btn.dataset.downloadStartupPdf;
        downloadStartupPdf(sId);
      };
    });

    // Startup Print / View Report
    container.querySelectorAll('[data-print-startup-report]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sId = btn.dataset.printStartupReport;
        printStartupReport(sId);
      };
    });

    // Download All 13 Startup PDFs ZIP Package
    container.querySelectorAll('[data-download-all-pdfs-zip]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        downloadAllPdfsZip();
      };
    });
  }

  // Public Interface
  window.AdminMetrics = {
    render: render,
    loadData: loadData,
    formatIST: formatIST,
    downloadStartupPdf: downloadStartupPdf,
    printStartupReport: printStartupReport,
    downloadAllPdfsZip: downloadAllPdfsZip,
    onRealtimeUpdate: () => {
      loadData(false).then(() => {
        const root = document.getElementById('admin-root');
        if (root && window.adminActiveView === 'metrics') {
          render(root);
        }
      });
    },
    getState: () => state,
    setCutoff: (cutoffIso) => {
      state.cutoff = cutoffIso;
      sessionStorage.setItem('startup-demo-metrics-cutoff', cutoffIso);
      return loadData(true);
    },
    exportStartupVotes: exportStartupVotesReport,
    exportInvestorActivity: exportInvestorActivityReport
  };
})();
