import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, User } from 'lucide-react';
import type { CallStatus, CallType } from '@/hooks/useWebRTC';

interface CallModalProps {
  status: CallStatus;
  callType: CallType;
  remoteUsername: string | null;
  isMuted: boolean;
  isVideoOff: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

export function CallModal({
  status,
  callType,
  remoteUsername,
  isMuted,
  isVideoOff,
  localVideoRef,
  remoteVideoRef,
  onHangUp,
  onToggleMute,
  onToggleVideo,
}: CallModalProps) {
  const statusText = {
    calling: 'Calling...',
    ringing: 'Ringing...',
    connecting: 'Connecting...',
    connected: 'Connected',
    ended: 'Call Ended',
    idle: '',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-card p-6 shadow-2xl border border-border w-full max-w-lg mx-4">
        {/* Video area */}
        {callType === 'video' ? (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-2 right-2 h-24 w-32 rounded-lg border-2 border-card object-cover shadow-lg"
            />
            {status !== 'connected' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-3">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <p className="text-lg font-semibold text-foreground">{remoteUsername || 'User'}</p>
                <p className="text-sm text-muted-foreground animate-pulse">{statusText[status]}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <User className="h-10 w-10 text-primary" />
            </div>
            <p className="text-lg font-semibold text-foreground">{remoteUsername || 'User'}</p>
            <p className="text-sm text-muted-foreground animate-pulse">{statusText[status]}</p>
            {/* Hidden audio elements */}
            <audio ref={remoteVideoRef as any} autoPlay />
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className={`h-12 w-12 rounded-full ${isMuted ? 'bg-destructive/10 text-destructive border-destructive/30' : ''}`}
            onClick={onToggleMute}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          {callType === 'video' && (
            <Button
              variant="outline"
              size="icon"
              className={`h-12 w-12 rounded-full ${isVideoOff ? 'bg-destructive/10 text-destructive border-destructive/30' : ''}`}
              onClick={onToggleVideo}
            >
              {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>
          )}

          <Button
            variant="destructive"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={onHangUp}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
