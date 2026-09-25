/**
 * Production Runtime Configuration
 * Allows environment overrides via window.__ENV__ or window.APP_CONFIG
 * Fallback values connect to the default AFF Demo Day Supabase project (public anon key).
 */
(() => {
  'use strict';

  const userConfig = (typeof window !== 'undefined' && (window.__ENV__ || window.APP_CONFIG)) || {};

  // Public Supabase Anon Key (safe for client-side distribution with Row Level Security)
  const DEFAULT_ANON_KEY = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvdWNnd2RhbGd0a2NmaGVidmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzIzNzQsImV4cCI6MjEwNTg0ODM3NH0',
    'YOpoQ6lzRgeicJvsiC4Zun78jvYtW7_TzCFosaG0HZQ'
  ].join('.');

  window.APP_CONFIG = {
    SUPABASE_URL: userConfig.SUPABASE_URL || 'https://toucgwdalgtkcfhebvgo.supabase.co',
    SUPABASE_ANON_KEY: userConfig.SUPABASE_ANON_KEY || DEFAULT_ANON_KEY,
    APP_VERSION: userConfig.APP_VERSION || '2.1.0',
    ENVIRONMENT: userConfig.ENVIRONMENT || 'production',
    DEFAULT_PASSCODE: userConfig.DEFAULT_PASSCODE || 'thatAff2026@',
    MAX_CONCURRENT_PITCHES: userConfig.MAX_CONCURRENT_PITCHES || 15
  };

  window.__ENV__ = window.APP_CONFIG;
})();
