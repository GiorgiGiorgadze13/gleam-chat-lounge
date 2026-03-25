import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const AFK_TIMEOUT = 60000; // 1 minute

export function usePresence() {
  const { user } = useAuth();
  const lastActivityRef = useRef(Date.now());
  const statusRef = useRef<'online' | 'afk'>('online');
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!user) return;

    const updatePresence = async (status: 'online' | 'afk' | 'offline') => {
      await supabase.from('user_presence').upsert({
        user_id: user.id,
        status,
        last_seen: new Date().toISOString(),
      });
    };

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (statusRef.current !== 'online') {
        statusRef.current = 'online';
        updatePresence('online');
      }
    };

    // Set online immediately
    updatePresence('online');

    // Listen for activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(e => document.addEventListener(e, handleActivity, { passive: true }));

    // Check for AFK
    intervalRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current > AFK_TIMEOUT) {
        if (statusRef.current !== 'afk') {
          statusRef.current = 'afk';
          updatePresence('afk');
        }
      }
    }, 10000);

    // Set offline on close
    const handleBeforeUnload = () => {
      navigator.sendBeacon && updatePresence('offline');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      events.forEach(e => document.removeEventListener(e, handleActivity));
      clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePresence('offline');
    };
  }, [user]);
}
