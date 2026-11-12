import React, { useEffect, useState } from 'react';
import { subscribeUserPresence } from '../../services/firebase/presenceService';

interface PresenceDotProps {
  uid: string;
  showOnlineStatus?: boolean;
  className?: string;
}

/** Shows online only from the live RTDB presence subscription, never stale profile data. */
export const PresenceDot: React.FC<PresenceDotProps> = ({
  uid,
  showOnlineStatus = true,
  className = '',
}) => {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(false);
    if (!uid || !showOnlineStatus) return;
    return subscribeUserPresence(uid, (presence) => {
      setIsOnline(presence.state === 'online');
    });
  }, [uid, showOnlineStatus]);

  if (!isOnline || !showOnlineStatus) return null;

  return (
    <span
      aria-label="Online"
      title="Online"
      className={`w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#121217] ${className}`}
    />
  );
};
