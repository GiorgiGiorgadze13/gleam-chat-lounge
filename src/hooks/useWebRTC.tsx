import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { attachMediaStream, clearMediaStream, getIceServers } from '@/lib/webrtc';
import { useAuth } from './useAuth';

export type CallType = 'voice' | 'video';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';

interface CallState {
  status: CallStatus;
  callType: CallType;
  remoteUserId: string | null;
  remoteUsername: string | null;
  roomId: string | null;
  isMuted: boolean;
  isVideoOff: boolean;
  callId: string | null;
}

export function useWebRTC() {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    callType: 'voice',
    remoteUserId: null,
    remoteUsername: null,
    roomId: null,
    isMuted: false,
    isVideoOff: false,
    callId: null,
  });

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const disconnectTimeoutRef = useRef<number | null>(null);

  const clearDisconnectTimeout = useCallback(() => {
    if (disconnectTimeoutRef.current) {
      window.clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearDisconnectTimeout();
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    remoteStream.current = null;
    peerConnection.current?.close();
    peerConnection.current = null;
    pendingCandidates.current = [];
    clearMediaStream(localVideoRef.current);
    clearMediaStream(remoteVideoRef.current);
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setCallState({
      status: 'idle',
      callType: 'voice',
      remoteUserId: null,
      remoteUsername: null,
      roomId: null,
      isMuted: false,
      isVideoOff: false,
      callId: null,
    });
  }, [clearDisconnectTimeout]);

  const scheduleDisconnectCleanup = useCallback(() => {
    if (disconnectTimeoutRef.current) return;

    disconnectTimeoutRef.current = window.setTimeout(() => {
      console.warn('[WebRTC] Connection stayed disconnected, cleaning up call');
      cleanup();
    }, 10000);
  }, [cleanup]);

  // Pass all needed values directly — never rely on callState closure
  const setupPeerConnection = useCallback(async (params: {
    roomId: string;
    remoteUserId: string;
    callType: CallType;
    userId: string;
  }) => {
    const { roomId, remoteUserId, callType, userId } = params;
    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: 'all',
    });
    peerConnection.current = pc;

    const remote = new MediaStream();
    remoteStream.current = remote;
    await attachMediaStream(remoteVideoRef.current, remote);

    pc.ontrack = (event) => {
      if (!remote.getTracks().some(track => track.id === event.track.id)) {
        remote.addTrack(event.track);
      }
      void attachMediaStream(remoteVideoRef.current, remote);
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await supabase.from('call_signals').insert({
          room_id: roomId,
          caller_id: userId,
          callee_id: remoteUserId,
          call_type: callType,
          signal_type: 'ice-candidate',
          signal_data: { candidate: event.candidate.toJSON() } as any,
          status: 'active',
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        clearDisconnectTimeout();
        setCallState(prev => ({ ...prev, status: 'connected' }));
      } else if (pc.connectionState === 'disconnected') {
        setCallState(prev => ({ ...prev, status: 'connecting' }));
        scheduleDisconnectCleanup();
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanup();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        clearDisconnectTimeout();
      } else if (pc.iceConnectionState === 'disconnected') {
        scheduleDisconnectCleanup();
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        cleanup();
      }
    };

    return pc;
  }, [cleanup, clearDisconnectTimeout, scheduleDisconnectCleanup]);

  const addIceCandidateSafe = useCallback(async (pc: RTCPeerConnection, candidate: RTCIceCandidateInit) => {
    if (pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Failed to add ICE candidate:', e);
      }
    } else {
      pendingCandidates.current.push(candidate);
    }
  }, []);

  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const candidates = [...pendingCandidates.current];
    pendingCandidates.current = [];
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Failed to flush ICE candidate:', e);
      }
    }
  }, []);

  const startCall = useCallback(async (
    targetUserId: string,
    targetUsername: string,
    roomId: string,
    type: CallType
  ) => {
    if (!user) return;

    setCallState({
      status: 'calling',
      callType: type,
      remoteUserId: targetUserId,
      remoteUsername: targetUsername,
      roomId,
      isMuted: false,
      isVideoOff: false,
      callId: null,
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      localStream.current = stream;
      await attachMediaStream(localVideoRef.current, stream);

      // Create call signal record (pending state)
      const { data: signal, error } = await supabase.from('call_signals').insert({
        room_id: roomId,
        caller_id: user.id,
        callee_id: targetUserId,
        call_type: type,
        signal_type: 'offer-pending',
        signal_data: {} as any,
        status: 'pending',
      }).select().single();

      if (error || !signal) {
        console.error('[WebRTC] Failed to create call signal:', error);
        cleanup();
        return;
      }

      const callId = signal.id;
      setCallState(prev => ({ ...prev, callId }));

      // Setup peer connection with explicit params (no stale closure)
      const pc = await setupPeerConnection({
        roomId,
        remoteUserId: targetUserId,
        callType: type,
        userId: user.id,
      });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Listen for answer and ICE candidates from callee
      const channel = supabase
        .channel(`call-${callId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `caller_id=eq.${targetUserId}`,
        }, async (payload) => {
          const sig = payload.new as any;
          console.log('[WebRTC] Caller received signal:', sig.signal_type);
          if (sig.signal_type === 'answer' && sig.signal_data?.answer) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.signal_data.answer));
              console.log('[WebRTC] Remote description set (answer)');
              setCallState(prev => ({ ...prev, status: 'connecting' }));
              await flushPendingCandidates(pc);
            } catch (e) {
              console.error('[WebRTC] Failed to set remote description:', e);
            }
          } else if (sig.signal_type === 'ice-candidate' && sig.signal_data?.candidate) {
            await addIceCandidateSafe(pc, sig.signal_data.candidate);
          } else if (sig.signal_type === 'reject' || sig.signal_type === 'hangup') {
            cleanup();
          }
        })
        .subscribe();

      channelRef.current = channel;

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await supabase.from('call_signals').update({
        signal_type: 'offer',
        signal_data: { offer: { type: offer.type, sdp: offer.sdp } } as any,
        status: 'ringing',
      }).eq('id', callId);

      console.log('[WebRTC] Offer sent, callId:', callId);
    } catch (err) {
      console.error('[WebRTC] Failed to start call:', err);
      cleanup();
    }
  }, [user, setupPeerConnection, cleanup, addIceCandidateSafe, flushPendingCandidates]);

  const answerCall = useCallback(async (signal: any) => {
    if (!user) return;

    const callType = signal.call_type as CallType;
    const callerId = signal.caller_id;
    const roomId = signal.room_id;

    setCallState({
      status: 'connecting',
      callType,
      remoteUserId: callerId,
      remoteUsername: null,
      roomId,
      isMuted: false,
      isVideoOff: false,
      callId: signal.id,
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      });
      localStream.current = stream;
      await attachMediaStream(localVideoRef.current, stream);

      // Setup peer connection with explicit params
      const pc = await setupPeerConnection({
        roomId,
        remoteUserId: callerId,
        callType,
        userId: user.id,
      });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Listen for ICE candidates from caller
      const channel = supabase
        .channel(`call-answer-${signal.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `caller_id=eq.${callerId}`,
        }, async (payload) => {
          const sig = payload.new as any;
          console.log('[WebRTC] Callee received signal:', sig.signal_type);
          if (sig.signal_type === 'ice-candidate' && sig.signal_data?.candidate) {
            await addIceCandidateSafe(pc, sig.signal_data.candidate);
          } else if (sig.signal_type === 'hangup') {
            cleanup();
          }
        })
        .subscribe();

      channelRef.current = channel;

      // Set remote description (the offer) and create answer
      console.log('[WebRTC] Setting remote description (offer)...');
      await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data.offer));
      console.log('[WebRTC] Remote description set, creating answer...');
      await flushPendingCandidates(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer signal
      await supabase.from('call_signals').insert({
        room_id: roomId,
        caller_id: user.id,
        callee_id: callerId,
        call_type: callType,
        signal_type: 'answer',
        signal_data: { answer: { type: answer.type, sdp: answer.sdp } } as any,
        status: 'active',
      });

      console.log('[WebRTC] Answer sent');

      // Load caller profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', callerId)
        .single();

      if (profileData) {
        setCallState(prev => ({ ...prev, remoteUsername: profileData.username }));
      }
    } catch (err) {
      console.error('[WebRTC] Failed to answer call:', err);
      cleanup();
    }
  }, [user, setupPeerConnection, cleanup, addIceCandidateSafe, flushPendingCandidates]);

  const rejectCall = useCallback(async (signal: any) => {
    if (!user) return;
    await supabase.from('call_signals').insert({
      room_id: signal.room_id,
      caller_id: user.id,
      callee_id: signal.caller_id,
      call_type: signal.call_type,
      signal_type: 'reject',
      signal_data: {} as any,
      status: 'ended',
    });
  }, [user]);

  const hangUp = useCallback(async () => {
    if (!user) {
      cleanup();
      return;
    }
    // Read current state values before cleanup
    const { remoteUserId, roomId, callType } = callState;
    if (remoteUserId && roomId) {
      await supabase.from('call_signals').insert({
        room_id: roomId,
        caller_id: user.id,
        callee_id: remoteUserId,
        call_type: callType,
        signal_type: 'hangup',
        signal_data: {} as any,
        status: 'ended',
      });
    }
    cleanup();
  }, [user, callState, cleanup]);

  const toggleMute = useCallback(() => {
    const audioTrack = localStream.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setCallState(prev => ({ ...prev, isMuted: !audioTrack.enabled }));
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const videoTrack = localStream.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCallState(prev => ({ ...prev, isVideoOff: !videoTrack.enabled }));
    }
  }, []);

  return {
    callState,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    rejectCall,
    hangUp,
    toggleMute,
    toggleVideo,
    cleanup,
  };
}
