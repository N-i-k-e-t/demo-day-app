(() => {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     SUPABASE CONNECTION
     ══════════════════════════════════════════════════════════════ */
  const SUPABASE_URL = 'https://toucgwdalgtkcfhebvgo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvdWNnd2RhbGd0a2NmaGVidmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzIzNzQsImV4cCI6MjEwNTg0ODM3NH0.YOpoQ6lzRgeicJvsiC4Zun78jvYtW7_TzCFosaG0HZQ';

  let supabase = null;
  try {
    if (window.supabase && window.supabase.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('[Supabase] ✅ Connected to:', SUPABASE_URL);
    }
  } catch (err) {
    console.warn('[Supabase] Init failed, running in local-only mode:', err);
  }

  /* ══════════════════════════════════════════════════════════════
     INTERACTION FEED — Records EVERYTHING to Supabase
     ══════════════════════════════════════════════════════════════ */
  const deviceInfo = (() => {
    const ua = navigator.userAgent;
    const w = screen.width;
    const h = screen.height;
    const mobile = /Mobi|Android|iPhone|iPad/i.test(ua);
    return `${mobile ? 'Mobile' : 'Desktop'} ${w}x${h} | ${ua.slice(0, 80)}`;
  })();

  async function recordFeed(eventType, data = {}) {
    if (!supabase) return;
    try {
      await supabase.from('interaction_feed').insert({
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
      });
    } catch (err) {
      console.warn('[Feed]', err.message);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     SUPABASE DATA PERSISTENCE
     ══════════════════════════════════════════════════════════════ */
  async function saveInvestorToSupabase(investorKey, name, email) {
    if (!supabase) return;
    try {
      await supabase.from('demo_investors').upsert({
        investor_key: investorKey,
        full_name: name,
        email: email,
        joined_at: new Date().toISOString()
      }, { onConflict: 'investor_key' });
    } catch (err) { console.warn('[Supabase] Investor save:', err.message); }
  }

  async function saveResponseToSupabase(investorKey, startupId, startupName, responseType) {
    if (!supabase) return;
    try {
      await supabase.from('demo_responses').insert({
        investor_key: investorKey,
        startup_id: startupId,
        startup_name: startupName,
        response_type: responseType,
        idempotency_key: `${investorKey}:${startupId}`,
        recorded_at: new Date().toISOString()
      });
    } catch (err) { console.warn('[Supabase] Response save:', err.message); }
  }

  async function saveAdminActionToSupabase(actionType, detail, stateSnapshot = {}) {
    if (!supabase) return;
    try {
      await supabase.from('demo_admin_actions').insert({
        action_type: actionType,
        detail: detail,
        state_snapshot: stateSnapshot,
        created_at: new Date().toISOString()
      });
    } catch (err) { console.warn('[Supabase] Admin action save:', err.message); }
  }

  async function syncEventStateToSupabase() {
    if (!supabase) return;
    try {
      await supabase.from('demo_event_state').upsert({
        id: 1,
        event_status: state.eventStatus,
        current_pitch: state.pitch,
        state_version: state.stateVersion,
        total_responses: state.investorResponses,
        stage_status: state.stageStatus,
        published_data: state.published,
        updated_at: new Date().toISOString()
      });
    } catch (err) { console.warn('[Supabase] Event state sync:', err.message); }
  }

  /* ══════════════════════════════════════════════════════════════
     SUPABASE REALTIME
     ══════════════════════════════════════════════════════════════ */
  function initSupabaseRealtime() {
    if (!supabase) return;
    try {
      const channel = supabase.channel('demo-realtime');
      channel.on('broadcast', { event: 'state_sync' }, (payload) => {
        if (payload?.payload?.state) {
          state = { ...defaultState, ...payload.payload.state };
          saveState();
          renderAll();
        }
      });
      channel.subscribe((status) => {
        console.log('[Supabase Realtime]', status);
      });
    } catch (err) {
      console.warn('[Supabase Realtime] Setup failed:', err);
    }
  }

  async function broadcastStateRealtime() {
    if (!supabase) return;
    try {
      const channel = supabase.channel('demo-realtime');
      await channel.send({
        type: 'broadcast',
        event: 'state_sync',
        payload: { state }
      });
    } catch (_) {}
  }

  /* ══════════════════════════════════════════════════════════════
     ADMIN PASSCODE
     ══════════════════════════════════════════════════════════════ */
  const ADMIN_PASSCODE = 'thatAff2026@';
  let adminUnlocked = false;
  const ADMIN_SESSION_KEY = 'startup-demo-admin-unlocked';
  try {
    adminUnlocked = sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  } catch (_) {}

  /* ══════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════ */
  const TOTAL_PITCHES = 15;
  const STORAGE_KEY = 'startup-demo-live-v2';
  const SESSION_KEY = 'startup-demo-session-v2';
  const CHANNEL_NAME = 'startup-demo-live-v2';
  const RESPONSE = { INTERESTED:'INTERESTED', EXPLORE:'EXPLORE', NOT_INTERESTED:'NOT_INTERESTED' };
  const COLORS = { INTERESTED:'green', EXPLORE:'yellow', NOT_INTERESTED:'blue' };

  const startups = [
    {id:'s01',n:1,name:'AquaSense',sub:'Smart water management for sustainable cities',tags:['Climate Tech','IoT','Sustainability'],initial:'A',accent:'blue'},
    {id:'s02',n:2,name:'VoltDrive',sub:'EV charging infrastructure for a greener future',tags:['Clean Energy','Mobility','Hardware'],initial:'V',accent:'yellow'},
    {id:'s03',n:3,name:'Mark Startup',sub:'Building the next generation AI workspace',tags:['AI','Productivity','SaaS'],initial:'M',accent:'blue'},
    {id:'s04',n:4,name:'HealthMate',sub:'AI-powered personal health companion',tags:['Health Tech','AI','Consumer App'],initial:'H',accent:'purple'},
    {id:'s05',n:5,name:'AgriNext',sub:'Data-driven farming for higher yields',tags:['Agriculture','AI','Sustainability'],initial:'A',accent:'green'},
    {id:'s06',n:6,name:'EduVerse',sub:'Immersive learning for every student',tags:['EdTech','VR/AR','Education'],initial:'E',accent:'red'},
    {id:'s07',n:7,name:'LogiSmart',sub:'Supply chain intelligence for modern businesses',tags:['Logistics','AI','Enterprise'],initial:'L',accent:'blue'},
    {id:'s08',n:8,name:'SafeCity',sub:'AI-driven public safety solutions',tags:['GovTech','AI','Smart Cities'],initial:'S',accent:'purple'},
    {id:'s09',n:9,name:'FinMate',sub:'Smarter financial wellness for working teams',tags:['FinTech','AI','B2B'],initial:'F',accent:'green'},
    {id:'s10',n:10,name:'CarbonLoop',sub:'Practical carbon intelligence for SMEs',tags:['Climate','Analytics','B2B'],initial:'C',accent:'green'},
    {id:'s11',n:11,name:'FoodGrid',sub:'Predictive food supply planning',tags:['AgriTech','AI','Food'],initial:'F',accent:'yellow'},
    {id:'s12',n:12,name:'CarePath',sub:'Digital coordination for community care',tags:['HealthTech','Platform','Care'],initial:'C',accent:'purple'},
    {id:'s13',n:13,name:'BuildAI',sub:'Automating early-stage construction planning',tags:['ConTech','AI','Enterprise'],initial:'B',accent:'blue'},
    {id:'s14',n:14,name:'FleetOS',sub:'Operations intelligence for logistics fleets',tags:['Mobility','IoT','SaaS'],initial:'F',accent:'blue'},
    {id:'s15',n:15,name:'LearnLoop',sub:'Personalized practice for lifelong learners',tags:['EdTech','AI','Consumer'],initial:'L',accent:'yellow'}
  ];

  const refImages = [
    ['01-investor-flow-overview.png','Investor flow overview'],
    ['02-investor-live-pitch.png','Original pitch screen reference'],
    ['03-response-recorded.png','Response recorded confirmation'],
    ['04-startup-list.png','Startup list reference'],
    ['05-startup-list-color-coded.png','Color-coded startup list'],
    ['06-startup-list-final.png','Final startup list reference'],
    ['07-not-interested-blue.png','Not Interested in blue'],
    ['08-startup-demo.png','Startup demo detail screen']
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

  let state = loadState();
  let session = loadSession();
  let investorScreen = session ? 'list' : 'join';
  let selectedStartup = null;
  let lastSubmitted = null;
  let route = 'investor';
  let toastTimer = null;

  /* ── URL-based routing ──────────────────────────────────────── */
  function getRouteFromURL() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (['investor', 'admin', 'stage', 'references'].includes(hash)) return hash;
    return 'investor';
  }

  /* ── BroadcastChannel for cross-tab sync ─────────────────────── */
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

  /* ── State Helpers ──────────────────────────────────────────── */
  function loadState() {
    try { return { ...defaultState, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }; } catch (_) { return { ...defaultState }; }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; } }
  function saveSession() { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  function toast(msg) {
    const el = document.getElementById('toast'); if (!el) return;
    clearTimeout(toastTimer); el.textContent = msg; el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function broadcast(type='STATE_SYNC') {
    saveState();
    if (bc) bc.postMessage({ type, state });
    broadcastStateRealtime();
    syncEventStateToSupabase();
  }
  function audit(action, detail, actor='ADMIN') {
    state.adminAudit.unshift({ ts:new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), action, detail, actor });
    state.adminAudit = state.adminAudit.slice(0, 60);
  }
  function getInvestorKey() { return session?.id || 'demo-investor'; }
  function responseFor(startupId) { return state.responseByInvestor[getInvestorKey()]?.[startupId] || null; }
  function responseLabel(value) { return value === RESPONSE.INTERESTED ? 'Interested' : value === RESPONSE.EXPLORE ? 'Explore more' : value === RESPONSE.NOT_INTERESTED ? 'Not interested' : 'Not responded'; }
  function responseColor(value) { return value ? COLORS[value] : 'none'; }
  function responseIcon(value) { return value === RESPONSE.INTERESTED ? '👍' : value === RESPONSE.EXPLORE ? '?' : value === RESPONSE.NOT_INTERESTED ? '👎' : '○'; }

  function ensureInvestor() {
    if (!session) { investorScreen = 'join'; renderInvestor(); return false; }
    return true;
  }

  /* ══════════════════════════════════════════════════════════════
     ADMIN PASSCODE MODAL
     ══════════════════════════════════════════════════════════════ */
  function showAdminLock() {
    const overlay = document.getElementById('admin-lock-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    const input = document.getElementById('admin-passcode');
    if (input) { input.value = ''; input.focus(); }
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
      try { sessionStorage.setItem(ADMIN_SESSION_KEY, 'true'); } catch(_){}
      hideAdminLock();
      setRoute('admin');
      toast('Admin access granted.');
      recordFeed('ADMIN_UNLOCKED', { detail: 'Admin panel unlocked' });
    } else {
      if (errEl) errEl.style.display = 'block';
      input.value = '';
      input.focus();
      recordFeed('ADMIN_UNLOCK_FAILED', { detail: 'Wrong passcode entered' });
    }
  }

  /* ══════════════════════════════════════════════════════════════
     INVESTOR ACTIONS
     ══════════════════════════════════════════════════════════════ */
  function joinEvent() {
    const name = document.getElementById('join-name')?.value.trim();
    const email = document.getElementById('join-email')?.value.trim();
    if (!name || name.length < 2 || !email.includes('@')) { toast('Enter your name and a valid email.'); return; }
    session = { id:'inv-' + btoa(unescape(encodeURIComponent(email))).replace(/[^a-zA-Z0-9]/g,'').slice(0,24), name, email, joinedAt:new Date().toISOString() };
    saveSession();
    if (!state.responseByInvestor[session.id]) state.responseByInvestor[session.id] = {};
    audit('INVESTOR_JOINED', `${name} joined the demo`, 'SYSTEM');
    broadcast();
    investorScreen = 'list';
    renderAll();
    toast('Welcome — startup list is ready.');

    // Record to Supabase
    saveInvestorToSupabase(session.id, name, email);
    recordFeed('INVESTOR_JOINED', {
      actorId: session.id,
      actorName: name,
      actorEmail: email,
      detail: `${name} (${email}) joined the demo`
    });
  }

  function openStartup(id) {
    if (!ensureInvestor()) return;
    selectedStartup = startups.find(s => s.id === id) || null;
    if (!selectedStartup) return;
    investorScreen = 'detail';
    renderInvestor();

    // Record startup view
    recordFeed('STARTUP_VIEWED', {
      startupId: selectedStartup.id,
      startupName: selectedStartup.name,
      detail: `Viewed ${selectedStartup.name}`
    });
  }

  function submitResponse(choice) {
    if (!session || !selectedStartup) return;
    const current = responseFor(selectedStartup.id);
    if (current) {
      toast('Response already recorded.');
      investorScreen = 'list';
      renderInvestor();
      recordFeed('DUPLICATE_RESPONSE_ATTEMPT', {
        startupId: selectedStartup.id,
        startupName: selectedStartup.name,
        responseType: choice,
        detail: `Tried to respond again to ${selectedStartup.name}`
      });
      return;
    }

    const investorBucket = state.responseByInvestor[getInvestorKey()] || (state.responseByInvestor[getInvestorKey()] = {});
    investorBucket[selectedStartup.id] = {
      response: choice,
      startupId: selectedStartup.id,
      startupNumber: selectedStartup.n,
      recordedAt: new Date().toISOString(),
      idempotencyKey: `${getInvestorKey()}:${selectedStartup.id}`
    };
    state.investorResponses += 1;
    state.stateVersion += 1;
    lastSubmitted = selectedStartup;
    investorScreen = 'confirmation';
    audit('RESPONSE_RECORDED', `${session.name} → ${selectedStartup.name}: ${choice}`, 'INVESTOR');
    broadcast();
    renderAll();
    toast('Response recorded.');

    // Record to Supabase
    saveResponseToSupabase(getInvestorKey(), selectedStartup.id, selectedStartup.name, choice);
    recordFeed('RESPONSE_SUBMITTED', {
      startupId: selectedStartup.id,
      startupName: selectedStartup.name,
      responseType: choice,
      detail: `${session.name} → ${selectedStartup.name}: ${responseLabel(choice)}`
    });
  }

  function backToList() {
    selectedStartup = null;
    investorScreen = 'list';
    renderInvestor();
    recordFeed('BACK_TO_LIST', { detail: 'Returned to startup list' });
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER: Investor Screens (Mobile-first)
     ══════════════════════════════════════════════════════════════ */
  function renderHeader() {
    return `<header class="phone-header">
      <div class="brand-mini"><div class="brand-mini-mark">✦</div><div><strong>Startup Demo <span style="color:#5c55ef;font-weight:850">Demo</span></strong><small>Innovation for a Better Tomorrow</small></div></div>
      <div style="display:flex;align-items:center;gap:8px"><span class="live-pill">● Live</span></div>
    </header>`;
  }

  function renderProgress() {
    return `<div class="progress-row"><div><div class="progress-label">${TOTAL_PITCHES} startups available</div><div class="dots">${startups.map(() => `<i class="dot"></i>`).join('')}</div></div><span class="live-pill">${state.eventStatus}</span></div>`;
  }

  function renderStartupCard(s) {
    const r = responseFor(s.id);
    const color = responseColor(r?.response);
    return `<button class="startup-card choice-${color}" data-startup="${s.id}">
      <span class="rank">${s.n}</span>
      <span class="logo">${s.initial}</span>
      <span class="startup-main"><strong>${s.name}</strong><span>${s.sub}</span><span class="tags">${s.tags.map(t=>`<small class="tag">${t}</small>`).join('')}</span></span>
      <span class="choice-pill ${color}"><span class="choice-icon">${responseIcon(r?.response)}</span>${responseLabel(r?.response)}</span>
      <span class="chevron">›</span>
    </button>`;
  }

  function renderListScreen() {
    return `${renderHeader()}<main class="phone-content">
      <div style="margin-top:4px"><h1 style="font-size:27px;margin:0 0 4px">All Startups</h1><div class="detail-label">Browse all startups and choose any startup to record one response.</div></div>
      ${renderProgress()}
      <div class="filters"><button class="chip active">All Startups (${TOTAL_PITCHES})</button><button class="chip">Not Responded (${startups.filter(s=>!responseFor(s.id)).length})</button><button class="chip">My Responses (${startups.filter(s=>responseFor(s.id)).length})</button></div>
      <section class="startup-list">${startups.map(renderStartupCard).join('')}</section>
    </main>${renderBottomNav('startups')}`;
  }

  function renderDetailScreen() {
    const s = selectedStartup; const r = responseFor(s.id);
    if (r) {
      investorScreen = 'confirmation'; lastSubmitted = s; return renderConfirmationScreen();
    }
    return `${renderHeader()}<main class="phone-content">
      <div class="detail-header"><button class="back-btn" data-action="back-list">‹</button><div class="detail-label">Startup ${s.n} of ${TOTAL_PITCHES}</div><span class="live-pill">Live</span></div>
      ${renderProgress()}
      <section class="hero-card">
        <div class="hero-logo">${s.name}</div>
        <h2>${s.sub}</h2>
        <p>A focused startup profile for the live event. Review the submitted startup information, then make one response.</p>
        <div class="hero-visual"><div style="position:absolute;left:16px;top:15px;font-size:10px;font-weight:850;color:#3656a5">STARTUP DEMO</div><div style="position:absolute;left:16px;bottom:15px;right:16px" class="feature-row"><div class="feature">AI Automation</div><div class="feature">Team Collaboration</div><div class="feature">Faster Productivity</div></div></div>
      </section>
      <div class="response-stack">
        <button class="response-btn green" data-response="INTERESTED"><span class="response-icon">👍</span><span><strong>I am interested</strong><span>I would like the team to reach out.</span></span><span style="margin-left:auto">›</span></button>
        <button class="response-btn yellow" data-response="EXPLORE"><span class="response-icon">?</span><span><strong>Would like to explore more</strong><span>I have some questions or would like to know more.</span></span><span style="margin-left:auto">›</span></button>
        <button class="response-btn blue" data-response="NOT_INTERESTED"><span class="response-icon">👎</span><span><strong>Not interested</strong><span>I am not interested at this time.</span></span><span style="margin-left:auto">›</span></button>
      </div>
      <div class="notice"><strong>Your response is recorded once submitted</strong>You can select only one option per startup. It cannot be changed after it is saved.</div>
    </main>`;
  }

  function renderConfirmationScreen() {
    const s = lastSubmitted || selectedStartup; const r = responseFor(s.id);
    return `${renderHeader()}<main class="phone-content success-screen">
      <div class="check"></div>
      <h2>Response recorded!</h2>
      <p>Your response for <strong>${s.name}</strong> has been saved successfully.</p>
      <div class="summary"><strong>${s.name}</strong><span>${responseLabel(r?.response)}</span></div>
      <button class="primary-cta" data-action="back-list">Back to Startup List →</button>
    </main>`;
  }

  function renderMyResponses() {
    const rows = startups.filter(s => responseFor(s.id)).map(s => {
      const r = responseFor(s.id);
      return `<div class="my-response-row"><div><strong>${s.n}. ${s.name}</strong><div class="detail-label">${new Date(r.recordedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div></div><span class="choice-pill ${COLORS[r.response]}">${responseLabel(r.response)}</span></div>`;
    }).join('');
    return `${renderHeader()}<main class="phone-content"><div style="margin:4px 0 14px"><h1 style="font-size:27px;margin:0 0 4px">My Responses</h1><div class="detail-label">Responses already recorded for this event.</div></div><div class="my-responses">${rows || '<div class="notice">No responses recorded yet. Choose a startup from the list to begin.</div>'}</div></main>${renderBottomNav('responses')}`;
  }

  function renderBottomNav(active) {
    return `<nav class="bottom-nav"><button data-nav="list" class="${active==='startups'?'active':''}">⌂<br>Home</button><button data-nav="list" class="${active==='startups'?'active':''}">▦<br>Startups</button><button data-nav="responses" class="${active==='responses'?'active':''}">◍<br>My Responses</button></nav>`;
  }

  function renderJoin() {
    return `${renderHeader()}<main class="phone-content" style="display:flex;flex-direction:column;justify-content:center"><section class="hero-card"><div class="hero-logo">Join Startup Demo</div><h2>Explore startups and record your response.</h2><p>Use one response per startup. Once submitted, it is stored and cannot be changed.</p></section><label class="detail-label">Full Name</label><input id="join-name" class="input" placeholder="Your full name" style="margin:7px 0 12px"><label class="detail-label">Email</label><input id="join-email" class="input" placeholder="you@example.com" type="email" style="margin:7px 0 12px"><button class="primary-cta" data-action="join">Enter Event</button><div class="notice"><strong>Live Event</strong>Your response will be recorded and saved.</div></main>`;
  }

  function renderInvestor() {
    const root = document.getElementById('phone-root'); if (!root) return;
    let html = investorScreen === 'join' ? renderJoin() : investorScreen === 'detail' ? renderDetailScreen() : investorScreen === 'confirmation' ? renderConfirmationScreen() : investorScreen === 'responses' ? renderMyResponses() : renderListScreen();
    root.innerHTML = `<div class="phone">${html}</div>`;
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER: Admin (Passcode Protected)
     ══════════════════════════════════════════════════════════════ */
  function renderAdmin() {
    const root = document.getElementById('admin-root'); if (!root) return;

    if (!adminUnlocked) {
      root.innerHTML = `<div class="admin-locked-notice"><div class="admin-lock-icon-large">🔒</div><h2>Admin Panel Locked</h2><p>This panel requires admin passcode access.</p></div>`;
      return;
    }

    const currentCounts = aggregateAllResponses();
    const total = currentCounts.total || 0;
    const published = state.published[state.pitch] || null;
    const baseURL = window.location.origin + window.location.pathname;

    root.innerHTML = `
      <div class="dashboard">
        <div class="kpi"><small>Event</small><strong>${state.eventStatus}</strong><span class="detail-label">15 startups</span></div>
        <div class="kpi"><small>Current pitch</small><strong>${state.pitch}/${TOTAL_PITCHES}</strong><span class="detail-label">startup list flow</span></div>
        <div class="kpi"><small>Responses recorded</small><strong>${state.investorResponses}</strong><span class="detail-label">immutable</span></div>
        <div class="kpi"><small>State version</small><strong>${state.stateVersion}</strong><span class="detail-label">authoritative</span></div>
      </div>
      <div class="admin-grid">
        <section class="panel">
          <h3>Event Control</h3>
          <div class="admin-btns">
            <button class="admin-btn blue" data-admin="start">Start Event</button>
            <button class="admin-btn yellow" data-admin="next">Next Startup</button>
            <button class="admin-btn green" data-admin="prepare">Prepare Stage</button>
            <button class="admin-btn dark" data-admin="publish">Publish to Stage</button>
            <button class="admin-btn red" data-admin="complete">Complete Event</button>
            <button class="admin-btn" style="background:#eef1f6" data-admin="reset">Reset Demo</button>
          </div>
          <div class="notice" style="margin-top:14px"><strong>Stage rule</strong>Individual investor responses are stored in the database and never streamed directly to the public stage.</div>
        </section>
        <section class="panel">
          <h3>Response Overview</h3>
          ${metric('Interested', currentCounts.interested, total, 'fill-green')}
          ${metric('Explore more', currentCounts.explore, total, 'fill-yellow')}
          ${metric('Not interested', currentCounts.notInterested, total, 'fill-blue')}
          <div class="detail-label" style="margin-top:10px">Raw response data is separate from stage publication.</div>
        </section>
      </div>
      <div class="admin-grid">
        <section class="panel"><h3>Pitch Queue</h3><table class="admin-table"><thead><tr><th>#</th><th>Startup</th><th>Status</th><th>Recorded</th></tr></thead><tbody>${startups.map(s=>{const r=session ? responseFor(s.id) : null; const status=s.n===state.pitch?'CURRENT':s.n<state.pitch?'COMPLETED':'UPCOMING'; return `<tr><td>${s.n}</td><td>${s.name}</td><td>${status}</td><td>${r?responseLabel(r.response):'—'}</td></tr>`;}).join('')}</tbody></table></section>
        <section class="panel"><h3>Admin Audit</h3><div class="audit-list">${state.adminAudit.length?state.adminAudit.slice(0,14).map(a=>`<div class="audit-row"><span>${a.ts}</span><span>${a.action}<br><small style="color:#8b95aa">${a.detail}</small></span><span>${a.actor}</span></div>`).join(''):'<div class="notice">No actions yet.</div>'}</div></section>
      </div>
      <div class="panel" style="margin-top:14px"><h3>Published Stage Snapshot</h3>${published?`<div class="notice"><strong>Pitch ${state.pitch} published</strong>${published.i}% interested • ${published.e}% explore more • ${published.n}% not interested</div>`:'<div class="notice">No stage snapshot published for the current startup.</div>'}</div>
      <div class="panel" style="margin-top:14px"><h3>🔗 Live Links</h3>
        <div class="links-grid">
          <div class="link-item"><strong>📱 Demo Day (Investors)</strong><div class="link-url"><a href="${baseURL}#investor" target="_blank">${baseURL}#investor</a></div></div>
          <div class="link-item"><strong>🔒 Admin Panel</strong><div class="link-url"><a href="${baseURL}#admin" target="_blank">${baseURL}#admin</a></div></div>
          <div class="link-item"><strong>📺 Stage Display</strong><div class="link-url"><a href="${baseURL}#stage" target="_blank">${baseURL}#stage</a></div></div>
          <div class="link-item"><strong>🖼️ UI References</strong><div class="link-url"><a href="${baseURL}#references" target="_blank">${baseURL}#references</a></div></div>
        </div>
      </div>
      <div class="panel" style="margin-top:14px"><h3>☁️ Supabase Connection</h3><div class="notice"><strong>Status: ${supabase ? '✅ Connected — All interactions are being recorded' : '⚠️ Local-only mode — Run schema.sql in Supabase SQL Editor'}</strong><br>URL: ${SUPABASE_URL}<br>Recording: interaction_feed, demo_investors, demo_responses, demo_admin_actions</div></div>
    `;
  }

  function metric(label, count, total, fillClass) { const pct = total ? Math.round(count / total * 100) : 0; return `<div class="metric-row"><div>${label}</div><div class="metric-bar"><div class="metric-fill ${fillClass}" style="width:${pct}%"></div></div><div>${count}</div></div>`; }

  function aggregateAllResponses() {
    let interested=0,explore=0,notInterested=0;
    Object.values(state.responseByInvestor).forEach(bucket=>Object.values(bucket).forEach(v=>{ if(v.response===RESPONSE.INTERESTED) interested++; else if(v.response===RESPONSE.EXPLORE) explore++; else if(v.response===RESPONSE.NOT_INTERESTED) notInterested++; }));
    return { interested, explore, notInterested, total:interested+explore+notInterested };
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER: Stage
     ══════════════════════════════════════════════════════════════ */
  function renderStage() {
    const root = document.getElementById('stage-root'); if (!root) return;
    const s = startups[state.pitch-1] || startups[0];
    if (state.stageStatus === 'PREPARING') {
      root.innerHTML = `<section class="stage-screen"><div class="stage-content"><div class="stage-loading"><div class="spinner"></div>Results are being prepared.<br><small>No individual investor responses are displayed.</small></div></div></section>`; return;
    }
    if (state.stageStatus === 'PUBLISHED' && state.published[state.pitch]) {
      const p = state.published[state.pitch];
      root.innerHTML = `<section class="stage-screen"><div class="stage-content"><span class="stage-badge">PUBLISHED RESULTS</span><h2>${s.name}</h2><p>${s.sub}</p><div class="stage-metrics"><div class="stage-metric stage-green"><strong>${p.i}%</strong><span>Interested</span></div><div class="stage-metric stage-yellow"><strong>${p.e}%</strong><span>Explore More</span></div><div class="stage-metric stage-blue"><strong>${p.n}%</strong><span>Not Interested</span></div></div></div></section>`; return;
    }
    root.innerHTML = `<section class="stage-screen"><div class="stage-content"><span class="stage-badge">LIVE PITCH • ${state.pitch}/${TOTAL_PITCHES}</span><h2>${s.name}</h2><p>${s.sub}</p><div class="notice" style="max-width:650px;margin:24px auto 0;background:#101b31;color:#8fa0bb;border:1px solid #24334f">The public stage is independent. Investor responses are recorded privately and appear only when an authorized admin publishes a result snapshot.</div></div></section>`;
  }

  /* ── Render: References ──────────────────────────────────────── */
  function renderReferences() {
    const root = document.getElementById('reference-root'); if (!root) return;
    root.innerHTML = refImages.map(([file,label])=>`<article class="reference-card"><img src="assets/ui-reference/${file}" alt="${label}" loading="lazy"><div class="ref-caption"><strong>${label}</strong><span>Generated UI reference included in this package.</span></div></article>`).join('');
  }

  /* ══════════════════════════════════════════════════════════════
     ROUTING
     ══════════════════════════════════════════════════════════════ */
  function setRoute(next) {
    if (next === 'admin' && !adminUnlocked) {
      showAdminLock();
      return;
    }
    route = next;
    window.location.hash = next;
    document.querySelectorAll('.route-view').forEach(v=>v.classList.remove('active'));
    document.getElementById(`view-${next}`)?.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.route===next));
    if (next==='investor') renderInvestor();
    if (next==='admin') renderAdmin();
    if (next==='stage') renderStage();
    if (next==='references') renderReferences();

    recordFeed('PAGE_VIEW', { detail: `Navigated to: ${next}` });
  }

  /* ══════════════════════════════════════════════════════════════
     ADMIN ACTIONS
     ══════════════════════════════════════════════════════════════ */
  function doAdmin(action) {
    if (!adminUnlocked) { showAdminLock(); return; }
    if (action==='start') {
      state.eventStatus='LIVE';
      audit('EVENT_STARTED','Live investor experience started');
      broadcast();
      toast('Event live. Investors can choose startups.');
      saveAdminActionToSupabase('EVENT_STARTED', 'Live investor experience started', { eventStatus: 'LIVE' });
      recordFeed('ADMIN_ACTION', { detail: 'Event started — LIVE' });
    }
    if (action==='next') {
      state.pitch = Math.min(TOTAL_PITCHES, state.pitch + 1);
      state.eventStatus='LIVE';
      state.stageStatus='STANDBY';
      audit('NEXT_PITCH',`Moved to Startup ${state.pitch}`);
      broadcast();
      toast(`Moved to Startup ${state.pitch}`);
      saveAdminActionToSupabase('NEXT_PITCH', `Moved to Startup ${state.pitch}`, { pitch: state.pitch });
      recordFeed('ADMIN_ACTION', { detail: `Next pitch → Startup ${state.pitch}` });
    }
    if (action==='prepare') {
      state.stageStatus='PREPARING';
      audit('STAGE_LOADING',`Preparing results for ${state.pitch}`);
      broadcast();
      toast('Stage moved to results preparing.');
      saveAdminActionToSupabase('STAGE_LOADING', `Preparing results for ${state.pitch}`);
      recordFeed('ADMIN_ACTION', { detail: `Stage preparing for pitch ${state.pitch}` });
    }
    if (action==='publish') { publishCurrent(); }
    if (action==='complete') {
      state.eventStatus='COMPLETED';
      audit('EVENT_COMPLETED','Event completed');
      broadcast();
      toast('Event completed.');
      saveAdminActionToSupabase('EVENT_COMPLETED', 'Event completed', { eventStatus: 'COMPLETED' });
      recordFeed('ADMIN_ACTION', { detail: 'Event completed' });
    }
    if (action==='reset') {
      recordFeed('ADMIN_ACTION', { detail: 'Demo reset' });
      saveAdminActionToSupabase('DEMO_RESET', 'Full demo state reset');
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  }

  function publishCurrent() {
    if (!adminUnlocked) return;
    const current = aggregateAllResponses();
    const base = current.total || 1;
    const i = Math.round(current.interested / base * 100);
    const e = Math.round(current.explore / base * 100);
    const n = 100 - i - e;
    state.published[state.pitch] = { i, e, n, publishedAt:new Date().toISOString(), version:(state.published[state.pitch]?.version || 0)+1 };
    state.stageStatus='PUBLISHED';
    audit('STAGE_RESULTS_PUBLISHED',`Pitch ${state.pitch}: ${i}% / ${e}% / ${n}%`);
    broadcast();
    toast('Published approved results to the stage.');
    saveAdminActionToSupabase('STAGE_PUBLISHED', `Pitch ${state.pitch}: ${i}%/${e}%/${n}%`, state.published[state.pitch]);
    recordFeed('STAGE_PUBLISHED', {
      startupId: startups[state.pitch-1]?.id,
      startupName: startups[state.pitch-1]?.name,
      detail: `Published: ${i}% interested, ${e}% explore, ${n}% not interested`,
      metadata: { interested: i, explore: e, notInterested: n }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     EVENT BINDING
     ══════════════════════════════════════════════════════════════ */
  function bind() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-route]'); if (nav) setRoute(nav.dataset.route);
      const startup = e.target.closest('[data-startup]'); if (startup) openStartup(startup.dataset.startup);
      const response = e.target.closest('[data-response]'); if (response) submitResponse(response.dataset.response);
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action==='join') joinEvent();
      if (action==='back-list') backToList();
      const tab = e.target.closest('[data-nav]')?.dataset.nav;
      if (tab==='list') { investorScreen='list'; renderInvestor(); }
      if (tab==='responses') {
        investorScreen='responses';
        renderInvestor();
        recordFeed('VIEW_MY_RESPONSES', { detail: 'Opened My Responses tab' });
      }
      const admin = e.target.closest('[data-admin]')?.dataset.admin; if (admin) doAdmin(admin);
    });

    document.getElementById('admin-passcode-submit')?.addEventListener('click', attemptAdminUnlock);
    document.getElementById('admin-passcode-cancel')?.addEventListener('click', () => {
      hideAdminLock();
      setRoute('investor');
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
    if (route==='investor') renderInvestor();
    if (route==='admin') renderAdmin();
    if (route==='stage') renderStage();
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════ */
  bind();
  route = getRouteFromURL();
  setRoute(route);
  renderAll();
  renderReferences();
  initSupabaseRealtime();
  window.setInterval(() => renderAll(), 3000);
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));

  // Record app load
  recordFeed('APP_LOADED', {
    detail: `App opened on route: ${route}`,
    metadata: { route, hasSession: !!session, deviceInfo }
  });
})();
