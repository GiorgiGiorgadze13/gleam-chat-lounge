import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type CallType = 'voice' | 'video';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

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

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

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

  const cleanup = useCallback(() => {
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    remoteStream.current = null;
    peerConnection.current?.close();
    peerConnection.current = null;
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
  }, []);

  const setupPeerConnection = useCallback((callId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnection.current = pc;

    // Remote stream
    const remote = new MediaStream();
    remoteStream.current = remote;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach(track => {
        remote.addTrack(track);
      });
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate && user) {
        await supabase.from('call_signals').insert({
          room_id: callState.roomId || callId,
          caller_id: user.id,
          callee_id: callState.remoteUserId,
          call_type: callState.callType,
          signal_type: 'ice-candidate',
          signal_data: { candidate: event.candidate.toJSON() } as any,
          status: 'active',
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState(prev => ({ ...prev, status: 'connected' }));
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        cleanup();
      }
    };

    return pc;
  }, [user, callState.roomId, callState.remoteUserId, callState.callType, cleanup]);

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
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Create call signal record
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
        cleanup();
        return;
      }

      const callId = signal.id;
      setCallState(prev => ({ ...prev, callId }));

      const pc = setupPeerConnection(callId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Listen for answer and ICE candidates
      const channel = supabase
        .channel(`call-${callId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `caller_id=eq.${targetUserId}`,
        }, async (payload) => {
          const sig = payload.new as any;
          if (sig.signal_type === 'answer' && sig.signal_data?.answer) {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.signal_data.answer));
          } else if (sig.signal_type === 'ice-candidate' && sig.signal_data?.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(sig.signal_data.candidate));
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

    } catch (err) {
      console.error('Failed to start call:', err);
      cleanup();
    }
  }, [user, setupPeerConnection, cleanup]);

  const answerCall = useCallback(async (signal: any) => {
    if (!user) return;

    setCallState({
      status: 'connected',
      callType: signal.call_type,
      remoteUserId: signal.caller_id,
      remoteUsername: null,
      roomId: signal.room_id,
      isMuted: false,
      isVideoOff: false,
      callId: signal.id,
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: signal.call_type === 'video',
      });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = setupPeerConnection(signal.id);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Listen for ICE candidates from caller
      const channel = supabase
        .channel(`call-answer-${signal.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `caller_id=eq.${signal.caller_id}`,
        }, async (payload) => {
          const sig = payload.new as any;
          if (sig.signal_type === 'ice-candidate' && sig.signal_data?.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(sig.signal_data.candidate));
          } else if (sig.signal_type === 'hangup') {
            cleanup();
          }
        })
        .subscribe();

      channelRef.current = channel;

      // Set remote description and create answer
      await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer
      await supabase.from('call_signals').insert({
        room_id: signal.room_id,
        caller_id: user.id,
        callee_id: signal.caller_id,
        call_type: signal.call_type,
        signal_type: 'answer',
        signal_data: { answer: { type: answer.type, sdp: answer.sdp } } as any,
        status: 'active',
      });

      // Load caller profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', signal.caller_id)
        .single();
      
      if (profile) {
        setCallState(prev => ({ ...prev, remoteUsername: profile.username }));
      }
    } catch (err) {
      console.error('Failed to answer call:', err);
      cleanup();
    }
  }, [user, setupPeerConnection, cleanup]);

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
    if (!user || !callState.remoteUserId) {
      cleanup();
      return;
    }
    await supabase.from('call_signals').insert({
      room_id: callState.roomId || '',
      caller_id: user.id,
      callee_id: callState.remoteUserId,
      call_type: callState.callType,
      signal_type: 'hangup',
      signal_data: {} as any,
      status: 'ended',
    });
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
