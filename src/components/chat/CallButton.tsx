import { Button } from '@/components/ui/button';
import { Phone, Video } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CallButtonProps {
  onVoiceCall: () => void;
  onVideoCall: () => void;
  disabled?: boolean;
}

export function CallButton({ onVoiceCall, onVideoCall, disabled = false }: CallButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} className="h-7 gap-1 text-xs text-muted-foreground hover:text-primary disabled:pointer-events-none">
          <Phone className="h-3.5 w-3.5" />
          Call
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onVoiceCall} disabled={disabled} className="gap-2">
          <Phone className="h-4 w-4" />
          Voice Call
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onVideoCall} disabled={disabled} className="gap-2">
          <Video className="h-4 w-4" />
          Video Call
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
