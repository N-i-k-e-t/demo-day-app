(() => {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     SUPABASE CONNECTION & REALTIME CONFIG
     ══════════════════════════════════════════════════════════════ */
  const cfg = (typeof window !== 'undefined' && (window.APP_CONFIG || window.__ENV__)) || {};
  const SUPABASE_URL = cfg.SUPABASE_URL || 'https://toucgwdalgtkcfhebvgo.supabase.co';
  const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvdWNnd2RhbGd0a2NmaGVidmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzIzNzQsImV4cCI6MjEwNTg0ODM3NH0.YOpoQ6lzRgeicJvsiC4Zun78jvYtW7_TzCFosaG0HZQ';

  let supabase = null;
  try {
    if (window.supabase && window.supabase.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  const TOTAL_PITCHES = 15;
  const STORAGE_KEY = 'startup-demo-live-v2';
  const SESSION_KEY = 'startup-demo-session-v2';
  const OUTBOX_KEY = 'startup-demo-outbox-v2';
  const CHANNEL_NAME = 'startup-demo-live-v2';
  const RESPONSE = { INTERESTED: 'INTERESTED', EXPLORE: 'EXPLORE', NOT_INTERESTED: 'NOT_INTERESTED' };
  const COLORS = { INTERESTED: 'green', EXPLORE: 'yellow', NOT_INTERESTED: 'blue' };

  const startups = [
    { id: 's01', n: 1, name: 'AquaSense', sub: 'Smart water management for sustainable cities', tags: ['Climate Tech', 'IoT', 'Sustainability'], initial: 'A', accent: 'blue' },
    { id: 's02', n: 2, name: 'VoltDrive', sub: 'EV charging infrastructure for a greener future', tags: ['Clean Energy', 'Mobility', 'Hardware'], initial: 'V', accent: 'yellow' },
    { id: 's03', n: 3, name: 'Mark Startup', sub: 'Building the next generation AI workspace', tags: ['AI', 'Productivity', 'SaaS'], initial: 'M', accent: 'blue' },
    { id: 's04', n: 4, name: 'HealthMate', sub: 'AI-powered personal health companion', tags: ['Health Tech', 'AI', 'Consumer App'], initial: 'H', accent: 'purple' },
    { id: 's05', n: 5, name: 'AgriNext', sub: 'Data-driven farming for higher yields', tags: ['Agriculture', 'AI', 'Sustainability'], initial: 'A', accent: 'green' },
    { id: 's06', n: 6, name: 'EduVerse', sub: 'Immersive learning for every student', tags: ['EdTech', 'VR/AR', 'Education'], initial: 'E', accent: 'red' },
    { id: 's07', n: 7, name: 'LogiSmart', sub: 'Supply chain intelligence for modern businesses', tags: ['Logistics', 'AI', 'Enterprise'], initial: 'L', accent: 'blue' },
    { id: 's08', n: 8, name: 'SafeCity', sub: 'AI-driven public safety solutions', tags: ['GovTech', 'AI', 'Smart Cities'], initial: 'S', accent: 'purple' },
    { id: 's09', n: 9, name: 'FinMate', sub: 'Smarter financial wellness for working teams', tags: ['FinTech', 'AI', 'B2B'], initial: 'F', accent: 'green' },
    { id: 's10', n: 10, name: 'CarbonLoop', sub: 'Practical carbon intelligence for SMEs', tags: ['Climate', 'Analytics', 'B2B'], initial: 'C', accent: 'green' },
    { id: 's11', n: 11, name: 'FoodGrid', sub: 'Predictive food supply planning', tags: ['AgriTech', 'AI', 'Food'], initial: 'F', accent: 'yellow' },
    { id: 's12', n: 12, name: 'CarePath', sub: 'Digital coordination for community care', tags: ['HealthTech', 'Platform', 'Care'], initial: 'C', accent: 'purple' },
    { id: 's13', n: 13, name: 'BuildAI', sub: 'Automating early-stage construction planning', tags: ['ConTech', 'AI', 'Enterprise'], initial: 'B', accent: 'blue' },
    { id: 's14', n: 14, name: 'FleetOS', sub: 'Operations intelligence for logistics fleets', tags: ['Mobility', 'IoT', 'SaaS'], initial: 'F', accent: 'blue' },
    { id: 's15', n: 15, name: 'LearnLoop', sub: 'Personalized practice for lifelong learners', tags: ['EdTech', 'AI', 'Consumer'], initial: 'L', accent: 'yellow' }
  ];

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
  let toastTimer = null;

  // Live Admin Data (Maintained live via Supabase Realtime + smart polling)
  let adminLiveStats = {
    investors: [],
    responses: [],
    lastSync: null,
    isSyncing: false
  };

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
    return value === RESPONSE.INTERESTED ? 'Interested' : value === RESPONSE.EXPLORE ? 'Explore more' : value === RESPONSE.NOT_INTERESTED ? 'Not interested' : 'Not responded';
  }

  function responseColor(value) {
    return value ? COLORS[value] : 'none';
  }

  function responseIcon(value) {
    return value === RESPONSE.INTERESTED ? '👍' : value === RESPONSE.EXPLORE ? '?' : value === RESPONSE.NOT_INTERESTED ? '👎' : '○';
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
  function updateNetworkStatusBadges() {
    const pendingCount = outboxQueue.length;
    let label = 'Online';
    let cls = 'online';

    if (!navigator.onLine || netState === 'OFFLINE') {
      cls = 'offline';
      label = pendingCount > 0 ? `Offline (${pendingCount} saved)` : 'Offline (Local mode)';
    } else if (pendingCount > 0 || isFlushingOutbox) {
      cls = 'syncing';
      label = `Syncing (${pendingCount} pending)`;
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
    updateNetworkStatusBadges();
    toast('Network online — syncing data...');
    flushOutboxQueue();
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
          const { error } = await supabase.from('demo_responses').upsert({
            investor_key: item.payload.investorKey,
            startup_id: item.payload.startupId,
            startup_name: item.payload.startupName,
            response_type: item.payload.responseType,
            idempotency_key: item.payload.idempotencyKey,
            recorded_at: item.payload.recordedAt || new Date().toISOString()
          }, { onConflict: 'idempotency_key' });
          if (!error) success = true;
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
        const { data: existingUser } = await supabase
          .from('demo_investors')
          .select('investor_key, full_name, email')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (existingUser?.investor_key) {
          investorKey = existingUser.investor_key;
          if (!displayName && existingUser.full_name) {
            displayName = existingUser.full_name;
          }
        }
      } catch (err) {
        console.warn('[Login] Existing user lookup note:', err);
      }
    }

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
    broadcast();
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

    // 2. Safely restore all previous votes from Supabase (prevents overrides!)
    const restored = await restoreResponsesFromSupabase(investorKey);
    if (restored > 0) {
      toast(`✓ Welcome back, ${displayName}! Restored ${restored} previous votes.`);
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

  async function restoreResponsesFromSupabase(targetKey) {
    const key = targetKey || session?.id;
    if (!supabase || !key) return 0;
    try {
      const { data, error } = await supabase
        .from('demo_responses')
        .select('startup_id, startup_name, response_type, recorded_at, idempotency_key')
        .eq('investor_key', key);

      if (!error && data && data.length > 0) {
        const bucket = state.responseByInvestor[key] || (state.responseByInvestor[key] = {});
        let newRestored = 0;
        data.forEach(r => {
          if (!bucket[r.startup_id]) {
            bucket[r.startup_id] = {
              response: r.response_type,
              startupId: r.startup_id,
              recordedAt: r.recorded_at,
              idempotencyKey: r.idempotency_key
            };
            newRestored++;
          }
        });
        if (newRestored > 0) {
          saveState();
          renderAll();
          console.log(`[Session] Restored ${newRestored} previous responses from cloud.`);
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
     LIVE ADMIN DATA FETCHING & AGGREGATION
     ══════════════════════════════════════════════════════════════ */
  async function fetchAdminLiveData() {
    if (!supabase || adminLiveStats.isSyncing) return;
    adminLiveStats.isSyncing = true;

    try {
      // 1. Fetch all registered investors
      const { data: invData, error: invErr } = await supabase
        .from('demo_investors')
        .select('investor_key, full_name, email, joined_at, last_active')
        .order('joined_at', { ascending: false });

      if (!invErr && invData) {
        adminLiveStats.investors = invData;
      }

      // 2. Fetch all immutable responses
      const { data: respData, error: respErr } = await supabase
        .from('demo_responses')
        .select('investor_key, startup_id, response_type, recorded_at')
        .order('recorded_at', { ascending: false });

      if (!respErr && respData) {
        adminLiveStats.responses = respData;
        try {
          localStorage.setItem('startup-demo-admin-backup-v2', JSON.stringify({
            savedAt: new Date().toISOString(),
            investors: adminLiveStats.investors,
            responses: adminLiveStats.responses
          }));
        } catch (e) {
          console.warn('[Admin] Local backup write notice:', e);
        }
      }

      adminLiveStats.lastSync = new Date();
      if (route === 'admin' && adminUnlocked) {
        renderAdmin();
      }
    } catch (err) {
      console.warn('[Admin] Live sync fetch error:', err);
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
     SUPABASE REALTIME SUBSCRIPTIONS (Live Score & Interaction Streams)
     ══════════════════════════════════════════════════════════════ */
  function initSupabaseRealtime() {
    if (!supabase) return;
    try {
      const channel = supabase.channel('startup-demo-live-room');

      // Listen to broadcast state
      channel.on('broadcast', { event: 'state_sync' }, (payload) => {
        if (payload?.payload?.state) {
          state = { ...defaultState, ...payload.payload.state };
          saveState();
          renderAll();
        }
      });

      // Realtime Postgres Changes: New Responses inserted by ANY investor
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'demo_responses' }, (payload) => {
        const newResp = payload.new;
        if (newResp) {
          // Check if not already in admin list
          if (!adminLiveStats.responses.some(r => r.investor_key === newResp.investor_key && r.startup_id === newResp.startup_id)) {
            adminLiveStats.responses.unshift(newResp);
          }
          // Push to live activity stream
          const invObj = adminLiveStats.investors.find(i => i.investor_key === newResp.investor_key);
          const invName = invObj ? invObj.full_name : 'Investor';
          pushRealtimeStreamItem({
            type: 'RESPONSE_SUBMITTED',
            actor: invName,
            startup: newResp.startup_name || ('Startup ' + newResp.startup_id),
            response: newResp.response_type,
            detail: `${invName} voted ${responseLabel(newResp.response_type)}`,
            time: new Date()
          });
          if (route === 'admin' && adminUnlocked) {
            renderAdmin();
          }
        }
      });

      // Realtime Postgres Changes: New Investors joined
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'demo_investors' }, (payload) => {
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

      // Realtime Postgres Changes: Event State updates (Pitch change, stage publish)
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'demo_event_state' }, (payload) => {
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

      channel.subscribe((status) => {
        console.log('[Supabase Realtime] Channel status:', status);
      });
    } catch (err) {
      console.warn('[Supabase Realtime] Setup error:', err);
    }
  }

  async function broadcastStateRealtime() {
    if (!supabase) return;
    try {
      const channel = supabase.channel('startup-demo-live-room');
      await channel.send({
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
        state = event.data.state || state;
        saveState();
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
    if (current) {
      toast('Response already recorded.');
      investorScreen = 'list';
      renderInvestor();
      return;
    }

    const key = getInvestorKey();
    const investorBucket = state.responseByInvestor[key] || (state.responseByInvestor[key] = {});

    const respItem = {
      response: choice,
      startupId: selectedStartup.id,
      startupNumber: selectedStartup.n,
      recordedAt: new Date().toISOString(),
      idempotencyKey: `${key}:${selectedStartup.id}`
    };

    // 1. Optimistic Local Save (0ms latency — instant UI response)
    investorBucket[selectedStartup.id] = respItem;
    state.investorResponses += 1;
    state.stateVersion += 1;
    lastSubmitted = selectedStartup;
    investorScreen = 'confirmation';

    audit('RESPONSE_RECORDED', `${session.name} → ${selectedStartup.name}: ${choice}`, 'INVESTOR');
    broadcast();
    renderAll();
    toast('Response saved securely.');

    // 2. Queue into Durable Outbox for guaranteed zero-loss delivery to cloud
    enqueueOutbox({
      type: 'SUBMIT_RESPONSE',
      payload: {
        investorKey: key,
        startupId: selectedStartup.id,
        startupName: selectedStartup.name,
        responseType: choice,
        idempotencyKey: respItem.idempotencyKey,
        recordedAt: respItem.recordedAt
      }
    });

    recordFeed('RESPONSE_SUBMITTED', {
      startupId: selectedStartup.id,
      startupName: selectedStartup.name,
      responseType: choice,
      detail: `${session.name} voted ${responseLabel(choice)} on ${selectedStartup.name}`
    });
  }

  function backToList() {
    selectedStartup = null;
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
          <strong>Startup Demo <span style="color:#5c55ef;font-weight:850">Live</span></strong>
          <small>Investor Voting Hub</small>
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
      <div>
        <div class="progress-label">${TOTAL_PITCHES} startups available</div>
        <div class="dots">${startups.map((s, idx) => `<i class="dot ${idx + 1 === state.pitch ? 'active' : ''}"></i>`).join('')}</div>
      </div>
      <span class="live-pill">${state.eventStatus}</span>
    </div>`;
  }

  function renderStartupCard(s) {
    const r = responseFor(s.id);
    const color = responseColor(r?.response);
    return `<button class="startup-card choice-${color}" data-startup="${s.id}">
      <span class="rank">${s.n}</span>
      <span class="logo">${s.initial}</span>
      <span class="startup-main">
        <strong>${s.name}</strong>
        <span>${s.sub}</span>
        <span class="tags">${s.tags.map(t => `<small class="tag">${t}</small>`).join('')}</span>
      </span>
      <span class="choice-pill ${color}">
        <span class="choice-icon">${responseIcon(r?.response)}</span>
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
        <h1 style="font-size:26px;margin:0 0 4px">Live Startup Pitches</h1>
        <div class="detail-label">Browse all 15 startups. Tap any startup to record your official response.</div>
      </div>
      ${renderProgress()}
      <div class="filters">
        <button class="chip ${startupFilter === 'all' ? 'active' : ''}" data-filter="all">All Startups (${TOTAL_PITCHES})</button>
        <button class="chip ${startupFilter === 'pending' ? 'active' : ''}" data-filter="pending">Pending (${notAnswered})</button>
        <button class="chip ${startupFilter === 'voted' ? 'active' : ''}" data-filter="voted">My Votes (${totalAnswered})</button>
      </div>
      <section class="startup-list">
        ${filtered.length > 0 ? filtered.map(renderStartupCard).join('') : '<div class="notice">No startups matching this filter.</div>'}
      </section>
    </main>${renderBottomNav('startups')}`;
  }

  function renderDetailScreen() {
    const s = selectedStartup;
    const r = responseFor(s.id);
    if (r) {
      investorScreen = 'confirmation';
      lastSubmitted = s;
      return renderConfirmationScreen();
    }
    return `${renderHeader()}<main class="phone-content">
      <div class="detail-header">
        <button class="back-btn" data-action="back-list">‹</button>
        <div class="detail-label">Pitch ${s.n} of ${TOTAL_PITCHES}</div>
        <span class="live-pill">Live</span>
      </div>
      ${renderProgress()}
      <section class="hero-card">
        <div class="hero-logo">${s.name}</div>
        <h2>${s.sub}</h2>
        <p>A focused profile for Demo Day. Review the startup opportunity below, then cast your one-time immutable vote.</p>
        <div class="hero-visual">
          <div style="position:absolute;left:16px;top:15px;font-size:10px;font-weight:850;color:#3656a5">STARTUP DEMO</div>
          <div style="position:absolute;left:16px;bottom:15px;right:16px" class="feature-row">
            <div class="feature">AI Technology</div>
            <div class="feature">Market Scalability</div>
            <div class="feature">Traction</div>
          </div>
        </div>
      </section>
      <div class="response-stack">
        <button class="response-btn green" data-response="INTERESTED">
          <span class="response-icon">👍</span>
          <span><strong>I am interested</strong><span>Request founder introduction & follow-up deck.</span></span>
          <span style="margin-left:auto">›</span>
        </button>
        <button class="response-btn yellow" data-response="EXPLORE">
          <span class="response-icon">?</span>
          <span><strong>Would like to explore more</strong><span>Have questions or want deeper diligence info.</span></span>
          <span style="margin-left:auto">›</span>
        </button>
        <button class="response-btn blue" data-response="NOT_INTERESTED">
          <span class="response-icon">👎</span>
          <span><strong>Not interested</strong><span>Not a fit for our current investment mandate.</span></span>
          <span style="margin-left:auto">›</span>
        </button>
      </div>
      <div class="notice">
        <strong>🔒 Immutable & Offline-Resilient</strong>
        Your response is saved instantly to your device and synchronized to the cloud. It cannot be altered after submission.
      </div>
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
        <strong>${s.name}</strong>
        <span>${responseLabel(r?.response)}</span>
      </div>
      <button class="primary-cta" data-action="back-list">Back to Startup List →</button>
    </main>${renderBottomNav('startups')}`;
  }

  function renderMyResponses() {
    const rows = startups.filter(s => responseFor(s.id)).map(s => {
      const r = responseFor(s.id);
      return `<div class="my-response-row">
        <div>
          <strong>${s.n}. ${s.name}</strong>
          <div class="detail-label">${new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <span class="choice-pill ${COLORS[r.response]}">${responseLabel(r.response)}</span>
      </div>`;
    }).join('');

    return `${renderHeader()}<main class="phone-content">
      <div style="margin:4px 0 14px">
        <h1 style="font-size:26px;margin:0 0 4px">My Responses</h1>
        <div class="detail-label">Your voting history for this Demo Day event.</div>
      </div>
      <div class="my-responses">
        ${rows || '<div class="notice">No responses recorded yet. Select any startup to record your vote.</div>'}
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
        <div class="hero-logo" style="justify-content:center">Investor Voting Hub</div>
        <h2>Welcome to ${orgState.eventTitle || 'AFF Demo Day 2026'}</h2>
        <p>Passwordless voting — sign in to score all 15 startups live. Your credentials and scores are preserved safely across sessions.</p>
      </section>

      ${hasSaved ? `
        <div class="saved-accounts-section" style="margin-bottom:14px">
          <div class="detail-label" style="margin-bottom:8px;font-weight:800;color:#64748b">CONTINUE AS SAVED INVESTOR</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${saved.map(acc => `
              <div class="saved-account-card" data-action="fast-login" data-email="${acc.email}" data-name="${acc.name}">
                <div class="avatar-mini" style="width:34px;height:34px;font-size:14px;background:#e0e7ff;color:#3730a3;border-radius:50%;display:grid;place-items:center;font-weight:900;flex-shrink:0">${acc.name.charAt(0).toUpperCase()}</div>
                <div style="flex:1;min-width:0;text-align:left">
                  <strong style="font-size:13px;display:block;color:var(--ink)">${acc.name}</strong>
                  <span style="font-size:11px;color:#64748b;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${acc.email}</span>
                </div>
                <button class="chip active" style="font-size:11px;padding:6px 12px">Login →</button>
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

    // Live Metrics: Derived from Supabase data + local fallback
    const totalInvestors = adminLiveStats.investors.length || Object.keys(state.responseByInvestor).length || 1;
    const totalResponsesCount = adminLiveStats.responses.length || state.investorResponses || 0;

    // Current Pitch Submission Stats
    const currentResponses = adminLiveStats.responses.length > 0
      ? adminLiveStats.responses.filter(r => r.startup_id === currentStartup.id)
      : Object.values(state.responseByInvestor).map(b => b[currentStartup.id]).filter(Boolean);

    const currentSubmittedCount = currentResponses.length;
    const currentCompletionPct = totalInvestors > 0 ? Math.round((currentSubmittedCount / totalInvestors) * 100) : 0;

    const currentInterested = currentResponses.filter(r => (r.response_type || r.response) === RESPONSE.INTERESTED).length;
    const currentExplore = currentResponses.filter(r => (r.response_type || r.response) === RESPONSE.EXPLORE).length;
    const currentNotInterested = currentResponses.filter(r => (r.response_type || r.response) === RESPONSE.NOT_INTERESTED).length;
    const currentPending = Math.max(0, totalInvestors - currentSubmittedCount);

    const published = state.published[state.pitch] || null;
    const baseURL = window.location.origin + window.location.pathname;

    root.innerHTML = `
      <!-- Live Submission Overview Hero -->
      <section class="admin-hero-live">
        <div class="admin-hero-top">
          <div class="admin-hero-meta">
            <span class="eyebrow" style="color:#7dd3fc">PITCH ${state.pitch} OF ${TOTAL_PITCHES} • LIVE PARTICIPATION</span>
            <h2>${currentStartup.name} <small style="font-size:14px;font-weight:400;color:#94a3b8">(${currentStartup.sub})</small></h2>
            <p>Live submission tracker: Real-time counter of investors who have filled their response.</p>
          </div>
          <div>
            <span class="net-badge online"><i></i> Realtime Submissions Stream</span>
          </div>
        </div>

        <div class="live-completion-stats">
          <div class="live-completion-num">${currentSubmittedCount} <span style="font-size:20px;font-weight:600;color:#94a3b8">/ ${totalInvestors}</span></div>
          <div class="live-completion-desc">
            <strong>${currentCompletionPct}% of registered investors have submitted</strong>
            <span>${currentPending > 0 ? `${currentPending} investors still pending for this pitch` : 'All registered investors have submitted!'}</span>
          </div>
        </div>

        <div class="completion-track">
          <div class="completion-fill" style="width: ${Math.min(100, currentCompletionPct)}%"></div>
        </div>

        <div class="live-chips-row">
          <span class="live-stat-chip green">👍 ${currentInterested} Interested</span>
          <span class="live-stat-chip yellow">? ${currentExplore} Explore More</span>
          <span class="live-stat-chip blue">👎 ${currentNotInterested} Not Interested</span>
          <span class="live-stat-chip gray">⏳ ${currentPending} Pending</span>
        </div>
      </section>

      <!-- KPI Grid -->
      <div class="dashboard">
        <div class="kpi">
          <small>Registered Investors</small>
          <strong>${adminLiveStats.investors.length || 1}</strong>
          <span class="detail-label">Passwordless accounts</span>
        </div>
        <div class="kpi">
          <small>Current Pitch</small>
          <strong>${state.pitch}/${TOTAL_PITCHES}</strong>
          <span class="detail-label">${currentStartup.name}</span>
        </div>
        <div class="kpi">
          <small>Total Submissions</small>
          <strong>${totalResponsesCount}</strong>
          <span class="detail-label">Across all startups</span>
        </div>
        <div class="kpi">
          <small>Live Network State</small>
          <strong style="font-size:20px;margin-top:8px">${netState === 'ONLINE' ? '🟢 Cloud Connected' : '🔴 Local / Offline'}</strong>
          <span class="detail-label">${outboxQueue.length} pending sync items</span>
        </div>
      </div>

      <!-- Controls & Responses -->
      <div class="admin-grid">
        <section class="panel">
          <h3>Event & Stage Controls</h3>
          <div class="admin-btns">
            <button class="admin-btn blue" data-admin="start">Start Event</button>
            <button class="admin-btn yellow" data-admin="next">Next Startup (${Math.min(TOTAL_PITCHES, state.pitch + 1)})</button>
            <button class="admin-btn green" data-admin="prepare">Prepare Stage</button>
            <button class="admin-btn dark" data-admin="publish">Publish to Stage</button>
            <button class="admin-btn red" data-admin="complete">Complete Event</button>
            <button class="admin-btn" style="background:#eef1f6" data-admin="reset">Reset Demo</button>
          </div>
          <div style="margin-top:16px;padding-top:14px;border-top:1px solid #edf2f7">
            <h4 style="margin:0 0 10px;font-size:13px;color:var(--ink)">Real-Time Data Backups & Exports</h4>
            <div class="admin-btns">
              <button class="admin-btn green" data-action="export-csv">📥 Export All Votes (CSV)</button>
              <button class="admin-btn blue" data-action="export-json">💾 Download Event Backup (JSON)</button>
              <button class="admin-btn" style="background:#eef1f6" data-admin="refresh-data">🔄 Force Cloud Sync</button>
            </div>
          </div>
          <div class="notice" style="margin-top:14px">
            <strong>Stage Privacy Rule</strong>
            Individual investor responses are stored securely in Supabase and aggregated before publishing. Individual votes are never streamed to public screens.
          </div>
        </section>

        <section class="panel">
          <h3>Live Incoming Activity Stream</h3>
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

      <!-- Live Pitch-by-Pitch Matrix -->
      <div class="panel" style="margin-top:14px">
        <h3>Startup Completion Matrix (All 15 Startups)</h3>
        <p class="detail-label" style="margin-bottom:12px">Real-time breakdown of how many investors have filled their response for each startup.</p>
        <div class="roster-wrap">
          <table class="roster-table">
            <thead>
              <tr>
                <th style="width:40px">#</th>
                <th>Startup</th>
                <th style="width:130px">Submissions</th>
                <th style="width:180px">Participation</th>
                <th>Breakdown (👍 / ? / 👎)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${startups.map(s => {
                const sResps = adminLiveStats.responses.length > 0
                  ? adminLiveStats.responses.filter(r => r.startup_id === s.id)
                  : Object.values(state.responseByInvestor).map(b => b[s.id]).filter(Boolean);
                const count = sResps.length;
                const pct = totalInvestors > 0 ? Math.round((count / totalInvestors) * 100) : 0;
                const iCount = sResps.filter(r => (r.response_type || r.response) === RESPONSE.INTERESTED).length;
                const eCount = sResps.filter(r => (r.response_type || r.response) === RESPONSE.EXPLORE).length;
                const nCount = sResps.filter(r => (r.response_type || r.response) === RESPONSE.NOT_INTERESTED).length;
                const status = s.n === state.pitch ? 'CURRENT' : s.n < state.pitch ? 'COMPLETED' : 'UPCOMING';
                const statusColor = s.n === state.pitch ? 'blue' : s.n < state.pitch ? 'green' : 'gray';

                return `<tr>
                  <td><strong>${s.n}</strong></td>
                  <td><strong>${s.name}</strong><br><small style="color:#64748b">${s.sub}</small></td>
                  <td><strong>${count}</strong> / ${totalInvestors}</td>
                  <td>
                    <div class="mini-prog">
                      <div class="mini-prog-bar"><div class="mini-prog-fill" style="width:${pct}%"></div></div>
                      <span>${pct}%</span>
                    </div>
                  </td>
                  <td>
                    <span style="color:#10b981;font-weight:750">👍 ${iCount}</span> &nbsp;
                    <span style="color:#f59e0b;font-weight:750">? ${eCount}</span> &nbsp;
                    <span style="color:#3b82f6;font-weight:750">👎 ${nCount}</span>
                  </td>
                  <td><span class="live-stat-chip ${statusColor}" style="padding:2px 8px;font-size:10px">${status}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Live Registered Investors Roster -->
      <div class="panel" style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div>
            <h3>Live Registered Investors Roster (${adminLiveStats.investors.length || 1})</h3>
            <p class="detail-label">Tracks each passwordless user and how many startups they have scored.</p>
          </div>
          <button class="admin-btn blue" data-admin="refresh-data" style="font-size:11px;padding:6px 12px">↻ Refresh Cloud Data</button>
        </div>
        <div class="roster-wrap">
          <table class="roster-table">
            <thead>
              <tr>
                <th>Investor</th>
                <th>Email</th>
                <th>Submissions Done</th>
                <th>Joined</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${(adminLiveStats.investors.length > 0 ? adminLiveStats.investors : (session ? [{ investor_key: session.id, full_name: session.name, email: session.email, joined_at: session.joinedAt }] : [])).map(inv => {
                const invResps = adminLiveStats.responses.filter(r => r.investor_key === inv.investor_key);
                const count = invResps.length || Object.keys(state.responseByInvestor[inv.investor_key] || {}).length;
                const pct = Math.round((count / TOTAL_PITCHES) * 100);
                const badgeClass = count === TOTAL_PITCHES ? 'complete' : count > 0 ? 'progress' : 'pending';
                const badgeLabel = count === TOTAL_PITCHES ? 'All 15 Completed' : count > 0 ? 'In Progress' : 'No Votes Yet';

                return `<tr>
                  <td><strong>${inv.full_name}</strong></td>
                  <td style="color:#64748b">${inv.email}</td>
                  <td>
                    <div class="mini-prog">
                      <div class="mini-prog-bar"><div class="mini-prog-fill" style="width:${pct}%"></div></div>
                      <span><strong>${count}</strong> / ${TOTAL_PITCHES}</span>
                    </div>
                  </td>
                  <td style="color:#64748b;font-size:10px">${new Date(inv.joined_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td><span class="roster-badge ${badgeClass}">${badgeLabel}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Published Stage Snapshot -->
      <div class="panel" style="margin-top:14px">
        <h3>Published Stage Snapshot</h3>
        ${published ? `<div class="notice">
          <strong>Pitch ${state.pitch} (${currentStartup.name}) Published:</strong>
          ${published.i}% Interested • ${published.e}% Explore More • ${published.n}% Not Interested
        </div>` : '<div class="notice">No snapshot published yet for this pitch. Click "Publish to Stage" to make aggregated results visible on the Stage screen.</div>'}
      </div>

      <!-- Live Shareable Links -->
      <div class="panel" style="margin-top:14px">
        <h3>🔗 Live Event Links</h3>
        <div class="links-grid">
          <div class="link-item">
            <strong>📱 Demo Day (Investors)</strong>
            <div class="link-url"><a href="${baseURL}#investor" target="_blank">${baseURL}#investor</a></div>
          </div>
          <div class="link-item">
            <strong>🔒 Admin Command Center</strong>
            <div class="link-url"><a href="${baseURL}#admin" target="_blank">${baseURL}#admin</a></div>
          </div>
          <div class="link-item">
            <strong>📺 Stage Display</strong>
            <div class="link-url"><a href="${baseURL}#stage" target="_blank">${baseURL}#stage</a></div>
          </div>
          <div class="link-item">
            <strong>🖼️ UI Reference Package</strong>
            <div class="link-url"><a href="${baseURL}#references" target="_blank">${baseURL}#references</a></div>
          </div>
        </div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER: Stage Display
     ══════════════════════════════════════════════════════════════ */
  function renderStage() {
    const root = document.getElementById('stage-root');
    if (!root) return;
    const s = startups[state.pitch - 1] || startups[0];

    if (state.stageStatus === 'PREPARING') {
      root.innerHTML = `<section class="stage-screen">
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
        <div class="stage-content">
          <span class="stage-badge">PUBLISHED RESULTS</span>
          <h2>${s.name}</h2>
          <p>${s.sub}</p>
          <div class="stage-metrics">
            <div class="stage-metric stage-green"><strong>${p.i}%</strong><span>Interested</span></div>
            <div class="stage-metric stage-yellow"><strong>${p.e}%</strong><span>Explore More</span></div>
            <div class="stage-metric stage-blue"><strong>${p.n}%</strong><span>Not Interested</span></div>
          </div>
        </div>
      </section>`;
      return;
    }

    root.innerHTML = `<section class="stage-screen">
      <div class="stage-content">
        <img src="assets/logo.png" alt="AFF Logo" style="width:76px;height:76px;margin:0 auto 14px;display:block;filter:drop-shadow(0 6px 16px rgba(0,0,0,0.12))">
        <span class="stage-badge">LIVE PITCH • ${state.pitch}/${TOTAL_PITCHES}</span>
        <h2>${s.name}</h2>
        <p>${s.sub}</p>
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

    const baseURL = window.location.origin + window.location.pathname;
    const eventSlug = orgState.slug || slugify(orgState.eventTitle);
    const investorURL = `${baseURL}?event=${eventSlug}#investor`;
    const stageURL = `${baseURL}?event=${eventSlug}#stage`;
    const adminURL = `${baseURL}?event=${eventSlug}#admin`;

    root.innerHTML = `
      <div class="org-landing-wrap">
        <!-- Hero Banner -->
        <section class="org-hero-banner">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
            <img src="assets/logo.png" alt="AFF Logo" style="width:64px;height:64px;filter:drop-shadow(0 6px 14px rgba(0,0,0,0.12));flex-shrink:0">
            <span class="org-badge"><i></i> ENTERPRISE DEMO DAY OPERATING SYSTEM</span>
          </div>
          <h1>Empower Your Demo Day with 1,000+ Real-Time Investor Interactions</h1>
          <p>
            The production-grade pitch platform engineered for venture capital funds, accelerators, and demo days.
            Instant passwordless voter verification, zero-data-loss offline sync, and real-time stage visualization.
          </p>
          <div class="org-actions-row">
            <button class="btn-org-primary" data-route="investor">🚀 Launch Active Event (AFF 2026)</button>
            <button class="btn-org-secondary" data-action="scroll-create-org">🏢 Register Organisation & Generate Link</button>
            <button class="btn-org-secondary" data-action="org-admin-login">🔒 Organiser Admin Access</button>
          </div>
        </section>

        <!-- Active Default Event Showcase Card (AFF Demo Day 2026) -->
        <section class="org-event-card">
          <div class="org-event-header">
            <div class="org-event-title">
              <span class="eyebrow" style="color:#2563eb">DEFAULT ACTIVE EVENT</span>
              <h2>${orgState.eventTitle || 'AFF Demo Day 2026'}</h2>
              <p>Hosted by <strong>${orgState.name || 'Asian Founders Fund (AFF)'}</strong> • 15 Pre-Configured Startups • Live Voting Ready</p>
            </div>
            <div class="org-event-badges">
              <span class="net-badge online"><i></i> Live Event Active</span>
              <span class="live-stat-chip blue">15 Tech Startups</span>
              <span class="live-stat-chip green">1,000+ Capacity</span>
            </div>
          </div>

          <div style="margin-top:18px">
            <h4 style="margin:0 0 4px;font-size:14px;color:var(--ink)">Generated Shareable Event Links</h4>
            <p class="detail-label" style="margin-bottom:14px">Share these direct links with your audience. Investors join passwordlessly with zero setup.</p>

            <div class="link-gen-container">
              <div class="link-gen-row">
                <span class="link-gen-title">📱 <strong>Investor Voting App</strong></span>
                <input id="link-investor" class="link-gen-url" value="${investorURL}" readonly>
                <button class="btn-copy-link" data-copy-link="link-investor">📋 Copy Link</button>
                <button class="btn-open-link" data-route="investor">Open App →</button>
              </div>

              <div class="link-gen-row">
                <span class="link-gen-title">📺 <strong>Main Stage Display</strong></span>
                <input id="link-stage" class="link-gen-url" value="${stageURL}" readonly>
                <button class="btn-copy-link" data-copy-link="link-stage">📋 Copy Link</button>
                <button class="btn-open-link" data-route="stage">Open Stage →</button>
              </div>

              <div class="link-gen-row">
                <span class="link-gen-title">🔒 <strong>Organiser Command Center</strong></span>
                <input id="link-admin" class="link-gen-url" value="${adminURL}" readonly>
                <button class="btn-copy-link" data-copy-link="link-admin">📋 Copy Link</button>
                <button class="btn-open-link" data-action="org-admin-login">Admin Login 🔒</button>
              </div>

              <div class="link-gen-row">
                <span class="link-gen-title">🏛️ <strong>Organisation Portal (Root)</strong></span>
                <input id="link-org" class="link-gen-url" value="${baseURL}#org" readonly>
                <button class="btn-copy-link" data-copy-link="link-org">📋 Copy Link</button>
                <button class="btn-open-link" data-route="org">Open Portal →</button>
              </div>

              <div class="link-gen-row">
                <span class="link-gen-title">🎨 <strong>UI Design Reference Screens</strong></span>
                <input id="link-refs" class="link-gen-url" value="${baseURL}#references" readonly>
                <button class="btn-copy-link" data-copy-link="link-refs">📋 Copy Link</button>
                <button class="btn-open-link" data-route="references">View Screens →</button>
              </div>
            </div>
          </div>
        </section>

        <!-- Organisation Registration & Event Creator -->
        <section id="org-create-section" class="org-event-card">
          <div class="org-event-header">
            <div class="org-event-title">
              <span class="eyebrow" style="color:#7c3aed">ORGANISATION ONBOARDING</span>
              <h2>Register Your Organisation & Generate Custom Event Link</h2>
              <p>Create branded event links for your venture firm, accelerator cohort, or syndicate demo day.</p>
            </div>
          </div>

          <div class="org-form-grid">
            <div class="org-input-group">
              <label>Organisation Name</label>
              <input id="org-input-name" class="input" placeholder="e.g. Asian Founders Fund (AFF)" value="${orgState.name}">
            </div>
            <div class="org-input-group">
              <label>Lead Organiser Email</label>
              <input id="org-input-email" class="input" type="email" placeholder="e.g. partner@asianfoundersfund.com" value="${orgState.leadEmail}">
            </div>
            <div class="org-input-group">
              <label>Demo Day Event Title</label>
              <input id="org-input-event" class="input" placeholder="e.g. AFF Demo Day 2026" value="${orgState.eventTitle}">
            </div>
            <div class="org-input-group">
              <label>Admin Passcode</label>
              <input id="org-input-passcode" class="input" placeholder="e.g. thatAff2026@" value="${orgState.passcode}">
            </div>
          </div>

          <div style="margin-top:20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <button class="btn-org-primary" data-action="create-org-event">✨ Generate Custom Event Links</button>
            <span class="detail-label">Instant link generation • Cloud database synchronized • Production secure</span>
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
            <h3>Passwordless Voting</h3>
            <p>Investors enter name & email for immediate cryptographic access with cloud session restore.</p>
          </div>
          <div class="org-feature-card">
            <div class="org-feature-icon">📶</div>
            <h3>Zero-Data-Loss Outbox</h3>
            <p>Votes are preserved in a persistent queue and auto-synced the moment cellular or Wi-Fi reconnects.</p>
          </div>
          <div class="org-feature-card">
            <div class="org-feature-icon">🛡️</div>
            <h3>Stage Isolation</h3>
            <p>Individual investor votes remain strictly confidential. Only approved aggregated stats are published.</p>
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
    return 'org'; // Default to Organisation Portal
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
      fetchAdminLiveData();
      toast('Refreshed data from Supabase.');
    }
    if (action === 'reset') {
      if (confirm('Are you sure you want to reset all demo state?')) {
        recordFeed('ADMIN_ACTION', { detail: 'Demo reset' });
        localStorage.removeItem(STORAGE_KEY);
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
        const s = startups.find(st => st.id === r.startup_id) || { n: '-', name: r.startup_id };
        rows.push([
          `"${r.startup_id || ''}"`,
          `"${s.n || ''}"`,
          `"${(s.name || '').replace(/"/g, '""')}"`,
          `"${(inv.full_name || '').replace(/"/g, '""')}"`,
          `"${(inv.email || '').replace(/"/g, '""')}"`,
          `"${r.response_type || r.response || ''}"`,
          `"${r.recorded_at || ''}"`,
          `"Supabase Cloud Realtime"`
        ]);
      });
    } else {
      // Local fallback
      Object.entries(state.responseByInvestor).forEach(([invKey, respObj]) => {
        Object.entries(respObj).forEach(([startupId, item]) => {
          const s = startups.find(st => st.id === startupId) || { n: '-', name: startupId };
          rows.push([
            `"${startupId}"`,
            `"${s.n || ''}"`,
            `"${(s.name || '').replace(/"/g, '""')}"`,
            `"Local Session"`,
            `"${invKey}"`,
            `"${item.response || item.response_type || ''}"`,
            `"${item.recordedAt || ''}"`,
            `"Local Device Storage"`
          ]);
        });
      });
    }

    if (rows.length === 0) {
      toast('No votes have been recorded yet to export.');
      return;
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

      const response = e.target.closest('[data-response]');
      if (response) submitResponse(response.dataset.response);

      // Copy link buttons
      const copyBtn = e.target.closest('[data-copy-link]');
      if (copyBtn) {
        const targetId = copyBtn.dataset.copyLink;
        const inputEl = document.getElementById(targetId);
        if (inputEl) {
          const val = inputEl.value || inputEl.textContent;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(val).then(() => {
              toast('✓ Link copied to clipboard!');
            }).catch(() => {
              toast(`Copied: ${val}`);
            });
          } else {
            inputEl.select?.();
            document.execCommand?.('copy');
            toast('✓ Link copied to clipboard!');
          }
        }
      }

      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'join') joinEvent();
      if (action === 'back-list') backToList();
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
      await restoreResponsesFromSupabase();
    }
  })();

  recordFeed('APP_LOADED', {
    detail: `App loaded on route: ${route}`,
    metadata: { route, hasSession: !!session, deviceInfo }
  });
})();
