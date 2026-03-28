import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const AFK_TIMEOUT = 60000; // 1 minute
const CHANNEL_NAME = 'chatroom-presence';

interface PresenceMessage {
  type: 'heartbeat' | 'activity' | 'closing';
  tabId: string;
  lastActivity: number;
}

export function usePresence() {
  const { user } = useAuth();
  const lastActivityRef = useRef(Date.now());
  const statusRef = useRef<'online' | 'afk'>('online');
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const tabIdRef = useRef(crypto.randomUUID());
  const otherTabsRef = useRef<Map<string, number>>(new Map());
  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!user) return;

    // Set up BroadcastChannel for multi-tab coordination
    try {
      bcRef.current = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      // BroadcastChannel not supported, single-tab mode
    }

    const updatePresence = async (status: 'online' | 'afk' | 'offline') => {
      await supabase.from('user_presence').upsert({
        user_id: user.id,
        status,
        last_seen: new Date().toISOString(),
      });
    };

    const broadcast = (type: PresenceMessage['type']) => {
      bcRef.current?.postMessage({
        type,
        tabId: tabIdRef.current,
        lastActivity: lastActivityRef.current,
      } as PresenceMessage);
    };

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      broadcast('activity');
      if (statusRef.current !== 'online') {
        statusRef.current = 'online';
        updatePresence('online');
      }
    };

    // Listen for other tabs
    const handleMessage = (event: MessageEvent<PresenceMessage>) => {
      const msg = event.data;
      if (msg.tabId === tabIdRef.current) return;

      if (msg.type === 'closing') {
        otherTabsRef.current.delete(msg.tabId);
      } else {
        otherTabsRef.current.set(msg.tabId, msg.lastActivity);
      }

      // If any tab is active, we should be online
      if (msg.type === 'activity' && statusRef.current !== 'online') {
        statusRef.current = 'online';
        updatePresence('online');
      }
    };

    bcRef.current?.addEventListener('message', handleMessage);

    // Set online immediately
    updatePresence('online');
    broadcast('heartbeat');

    // Listen for activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(e => document.addEventListener(e, handleActivity, { passive: true }));

    // Check for AFK — only go AFK if ALL tabs are idle
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const thisTabIdle = now - lastActivityRef.current > AFK_TIMEOUT;

      // Check if any other tab is active
      let anyOtherActive = false;
      for (const [, lastActivity] of otherTabsRef.current) {
        if (now - lastActivity <= AFK_TIMEOUT) {
          anyOtherActive = true;
          break;
        }
      }

      if (thisTabIdle && !anyOtherActive) {
        if (statusRef.current !== 'afk') {
          statusRef.current = 'afk';
          updatePresence('afk');
        }
      } else if (!thisTabIdle || anyOtherActive) {
        if (statusRef.current !== 'online') {
          statusRef.current = 'online';
          updatePresence('online');
        }
      }

      // Send heartbeat so other tabs know we exist
      broadcast('heartbeat');
    }, 10000);

    // On close: notify other tabs, only go offline if no other tabs
    const handleBeforeUnload = () => {
      broadcast('closing');
      // If no other tabs are known, set offline
      if (otherTabsRef.current.size === 0) {
        // Use sendBeacon-style: fire and forget
        updatePresence('offline');
      }
      // If other tabs exist, they'll handle presence
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      events.forEach(e => document.removeEventListener(e, handleActivity));
      clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      bcRef.current?.removeEventListener('message', handleMessage);
      bcRef.current?.close();
      // Only set offline if this is likely the last tab
      if (otherTabsRef.current.size === 0) {
        updatePresence('offline');
      }
    };
  }, [user]);
}
