'use client';

import { useEffect } from 'react';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type Listener = () => void;

let channel: RealtimeChannel | null = null;
let removeChannelFn: ((ch: RealtimeChannel) => void) | null = null;
const listeners = new Set<Listener>();

function ensureChannel() {
  if (!supabaseUrl || !supabaseAnonKey) return;
  if (channel) return;

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  removeChannelFn = (ch: RealtimeChannel) => supabase.removeChannel(ch);

  channel = supabase
    .channel('global-like-events')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, () => {
      for (const fn of listeners) fn();
    })
    .subscribe();
}

export function useLikeEvents(onLike: () => void) {
  useEffect(() => {
    ensureChannel();
    listeners.add(onLike);
    return () => {
      listeners.delete(onLike);
      if (listeners.size === 0 && channel && removeChannelFn) {
        removeChannelFn(channel);
        channel = null;
        removeChannelFn = null;
      }
    };
  }, [onLike]);
}

