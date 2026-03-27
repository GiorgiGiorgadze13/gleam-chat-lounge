import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video, User } from 'lucide-react';

interface IncomingCallProps {
  callerName: string | null;
  callType: 'voice' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCall({ callerName, callType, onAccept, onReject }: IncomingCallProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="flex flex-col items-center gap-5 rounded-2xl bg-card p-8 shadow-2xl border border-border mx-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 animate-pulse">
          {callType === 'video' ? (
            <Video className="h-10 w-10 text-primary" />
          ) : (
            <User className="h-10 w-10 text-primary" />
          )}
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{callerName || 'Someone'}</p>
          <p className="text-sm text-muted-foreground">
            Incoming {callType} call...
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="destructive"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={onReject}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            size="icon"
            className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700"
            onClick={onAccept}
          >
            <Phone className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
