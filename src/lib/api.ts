import type { Api } from './types';
import { demoApi } from './demo';

const live = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

let impl: Api = demoApi;
if (live) {
  const m = await import('./supa');
  impl = m.liveApi;
}

export const api: Api = impl;
