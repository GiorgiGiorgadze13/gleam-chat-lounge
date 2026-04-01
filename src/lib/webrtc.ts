import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

let cachedIceServers: RTCIceServer[] | null = null;

type TurnTokenResponse = {
  iceServers?: RTCIceServer[];
};

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cachedIceServers) return cachedIceServers;

  const { data, error } = await supabase.functions.invoke<TurnTokenResponse>('twilio-turn-token', {
    method: 'POST',
  });

  if (error) {
    console.warn('[WebRTC] Failed to load TURN servers, falling back to STUN only:', error.message);
    return DEFAULT_ICE_SERVERS;
  }

  if (data?.iceServers?.length) {
    cachedIceServers = data.iceServers;
    return cachedIceServers;
  }

  return DEFAULT_ICE_SERVERS;
}

export async function attachMediaStream(
  element: HTMLMediaElement | null,
  stream: MediaStream,
) {
  if (!element) return;

  element.srcObject = stream;

  try {
    await element.play();
  } catch (error) {
    console.warn('[WebRTC] Media playback could not start automatically:', error);
  }
}

export function clearMediaStream(element: HTMLMediaElement | null) {
  if (!element) return;
  element.srcObject = null;
}