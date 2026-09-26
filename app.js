(() => {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     SUPABASE CONNECTION & REALTIME CONFIG
     ══════════════════════════════════════════════════════════════ */
  const cfg = (typeof window !== 'undefined' && (window.APP_CONFIG || window.__ENV__)) || {};
  const SUPABASE_URL = cfg.SUPABASE_URL || 'https://toucgwdalgtkcfhebvgo.supabase.co';
  const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvdWNnd2RhbGd0a2NmaGVidmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzIzNzQsImV4cCI6MjEwNTg0ODM3NH0.YOpoQ6lzRgeicJvsiC4Zun78jvYtW7_TzCFosaG0HZQ';

  let supabase = null;
  let realtimeChannel = null;
  try {
    const supaLib = (typeof window !== 'undefined' && window.supabase) || (typeof supabase !== 'undefined' ? supabase : null);
    if (supaLib && supaLib.createClient) {
      supabase = supaLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: { params: { eventsPerSecond: 20 } }
      });
      console.log('[Supabase] Connected to:', SUPABASE_URL);
    }
  } catch (err) {
    console.warn('[Supabase] Client initialization failed:', err);
  }

  /* ══════════════════════════════════════════════════════════════
     CONSTANTS & MASTER DATA
     ══════════════════════════════════════════════════════════════ */
  const TOTAL_PITCHES = 12;
  const STORAGE_KEY = 'startup-demo-live-v2';
  const SESSION_KEY = 'startup-demo-session-v2';
  const OUTBOX_KEY = 'startup-demo-outbox-v2';
  const CHANNEL_NAME = 'startup-demo-live-v2';
  const RESPONSE = { INTERESTED: 'INTERESTED', EXPLORE: 'EXPLORE', NOT_INTERESTED: 'NOT_INTERESTED' };
  const COLORS = { INTERESTED: 'green', EXPLORE: 'yellow', NOT_INTERESTED: 'blue' };

  const ORDER_STORAGE_KEY = 'startup-demo-order-v6';

  // Purge any stale order keys from older sessions
  ['startup-demo-order', 'startup-demo-order-v1', 'startup-demo-order-v2', 'startup-demo-order-v3', 'startup-demo-order-v4', 'startup-demo-order-v5'].forEach(k => {
    try { localStorage.removeItem(k); } catch (_) {}
  });

  const STARTUPS_MASTER = [
    {
      id: 's07',
      n: 1,
      name: 'Shraddha Farms',
      subSector: 'Dairy',
      tagline: '',
      initial: 'S',
      accent: 'blue'
    },
    {
      id: 's01',
      n: 2,
      name: 'Mecco',
      subSector: 'Farm Mechanisation',
      tagline: '',
      initial: 'M',
      accent: 'green'
    },
    {
      id: 's08',
      n: 3,
      name: 'Kumbhargaon Agro',
      subSector: 'FPO',
      tagline: '',
      initial: 'K',
      accent: 'green'
    },
    {
      id: 's02',
      n: 4,
      name: 'Neoperk',
      subSector: 'Soil & Precision Agriculture',
      tagline: '',
      initial: 'N',
      accent: 'blue'
    },
    {
      id: 's06',
      n: 5,
      name: 'WhatsLoan',
      subSector: 'Agri-Fintech',
      tagline: 'We bring banks to the farmers with agri loan market place and digital financial identity to empower farmers.',
      initial: 'W',
      accent: 'blue'
    },
    {
      id: 's10',
      n: 6,
      name: 'GAON NASP',
      subSector: 'Rural Operating System',
      tagline: '',
      initial: 'G',
      accent: 'yellow'
    },
    {
      id: 's03',
      n: 7,
      name: 'EarthSaathi',
      subSector: 'Clean Energy - Climate Tech',
      tagline: '',
      initial: 'E',
      accent: 'green'
    },
    {
      id: 's05',
      n: 8,
      name: 'Deccan Pack',
      subSector: 'Packaging',
      tagline: '',
      initial: 'D',
      accent: 'blue'
    },
    {
      id: 's04',
      n: 9,
      name: 'Poshaqq',
      subSector: 'Food Processing',
      tagline: 'Ghar jaisa khana with zero kitchen drama.',
      initial: 'P',
      accent: 'yellow'
    },
    {
      id: 's09',
      n: 10,
      name: 'NxtQube',
      subSector: 'Agentic Drones',
      tagline: '',
      initial: 'N',
      accent: 'purple'
    },
    {
      id: 's11',
      n: 11,
      name: 'SP Agro',
      subSector: 'Farm Mechanisation',
      tagline: '',
      initial: 'S',
      accent: 'green'
    },
    {
      id: 's12',
      n: 12,
      name: 'Borse Automotive',
      subSector: 'Agri Robotics',
      tagline: '',
      initial: 'B',
      accent: 'purple'
    }
  ];

  function loadStartupOrder() {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length === STARTUPS_MASTER.length) {
        const masterIds = new Set(STARTUPS_MASTER.map(s => s.id));
        const allValid = saved.every(id => masterIds.has(id));
        if (allValid) return saved;
      }
    } catch (_) {}
    return null;
  }

  function applyStartupOrder(orderIds, shouldSave = true) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return;
    const map = new Map(STARTUPS_MASTER.map(s => [s.id, { ...s }]));
    const ordered = [];
    orderIds.forEach(id => {
      if (map.has(id)) {
        ordered.push(map.get(id));
        map.delete(id);
      }
    });
    map.forEach(s => ordered.push(s));
    ordered.forEach((s, idx) => {
      s.n = idx + 1;
    });
    startups = ordered;
    if (shouldSave) {
      try {
        localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orderIds));
      } catch (_) {}
    }
  }

  let startups = STARTUPS_MASTER.map((s, idx) => ({ ...s, n: idx + 1 }));
  const initialSavedOrder = loadStartupOrder();
  if (initialSavedOrder) {
    applyStartupOrder(initialSavedOrder, false);
  }

  const refImages = [
    ['01-investor-flow-overview.png', 'Investor flow overview'],
    ['02-investor-live-pitch.png', 'Original pitch screen reference'],
    ['03-response-recorded.png', 'Response recorded confirmation'],
    ['04-startup-list.png', 'Startup list reference'],
    ['05-startup-list-color-coded.png', 'Color-coded startup list'],
    ['06-startup-list-final.png', 'Final startup list reference'],
    ['07-not-interested-blue.png', 'Not Interested in blue'],
    ['08-startup-demo.png', 'Startup demo detail screen']
  ];

  const defaultState = {
    pitch: 1,
    responseByInvestor: {},
    eventStatus: 'READY',
    stageStatus: 'STANDBY',
    published: {},
    network: 'ONLINE',
    stateVersion: 1,
    adminAudit: [],
    investorResponses: 0
  };

  // Suppress automatic browser PWA install prompt on first load so user isn't interrupted
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.__deferredInstallPrompt = e;
    });
  }

  /* ══════════════════════════════════════════════════════════════
     RUNTIME APP STATE
     ══════════════════════════════════════════════════════════════ */
  let state = loadState();
  let session = loadSession();
  let investorScreen = session ? 'list' : 'join';
  let selectedStartup = null;
  let lastSubmitted = null;
  let route = 'investor';
  let startupFilter = 'all';
  let myResponseFilter = 'all'; // 'all' | 'INTERESTED' | 'EXPLORE' | 'NOT_INTERESTED'
  let toastTimer = null;
  let pendingChoice = null;
  let isEditingVote = false;
  const myInvestorKeys = new Set(session?.id ? [session.id] : []);

  // Live Admin Data (Maintained live via Supabase Realtime + smart polling)
  let adminLiveStats = {
    investors: [],
    responses: [],
    lastSync: null,
    isSyncing: false
  };
  let adminRosterFilter = 'all'; // 'all' | 'online' | 'voted' | 'pending'

  // Real-time Activity Ticker (streaming events)
  const realtimeStream = [];

  /* ── Network & Outbox (Offline-First / Zero Data Loss) ──────── */
  let netState = navigator.onLine ? 'ONLINE' : 'OFFLINE';
  let outboxQueue = loadOutbox();
  let isFlushingOutbox = false;
  let feedBuffer = [];
  let feedFlushTimer = null;

  const deviceInfo = (() => {
    const ua = navigator.userAgent;
    const w = window.innerWidth || screen.width;
    const h = window.innerHeight || screen.height;
    const mobile = /Mobi|Android|iPhone|iPad/i.test(ua);
    return `${mobile ? 'Mobile' : 'Desktop'} ${w}x${h} | ${ua.slice(0, 80)}`;
  })();

  /* ══════════════════════════════════════════════════════════════
     STATE & STORAGE HELPERS
     ══════════════════════════════════════════════════════════════ */
  function loadState() {
    try {
      return { ...defaultState, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
    } catch (_) {
      return { ...defaultState };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('[Storage] Save state error:', err);
    }
  }

  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function saveSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn('[Storage] Save session error:', err);
    }
  }

  function loadOutbox() {
    try {
      return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function saveOutbox() {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(outboxQueue));
    } catch (err) {
      console.warn('[Storage] Save outbox error:', err);
    }
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = msg;
    el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function audit(action, detail, actor = 'ADMIN') {
    state.adminAudit.unshift({
      ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action,
      detail,
      actor
    });
    state.adminAudit = state.adminAudit.slice(0, 60);
  }

  function getInvestorKey() {
    return session?.id || 'demo-investor';
  }

  function responseFor(startupId) {
    return state.responseByInvestor[getInvestorKey()]?.[startupId] || null;
  }

  function responseLabel(value) {
    return value === RESPONSE.INTERESTED ? 'Interested' : value === RESPONSE.EXPLORE ? 'Explore more' : value === RESPONSE.NOT_INTERESTED ? 'Not my area of interest' : 'Tap to vote';
  }

  function responseColor(value) {
    return value ? COLORS[value] : 'none';
  }

  function responseIcon(value) {
    return value === RESPONSE.INTERESTED ? '👍' : value === RESPONSE.EXPLORE ? '?' : value === RESPONSE.NOT_INTERESTED ? '👎' : '';
  }

  function generateSecureToken() {
    const arr = new Uint8Array(24);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
    } else {
      for (let i = 0; i < 24; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  const SAVED_ACCOUNTS_KEY = 'startup-demo-saved-investors-v2';

  function getSavedAccounts() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY));
      if (Array.isArray(data)) return data;
    } catch (e) {
      console.warn('[Accounts] Read note:', e);
    }
    return [];
  }

  function saveAccountProfile(acc) {
    if (!acc || !acc.email) return;
    const list = getSavedAccounts();
    const cleanEmail = acc.email.trim().toLowerCase();
    const existingIdx = list.findIndex(a => a.email.toLowerCase() === cleanEmail);
    const updated = {
      investorKey: acc.id || acc.investorKey,
      name: acc.name,
      email: cleanEmail,
      lastActive: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...updated };
    } else {
      list.unshift(updated);
    }
    try {
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(list.slice(0, 8)));
    } catch (e) {
      console.warn('[Accounts] Save note:', e);
    }
  }

  function makeInvestorKey(email) {
    const clean = (email || '').trim().toLowerCase();
    let hash = 5381;
    for (let i = 0; i < clean.length; i++) {
      hash = ((hash << 5) + hash) + clean.charCodeAt(i);
      hash |= 0;
    }
    const safePrefix = clean.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'investor';
    const safeDomain = (clean.split('@')[1] || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'fund';
    return `inv_${safePrefix}_${safeDomain}_${Math.abs(hash).toString(36)}`;
  }

  /* ══════════════════════════════════════════════════════════════
     DYNAMIC NETWORK BADGE (Resilience & Offline Indicator)
     ══════════════════════════════════════════════════════════════ */
  let realtimeReconnectAttempts = 0;
  let realtimeReconnectTimer = null;
  let realtimeConnected = false;

  function scheduleRealtimeReconnect() {
    if (realtimeReconnectTimer || !navigator.onLine) return;
    const delay = Math.min(30000, 1500 * Math.pow(1.5, realtimeReconnectAttempts) + Math.random() * 1000);
    realtimeReconnectAttempts++;
    console.log(`[Supabase Realtime] Reconnecting channel in ${(delay / 1000).toFixed(1)}s (attempt ${realtimeReconnectAttempts})...`);
    updateNetworkStatusBadges();
    realtimeReconnectTimer = setTimeout(() => {
      realtimeReconnectTimer = null;
      if (navigator.onLine) {
        initSupabaseRealtime();
      }
    }, delay);
  }

  function updateNetworkStatusBadges() {
    const pendingCount = outboxQueue.length;
    let label = 'Online (Live sync)';
    let cls = 'online';

    if (!navigator.onLine || netState === 'OFFLINE') {
      cls = 'offline';
      label = pendingCount > 0 ? `Offline (${pendingCount} saved)` : 'Offline (Local mode)';
    } else if (pendingCount > 0 || isFlushingOutbox) {
      cls = 'syncing';
      label = `Syncing (${pendingCount} pending)`;
    } else if (!realtimeConnected && realtimeReconnectAttempts > 0) {
      cls = 'syncing';
      label = 'Reconnecting (Cloud sync)...';
    } else {
      cls = 'online';
      label = 'Online (Live sync)';
    }

    const adminPill = document.getElementById('admin-network');
    if (adminPill) {
      adminPill.className = `net-badge ${cls}`;
      adminPill.innerHTML = `<i></i> ${label}`;
    }

    const invPill = document.getElementById('investor-network');
    if (invPill) {
      invPill.className = `net-badge ${cls}`;
      invPill.innerHTML = `<i></i> ${label}`;
    }
  }

  window.addEventListener('online', () => {
    netState = 'ONLINE';
    realtimeReconnectAttempts = 0;
    updateNetworkStatusBadges();
    toast('Network online — syncing data...');
    flushOutboxQueue();
    initSupabaseRealtime();
  });

  window.addEventListener('offline', () => {
    netState = 'OFFLINE';
    updateNetworkStatusBadges();
    toast('Working offline — your changes are safely saved locally.');
  });

  /* ══════════════════════════════════════════════════════════════
     OUTBOX QUEUE & OFFLINE ENGINE (Zero Data Loss under 1000+ concurrency)
     ══════════════════════════════════════════════════════════════ */
  function enqueueOutbox(item) {
    const entry = {
      id: 'out_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type: item.type,
      payload: item.payload,
      createdAt: new Date().toISOString(),
      attempts: 0
    };
    outboxQueue.push(entry);
    saveOutbox();
    updateNetworkStatusBadges();
    // Trigger immediate background sync attempt with backoff
    setTimeout(() => flushOutboxQueue(), 50);
  }

  async function flushOutboxQueue() {
    if (isFlushingOutbox || !supabase || outboxQueue.length === 0) return;
    if (!navigator.onLine) {
      netState = 'OFFLINE';
      updateNetworkStatusBadges();
      return;
    }

    isFlushingOutbox = true;
    updateNetworkStatusBadges();

    const remaining = [];
    let syncedAny = false;

    for (const item of outboxQueue) {
      try {
        let success = false;
        if (item.type === 'REGISTER_INVESTOR') {
          const { error } = await supabase.from('demo_investors').upsert({
            investor_key: item.payload.investorKey,
            full_name: item.payload.fullName,
            email: item.payload.email,
            session_token: item.payload.sessionToken,
            last_active: new Date().toISOString(),
            joined_at: item.payload.joinedAt || new Date().toISOString()
          }, { onConflict: 'investor_key' });
          if (!error) success = true;
        } else if (item.type === 'SUBMIT_RESPONSE') {
          const basePayload = {
            investor_key: item.payload.investorKey,
            startup_id: item.payload.startupId,
            startup_name: item.payload.startupName || null,
            response_type: item.payload.responseType,
            idempotency_key: item.payload.idempotencyKey,
            recorded_at: item.payload.recordedAt || new Date().toISOString()
          };

          // 1. Upsert to Supabase demo_responses (matches live database schema)
          let { error } = await supabase.from('demo_responses').upsert(basePayload, { onConflict: 'idempotency_key' });

          // 2. If onConflict error occurs, fallback to insert
          if (error && error.code !== '23505') {
            console.warn('[Outbox] Standard upsert error, attempting fallback insert:', error.message);
            const insRes = await supabase.from('demo_responses').insert(basePayload);
            if (!insRes.error) error = null;
          }

          if (!error) {
            success = true;
            console.log('[Outbox] Successfully recorded vote in database:', item.payload.idempotencyKey);
          } else {
            console.error('[Outbox] Failed to record vote:', error.message || error);
          }
        } else if (item.type === 'ADMIN_ACTION') {
          const { error } = await supabase.from('demo_admin_actions').insert({
            action_type: item.payload.actionType,
            detail: item.payload.detail,
            state_snapshot: item.payload.stateSnapshot || {},
            created_at: item.payload.createdAt || new Date().toISOString()
          });
          if (!error) success = true;
        }

        if (success) {
          syncedAny = true;
        } else {
          item.attempts = (item.attempts || 0) + 1;
          remaining.push(item);
        }
      } catch (err) {
        item.attempts = (item.attempts || 0) + 1;
        remaining.push(item);
      }
    }

    outboxQueue = remaining;
    saveOutbox();
    isFlushingOutbox = false;
    netState = navigator.onLine ? 'ONLINE' : 'OFFLINE';
    updateNetworkStatusBadges();

    if (syncedAny && outboxQueue.length === 0) {
      console.log('[Outbox] All items safely synced to cloud.');
    }
  }

  // Periodic Outbox Sync Runner (every 4 seconds + random jitter to prevent thundering herds)
  setInterval(() => {
    if (outboxQueue.length > 0 && navigator.onLine) {
      flushOutboxQueue();
    }
  }, 3500 + Math.random() * 1000);

  /* ══════════════════════════════════════════════════════════════
     BATCHED INTERACTION FEED (Scale for 1000+ concurrent interactions)
     ══════════════════════════════════════════════════════════════ */
  function recordFeed(eventType, data = {}) {
    const evt = {
      event_type: eventType,
      actor_id: data.actorId || session?.id || null,
      actor_name: data.actorName || session?.name || null,
      actor_email: data.actorEmail || session?.email || null,
      startup_id: data.startupId || null,
      startup_name: data.startupName || null,
      response_type: data.responseType || null,
      detail: data.detail || null,
      metadata: data.metadata || {},
      device_info: deviceInfo,
      created_at: new Date().toISOString()
    };

    feedBuffer.push(evt);

    // Stream to local live ticker immediately
    if (eventType === 'RESPONSE_SUBMITTED' || eventType === 'INVESTOR_JOINED' || eventType === 'STAGE_PUBLISHED') {
      pushRealtimeStreamItem({
        type: eventType,
        actor: evt.actor_name || 'Investor',
        startup: evt.startup_name || '',
        response: evt.response_type || '',
        detail: evt.detail || '',
        time: new Date()
      });
    }

    if (feedBuffer.length >= 8) {
      flushFeedBuffer();
    } else if (!feedFlushTimer) {
      feedFlushTimer = setTimeout(() => {
        feedFlushTimer = null;
        flushFeedBuffer();
      }, 2500);
    }
  }

  async function flushFeedBuffer() {
    if (feedBuffer.length === 0 || !supabase || !navigator.onLine) return;
    const batch = feedBuffer.slice();
    feedBuffer = [];

    try {
      const { error } = await supabase.from('interaction_feed').insert(batch);
      if (error) {
        console.warn('[Feed] Batch insert warning:', error.message);
      }
    } catch (err) {
      console.warn('[Feed] Flush error:', err);
    }
  }

  function pushRealtimeStreamItem(item) {
    realtimeStream.unshift(item);
    if (realtimeStream.length > 30) realtimeStream.pop();
    if (route === 'admin' && adminUnlocked) {
      renderAdmin();
    }
  }

  /* ══════════════════════════════════════════════════════════════
     PASSWORDLESS USER SIGNUP & SAFE MULTI-LOGIN (No Overrides)
     ══════════════════════════════════════════════════════════════ */
  async function performLogin(name, email) {
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      toast('Please enter your full name.');
      document.getElementById('join-name')?.focus();
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      toast('Please enter a valid work or personal email address.');
      document.getElementById('join-email')?.focus();
      return;
    }

    let investorKey = makeInvestorKey(cleanEmail);
    let sessionToken = generateSecureToken();
    let displayName = cleanName;

    // 1. Safe Multi-Login Check: query Supabase if this email was already registered
    if (supabase) {
      try {
        const { data: existingUsers } = await supabase
          .from('demo_investors')
          .select('investor_key, full_name, email')
          .ilike('email', cleanEmail)
          .order('joined_at', { ascending: false });

        if (existingUsers && existingUsers.length > 0) {
          existingUsers.forEach(u => {
            if (u.investor_key) myInvestorKeys.add(u.investor_key);
          });
          const existingUser = existingUsers[0];
          if (existingUser?.investor_key) {
            investorKey = existingUser.investor_key;
            if (!displayName && existingUser.full_name) {
              displayName = existingUser.full_name;
            }
          }
        }
      } catch (err) {
        console.warn('[Login] Existing user lookup note:', err);
      }
    }

    myInvestorKeys.add(investorKey);
    myInvestorKeys.add(makeInvestorKey(cleanEmail));

    session = {
      id: investorKey,
      name: displayName,
      email: cleanEmail,
      sessionToken,
      joinedAt: new Date().toISOString()
    };
    saveSession();
    saveAccountProfile(session);

    // Ensure bucket exists in local state without wiping out any previous data
    if (!state.responseByInvestor[session.id]) {
      state.responseByInvestor[session.id] = {};
    }

    audit('INVESTOR_JOINED', `${displayName} (${cleanEmail}) signed in`, 'SYSTEM');
    investorScreen = 'list';
    renderAll();

    // Persist via Outbox (Guaranteed delivery even with offline or weak network)
    enqueueOutbox({
      type: 'REGISTER_INVESTOR',
      payload: {
        investorKey,
        fullName: displayName,
        email: cleanEmail,
        sessionToken,
        joinedAt: session.joinedAt
      }
    });

    recordFeed('INVESTOR_JOINED', {
      actorId: investorKey,
      actorName: displayName,
      actorEmail: cleanEmail,
      detail: `${displayName} logged in (${cleanEmail})`
    });

    // 2. Safely restore all previous votes from Supabase across all devices!
    const restored = await restoreResponsesFromSupabase(investorKey, cleanEmail);
    if (restored > 0) {
      toast(`✓ Welcome back, ${displayName}! Synced ${restored} previous votes from your devices.`);
    } else {
      toast(`✓ Welcome, ${displayName} — Ready to cast your live votes.`);
    }
  }

  async function joinEvent() {
    const nameInput = document.getElementById('join-name');
    const emailInput = document.getElementById('join-email');
    await performLogin(nameInput?.value, emailInput?.value);
  }

  async function restoreSessionFromSupabase() {
    if (!supabase || !session?.id) return false;
    try {
      const { data, error } = await supabase
        .from('demo_investors')
        .select('investor_key, full_name, email, session_token')
        .eq('investor_key', session.id)
        .maybeSingle();

      if (error || !data) return false;

      // Update last active
      supabase.from('demo_investors').update({
        last_active: new Date().toISOString()
      }).eq('investor_key', session.id).then(() => {}).catch(() => {});

      return true;
    } catch (err) {
      console.warn('[Session] Restore check failed:', err);
      return false;
    }
  }

  async function restoreResponsesFromSupabase(targetKey, targetEmail) {
    const key = targetKey || session?.id;
    const email = (targetEmail || session?.email || '').trim().toLowerCase();
    if (!supabase || (!key && !email)) return 0;
    try {
      // 1. Gather all investor_keys associated with this email or targetKey
      const keysToQuery = [key].filter(Boolean);
      if (key) myInvestorKeys.add(key);
      if (email) {
        try {
          const { data: matchedUsers } = await supabase
            .from('demo_investors')
            .select('investor_key')
            .ilike('email', email);
          if (matchedUsers && matchedUsers.length > 0) {
            matchedUsers.forEach(u => {
              if (u.investor_key) {
                myInvestorKeys.add(u.investor_key);
                if (!keysToQuery.includes(u.investor_key)) {
                  keysToQuery.push(u.investor_key);
                }
              }
            });
          }
        } catch (err) {
          console.warn('[Sync] User keys query notice:', err);
        }
      }

      // 2. Query demo_responses using actual valid columns in Supabase
      let query = supabase
        .from('demo_responses')
        .select('startup_id, startup_name, response_type, recorded_at, idempotency_key, investor_key');

      if (keysToQuery.length === 1) {
        query = query.eq('investor_key', keysToQuery[0]);
      } else if (keysToQuery.length > 1) {
        query = query.in('investor_key', keysToQuery);
      } else {
        return 0;
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const bucket = state.responseByInvestor[key] || (state.responseByInvestor[key] = {});
        let newRestored = 0;
        data.forEach(r => {
          const existing = bucket[r.startup_id];
          const hasChanged = !existing || existing.response !== r.response_type;

          if (hasChanged) {
            bucket[r.startup_id] = {
              response: r.response_type,
              startupId: r.startup_id,
              startupNumber: startups.find(s => s.id === r.startup_id)?.n || parseInt((r.startup_id || '').replace(/\D/g, ''), 10) || 1,
              startupName: (startups.find(s => s.id === r.startup_id)?.name || r.startup_name || existing?.startupName || r.startup_id),
              investorKey: key,
              investorName: session?.name || 'Registered Investor',
              investorEmail: session?.email || email,
              recordedAt: r.recorded_at || existing?.recordedAt || new Date().toISOString(),
              idempotencyKey: r.idempotency_key || existing?.idempotencyKey || `${key}:${r.startup_id}`
            };
            newRestored++;
          }
        });
        if (newRestored > 0) {
          saveState();
          renderAll();
          console.log(`[Session] Restored/Synced ${newRestored} responses from cloud across devices for ${email || key}.`);
        }
        return data.length;
      }
    } catch (err) {
      console.warn('[Session] Response restore failed:', err);
    }
    return 0;
  }

  function switchInvestorAccount() {
    if (confirm(`Switch account? (Currently signed in as ${session?.email || 'Guest'})`)) {
      session = null;
      localStorage.removeItem(SESSION_KEY);
      investorScreen = 'join';
      renderInvestor();
      toast('Signed out. Select a saved investor profile or enter new credentials.');
    }
  }

  /* ══════════════════════════════════════════════════════════════
     LIVE INVESTOR PRESENCE HEARTBEAT (Keeps last_active fresh)
     ══════════════════════════════════════════════════════════════ */
  let lastHeartbeatTime = 0;
  async function sendInvestorHeartbeat() {
    if (!session?.id || !supabase || !navigator.onLine) return;
    const now = Date.now();
    if (now - lastHeartbeatTime < 15000) return; // rate-limit to at most once per 15s
    lastHeartbeatTime = now;
    try {
      await supabase
        .from('demo_investors')
        .update({ last_active: new Date().toISOString() })
        .eq('investor_key', session.id);
    } catch (_) {
      // quiet fail
    }
  }

  // Periodic background multi-device sync for active investor session (every 8 seconds)
  setInterval(() => {
    if (session?.id && navigator.onLine && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
      sendInvestorHeartbeat();
      restoreResponsesFromSupabase(session.id, session.email);
    }
  }, 8000);

  if (typeof window !== 'undefined') {
    const handleDeviceSyncOnWake = () => {
      if (session?.id && navigator.onLine) {
        sendInvestorHeartbeat();
        restoreResponsesFromSupabase(session.id, session.email);
      }
      if (route === 'admin' && adminUnlocked && navigator.onLine) {
        fetchAdminLiveData();
      }
    };

    window.addEventListener('focus', handleDeviceSyncOnWake);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleDeviceSyncOnWake();
      }
    });
    window.addEventListener('pageshow', handleDeviceSyncOnWake);
  }

  /* ══════════════════════════════════════════════════════════════
     ADMIN PASSCODE & AUDIT
     ══════════════════════════════════════════════════════════════ */
  const ADMIN_PASSCODE = 'thatAff2026@';
  let adminUnlocked = false;
  const ADMIN_SESSION_KEY = 'startup-demo-admin-unlocked';
  try {
    adminUnlocked = sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  } catch (err) {
    console.warn('[Admin] SessionStorage access error:', err);
  }

  function showAdminLock() {
    const overlay = document.getElementById('admin-lock-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    const input = document.getElementById('admin-passcode');
    if (input) {
      input.value = '';
      input.focus();
    }
    const errEl = document.getElementById('admin-passcode-error');
    if (errEl) errEl.style.display = 'none';
  }

  function hideAdminLock() {
    const overlay = document.getElementById('admin-lock-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function attemptAdminUnlock() {
    const input = document.getElementById('admin-passcode');
    const errEl = document.getElementById('admin-passcode-error');
    if (!input) return;

    if (input.value === ADMIN_PASSCODE) {
      adminUnlocked = true;
      const adminToken = generateSecureToken();
      try {
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        sessionStorage.setItem('startup-demo-admin-token', adminToken);
      } catch (_) {}
      hideAdminLock();
      setRoute('admin');
      toast('Admin command center unlocked.');
      fetchAdminLiveData();

      enqueueOutbox({
        type: 'ADMIN_ACTION',
        payload: {
          actionType: 'ADMIN_SESSION_CREATED',
          detail: 'Admin unlocked via passcode',
          stateSnapshot: { tokenPrefix: adminToken.slice(0, 8), device: deviceInfo },
          createdAt: new Date().toISOString()
        }
      });
      recordFeed('ADMIN_UNLOCKED', { detail: 'Admin session started' });
    } else {
      if (errEl) errEl.style.display = 'block';
      input.value = '';
      input.focus();
      recordFeed('ADMIN_UNLOCK_FAILED', { detail: 'Incorrect admin passcode attempt' });
    }
  }

  /* ══════════════════════════════════════════════════════════════
     LIVE ADMIN DATA FETCHING & AGGREGATION (Resilient & Non-destructive)
     ══════════════════════════════════════════════════════════════ */
  async function fetchAdminLiveData(isManualTrigger = false) {
    if (!supabase) return { success: false, error: 'No client' };
    if (adminLiveStats.isSyncing) return { success: false, error: 'Already syncing' };
    adminLiveStats.isSyncing = true;

    try {
      // 1. Fetch registered investors and immutable responses in parallel with error resilience
      const [invRes, respRes] = await Promise.all([
        supabase
          .from('demo_investors')
          .select('investor_key, full_name, email, joined_at, last_active')
          .order('joined_at', { ascending: false }),
        supabase
          .from('demo_responses')
          .select('investor_key, startup_id, startup_name, response_type, recorded_at, idempotency_key')
          .order('recorded_at', { ascending: false })
      ]);

      let hasNewData = false;

      if (!invRes.error && invRes.data) {
        adminLiveStats.investors = invRes.data;
        hasNewData = true;
      } else if (invRes.error) {
        console.warn('[Admin Sync] Investors query notice:', invRes.error.message);
      }

      if (!respRes.error && respRes.data) {
        const invMap = new Map();
        (adminLiveStats.investors || []).forEach(inv => invMap.set(inv.investor_key, inv));
        adminLiveStats.responses = respRes.data.map(r => {
          const inv = invMap.get(r.investor_key);
          const matchedStartup = startups.find(s => s.id === r.startup_id);
          return {
            ...r,
            startup_name: matchedStartup ? matchedStartup.name : (r.startup_name || r.startup_id),
            investor_name: (inv ? inv.full_name : 'Registered Investor'),
            investor_email: (inv ? inv.email : r.investor_key)
          };
        });
        hasNewData = true;

        try {
          localStorage.setItem('startup-demo-admin-backup-v2', JSON.stringify({
            savedAt: new Date().toISOString(),
            investors: adminLiveStats.investors,
            responses: adminLiveStats.responses
          }));
        } catch (e) {
          console.warn('[Admin] Backup write note:', e);
        }
      } else if (respRes.error) {
        console.warn('[Admin Sync] Responses query notice:', respRes.error.message);
      }

      adminLiveStats.lastSync = new Date();
      adminLiveStats.syncError = null;

      if (route === 'admin' && adminUnlocked) {
        renderAdmin();
      }

      if (isManualTrigger) {
        toast(`✓ Cloud synced: ${adminLiveStats.investors.length} investors, ${adminLiveStats.responses.length} total votes.`);
      }
      return { success: true, investors: adminLiveStats.investors.length, responses: adminLiveStats.responses.length };
    } catch (err) {
      console.warn('[Admin] Live sync fetch error:', err);
      adminLiveStats.syncError = err?.message || 'Network error';
      if (isManualTrigger) {
        toast('⚠️ Cloud connection slow — displaying latest local cached data.');
      }
      return { success: false, error: err?.message || 'Network error' };
    } finally {
      adminLiveStats.isSyncing = false;
    }
  }

  // Periodic Admin Poller with random jitter (prevents thundering herd on Supabase)
  setInterval(() => {
    if (adminUnlocked && route === 'admin' && navigator.onLine) {
      fetchAdminLiveData();
    }
  }, 3500 + Math.random() * 1000);

  /* ══════════════════════════════════════════════════════════════
     SUPABASE REALTIME SUBSCRIPTIONS & MULTI-DEVICE VOTE SYNC
     ══════════════════════════════════════════════════════════════ */
  function handleIncomingVote(vote) {
    if (!vote) return;
    const invKey = vote.investorKey || vote.investor_key;
    const invName = vote.investorName || vote.investor_name || 'Investor';
    const invEmail = (vote.investorEmail || vote.investor_email || '').trim().toLowerCase();
    const startupId = vote.startupId || vote.startup_id;
    const respType = vote.response || vote.response_type;
    const startupName = (startups.find(s => s.id === startupId)?.name || vote.startupName || vote.startup_name || startupId);
    const recordedAt = vote.recordedAt || vote.recorded_at || new Date().toISOString();
    const idempotencyKey = vote.idempotencyKey || vote.idempotency_key || `${invKey}:${startupId}`;

    if (!startupId || !respType) return;

    // 1. Maintain Live Admin Data
    const formattedForAdmin = {
      investor_key: invKey,
      investor_name: invName,
      investor_email: invEmail || invKey,
      startup_id: startupId,
      startup_name: startupName,
      response_type: respType,
      recorded_at: recordedAt,
      idempotency_key: idempotencyKey
    };

    const existingIdx = adminLiveStats.responses.findIndex(r => r.investor_key === invKey && r.startup_id === startupId);
    if (existingIdx !== -1) {
      adminLiveStats.responses[existingIdx] = formattedForAdmin;
    } else {
      adminLiveStats.responses.unshift(formattedForAdmin);
    }

    // 2. Stream to Live Activity Ticker
    pushRealtimeStreamItem({
      type: 'RESPONSE_SUBMITTED',
      actor: invName,
      startup: startupName,
      response: respType,
      detail: `${invName} voted ${responseLabel(respType)} on ${startupName}`,
      time: new Date()
    });

    // 3. Multi-Device Synchronization for the Logged-in Investor!
    // Check if this vote was cast by the SAME investor on another device (same investor_key OR same email)
    const myKey = session?.id;
    const myEmail = (session?.email || '').trim().toLowerCase();
    const isSameInvestor = (myKey && invKey && (myKey === invKey || myInvestorKeys.has(invKey))) || (myEmail && invEmail && myEmail === invEmail);

    if (isSameInvestor) {
      const activeKey = myKey || invKey;
      const bucket = state.responseByInvestor[activeKey] || (state.responseByInvestor[activeKey] = {});
      const existing = bucket[startupId];

      if (!existing || existing.response !== respType) {
        bucket[startupId] = {
          response: respType,
          startupId: startupId,
          startupNumber: startups.find(s => s.id === startupId)?.n || parseInt((startupId || '').replace(/\D/g, ''), 10) || 1,
          startupName: startupName,
          investorKey: activeKey,
          investorName: session?.name || invName,
          investorEmail: session?.email || invEmail,
          recordedAt: recordedAt,
          idempotencyKey: idempotencyKey
        };
        saveState();

        if (selectedStartup && selectedStartup.id === startupId) {
          lastSubmitted = selectedStartup;
          isEditingVote = false;
          investorScreen = 'confirmation';
        }

        renderInvestor();
        toast(`⚡ Synced: Your vote for ${startupName} was updated from your other device!`);
      }
    }

    if (route === 'admin' && adminUnlocked) {
      renderAdmin();
    }
  }

  function broadcastVoteRealtime(voteItem) {
    if (!voteItem) return;
    if (realtimeChannel) {
      try {
        realtimeChannel.send({
          type: 'broadcast',
          event: 'investor_vote',
          payload: voteItem
        });
      } catch (err) {
        console.warn('[Realtime Broadcast] Vote send notice:', err);
      }
    }
    // Also sync cross-tabs locally
    if (bc) {
      try {
        bc.postMessage({ type: 'INVESTOR_VOTE', vote: voteItem });
      } catch (_) {}
    }
  }

  function initSupabaseRealtime() {
    if (!supabase) return;
    try {
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
      realtimeChannel = supabase.channel('startup-demo-live-room', {
        config: { broadcast: { self: false } }
      });

      // Listen to broadcast state from admin
      realtimeChannel.on('broadcast', { event: 'state_sync' }, (payload) => {
        if (payload?.payload?.state) {
          const incoming = payload.payload.state;
          state.pitch = incoming.pitch ?? state.pitch;
          state.eventStatus = incoming.eventStatus ?? state.eventStatus;
          state.stageStatus = incoming.stageStatus ?? state.stageStatus;
          state.published = incoming.published ?? state.published;
          state.stateVersion = incoming.stateVersion ?? state.stateVersion;
          if (incoming.responseByInvestor) {
            Object.keys(incoming.responseByInvestor).forEach(k => {
              state.responseByInvestor[k] = {
                ...(state.responseByInvestor[k] || {}),
                ...incoming.responseByInvestor[k]
              };
            });
          }
          saveState();
          renderAll();
        }
      });

      // Listen to broadcast investor votes (Sub-second cross-device sync)
      realtimeChannel.on('broadcast', { event: 'investor_vote' }, (msg) => {
        if (msg?.payload) {
          handleIncomingVote(msg.payload);
        }
      });

      // Listen to broadcast pitch sequence reorder from admin
      realtimeChannel.on('broadcast', { event: 'startup_order_sync' }, (msg) => {
        if (msg?.payload?.order && Array.isArray(msg.payload.order)) {
          applyStartupOrder(msg.payload.order, true);
          renderAll();
          toast('Pitch sequence updated by organizer');
        }
      });

      // Realtime Postgres Changes: New or updated responses by ANY investor
      realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'demo_responses' }, (payload) => {
        const row = payload.new || payload.old;
        if (payload.eventType === 'DELETE') {
          if (row?.investor_key && state.responseByInvestor[row.investor_key]) {
            delete state.responseByInvestor[row.investor_key][row.startup_id];
            saveState();
            renderAll();
          }
          return;
        }
        if (payload.new) {
          handleIncomingVote(payload.new);
        }
      });

      // Realtime Postgres Changes: New Investors joined
      realtimeChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'demo_investors' }, (payload) => {
        const newInv = payload.new;
        if (newInv) {
          if (!adminLiveStats.investors.some(i => i.investor_key === newInv.investor_key)) {
            adminLiveStats.investors.unshift(newInv);
          }
          pushRealtimeStreamItem({
            type: 'INVESTOR_JOINED',
            actor: newInv.full_name,
            startup: '',
            response: '',
            detail: `${newInv.full_name} (${newInv.email}) registered passwordlessly`,
            time: new Date()
          });
          if (route === 'admin' && adminUnlocked) {
            renderAdmin();
          }
        }
      });

      // Realtime Postgres Changes: Investor presence update (last_active heartbeat)
      realtimeChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'demo_investors' }, (payload) => {
        const updInv = payload.new;
        if (updInv) {
          const idx = adminLiveStats.investors.findIndex(i => i.investor_key === updInv.investor_key);
          if (idx !== -1) {
            adminLiveStats.investors[idx] = { ...adminLiveStats.investors[idx], ...updInv };
          } else {
            adminLiveStats.investors.unshift(updInv);
          }
          if (route === 'admin' && adminUnlocked) {
            renderAdmin();
          }
        }
      });

      // Realtime Postgres Changes: Event State updates (Pitch change, stage publish)
      realtimeChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'demo_event_state' }, (payload) => {
        const s = payload.new;
        if (s) {
          if (s.current_pitch !== state.pitch || s.event_status !== state.eventStatus || s.stage_status !== state.stageStatus) {
            state.pitch = s.current_pitch;
            state.eventStatus = s.event_status;
            state.stageStatus = s.stage_status;
            state.published = s.published_data || state.published;
            saveState();
            renderAll();
          }
        }
      });

      realtimeChannel.subscribe((status, err) => {
        console.log('[Supabase Realtime] Channel status:', status, err || '');
        if (status === 'SUBSCRIBED') {
          realtimeConnected = true;
          realtimeReconnectAttempts = 0;
          updateNetworkStatusBadges();
          if (session?.id) {
            restoreResponsesFromSupabase(session.id, session.email);
          }
          if (route === 'admin' && adminUnlocked) {
            fetchAdminLiveData();
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          realtimeConnected = false;
          updateNetworkStatusBadges();
          scheduleRealtimeReconnect();
        }
      });
    } catch (err) {
      console.warn('[Supabase Realtime] Setup error:', err);
      realtimeConnected = false;
      updateNetworkStatusBadges();
      scheduleRealtimeReconnect();
    }
  }

  async function broadcastStateRealtime() {
    if (!realtimeChannel) return;
    try {
      await realtimeChannel.send({
        type: 'broadcast',
        event: 'state_sync',
        payload: { state }
      });
    } catch (err) {
      console.warn('[Realtime Broadcast] Send error:', err);
    }
  }

  async function syncEventStateToSupabase() {
    if (!supabase) return;
    try {
      await supabase.from('demo_event_state').upsert({
        id: 1,
        event_status: state.eventStatus,
        current_pitch: state.pitch,
        state_version: state.stateVersion,
        total_responses: adminLiveStats.responses.length || state.investorResponses,
        stage_status: state.stageStatus,
        published_data: state.published,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[EventState] Sync error:', err);
    }
  }

  /* ── Cross-Tab Sync via BroadcastChannel ────────────────────── */
  let bc = null;
  try {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = (event) => {
      if (!event.data) return;
      if (event.data.type === 'STATE_SYNC') {
        const incoming = event.data.state;
        if (incoming) {
          state.pitch = incoming.pitch ?? state.pitch;
          state.eventStatus = incoming.eventStatus ?? state.eventStatus;
          state.stageStatus = incoming.stageStatus ?? state.stageStatus;
          state.published = incoming.published ?? state.published;
          if (incoming.responseByInvestor) {
            Object.keys(incoming.responseByInvestor).forEach(k => {
              state.responseByInvestor[k] = {
                ...(state.responseByInvestor[k] || {}),
                ...incoming.responseByInvestor[k]
              };
            });
          }
          saveState();
          renderAll();
        }
      } else if (event.data.type === 'INVESTOR_VOTE' && event.data.vote) {
        handleIncomingVote(event.data.vote);
      } else if (event.data.type === 'STARTUP_ORDER_SYNC' && Array.isArray(event.data.order)) {
        applyStartupOrder(event.data.order, true);
        renderAll();
      }
    };
  } catch (_) {}

  function broadcast(type = 'STATE_SYNC') {
    saveState();
    if (bc) bc.postMessage({ type, state });
    broadcastStateRealtime();
    syncEventStateToSupabase();
  }

  /* ══════════════════════════════════════════════════════════════
     INVESTOR ACTIONS (Optimistic 0ms UI + Durable Offline Queue)
     ══════════════════════════════════════════════════════════════ */
  function ensureInvestor() {
    if (!session) {
      investorScreen = 'join';
      renderInvestor();
      return false;
    }
    return true;
  }

  function openStartup(id) {
    if (!ensureInvestor()) return;
    selectedStartup = startups.find(s => s.id === id) || null;
    if (!selectedStartup) return;
    pendingChoice = null;
    isEditingVote = false;
    investorScreen = 'detail';
    renderInvestor();

    recordFeed('STARTUP_VIEWED', {
      startupId: selectedStartup.id,
      startupName: selectedStartup.name,
      detail: `Viewed profile: ${selectedStartup.name}`
    });
  }

  function submitResponse(choice) {
    if (!session || !selectedStartup) return;
    const current = responseFor(selectedStartup.id);
    if (current && current.response === choice) {
      toast(`You already selected "${responseLabel(choice)}".`);
      pendingChoice = null;
      isEditingVote = false;
      lastSubmitted = selectedStartup;
      investorScreen = 'confirmation';
      renderInvestor();
      return;
    }

    const key = getInvestorKey();
    const investorBucket = state.responseByInvestor[key] || (state.responseByInvestor[key] = {});
    const isUpdate = !!current;

    const respItem = {
      response: choice,
      startupId: selectedStartup.id,
      startupNumber: selectedStartup.n,
      startupName: selectedStartup.name,
      investorKey: key,
      investorName: session.name,
      investorEmail: session.email,
      recordedAt: new Date().toISOString(),
      idempotencyKey: `${key}:${selectedStartup.id}`
    };

    // 1. Optimistic Local Save (0ms latency — instant UI response)
    investorBucket[selectedStartup.id] = respItem;
    if (!isUpdate) {
      state.investorResponses += 1;
    }
    state.stateVersion += 1;
    lastSubmitted = selectedStartup;
    pendingChoice = null;
    isEditingVote = false;
    investorScreen = 'confirmation';

    audit(isUpdate ? 'RESPONSE_UPDATED' : 'RESPONSE_RECORDED', `${session.name} → ${selectedStartup.name}: ${choice}`, 'INVESTOR');

    // Push immediately to realtime activity stream on admin screen
    pushRealtimeStreamItem({
      type: 'RESPONSE_SUBMITTED',
      actor: session.name,
      startup: selectedStartup.name,
      response: choice,
      detail: isUpdate
        ? `${session.name} updated vote to ${responseLabel(choice)} on ${selectedStartup.name}`
        : `${session.name} voted ${responseLabel(choice)} on ${selectedStartup.name}`,
      time: new Date()
    });

    saveState();
    renderAll();
    broadcastVoteRealtime(respItem);
    toast(isUpdate ? `✓ Vote updated to "${responseLabel(choice)}" & synced to all devices!` : '✓ Response saved securely.');

    // 2. Queue into Durable Outbox for guaranteed zero-loss delivery to cloud
    enqueueOutbox({
      type: 'SUBMIT_RESPONSE',
      payload: {
        investorKey: key,
        investorName: session.name,
        investorEmail: session.email,
        startupId: selectedStartup.id,
        startupName: selectedStartup.name,
        responseType: choice,
        idempotencyKey: respItem.idempotencyKey,
        recordedAt: respItem.recordedAt
      }
    });

    recordFeed(isUpdate ? 'RESPONSE_UPDATED' : 'RESPONSE_SUBMITTED', {
      actorId: key,
      actorName: session.name,
      actorEmail: session.email,
      startupId: selectedStartup.id,
      startupName: selectedStartup.name,
      responseType: choice,
      detail: `${session.name} voted ${responseLabel(choice)} on ${selectedStartup.name}`
    });

    sendInvestorHeartbeat();
  }

  function backToList() {
    selectedStartup = null;
    pendingChoice = null;
    isEditingVote = false;
    investorScreen = 'list';
    renderInvestor();
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER: Investor Views (Mobile-First)
     ══════════════════════════════════════════════════════════════ */
  function renderHeader() {
    const isOnline = navigator.onLine && netState === 'ONLINE';
    const pending = outboxQueue.length;
    const netClass = !isOnline ? 'offline' : pending > 0 ? 'syncing' : 'online';
    const netText = !isOnline ? 'Offline' : pending > 0 ? `Syncing (${pending})` : 'Live';

    const accountChip = session ? `
      <div class="account-chip" data-action="switch-account" title="Signed in as ${session.email}">
        <span class="avatar-mini">${session.name.charAt(0).toUpperCase()}</span>
        <span>${session.name.split(' ')[0]}</span>
      </div>
    ` : '';

    return `<header class="phone-header">
      <div class="brand-mini">
        <div class="brand-mini-mark"><img src="assets/logo.png" alt="AFF Logo"></div>
        <div>
          <strong>Startup Demo <span style="color:#5c55ef;font-weight:850">Day</span></strong>
          <small>Investor Hub</small>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        ${accountChip}
        <span class="net-badge ${netClass}" style="padding:4px 8px;font-size:10px"><i></i> ${netText}</span>
      </div>
    </header>`;
  }

  function renderProgress() {
    return `<div class="progress-row">
      <div class="progress-label">${TOTAL_PITCHES} startups available</div>
      <span class="live-pill">${state.eventStatus}</span>
    </div>`;
  }

  function renderStartupCard(s) {
    const r = responseFor(s.id);
    const color = responseColor(r?.response);
    const icon = responseIcon(r?.response);
    return `<button class="startup-card choice-${color}" data-startup="${s.id}">
      <span class="rank" title="Booth ${s.n}">B${s.n}</span>
      <span class="logo">${s.initial}</span>
      <span class="startup-main">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="booth-tag">Booth ${s.n}</span>
          <strong style="font-size:15px;color:var(--ink)">${s.name}</strong>
        </div>
        <div style="font-size:12px;color:#0284c7;font-weight:600;margin-top:2px">
          ${s.subSector}
        </div>
      </span>
      <span class="choice-pill ${color}">
        ${icon ? `<span class="choice-icon">${icon}</span>` : ''}
        ${responseLabel(r?.response)}
      </span>
      <span class="chevron">›</span>
    </button>`;
  }

  function renderListScreen() {
    const totalAnswered = startups.filter(s => responseFor(s.id)).length;
    const notAnswered = TOTAL_PITCHES - totalAnswered;

    let filtered = startups;
    if (startupFilter === 'pending') {
      filtered = startups.filter(s => !responseFor(s.id));
    } else if (startupFilter === 'voted') {
      filtered = startups.filter(s => !!responseFor(s.id));
    }

    return `${renderHeader()}<main class="phone-content">
      <div style="margin-top:4px">
        <h1 style="font-size:26px;margin:0 0 4px">Startup Booths</h1>
        <div class="detail-label">Browse all ${TOTAL_PITCHES} startup booths. Tap any booth to record your official response.</div>
      </div>
      ${renderProgress()}
      <div class="filters">
        <button class="chip ${startupFilter === 'all' ? 'active' : ''}" data-filter="all">All Startups (${TOTAL_PITCHES})</button>
        <button class="chip ${startupFilter === 'pending' ? 'active' : ''}" data-filter="pending">Pending (${notAnswered})</button>
        <button class="chip ${startupFilter === 'voted' ? 'active' : ''}" data-filter="voted">My Responses (${totalAnswered})</button>
      </div>
      <section class="startup-list">
        ${filtered.length > 0 ? filtered.map(renderStartupCard).join('') : '<div class="notice">No startups matching this filter.</div>'}
      </section>
    </main>${renderBottomNav('startups')}`;
  }

  function renderScenicIllustration(s) {
    return `<svg class="shc-svg-scene" viewBox="0 0 540 260" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#bae6fd" />
          <stop offset="55%" stop-color="#e0f2fe" />
          <stop offset="100%" stop-color="#f0fdf4" />
        </linearGradient>
        <linearGradient id="hill1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#86efac" />
          <stop offset="100%" stop-color="#4ade80" />
        </linearGradient>
        <linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4ade80" />
          <stop offset="100%" stop-color="#22c55e" />
        </linearGradient>
        <linearGradient id="hill3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#22c55e" />
          <stop offset="100%" stop-color="#15803d" />
        </linearGradient>
      </defs>

      <!-- Sky Background -->
      <rect width="540" height="260" fill="url(#skyGrad)" />

      <!-- Soft Clouds -->
      <path d="M60 60 Q80 40 110 50 Q130 35 160 50 Q180 45 195 65 Z" fill="#ffffff" opacity="0.75" />
      <path d="M220 75 Q235 60 260 68 Q275 55 300 68 Q315 62 330 80 Z" fill="#ffffff" opacity="0.65" />
      <path d="M420 50 Q435 38 460 44 Q475 34 495 45 Q510 40 520 58 Z" fill="#ffffff" opacity="0.6" />

      <!-- Distant Hills -->
      <path d="M0 130 Q120 70 240 120 Q360 80 480 110 L540 125 L540 260 L0 260 Z" fill="#99f6e4" opacity="0.45" />
      <path d="M-20 145 Q80 100 200 135 Q320 95 440 130 L540 140 L540 260 L0 260 Z" fill="url(#hill1)" opacity="0.7" />

      <!-- Rolling Green Fields -->
      <path d="M0 160 Q110 120 230 155 Q350 130 540 150 L540 260 L0 260 Z" fill="url(#hill2)" />
      <path d="M0 185 Q130 150 280 180 Q410 160 540 175 L540 260 L0 260 Z" fill="url(#hill3)" />

      <!-- Crop Furrow Lines -->
      <path d="M30 260 Q80 200 120 165" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" opacity="0.7" />
      <path d="M90 260 Q140 205 180 170" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" opacity="0.7" />
      <path d="M160 260 Q200 210 235 178" stroke="#16a34a" stroke-width="2" stroke-linecap="round" opacity="0.6" />

      <!-- Green Tractor -->
      <g transform="translate(155, 126) scale(0.72)">
        <path d="M12 28 L28 28 L34 14 L18 14 Z" fill="#15803d" />
        <path d="M20 17 L30 17 L27 25 L16 25 Z" fill="#bae6fd" opacity="0.85" />
        <rect x="2" y="24" width="38" height="12" rx="3" fill="#16a34a" />
        <rect x="2" y="16" width="4" height="10" rx="1.5" fill="#15803d" />
        <circle cx="12" cy="38" r="11" fill="#1e293b" />
        <circle cx="12" cy="38" r="6" fill="#64748b" />
        <circle cx="12" cy="38" r="2.5" fill="#f8fafc" />
        <circle cx="36" cy="41" r="7" fill="#1e293b" />
        <circle cx="36" cy="41" r="3.5" fill="#64748b" />
        <circle cx="36" cy="41" r="1.5" fill="#f8fafc" />
      </g>

      <!-- Foreground Leaves -->
      <g transform="translate(20, 195) scale(0.75)">
        <path d="M0 40 Q25 15 50 10 Q35 35 0 40 Z" fill="#22c55e" />
        <path d="M0 40 Q-15 10 10 0 Q10 25 0 40 Z" fill="#16a34a" />
      </g>
      <g transform="translate(285, 175) scale(0.9)">
        <path d="M0 45 Q30 15 55 10 Q40 40 0 45 Z" fill="#16a34a" />
        <path d="M0 45 Q-20 15 5 0 Q15 28 0 45 Z" fill="#22c55e" />
      </g>

      <!-- Bank Building with Pillars & Pediment -->
      <g transform="translate(390, 122) scale(0.74)">
        <rect x="0" y="70" width="84" height="8" rx="2" fill="#2563eb" />
        <rect x="4" y="65" width="76" height="6" fill="#3b82f6" />
        <polygon points="42,10 0,34 84,34" fill="#1d4ed8" />
        <rect x="2" y="34" width="80" height="7" fill="#3b82f6" />
        <rect x="10" y="41" width="8" height="24" rx="1.5" fill="#60a5fa" />
        <rect x="28" y="41" width="8" height="24" rx="1.5" fill="#60a5fa" />
        <rect x="46" y="41" width="8" height="24" rx="1.5" fill="#60a5fa" />
        <rect x="64" y="41" width="8" height="24" rx="1.5" fill="#60a5fa" />
      </g>

      <!-- Wi-Fi / Radio Broadcast Arcs -->
      <g transform="translate(378, 116) scale(0.85)">
        <path d="M0 20 A 24 24 0 0 1 34 0" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.85" />
        <path d="M5 28 A 16 16 0 0 1 28 12" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.9" />
        <path d="M10 36 A 8 8 0 0 1 20 26" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" fill="none" />
      </g>

      <!-- Upward Growth Arrow -->
      <path d="M398 178 L398 158 L393 163 L398 151 L403 163 L398 158" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="#22c55e" />

      <!-- Smartphone with Rupee Coin & Sprout -->
      <g transform="translate(332, 136) scale(0.88)">
        <rect x="0" y="0" width="54" height="92" rx="11" fill="#0f172a" />
        <rect x="2.5" y="2.5" width="49" height="87" rx="9" fill="#ffffff" />
        <rect x="21" y="6" width="12" height="2.5" rx="1" fill="#cbd5e1" />
        <circle cx="27" cy="48" r="16.5" fill="#15803d" />
        <text x="27" y="54" font-family="system-ui, -apple-system, sans-serif" font-size="17" font-weight="900" fill="#ffffff" text-anchor="middle">₹</text>
        <path d="M27 31 Q23 20 15 18 Q19 29 27 31 Z" fill="#22c55e" />
        <path d="M27 31 Q31 20 39 18 Q35 29 27 31 Z" fill="#4ade80" />
      </g>
    </svg>`;
  }

  function renderStartupHeroCard(s) {
    return `<div class="startup-hero-card">
      <div class="shc-header">
        <div class="shc-info">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
            <span class="booth-tag" style="font-size:12px;padding:4px 10px;font-weight:800">Booth ${s.n}</span>
            <span class="shc-subsector-badge">
              <span class="shc-subsector-icon">🌱</span>
              <span><strong>Sub-Sector:</strong> ${s.subSector}</span>
            </span>
          </div>
          <h2 class="shc-title">${s.name}</h2>
          ${s.tagline ? `<p class="shc-tagline" style="margin-top:6px">${s.tagline}</p>` : ''}
        </div>
      </div>

      <div class="shc-banner">
        <span class="shc-badge">STARTUP DEMO</span>
        ${renderScenicIllustration(s)}
        <div class="shc-metrics">
          <div class="shc-metric-chip">
            <span class="shc-metric-icon">🌱</span>
            <div class="shc-metric-text">
              <strong title="${s.subSector}">${s.subSector}</strong>
              <span>Sub-Sector</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderDetailScreen() {
    const s = selectedStartup;
    const r = responseFor(s.id);
    if (r && !isEditingVote) {
      investorScreen = 'confirmation';
      lastSubmitted = s;
      return renderConfirmationScreen();
    }
    const isEdit = isEditingVote && !!r;

    return `${renderHeader()}<main class="phone-content detail-screen-content ${pendingChoice ? 'has-confirm' : ''}">
      <div class="detail-header">
        <button class="back-btn" data-action="back-list">‹</button>
        <div class="detail-label">${isEdit ? 'Update Response • ' : ''}Booth ${s.n} of ${TOTAL_PITCHES}</div>
        <span class="live-pill" style="${isEdit ? 'background:#0284c7' : ''}">${isEdit ? 'Editing' : 'Active'}</span>
      </div>

      ${renderStartupHeroCard(s)}

      <div style="margin:4px 0 10px;padding:0 2px">
        <div class="detail-label" style="font-weight:800;color:#475569;font-size:12px;letter-spacing:0.04em">
          ${isEdit ? 'UPDATE YOUR OFFICIAL INVESTOR RESPONSE:' : 'SELECT YOUR OFFICIAL INVESTOR RESPONSE:'}
        </div>
      </div>

      <div class="response-stack">
        <button class="response-btn green ${pendingChoice === 'INTERESTED' ? 'selected' : ''}" data-select-response="INTERESTED">
          <span class="response-icon">👍</span>
          <span><strong>I am interested</strong><span>Request founder introduction & follow-up.</span></span>
          ${pendingChoice === 'INTERESTED' ? '<span class="selected-indicator"><span>✓ Selected</span></span>' : '<span style="margin-left:auto;color:#8fa0bb">›</span>'}
        </button>
        <button class="response-btn yellow ${pendingChoice === 'EXPLORE' ? 'selected' : ''}" data-select-response="EXPLORE">
          <span class="response-icon">?</span>
          <span><strong>Would like to explore more</strong><span>Have questions or want deeper diligence info.</span></span>
          ${pendingChoice === 'EXPLORE' ? '<span class="selected-indicator"><span>✓ Selected</span></span>' : '<span style="margin-left:auto;color:#8fa0bb">›</span>'}
        </button>
        <button class="response-btn blue ${pendingChoice === 'NOT_INTERESTED' ? 'selected' : ''}" data-select-response="NOT_INTERESTED">
          <span class="response-icon">👎</span>
          <span><strong>Not my area of interest</strong><span>Not a fit for our current investment mandate.</span></span>
          ${pendingChoice === 'NOT_INTERESTED' ? '<span class="selected-indicator"><span>✓ Selected</span></span>' : '<span style="margin-left:auto;color:#8fa0bb">›</span>'}
        </button>
      </div>

      ${pendingChoice ? `
        <div class="confirm-box ${COLORS[pendingChoice]}">
          <div class="confirm-box-header">
            <span class="confirm-badge">${isEdit ? 'Confirm Update' : 'Confirm Selection'}</span>
            <span style="font-size:11px;color:#94a3b8">Prevents accidental taps</span>
          </div>
          <div class="confirm-choice-label ${COLORS[pendingChoice]}">
            <span>${responseIcon(pendingChoice)}</span>
            <span>${responseLabel(pendingChoice)}</span>
          </div>
          <p class="confirm-desc">${isEdit ? `Are you sure you want to update your response for <strong>${s.name}</strong> to <strong>${responseLabel(pendingChoice)}</strong>? This will update across both your devices.` : `Are you sure you want to submit this response for <strong>${s.name}</strong>? Once confirmed, this response will sync to all your devices.`}</p>
          <div class="confirm-btn-row">
            <button class="btn-cancel-choice" data-action="cancel-choice">✕ Cancel</button>
            <button class="btn-submit-choice ${COLORS[pendingChoice]}" data-action="confirm-submit">
              ${isEdit ? '✓ Update Response & Sync' : '✓ Submit Response'}
            </button>
          </div>
        </div>
      ` : ''}
    </main>${renderBottomNav('startups')}`;
  }

  function renderConfirmationScreen() {
    const s = lastSubmitted || selectedStartup;
    const r = responseFor(s.id);
    return `${renderHeader()}<main class="phone-content success-screen">
      <div class="check"></div>
      <h2>Response Recorded!</h2>
      <p>Your response for <strong>${s.name}</strong> is safely registered.</p>
      <div class="summary">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="booth-tag">Booth ${s.n}</span>
          <strong>${s.name}</strong>
        </div>
        <span>${responseLabel(r?.response)}</span>
      </div>
      <button class="primary-cta" data-action="back-list">Back to Startup List →</button>
      <button class="btn-change-choice" data-action="change-vote" style="margin-top:10px;background:rgba(255,255,255,0.9);border:1px solid #cbd5e1;color:#475569;padding:11px 16px;border-radius:12px;font-size:13px;font-weight:650;width:100%;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
        <span>✏️</span>
        <span>Change / Update Your Response</span>
      </button>
    </main>${renderBottomNav('startups')}`;
  }

  function renderMyResponses() {
    const allAnswered = startups.filter(s => responseFor(s.id));
    const interestedList = allAnswered.filter(s => responseFor(s.id)?.response === RESPONSE.INTERESTED);
    const exploreList = allAnswered.filter(s => responseFor(s.id)?.response === RESPONSE.EXPLORE);
    const notInterestedList = allAnswered.filter(s => responseFor(s.id)?.response === RESPONSE.NOT_INTERESTED);

    let displayList = allAnswered;
    if (myResponseFilter === 'INTERESTED') displayList = interestedList;
    else if (myResponseFilter === 'EXPLORE') displayList = exploreList;
    else if (myResponseFilter === 'NOT_INTERESTED') displayList = notInterestedList;

    const rows = displayList.map(s => {
      const r = responseFor(s.id);
      return `<div class="my-response-row" data-startup="${s.id}" style="cursor:pointer" title="Click to view details or update response">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span class="booth-tag">Booth ${s.n}</span>
          <div style="min-width:0">
            <strong style="font-size:14px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</strong>
            <div class="detail-label" style="font-size:11px">${new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Tap to edit</div>
          </div>
        </div>
        <span class="choice-pill ${COLORS[r.response]}">
          <span class="choice-icon">${responseIcon(r.response)}</span>
          ${responseLabel(r.response)}
        </span>
      </div>`;
    }).join('');

    return `${renderHeader()}<main class="phone-content">
      <div style="margin:4px 0 10px">
        <h1 style="font-size:26px;margin:0 0 4px">My Responses</h1>
        <div class="detail-label">Your voting history for this Demo Day event.</div>
      </div>
      <div class="filters" style="margin:8px 0 14px">
        <button class="chip ${myResponseFilter === 'all' ? 'active' : ''}" data-resp-filter="all">All (${allAnswered.length})</button>
        <button class="chip chip-interested ${myResponseFilter === 'INTERESTED' ? 'active' : ''}" data-resp-filter="INTERESTED">👍 Interested (${interestedList.length})</button>
        <button class="chip chip-explore ${myResponseFilter === 'EXPLORE' ? 'active' : ''}" data-resp-filter="EXPLORE">? Explore More (${exploreList.length})</button>
        <button class="chip chip-not-interested ${myResponseFilter === 'NOT_INTERESTED' ? 'active' : ''}" data-resp-filter="NOT_INTERESTED">👎 Not My Area (${notInterestedList.length})</button>
      </div>
      <div class="my-responses" style="display:flex;flex-direction:column;gap:8px">
        ${rows || `<div class="notice">No responses found for this filter.</div>`}
      </div>
    </main>${renderBottomNav('responses')}`;
  }

  function renderBottomNav(active) {
    return `<nav class="bottom-nav">
      <button data-nav="home" class="${active === 'home' ? 'active' : ''}">
        <span class="nav-icon">⌂</span>
        <span class="nav-label">Home</span>
      </button>
      <button data-nav="list" class="${active === 'startups' ? 'active' : ''}">
        <span class="nav-icon">▦</span>
        <span class="nav-label">Startups</span>
      </button>
      <button data-nav="responses" class="${active === 'responses' ? 'active' : ''}">
        <span class="nav-icon">📊</span>
        <span class="nav-label">My Responses</span>
      </button>
    </nav>`;
  }

  function renderJoin() {
    const saved = getSavedAccounts();
    const hasSaved = saved.length > 0;

    return `${renderHeader()}<main class="phone-content" style="display:flex;flex-direction:column;justify-content:center">
      <section class="hero-card" style="margin-bottom:12px;text-align:center">
        <img src="assets/logo.png" alt="AFF Logo" style="width:68px;height:68px;margin:0 auto 10px;display:block;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.08))">
        <div class="hero-logo" style="justify-content:center">Investor Hub</div>
        <h2>Welcome to ${orgState.eventTitle || 'AFF Demo Day 2026'}</h2>
        <p>Passwordless voting — sign in to score all 12 startups live. Your credentials and scores are preserved safely across sessions.</p>
      </section>

      ${hasSaved ? `
        <div class="saved-accounts-section" style="margin-bottom:14px">
          <div class="detail-label" style="margin-bottom:8px;font-weight:800;color:#64748b">CONTINUE AS SAVED INVESTOR</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${saved.map(acc => `
              <div class="saved-account-card" data-action="fast-login" data-email="${acc.email}" data-name="${acc.name}" role="button" tabindex="0" style="cursor:pointer">
                <div class="avatar-mini" style="width:34px;height:34px;font-size:14px;background:#e0e7ff;color:#3730a3;border-radius:50%;display:grid;place-items:center;font-weight:900;flex-shrink:0">${acc.name.charAt(0).toUpperCase()}</div>
                <div style="flex:1;min-width:0;text-align:left">
                  <strong style="font-size:13px;display:block;color:var(--ink)">${acc.name}</strong>
                  <span style="font-size:11px;color:#64748b;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${acc.email}</span>
                </div>
                <button class="chip active" style="font-size:11px;padding:6px 12px;pointer-events:none">Login →</button>
              </div>
            `).join('')}
          </div>
          <div style="text-align:center;margin:14px 0 10px;font-size:11px;font-weight:700;color:#94a3b8">— OR SIGN IN WITH ANOTHER EMAIL —</div>
        </div>
      ` : ''}

      <div class="login-inputs-wrap">
        <label class="detail-label">Full Name</label>
        <input id="join-name" class="input" placeholder="e.g. Sarah Jenkins" style="margin:6px 0 12px" autocomplete="name">
        <label class="detail-label">Work / Personal Email</label>
        <input id="join-email" class="input" placeholder="e.g. sarah@sequoia.com" type="email" style="margin:6px 0 12px" autocomplete="email">
        <button class="primary-cta" data-action="join">Enter Live Event →</button>
      </div>

      <div class="notice" style="margin-top:14px">
        <strong>⚡ Multi-Login & Zero Override Protection</strong>
        Your account is uniquely tied to your email address. Multiple investors with identical names or multiple devices will never overwrite each other's score records.
      </div>
    </main>`;
  }

  function renderInvestor() {
    const root = document.getElementById('phone-root');
    if (!root) return;
    let html = investorScreen === 'join' ? renderJoin() : investorScreen === 'detail' ? renderDetailScreen() : investorScreen === 'confirmation' ? renderConfirmationScreen() : investorScreen === 'responses' ? renderMyResponses() : renderListScreen();
    root.innerHTML = `<div class="phone">${html}</div>`;
  }

  /* ══════════════════════════════════════════════════════════════
     STARTUP BOOTH ORDER REORDERING & LIVE BROADCAST
     ══════════════════════════════════════════════════════════════ */
  function renderStartupReorderPanel() {
    return `
      <div class="startup-reorder-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:12px">
          <div>
            <h3 style="margin:0 0 4px;display:flex;align-items:center;gap:8px">
              <span>🔢 Startup Booth Order & Sequence</span>
              <span class="live-stat-chip blue" style="font-size:10.5px;padding:3px 10px;font-weight:800">Live Drag & Drop</span>
            </h3>
            <p class="detail-label" style="margin:0">Drag handle ⠿ or use ▲ / ▼ buttons to adjust pitch sequence. Booth 1 to 12 renumbers dynamically in real time.</p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="admin-btn dark" data-action="broadcast-order" style="font-weight:850;padding:8px 16px;font-size:12px;background:#0f172a;color:#ffffff;display:inline-flex;align-items:center;gap:6px">
              <span>📡</span> Broadcast New Order
            </button>
            <button class="admin-btn neutral" data-action="reset-order" style="font-size:11.5px;padding:8px 14px">
              ↺ Reset Default
            </button>
          </div>
        </div>

        <div class="reorder-list" id="reorder-startup-list">
          ${startups.map((s, idx) => `
            <div class="reorder-item" draggable="true" data-id="${s.id}" data-index="${idx}">
              <span class="drag-handle" title="Drag to reorder">⠿</span>
              <span class="reorder-booth-badge">Booth ${s.n}</span>
              <div class="reorder-item-main">
                <div class="reorder-item-title">${s.name}</div>
                <div class="reorder-item-sub">${s.subSector}</div>
              </div>
              <div class="reorder-actions">
                <button class="btn-order-move" data-action="order-move-up" data-index="${idx}" title="Move Up" ${idx === 0 ? 'disabled' : ''}>▲</button>
                <button class="btn-order-move" data-action="order-move-down" data-index="${idx}" title="Move Down" ${idx === startups.length - 1 ? 'disabled' : ''}>▼</button>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="notice" style="margin-top:14px;background:#f0fdf4;border-color:#bbf7d0;color:#166534;font-size:12.5px">
          <strong>💡 Zero Vote Loss Guarantee:</strong> All investor responses are stored by immutable Startup ID. Adjusting sequence safely updates Booth 1–12 across the Admin, Stage, and all attendee screens.
        </div>
      </div>
    `;
  }

  function broadcastStartupOrder(newOrderIds) {
    if (!Array.isArray(newOrderIds) || newOrderIds.length === 0) return;
    applyStartupOrder(newOrderIds, true);

    // 1. Broadcast via Supabase Realtime channel to all attendee phones
    if (realtimeChannel) {
      try {
        realtimeChannel.send({
          type: 'broadcast',
          event: 'startup_order_sync',
          payload: { order: newOrderIds, timestamp: Date.now() }
        });
      } catch (err) {
        console.warn('[Realtime Broadcast] Order send notice:', err);
      }
    }

    // 2. Broadcast via BroadcastChannel to all open tabs locally
    if (bc) {
      try {
        bc.postMessage({ type: 'STARTUP_ORDER_SYNC', order: newOrderIds });
      } catch (_) {}
    }

    // 3. Persist action audit to Supabase
    if (supabase) {
      supabase.from('demo_admin_actions').insert({
        action_type: 'PITCH_ORDER_UPDATED',
        detail: `Pitch sequence updated (${newOrderIds.join(', ')})`,
        state_snapshot: { order: newOrderIds },
        created_at: new Date().toISOString()
      }).then(() => {}).catch(err => console.warn('[Supabase] Save order error:', err));
    }

    recordFeed('ADMIN_ACTION', { detail: 'Pitch sequence reordered and broadcasted' });
  }

  function initDragAndDrop() {
    const listEl = document.getElementById('reorder-startup-list');
    if (!listEl) return;

    let draggedItem = null;
    let draggedIdx = null;

    const items = listEl.querySelectorAll('.reorder-item');
    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        draggedIdx = parseInt(item.dataset.index, 10);
        item.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', item.dataset.id || '');
        }
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        items.forEach(it => it.classList.remove('drag-over'));
        draggedItem = null;
        draggedIdx = null;
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        if (!item.classList.contains('dragging')) {
          items.forEach(it => {
            if (it !== item) it.classList.remove('drag-over');
          });
          item.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        const targetIdx = parseInt(item.dataset.index, 10);
        if (draggedIdx !== null && !isNaN(targetIdx) && draggedIdx !== targetIdx) {
          const currentOrder = startups.map(s => s.id);
          const [movedId] = currentOrder.splice(draggedIdx, 1);
          currentOrder.splice(targetIdx, 0, movedId);
          applyStartupOrder(currentOrder, true);
          renderAdmin();
          toast(`Updated sequence: ${startups[targetIdx]?.name || 'Startup'} is now Booth ${targetIdx + 1}. Click 'Broadcast New Order' to sync to phones.`);
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER: Admin Command Center (Live Submission Counters & Roster)
     ══════════════════════════════════════════════════════════════ */
  function renderAdmin() {
    const root = document.getElementById('admin-root');
    if (!root) return;

    if (!adminUnlocked) {
      root.innerHTML = `<div class="admin-locked-notice">
        <div class="admin-lock-icon-large">🔒</div>
        <h2>Admin Command Center Locked</h2>
        <p>Please enter your administrator passcode to access live controls and submission tracking.</p>
      </div>`;
      return;
    }

    const currentStartup = startups[state.pitch - 1] || startups[0];

    // Effective Registered Investors List (Cloud + Local Session Fallback)
    const effectiveInvestors = adminLiveStats.investors.length > 0
      ? adminLiveStats.investors
      : (session ? [{ investor_key: session.id, full_name: session.name, email: session.email, joined_at: session.joinedAt, last_active: new Date().toISOString() }] : []);

    const totalInvestors = effectiveInvestors.length;

    // Helper: Map all recorded responses per startup for a given investor
    const getInvestorResponseMap = (inv) => {
      const respMap = {};
      if (state.responseByInvestor[inv.investor_key]) {
        Object.values(state.responseByInvestor[inv.investor_key]).forEach(r => {
          const sId = r.startupId || r.startup_id;
          if (sId) respMap[sId] = r.response || r.response_type;
        });
      }
      adminLiveStats.responses.filter(r => r.investor_key === inv.investor_key).forEach(r => {
        const sId = r.startup_id || r.startupId;
        if (sId) respMap[sId] = r.response_type || r.response;
      });
      return respMap;
    };

    // Deduplicated list of all responses across all startups and investors
    const allUniqueResponses = [];
    const seenResponseKey = new Set();
    adminLiveStats.responses.forEach(r => {
      const sId = r.startup_id || r.startupId;
      const k = `${r.investor_key}__${sId}`;
      seenResponseKey.add(k);
      allUniqueResponses.push({ ...r, startup_id: sId, response_type: r.response_type || r.response });
    });
    Object.entries(state.responseByInvestor).forEach(([invKey, respObj]) => {
      Object.entries(respObj || {}).forEach(([sId, r]) => {
        const k = `${invKey}__${sId}`;
        if (!seenResponseKey.has(k)) {
          seenResponseKey.add(k);
          allUniqueResponses.push({
            investor_key: invKey,
            startup_id: sId,
            response_type: r.response || r.response_type,
            recorded_at: r.recordedAt
          });
        }
      });
    });

    const totalResponsesCount = allUniqueResponses.length;
    const maxExpectedResponses = totalInvestors * TOTAL_PITCHES;
    const overallCompletionPct = maxExpectedResponses > 0 ? Math.round((totalResponsesCount / maxExpectedResponses) * 100) : 0;

    const allInterested = allUniqueResponses.filter(r => (r.response_type || r.response) === RESPONSE.INTERESTED).length;
    const allExplore = allUniqueResponses.filter(r => (r.response_type || r.response) === RESPONSE.EXPLORE).length;
    const allNotInterested = allUniqueResponses.filter(r => (r.response_type || r.response) === RESPONSE.NOT_INTERESTED).length;

    // Online Now Detection (Active within 60s or current session is online)
    const now = Date.now();
    const isInvestorOnline = (inv) => {
      if (session?.id === inv.investor_key && navigator.onLine) return true;
      if (!inv.last_active) return false;
      const diff = now - new Date(inv.last_active).getTime();
      return diff >= 0 && diff < 60000;
    };
    const onlineNowCount = effectiveInvestors.filter(isInvestorOnline).length;

    // Investor completion cohorts
    const allDoneInvestorsCount = effectiveInvestors.filter(inv => Object.keys(getInvestorResponseMap(inv)).length === TOTAL_PITCHES).length;
    const inProgressInvestorsCount = effectiveInvestors.filter(inv => {
      const c = Object.keys(getInvestorResponseMap(inv)).length;
      return c > 0 && c < TOTAL_PITCHES;
    }).length;
    const noResponseInvestorsCount = effectiveInvestors.filter(inv => Object.keys(getInvestorResponseMap(inv)).length === 0).length;
    const totalVotedInvestorsCount = effectiveInvestors.filter(inv => Object.keys(getInvestorResponseMap(inv)).length > 0).length;

    const published = state.published[state.pitch] || null;
    const baseURL = window.location.origin + window.location.pathname;
    const eventSlug = orgState.slug || slugify(orgState.eventTitle);
    const investorURL = `${baseURL}?event=${eventSlug}#investor`;
    const stageURL = `${baseURL}?event=${eventSlug}#stage`;
    const adminURL = `${baseURL}?event=${eventSlug}#admin`;

    root.innerHTML = `
      <!-- Live Submission Overview Hero -->
      <section class="admin-hero-live">
        <div class="admin-hero-top">
          <div class="admin-hero-meta">
            <span class="eyebrow" style="color:#38bdf8;background:rgba(56,189,248,0.12);padding:4px 12px;border-radius:999px;border:1px solid rgba(56,189,248,0.25);display:inline-block;margin-bottom:6px">12 STARTUP BOOTHS • REAL-TIME INVESTOR RESPONSES</span>
            <h2>Startup Demo Day Response Hub</h2>
            <p>Live responses recorded per startup across all 12 booths with instant syndicate sentiment.</p>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="net-badge online"><span class="live-pulse-dot" style="width:7px;height:7px"></span> Realtime Submissions Stream</span>
          </div>
        </div>

        <div class="live-completion-stats">
          <div class="live-completion-num">${totalResponsesCount > 0 ? totalResponsesCount : '0'} <span style="font-size:22px;font-weight:600;color:#94a3b8">/ ${maxExpectedResponses > 0 ? maxExpectedResponses : '0'}</span></div>
          <div class="live-completion-desc">
            <strong>${totalResponsesCount > 0 ? `${overallCompletionPct}% of total expected booth responses recorded` : 'Awaiting initial investor responses'}</strong>
            <span>${totalInvestors > 0 ? `${totalVotedInvestorsCount} of ${totalInvestors} investors active (${allDoneInvestorsCount} completed all 12 booths)` : 'Awaiting live investor participation'}</span>
          </div>
        </div>

        <div class="completion-track">
          <div class="completion-fill" style="width: ${Math.min(100, overallCompletionPct)}%"></div>
        </div>

        <div class="live-chips-row">
          ${totalResponsesCount > 0 ? `
            <span class="live-stat-chip green">👍 <strong>${allInterested}</strong> Interested</span>
            <span class="live-stat-chip yellow">? <strong>${allExplore}</strong> Explore More</span>
            <span class="live-stat-chip blue">👎 <strong>${allNotInterested}</strong> Not My Area</span>
            <span class="live-stat-chip gray">⏳ <strong>${Math.max(0, maxExpectedResponses - totalResponsesCount)}</strong> Pending</span>
          ` : `
            <span class="live-stat-chip gray" style="font-weight:600;padding:6px 14px">— Awaiting live responses across 12 startup booths —</span>
          `}
        </div>
      </section>

      <!-- KPI Grid -->
      <div class="dashboard">
        <div class="kpi kpi-investors">
          <small>👥 Registered Investors</small>
          <strong>${totalInvestors}</strong>
          <span class="detail-label">Passwordless accounts</span>
        </div>
        <div class="kpi kpi-online" style="${onlineNowCount > 0 ? 'background:#f0fdf4;border-color:#86efac' : ''}">
          <small style="${onlineNowCount > 0 ? 'color:#15803d' : ''}"><span class="live-pulse-dot"></span> Logged In Now</small>
          <strong style="${onlineNowCount > 0 ? 'color:#166534' : ''}">${onlineNowCount}</strong>
          <span class="detail-label">${onlineNowCount > 0 ? 'Active in last 60s' : 'Awaiting sign-ins'}</span>
        </div>
        <div class="kpi kpi-voters">
          <small>✅ Active Voters</small>
          <strong>${totalVotedInvestorsCount} <span style="font-size:18px;font-weight:600;color:#94a3b8">/ ${totalInvestors}</span></strong>
          <span class="detail-label">${totalInvestors > 0 ? Math.round((totalVotedInvestorsCount / totalInvestors) * 100) : 0}% participated</span>
        </div>
        <div class="kpi kpi-pitch">
          <small>🎯 All 12 Done</small>
          <strong>${allDoneInvestorsCount} <span style="font-size:18px;font-weight:600;color:#94a3b8">/ ${totalInvestors}</span></strong>
          <span class="detail-label">${inProgressInvestorsCount} in progress</span>
        </div>
        <div class="kpi kpi-total">
          <small>📈 Total Responses</small>
          <strong>${totalResponsesCount}</strong>
          <span class="detail-label">Across all 12 booths</span>
        </div>
        <div class="kpi kpi-network">
          <small>🌐 Cloud Sync</small>
          <strong style="font-size:22px;margin-top:6px">${netState === 'ONLINE' ? '🟢 Realtime' : '🔴 Local Only'}</strong>
          <span class="detail-label">${outboxQueue.length} pending outbox</span>
        </div>
      </div>

      <!-- Controls & Responses -->
      <div class="admin-grid">
        <section class="panel">
          <h3>
            <span>🎛️ Event & Stage Controls</span>
            <span class="live-stat-chip blue" style="font-size:10px;padding:3px 10px;font-weight:800">Featured: Booth ${currentStartup.n}</span>
          </h3>
          <p class="detail-label" style="margin-bottom:16px">Control stage featured startup and publish live aggregated sentiment to audience screens.</p>
          
          <div class="admin-btns">
            <button class="admin-btn blue" data-admin="start">▶ Start Event</button>
            <button class="admin-btn yellow" data-admin="next">⏭ Next Booth (${Math.min(TOTAL_PITCHES, state.pitch + 1)})</button>
            <button class="admin-btn green" data-admin="prepare">🎯 Prepare Stage</button>
            <button class="admin-btn dark" data-admin="publish">📡 Publish to Stage</button>
            <button class="admin-btn red" data-admin="complete">🏁 Complete Event</button>
            <button class="admin-btn neutral" data-admin="reset">↺ Reset Demo</button>
          </div>

          <div style="margin-top:20px;padding:16px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px">
            <h4 style="margin:0 0 10px;font-size:13px;font-weight:850;color:var(--ink)">Real-Time Data Backups & Reset</h4>
            <div class="admin-btns">
              <button class="admin-btn green" data-action="export-csv">📥 Export All Votes (CSV)</button>
              <button class="admin-btn blue" data-action="export-json">💾 Download Event Backup (JSON)</button>
              <button class="admin-btn neutral" data-admin="refresh-data">🔄 Force Cloud Sync</button>
              <button class="admin-btn red" data-action="reset-session" style="font-weight:850">
                🔄 Reset & Start New Session (Auto-CSV)
              </button>
            </div>
          </div>

          <div class="notice" style="margin-top:16px;background:#f0f9ff;border-color:#bae6fd;color:#0369a1">
            <strong>🛡️ Stage Privacy Rule</strong>
            Individual investor responses are stored securely in Supabase and aggregated before publishing. Individual votes are never streamed to public screens.
          </div>
        </section>

        <section class="panel">
          <h3>
            <span>📡 Live Incoming Stream</span>
            <span class="live-stat-chip green" style="font-size:10px;padding:3px 10px"><span class="live-pulse-dot" style="width:6px;height:6px"></span> Live</span>
          </h3>
          <p class="detail-label" style="margin-bottom:14px">Real-time broadcast feed of investor logins, votes, and administrative triggers.</p>
          <div class="live-stream-box">
            ${realtimeStream.length > 0 ? realtimeStream.slice(0, 15).map(item => `
              <div class="stream-item">
                <div class="stream-main">
                  <span class="stream-dot"></span>
                  <span><strong>${item.actor}</strong> ${item.detail ? `— ${item.detail}` : ''}</span>
                </div>
                <span class="stream-time">${item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            `).join('') : '<div class="notice">Waiting for live interactions from investors...</div>'}
          </div>
        </section>
      </div>

      <!-- Startup Booth Order & Pitch Sequence (Live Drag & Drop + Broadcast) -->
      ${renderStartupReorderPanel()}

      <!-- Live Startup Completion Matrix -->
      <div class="panel" style="margin-top:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0 0 4px">Startup Booth Completion Matrix (All 12 Startups)</h3>
            <p class="detail-label" style="margin:0">Real-time breakdown of how many investors have filled their response for each startup booth.</p>
          </div>
          <span class="live-stat-chip blue" style="font-weight:800;font-size:11px">12 Booths Total</span>
        </div>
        <div class="roster-wrap">
          <table class="roster-table">
            <thead>
              <tr>
                <th style="width:65px">Booth</th>
                <th>Startup Name</th>
                <th style="width:140px">Submissions</th>
                <th style="width:190px">Participation</th>
                <th>Breakdown (👍 / ? / 👎)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${startups.map(s => {
                const sResps = allUniqueResponses.filter(r => (r.startup_id || r.startupId) === s.id);
                const count = sResps.length;
                const hasVotes = count > 0;
                const pct = totalInvestors > 0 ? Math.round((count / totalInvestors) * 100) : 0;
                const iCount = sResps.filter(r => (r.response_type || r.response) === RESPONSE.INTERESTED).length;
                const eCount = sResps.filter(r => (r.response_type || r.response) === RESPONSE.EXPLORE).length;
                const nCount = sResps.filter(r => (r.response_type || r.response) === RESPONSE.NOT_INTERESTED).length;
                const isAllVoted = count >= totalInvestors && totalInvestors > 0;
                const status = isAllVoted ? 'ALL VOTED' : count > 0 ? 'ACTIVE' : 'OPEN';
                const statusColor = isAllVoted ? 'green' : count > 0 ? 'blue' : 'gray';

                return `<tr>
                  <td><strong>B${s.n}</strong></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <span class="booth-tag">Booth ${s.n}</span>
                      <div>
                        <strong style="font-size:14px;color:#0f172a;display:block">${s.name}</strong>
                        <div style="font-size:11.5px;color:#64748b;font-weight:550">${s.subSector}</div>
                      </div>
                    </div>
                  </td>
                  <td>${hasVotes ? `<strong style="font-size:14px;color:#0f172a">${count}</strong> <span style="color:#94a3b8">/ ${totalInvestors}</span>` : '<span style="color:#94a3b8;font-size:12px">—</span>'}</td>
                  <td>
                    ${hasVotes ? `
                      <div class="mini-prog">
                        <div class="mini-prog-bar"><div class="mini-prog-fill" style="width:${pct}%"></div></div>
                        <span style="font-weight:750;font-size:12px">${pct}%</span>
                      </div>
                    ` : '<span style="color:#94a3b8;font-size:12px">—</span>'}
                  </td>
                  <td>
                    ${hasVotes ? `
                      <span class="live-stat-chip green" style="padding:2px 8px;font-size:10.5px;font-weight:800">👍 ${iCount}</span> &nbsp;
                      <span class="live-stat-chip yellow" style="padding:2px 8px;font-size:10.5px;font-weight:800">? ${eCount}</span> &nbsp;
                      <span class="live-stat-chip blue" style="padding:2px 8px;font-size:10.5px;font-weight:800">👎 ${nCount}</span>
                    ` : '<span style="color:#94a3b8;font-size:12px">—</span>'}
                  </td>
                  <td><span class="live-stat-chip ${statusColor}" style="padding:3px 10px;font-size:10.5px;font-weight:800">${status}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Live Registered Investors Roster -->
      <div class="panel" style="margin-top:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
          <div>
            <h3 style="margin:0 0 4px">Live Registered Investors Roster (${totalInvestors})</h3>
            <p class="detail-label" style="margin:0">Live presence and per-startup responses tracker across all 12 booths.</p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <div class="roster-tabs">
              <button class="roster-tab-btn ${adminRosterFilter === 'all' ? 'active' : ''}" data-roster-filter="all">All (${totalInvestors})</button>
              <button class="roster-tab-btn ${adminRosterFilter === 'online' ? 'active' : ''}" data-roster-filter="online">🟢 Online Now (${onlineNowCount})</button>
              <button class="roster-tab-btn ${adminRosterFilter === 'complete' ? 'active' : ''}" data-roster-filter="complete">✅ All 12 Done (${allDoneInvestorsCount})</button>
              <button class="roster-tab-btn ${adminRosterFilter === 'progress' ? 'active' : ''}" data-roster-filter="progress">⚡ In Progress (${inProgressInvestorsCount})</button>
              <button class="roster-tab-btn ${adminRosterFilter === 'unvoted' ? 'active' : ''}" data-roster-filter="unvoted">⏳ No Responses (${noResponseInvestorsCount})</button>
            </div>
            <button class="admin-btn neutral" data-admin="refresh-data" style="font-size:11.5px;padding:7px 14px">↻ Refresh Cloud Data</button>
          </div>
        </div>
        <div class="roster-wrap">
          <table class="roster-table">
            <thead>
              <tr>
                <th>Investor Name & Details</th>
                <th>Responses Per Startup (12 Booths)</th>
                <th>Progress</th>
                <th>Sentiment (👍 / ? / 👎)</th>
                <th>Joined</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                let list = effectiveInvestors;
                if (adminRosterFilter === 'online') {
                  list = list.filter(isInvestorOnline);
                } else if (adminRosterFilter === 'complete') {
                  list = list.filter(inv => Object.keys(getInvestorResponseMap(inv)).length === TOTAL_PITCHES);
                } else if (adminRosterFilter === 'progress') {
                  list = list.filter(inv => {
                    const c = Object.keys(getInvestorResponseMap(inv)).length;
                    return c > 0 && c < TOTAL_PITCHES;
                  });
                } else if (adminRosterFilter === 'unvoted') {
                  list = list.filter(inv => Object.keys(getInvestorResponseMap(inv)).length === 0);
                }

                if (list.length === 0) {
                  return `<tr><td colspan="6" style="text-align:center;padding:32px;color:#64748b">No investors found matching filter "${adminRosterFilter}". All live submissions and scores will appear here in real time.</td></tr>`;
                }

                return list.map(inv => {
                  const respMap = getInvestorResponseMap(inv);
                  const count = Object.keys(respMap).length;
                  const hasUserVotes = count > 0;
                  const pct = Math.round((count / TOTAL_PITCHES) * 100);
                  const badgeClass = count === TOTAL_PITCHES ? 'complete' : count > 0 ? 'progress' : 'pending';
                  const badgeLabel = count === TOTAL_PITCHES ? 'All 12 Completed' : count > 0 ? 'In Progress' : 'No Responses Yet';

                  const userInterested = Object.values(respMap).filter(v => v === RESPONSE.INTERESTED).length;
                  const userExplore = Object.values(respMap).filter(v => v === RESPONSE.EXPLORE).length;
                  const userNotInterested = Object.values(respMap).filter(v => v === RESPONSE.NOT_INTERESTED).length;

                  // 12 Booth Badges per startup
                  const boothBadges = startups.map(s => {
                    const resp = respMap[s.id];
                    if (resp === RESPONSE.INTERESTED) {
                      return `<span class="booth-resp-badge green" title="Booth ${s.n} (${s.name}): Interested (👍)">B${s.n} 👍</span>`;
                    } else if (resp === RESPONSE.EXPLORE) {
                      return `<span class="booth-resp-badge yellow" title="Booth ${s.n} (${s.name}): Explore More (?)">B${s.n} ?</span>`;
                    } else if (resp === RESPONSE.NOT_INTERESTED) {
                      return `<span class="booth-resp-badge blue" title="Booth ${s.n} (${s.name}): Not my area of interest (👎)">B${s.n} 👎</span>`;
                    } else {
                      return `<span class="booth-resp-badge empty" title="Booth ${s.n} (${s.name}): Pending response">B${s.n} ·</span>`;
                    }
                  }).join('');

                  const lastActiveMs = inv.last_active ? (Date.now() - new Date(inv.last_active).getTime()) : 0;
                  const isSelf = session?.id === inv.investor_key;
                  const isOnlineNow = isSelf ? (navigator.onLine && netState === 'ONLINE') : (lastActiveMs > 0 && lastActiveMs < 60000);
                  const connBadge = isOnlineNow
                    ? '<span class="live-stat-chip green" style="padding:2px 8px;font-size:9.5px"><span class="live-pulse-dot" style="width:6px;height:6px"></span> Online Now</span>'
                    : (lastActiveMs > 0 && lastActiveMs < 180000)
                    ? '<span class="live-stat-chip yellow" style="padding:2px 8px;font-size:9.5px">🟡 Idle (&lt;3m)</span>'
                    : '<span class="live-stat-chip gray" style="padding:2px 8px;font-size:9.5px">⚪ Offline</span>';

                  const initials = (inv.full_name || 'Inv').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();

                  return `<tr>
                    <td>
                      <div class="investor-name-cell">
                        <div class="investor-avatar">${initials}</div>
                        <div>
                          <div style="font-weight:800;color:#0f172a;display:flex;align-items:center;gap:8px">
                            <span>${inv.full_name}</span>
                            ${connBadge}
                          </div>
                          <div style="color:#64748b;font-size:11px;margin-top:2px">${inv.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="booth-resp-grid">
                        ${boothBadges}
                      </div>
                    </td>
                    <td>
                      ${hasUserVotes ? `
                        <div class="mini-prog">
                          <div class="mini-prog-bar"><div class="mini-prog-fill" style="width:${pct}%"></div></div>
                          <span style="font-weight:800"><strong>${count}</strong> / ${TOTAL_PITCHES}</span>
                        </div>
                      ` : '<span style="color:#94a3b8;font-size:12px">—</span>'}
                    </td>
                    <td>
                      ${hasUserVotes ? `
                        <span class="live-stat-chip green" style="padding:2px 7px;font-size:10px;font-weight:800">👍 ${userInterested}</span> &nbsp;
                        <span class="live-stat-chip yellow" style="padding:2px 7px;font-size:10px;font-weight:800">? ${userExplore}</span> &nbsp;
                        <span class="live-stat-chip blue" style="padding:2px 7px;font-size:10px;font-weight:800">👎 ${userNotInterested}</span>
                      ` : '<span style="color:#94a3b8;font-size:12px">—</span>'}
                    </td>
                    <td style="color:#64748b;font-size:11px">${new Date(inv.joined_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span class="roster-badge ${badgeClass}">${badgeLabel}</span></td>
                  </tr>`;
                }).join('');
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Published Stage Snapshot -->
      <div class="panel" style="margin-top:22px">
        <h3>
          <span>Published Stage Snapshot</span>
          ${published ? '<span class="live-stat-chip green" style="font-size:10px;padding:3px 10px">Live on Screen</span>' : ''}
        </h3>
        ${published ? `<div class="notice" style="background:#f0fdf4;border-color:#bbf7d0;color:#166534">
          <strong style="font-size:14px">Featured Booth ${currentStartup.n} (${currentStartup.name}) Snapshot:</strong><br>
          <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap">
            <span class="live-stat-chip green" style="font-weight:800;padding:4px 10px">👍 ${published.i}% Interested</span>
            <span class="live-stat-chip yellow" style="font-weight:800;padding:4px 10px">? ${published.e}% Explore More</span>
            <span class="live-stat-chip blue" style="font-weight:800;padding:4px 10px">👎 ${published.n}% Not My Area</span>
          </div>
        </div>` : '<div class="notice">No snapshot published yet for this booth. Click "Publish to Stage" to make aggregated results visible on the Stage screen.</div>'}
      </div>

      <!-- Generated Shareable Event Links (Admin-Only Access) -->
      <section class="panel" style="margin-top:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0 0 4px">🔗 Generated Shareable Event Links</h3>
            <p class="detail-label" style="margin:0">Distribute these direct URLs to your audience and projection team. The investor app has zero admin buttons.</p>
          </div>
          <span class="live-stat-chip blue" style="font-weight:800">Admin Control Only</span>
        </div>

        <div class="link-gen-container">
          <div class="link-gen-row">
            <span class="link-gen-title">📱 <strong>Investor Hub App</strong></span>
            <input id="admin-link-investor" class="link-gen-url" value="${investorURL}" readonly>
            <button class="btn-copy-link" data-copy-link="admin-link-investor">📋 Copy Link</button>
            <a href="${investorURL}" target="_blank" class="btn-open-link" style="text-decoration:none">Open App ↗</a>
          </div>

          <div class="link-gen-row">
            <span class="link-gen-title">📺 <strong>Main Stage Display</strong></span>
            <input id="admin-link-stage" class="link-gen-url" value="${stageURL}" readonly>
            <button class="btn-copy-link" data-copy-link="admin-link-stage">📋 Copy Link</button>
            <button class="btn-open-link" data-route="stage">Open Stage →</button>
          </div>

          <div class="link-gen-row">
            <span class="link-gen-title">🔒 <strong>Organiser Command Center</strong></span>
            <input id="admin-link-admin" class="link-gen-url" value="${adminURL}" readonly>
            <button class="btn-copy-link" data-copy-link="admin-link-admin">📋 Copy Link</button>
            <button class="btn-open-link" data-route="admin">Active View ✓</button>
          </div>

          <div class="link-gen-row">
            <span class="link-gen-title">🏛️ <strong>Public Organisation Landing Page</strong></span>
            <input id="admin-link-org" class="link-gen-url" value="${baseURL}#org" readonly>
            <button class="btn-copy-link" data-copy-link="admin-link-org">📋 Copy Link</button>
            <button class="btn-open-link" data-route="org">Open Landing →</button>
          </div>

          <div class="link-gen-row">
            <span class="link-gen-title">🎨 <strong>UI Design Reference Screens</strong></span>
            <input id="admin-link-refs" class="link-gen-url" value="${baseURL}#references" readonly>
            <button class="btn-copy-link" data-copy-link="admin-link-refs">📋 Copy Link</button>
            <button class="btn-open-link" data-route="references">View Screens →</button>
          </div>
        </div>
      </section>
    `;
    initDragAndDrop();
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER: Stage Display
     ══════════════════════════════════════════════════════════════ */
  function renderStage() {
    const root = document.getElementById('stage-root');
    if (!root) return;
    const s = startups[state.pitch - 1] || startups[0];
    const exitBtn = `<button data-route="admin" style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.08);color:#94a3b8;font-size:11px;font-weight:700;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);cursor:pointer;z-index:100">Exit Stage ✕</button>`;

    if (state.stageStatus === 'PREPARING') {
      root.innerHTML = `<section class="stage-screen">
        ${exitBtn}
        <div class="stage-content">
          <div class="stage-loading">
            <div class="spinner"></div>
            Results are being prepared.<br>
            <small>No individual investor votes are displayed.</small>
          </div>
        </div>
      </section>`;
      return;
    }

    if (state.stageStatus === 'PUBLISHED' && state.published[state.pitch]) {
      const p = state.published[state.pitch];
      root.innerHTML = `<section class="stage-screen">
        ${exitBtn}
        <div class="stage-content">
          <span class="stage-badge">PUBLISHED RESULTS</span>
          <h2><span class="booth-tag" style="font-size:16px;padding:4px 12px">Booth ${s.n}</span> ${s.name}</h2>
          <div class="stage-metrics">
            <div class="stage-metric stage-green"><strong>${p.i}%</strong><span>Interested</span></div>
            <div class="stage-metric stage-yellow"><strong>${p.e}%</strong><span>Explore More</span></div>
            <div class="stage-metric stage-blue"><strong>${p.n}%</strong><span>Not My Area</span></div>
          </div>
        </div>
      </section>`;
      return;
    }

    root.innerHTML = `<section class="stage-screen">
      ${exitBtn}
      <div class="stage-content">
        <img src="assets/logo.png" alt="AFF Logo" style="width:76px;height:76px;margin:0 auto 14px;display:block;filter:drop-shadow(0 6px 16px rgba(0,0,0,0.12))">
        <span class="stage-badge">STARTUP BOOTH • ${state.pitch}/${TOTAL_PITCHES}</span>
        <h2><span class="booth-tag" style="font-size:16px;padding:4px 12px">Booth ${s.n}</span> ${s.name}</h2>
        <div class="notice" style="max-width:650px;margin:24px auto 0;background:#101b31;color:#8fa0bb;border:1px solid #24334f">
          The public stage displays only approved, aggregated results. Investor responses are recorded privately and securely.
        </div>
      </div>
    </section>`;
  }

  /* ── Render: UI References ──────────────────────────────────── */
  function renderReferences() {
    const root = document.getElementById('reference-root');
    if (!root) return;
    root.innerHTML = refImages.map(([file, label]) => `
      <article class="reference-card">
        <img src="assets/ui-reference/${file}" alt="${label}" loading="lazy">
        <div class="ref-caption">
          <strong>${label}</strong>
          <span>Generated UI screen included in this package.</span>
        </div>
      </article>
    `).join('');
  }

  /* ══════════════════════════════════════════════════════════════
     ORGANISATION PORTAL (Top Layer Landing Page & Event Generator)
     ══════════════════════════════════════════════════════════════ */
  const ORG_STORAGE_KEY = 'startup-demo-org-v2';

  function slugify(text) {
    return (text || '').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') || 'aff-2026';
  }

  function loadOrgState() {
    try {
      const saved = JSON.parse(localStorage.getItem(ORG_STORAGE_KEY));
      if (saved) return saved;
    } catch (e) {
      console.warn('[Org] State load note:', e);
    }
    return {
      name: 'Asian Founders Fund (AFF)',
      leadEmail: 'organizer@asianfoundersfund.com',
      eventTitle: 'AFF Demo Day 2026',
      passcode: 'thatAff2026@',
      slug: 'aff-2026'
    };
  }

  function saveOrgState() {
    try {
      localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(orgState));
    } catch (err) {
      console.warn('[Org] Save warning:', err);
    }
  }

  let orgState = loadOrgState();

  function renderOrgPortal() {
    const root = document.getElementById('org-root');
    if (!root) return;

    root.innerHTML = `
      <div class="org-landing-wrap">
        <!-- Hero Banner -->
        <section class="org-hero-banner">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
            <img src="assets/logo.png" alt="AFF Logo" style="width:64px;height:64px;filter:drop-shadow(0 6px 14px rgba(0,0,0,0.12));flex-shrink:0">
            <span class="org-badge"><i></i> ENTERPRISE DEMO DAY PLATFORM</span>
          </div>
          <h1>${orgState.eventTitle || 'AFF Demo Day 2026'} is Live</h1>
          <p>
            Hosted by <strong>${orgState.name || 'Asian Founders Fund (AFF)'}</strong>. 12 venture-backed tech startups pitching live to accredited investors and syndicate partners.
          </p>
          <div class="org-actions-row">
            <button class="btn-org-secondary" data-action="org-admin-login">🔒 Organiser Admin Access</button>
            <a href="tel:+917350868084" class="btn-org-primary" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none">📞 Contact: +91 7350868084</a>
          </div>
        </section>

        <!-- Live Event Status Card (Secure Public View - No Sensitive Internal Links) -->
        <section class="org-event-card">
          <div class="org-event-header">
            <div class="org-event-title">
              <span class="eyebrow" style="color:#2563eb">ACTIVE LIVE EVENT</span>
              <h2>${orgState.eventTitle || 'AFF Demo Day 2026'}</h2>
              <p>Hosted by <strong>${orgState.name || 'Asian Founders Fund (AFF)'}</strong> • 12 Pre-Configured Startups • Live Voting in Progress</p>
            </div>
            <div class="org-event-badges">
              <span class="net-badge online"><i></i> Live Pitching Active</span>
              <span class="live-stat-chip blue">12 Tech Startups</span>
              <span class="live-stat-chip green">1,000+ Capacity</span>
            </div>
          </div>

          <div style="margin-top:20px;padding:20px;background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.2);border-radius:12px">
            <div style="display:flex;align-items:flex-start;gap:14px">
              <span style="font-size:28px;line-height:1">🔒</span>
              <div>
                <h4 style="margin:0 0 6px;font-size:15px;color:var(--ink);font-weight:700">Private & Confidential Investor Access</h4>
                <p style="margin:0;font-size:13.5px;color:var(--ink-secondary);line-height:1.6">
                  Attendee voting and live pitch participation are strictly private and invite-only. Accredited investors and partners receive dedicated, passwordless access links directly from event organisers.
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Contact Us To Host Your Demo Day Section -->
        <section class="org-event-card" style="border:1px solid rgba(16,185,129,0.3);background:linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(37,99,235,0.04) 100%)">
          <div class="org-event-header">
            <div class="org-event-title">
              <span class="eyebrow" style="color:#059669">HOST YOUR EVENT</span>
              <h2>Want to Host Your Demo Day With Us?</h2>
              <p>Power your venture fund, accelerator cohort, or startup pitch competition with zero-latency voting and live stage display.</p>
            </div>
          </div>

          <div style="margin-top:16px;padding:20px;background:var(--card-bg, #ffffff);border:1px solid rgba(0,0,0,0.08);border-radius:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:18px">
            <div>
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-tertiary);font-weight:700;margin-bottom:4px">Direct Organiser Hotline</div>
              <div style="font-size:24px;font-weight:800;letter-spacing:-0.02em;color:#0f172a">
                <a href="tel:+917350868084" style="color:inherit;text-decoration:none">+91 7350868084</a>
              </div>
              <div style="font-size:13px;color:var(--ink-secondary);margin-top:4px">
                Direct phone & WhatsApp support for Demo Day partnerships & custom deployments
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <a href="tel:+917350868084" class="btn-org-primary" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;padding:12px 20px;font-weight:600">
                <span>📞</span> Call +91 7350868084
              </a>
              <a href="https://wa.me/917350868084?text=Hi%2C%20we%20want%20to%20host%20our%20Demo%20Day%20on%20your%20platform" target="_blank" rel="noopener noreferrer" class="btn-org-secondary" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;padding:12px 20px;font-weight:600;background:#25d366;color:#ffffff;border-color:#25d366">
                <span>💬</span> WhatsApp Us
              </a>
            </div>
          </div>
        </section>

        <!-- Feature Grid -->
        <div class="org-feature-grid">
          <div class="org-feature-card">
            <div class="org-feature-icon">⚡</div>
            <h3>1,000+ Concurrency</h3>
            <p>Optimistic 0ms local storage recording and idempotent cloud upserts prevent server bottlenecks.</p>
          </div>
          <div class="org-feature-card">
            <div class="org-feature-icon">🔑</div>
            <h3>Passwordless Access</h3>
            <p>Investors join securely with instant cryptographic key verification and cloud session restoration.</p>
          </div>
          <div class="org-feature-card">
            <div class="org-feature-icon">📶</div>
            <h3>Zero-Data-Loss Outbox</h3>
            <p>Votes are preserved in a persistent queue and auto-synced the moment cellular or Wi-Fi reconnects.</p>
          </div>
          <div class="org-feature-card">
            <div class="org-feature-icon">🛡️</div>
            <h3>Confidential Stage Sync</h3>
            <p>Individual investor votes remain strictly confidential. Only approved aggregated stats are published on stage.</p>
          </div>
        </div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════════════════════
     ROUTING & NAVIGATION
     ══════════════════════════════════════════════════════════════ */
  function getRouteFromURL() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (['org', 'investor', 'admin', 'stage', 'references'].includes(hash)) return hash;
    // On mobile devices (screen width <= 768px or mobile user agent), default to 'investor' for attendees!
    const isMobileDevice = (typeof window !== 'undefined') && (
      window.innerWidth <= 768 || 
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
    if (isMobileDevice) return 'investor';
    return 'org'; // Default to Organisation Portal on desktop
  }

  function setRoute(next) {
    if (next === 'admin' && !adminUnlocked) {
      showAdminLock();
      return;
    }
    route = next;
    window.location.hash = next;
    document.body.className = `route-${next}`;

    const titleEl = document.getElementById('investor-event-title');
    if (titleEl) titleEl.textContent = orgState.eventTitle || 'AFF Demo Day 2026';

    document.querySelectorAll('.route-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${next}`)?.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.route === next));

    if (next === 'org') renderOrgPortal();
    if (next === 'investor') renderInvestor();
    if (next === 'admin') {
      fetchAdminLiveData();
      renderAdmin();
    }
    if (next === 'stage') renderStage();
    if (next === 'references') renderReferences();

    updateNetworkStatusBadges();
    recordFeed('PAGE_VIEW', { detail: `Navigated to: ${next}` });
  }

  /* ══════════════════════════════════════════════════════════════
     ADMIN COMMANDS
     ══════════════════════════════════════════════════════════════ */
  function doAdmin(action) {
    if (!adminUnlocked) {
      showAdminLock();
      return;
    }

    if (action === 'start') {
      state.eventStatus = 'LIVE';
      audit('EVENT_STARTED', 'Live investor voting session started');
      broadcast();
      toast('Event live — voting enabled.');
      recordFeed('ADMIN_ACTION', { detail: 'Event started' });
    }
    if (action === 'next') {
      state.pitch = Math.min(TOTAL_PITCHES, state.pitch + 1);
      state.eventStatus = 'LIVE';
      state.stageStatus = 'STANDBY';
      audit('NEXT_PITCH', `Advanced to Startup ${state.pitch}`);
      broadcast();
      toast(`Advanced to Startup ${state.pitch}`);
      recordFeed('ADMIN_ACTION', { detail: `Next pitch: Startup ${state.pitch}` });
    }
    if (action === 'prepare') {
      state.stageStatus = 'PREPARING';
      audit('STAGE_LOADING', `Preparing results for Pitch ${state.pitch}`);
      broadcast();
      toast('Stage status set to PREPARING.');
      recordFeed('ADMIN_ACTION', { detail: `Stage preparing for pitch ${state.pitch}` });
    }
    if (action === 'publish') {
      publishCurrentPitch();
    }
    if (action === 'complete') {
      state.eventStatus = 'COMPLETED';
      audit('EVENT_COMPLETED', 'Event completed');
      broadcast();
      toast('Event completed.');
      recordFeed('ADMIN_ACTION', { detail: 'Event marked completed' });
    }
    if (action === 'refresh-data') {
      flushOutboxQueue();
      fetchAdminLiveData(true);
    }
    if (action === 'reset') {
      if (confirm('Are you sure you want to reset all demo state?')) {
        recordFeed('ADMIN_ACTION', { detail: 'Demo reset' });
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ORDER_STORAGE_KEY);
        localStorage.removeItem('startup-demo-admin-backup-v2');
        location.reload();
      }
    }
  }

  function publishCurrentPitch() {
    if (!adminUnlocked) return;
    const currentStartup = startups[state.pitch - 1] || startups[0];

    const currentResponses = adminLiveStats.responses.length > 0
      ? adminLiveStats.responses.filter(r => r.startup_id === currentStartup.id)
      : Object.values(state.responseByInvestor).map(b => b[currentStartup.id]).filter(Boolean);

    const base = Math.max(1, currentResponses.length);
    const iCount = currentResponses.filter(r => (r.response_type || r.response) === RESPONSE.INTERESTED).length;
    const eCount = currentResponses.filter(r => (r.response_type || r.response) === RESPONSE.EXPLORE).length;

    const i = Math.round((iCount / base) * 100);
    const e = Math.round((eCount / base) * 100);
    const n = Math.max(0, 100 - i - e);

    state.published[state.pitch] = {
      i, e, n,
      totalVotes: base,
      publishedAt: new Date().toISOString(),
      version: (state.published[state.pitch]?.version || 0) + 1
    };
    state.stageStatus = 'PUBLISHED';

    audit('STAGE_RESULTS_PUBLISHED', `Pitch ${state.pitch}: ${i}% / ${e}% / ${n}%`);
    broadcast();
    toast('Published results to Stage.');

    recordFeed('STAGE_PUBLISHED', {
      startupId: currentStartup.id,
      startupName: currentStartup.name,
      detail: `Published to Stage: ${i}% interested, ${e}% explore, ${n}% not interested`,
      metadata: { interested: i, explore: e, notInterested: n, totalVotes: base }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     DATA EXPORT & BACKUPS (Real-Time Admin & Audit Trails)
     ══════════════════════════════════════════════════════════════ */
  function exportResponsesCSV() {
    const responses = adminLiveStats.responses.length > 0 ? adminLiveStats.responses : [];
    const investorsMap = new Map();
    (adminLiveStats.investors || []).forEach(inv => {
      investorsMap.set(inv.investor_key, inv);
    });

    const headers = ['Startup ID', 'Startup Number', 'Startup Name', 'Investor Name', 'Investor Email', 'Response Type', 'Recorded At', 'Data Source'];
    const rows = [];

    if (responses.length > 0) {
      responses.forEach(r => {
        const inv = investorsMap.get(r.investor_key) || { full_name: 'Registered Investor', email: r.investor_key };
        const invName = r.investor_name || inv.full_name || 'Registered Investor';
        const invEmail = r.investor_email || inv.email || r.investor_key;
        const s = startups.find(st => st.id === r.startup_id) || { n: '-', name: r.startup_name || r.startup_id };
        rows.push([
          `"${r.startup_id || ''}"`,
          `"${s.n || ''}"`,
          `"${(s.name || '').replace(/"/g, '""')}"`,
          `"${invName.replace(/"/g, '""')}"`,
          `"${invEmail.replace(/"/g, '""')}"`,
          `"${r.response_type || r.response || ''}"`,
          `"${r.recorded_at || ''}"`,
          `"Supabase Cloud Realtime"`
        ]);
      });
    } else {
      // Local fallback
      Object.entries(state.responseByInvestor).forEach(([invKey, respObj]) => {
        Object.entries(respObj).forEach(([startupId, item]) => {
          const s = startups.find(st => st.id === startupId) || { n: '-', name: item.startupName || startupId };
          const invName = item.investorName || (session?.id === invKey ? session.name : 'Local Session');
          const invEmail = item.investorEmail || (session?.id === invKey ? session.email : invKey);
          rows.push([
            `"${startupId}"`,
            `"${s.n || ''}"`,
            `"${(s.name || '').replace(/"/g, '""')}"`,
            `"${invName.replace(/"/g, '""')}"`,
            `"${invEmail.replace(/"/g, '""')}"`,
            `"${item.response || item.response_type || ''}"`,
            `"${item.recordedAt || ''}"`,
            `"Local Device Storage"`
          ]);
        });
      });
    }

    if (rows.length === 0) {
      toast('No votes have been recorded yet to export.');
      return 0;
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.setAttribute('download', `demo-day-votes-${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast(`✓ Exported ${rows.length} votes to CSV!`);
    return rows.length;
  }

  async function resetAndArchiveSession() {
    if (!adminUnlocked) {
      showAdminLock();
      return;
    }

    const totalVotes = (adminLiveStats.responses && adminLiveStats.responses.length) ||
      Object.values(state.responseByInvestor).reduce((acc, cur) => acc + Object.keys(cur || {}).length, 0);

    const confirmMsg = totalVotes > 0
      ? `Archive current session and initialize a new session?\n\n✓ All ${totalVotes} recorded vote(s) will be automatically saved and downloaded to CSV first.\n✓ Active responses will then be cleared to start fresh for pitch 1.`
      : 'Start a new session and reset active event state to pitch 1?';

    if (!confirm(confirmMsg)) return;

    // 1. Export CSV first if votes exist
    if (totalVotes > 0) {
      exportResponsesCSV();
      toast('📥 Session CSV downloaded to your device!');
    }

    // 2. Archive local snapshot
    try {
      const archiveId = 'startup-demo-archive-' + Date.now();
      localStorage.setItem(archiveId, JSON.stringify({
        archivedAt: new Date().toISOString(),
        eventTitle: orgState.eventTitle || 'AFF Demo Day 2026',
        totalVotes,
        investors: adminLiveStats.investors,
        responses: adminLiveStats.responses,
        localResponses: state.responseByInvestor,
        publishedResults: state.published
      }));
    } catch (e) {
      console.warn('[Archive] Snapshot note:', e);
    }

    // 3. Clear cloud responses in Supabase for the fresh session
    if (supabase) {
      try {
        await supabase.from('demo_responses').delete().neq('id', 0);
      } catch (err) {
        console.warn('[Archive] Cloud delete warning:', err);
      }
    }

    // 4. Reset runtime & local state
    state.pitch = 1;
    state.responseByInvestor = {};
    state.published = {};
    state.stageStatus = 'STANDBY';
    state.eventStatus = 'READY';
    state.investorResponses = 0;
    saveState();

    adminLiveStats.responses = [];
    localStorage.removeItem(ORDER_STORAGE_KEY);
    applyStartupOrder(STARTUPS_MASTER.map(s => s.id), true);
    localStorage.removeItem('startup-demo-admin-backup-v2');

    audit('SESSION_RESET_AND_ARCHIVED', `Session reset: ${totalVotes} votes exported to CSV; fresh session ready`);
    recordFeed('SESSION_RESET', {
      detail: `Admin reset session. ${totalVotes} votes exported to CSV.`
    });

    broadcast();
    renderAll();
    toast('✓ Previous session archived & CSV saved! New session started.');
  }

  function exportEventJSON() {
    const backupData = {
      exportedAt: new Date().toISOString(),
      eventTitle: orgState.eventTitle || 'AFF Demo Day 2026',
      organisation: orgState.name || 'Asian Founders Fund (AFF)',
      leadEmail: orgState.leadEmail || '',
      currentPitch: state.pitch,
      eventStatus: state.eventStatus,
      stageStatus: state.stageStatus,
      publishedResults: state.published,
      startupsCount: startups.length,
      startups: startups,
      registeredInvestors: adminLiveStats.investors,
      allResponses: adminLiveStats.responses,
      localStateSnapshot: state,
      auditLog: state.adminAudit || []
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.setAttribute('download', `demo-day-backup-${timestamp}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('✓ Complete event JSON backup downloaded!');
  }

  /* ══════════════════════════════════════════════════════════════
     EVENT BINDINGS
     ══════════════════════════════════════════════════════════════ */
  function bind() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-route]');
      if (nav) setRoute(nav.dataset.route);

      const startup = e.target.closest('[data-startup]');
      if (startup) openStartup(startup.dataset.startup);

      const selectBtn = e.target.closest('[data-select-response]');
      if (selectBtn) {
        pendingChoice = selectBtn.dataset.selectResponse;
        renderInvestor();
        return;
      }

      const rosterFilterBtn = e.target.closest('[data-roster-filter]');
      if (rosterFilterBtn) {
        adminRosterFilter = rosterFilterBtn.dataset.rosterFilter;
        renderAdmin();
        return;
      }

      const response = e.target.closest('[data-response]');
      if (response) submitResponse(response.dataset.response);

      // Copy link buttons
      const copyBtn = e.target.closest('[data-copy-link]');
      if (copyBtn) {
        const targetId = copyBtn.dataset.copyLink;
        const inputEl = document.getElementById(targetId);
        if (inputEl) {
          const val = inputEl.value || inputEl.textContent;
          const triggerFeedback = () => {
            const origText = copyBtn.textContent;
            copyBtn.textContent = '✓ Copied!';
            copyBtn.style.background = '#10b981';
            copyBtn.style.color = '#fff';
            setTimeout(() => {
              copyBtn.textContent = origText;
              copyBtn.style.background = '';
              copyBtn.style.color = '';
            }, 1800);
          };

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(val).then(() => {
              toast('✓ Link copied to clipboard!');
              triggerFeedback();
            }).catch(() => {
              toast(`Copied: ${val}`);
              triggerFeedback();
            });
          } else {
            inputEl.select?.();
            document.execCommand?.('copy');
            toast('✓ Link copied to clipboard!');
            triggerFeedback();
          }
        }
      }

      const savedCard = e.target.closest('.saved-account-card, [data-action="fast-login"]');
      if (savedCard) {
        const name = savedCard.dataset.name;
        const email = savedCard.dataset.email;
        const nameInput = document.getElementById('join-name');
        const emailInput = document.getElementById('join-email');
        if (nameInput && name) nameInput.value = name;
        if (emailInput && email) emailInput.value = email;
        if (name && email) {
          performLogin(name, email);
          return;
        }
      }

      const respFilterBtn = e.target.closest('[data-resp-filter]');
      if (respFilterBtn) {
        myResponseFilter = respFilterBtn.dataset.respFilter;
        renderInvestor();
        return;
      }

      // Startup pitch sequence reordering buttons (Touch & Mouse)
      const moveUpBtn = e.target.closest('[data-action="order-move-up"]');
      if (moveUpBtn) {
        const idx = parseInt(moveUpBtn.dataset.index, 10);
        if (idx > 0) {
          const orderIds = startups.map(s => s.id);
          const temp = orderIds[idx];
          orderIds[idx] = orderIds[idx - 1];
          orderIds[idx - 1] = temp;
          applyStartupOrder(orderIds, true);
          renderAdmin();
          toast(`Moved ${startups[idx - 1]?.name || 'Startup'} to Booth ${idx}. Click 'Broadcast New Order' to sync.`);
        }
        return;
      }

      const moveDownBtn = e.target.closest('[data-action="order-move-down"]');
      if (moveDownBtn) {
        const idx = parseInt(moveDownBtn.dataset.index, 10);
        if (idx < startups.length - 1) {
          const orderIds = startups.map(s => s.id);
          const temp = orderIds[idx];
          orderIds[idx] = orderIds[idx + 1];
          orderIds[idx + 1] = temp;
          applyStartupOrder(orderIds, true);
          renderAdmin();
          toast(`Moved ${startups[idx + 1]?.name || 'Startup'} to Booth ${idx + 2}. Click 'Broadcast New Order' to sync.`);
        }
        return;
      }

      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'broadcast-order') {
        const orderIds = startups.map(s => s.id);
        broadcastStartupOrder(orderIds);
        renderAll();
        toast('✓ Pitch sequence broadcasted to all attendee devices & stage display!');
        return;
      }
      if (action === 'reset-order') {
        if (confirm('Reset startup pitch sequence to default order?')) {
          const defaultIds = STARTUPS_MASTER.map(s => s.id);
          broadcastStartupOrder(defaultIds);
          renderAll();
          toast('✓ Startup order reset to default sequence.');
        }
        return;
      }
      if (action === 'join') joinEvent();
      if (action === 'back-list') backToList();
      if (action === 'change-vote') {
        const s = lastSubmitted || selectedStartup;
        if (s) {
          selectedStartup = s;
          isEditingVote = true;
          pendingChoice = responseFor(s.id)?.response || null;
          investorScreen = 'detail';
          renderInvestor();
        }
      }
      if (action === 'cancel-choice') {
        pendingChoice = null;
        if (isEditingVote) {
          isEditingVote = false;
          investorScreen = 'confirmation';
        }
        renderInvestor();
      }
      if (action === 'confirm-submit') {
        if (pendingChoice) {
          submitResponse(pendingChoice);
        }
      }
      if (action === 'reset-session') resetAndArchiveSession();
      if (action === 'switch-account') switchInvestorAccount();
      if (action === 'org-admin-login') showAdminLock();
      if (action === 'export-csv') exportResponsesCSV();
      if (action === 'export-json') exportEventJSON();
      if (action === 'scroll-create-org') {
        const sec = document.getElementById('org-create-section');
        if (sec) sec.scrollIntoView({ behavior: 'smooth' });
      }

      if (action === 'create-org-event') {
        const orgName = document.getElementById('org-input-name')?.value.trim() || 'Asian Founders Fund (AFF)';
        const orgEmail = document.getElementById('org-input-email')?.value.trim() || 'organizer@asianfoundersfund.com';
        const eventTitle = document.getElementById('org-input-event')?.value.trim() || 'AFF Demo Day 2026';
        const passcode = document.getElementById('org-input-passcode')?.value.trim() || 'thatAff2026@';
        const slug = slugify(eventTitle);

        orgState.name = orgName;
        orgState.leadEmail = orgEmail;
        orgState.eventTitle = eventTitle;
        orgState.passcode = passcode;
        orgState.slug = slug;
        saveOrgState();

        const baseURL = window.location.origin + window.location.pathname;
        const invUrl = `${baseURL}?event=${slug}#investor`;
        const admUrl = `${baseURL}?event=${slug}#admin`;
        const stgUrl = `${baseURL}?event=${slug}#stage`;

        if (supabase) {
          supabase.from('demo_organisations').upsert({
            org_id: 'org_' + slug,
            org_name: orgName,
            lead_name: orgName + ' Lead',
            lead_email: orgEmail,
            event_title: eventTitle,
            passcode: passcode,
            investor_url: invUrl,
            admin_url: admUrl,
            stage_url: stgUrl
          }, { onConflict: 'org_id' }).then(() => {}).catch(err => console.warn('[Org] Save error:', err));
        }

        recordFeed('ORGANISATION_REGISTERED', {
          actorName: orgName,
          actorEmail: orgEmail,
          detail: `Organisation registered: ${orgName} — Event: ${eventTitle} (Slug: ${slug})`
        });

        renderOrgPortal();
        renderAdmin();
        toast(`✓ Event created for ${orgName}! Custom links ready.`);
      }

      const filterBtn = e.target.closest('[data-filter]');
      if (filterBtn) {
        startupFilter = filterBtn.dataset.filter;
        renderInvestor();
      }

      const tab = e.target.closest('[data-nav]')?.dataset.nav;
      if (tab === 'home') {
        startupFilter = 'all';
        selectedStartup = null;
        investorScreen = 'list';
        renderInvestor();
        const scroller = document.querySelector('.phone-content');
        if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (tab === 'list') {
        selectedStartup = null;
        investorScreen = 'list';
        renderInvestor();
      }
      if (tab === 'responses') {
        selectedStartup = null;
        investorScreen = 'responses';
        renderInvestor();
        recordFeed('VIEW_MY_RESPONSES', { detail: 'Opened My Responses' });
      }

      const admin = e.target.closest('[data-admin]')?.dataset.admin;
      if (admin) doAdmin(admin);
    });

    document.getElementById('admin-passcode-submit')?.addEventListener('click', attemptAdminUnlock);
    document.getElementById('admin-passcode-cancel')?.addEventListener('click', () => {
      hideAdminLock();
      setRoute('org');
    });
    document.getElementById('admin-passcode')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') attemptAdminUnlock();
    });

    window.addEventListener('hashchange', () => {
      const newRoute = getRouteFromURL();
      if (newRoute !== route) setRoute(newRoute);
    });
  }

  function renderAll() {
    if (route === 'org') renderOrgPortal();
    if (route === 'investor') renderInvestor();
    if (route === 'admin') renderAdmin();
    if (route === 'stage') renderStage();
    updateNetworkStatusBadges();
  }

  /* ══════════════════════════════════════════════════════════════
     INITIALIZATION
     ══════════════════════════════════════════════════════════════ */
  bind();
  route = getRouteFromURL();
  setRoute(route);
  renderAll();
  renderReferences();
  initSupabaseRealtime();
  updateNetworkStatusBadges();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('[SW] Registration notice:', err);
      });
    });
  }

  // Restore passwordless cloud session and responses on start
  (async () => {
    if (session?.id) {
      const valid = await restoreSessionFromSupabase();
      if (valid) {
        console.log('[Session] Verified cloud session for:', session.name);
      }
      await restoreResponsesFromSupabase(session.id, session.email);
    }
  })();

  recordFeed('APP_LOADED', {
    detail: `App loaded on route: ${route}`,
    metadata: { route, hasSession: !!session, deviceInfo }
  });
})();
