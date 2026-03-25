import { cn } from '@/lib/utils';

interface PresenceDotProps {
  status: 'online' | 'afk' | 'offline';
  className?: string;
}

export function PresenceDot({ status, className }: PresenceDotProps) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full border border-background',
        status === 'online' && 'bg-presence-online',
        status === 'afk' && 'bg-presence-afk',
        status === 'offline' && 'bg-presence-offline',
        className
      )}
      title={status}
    />
  );
}
