import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase/firebaseConfig';

export interface HqPublicConfig {
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  allowBookPublishing: boolean;
  communityEnabled: boolean;
  announcement: string;
}

const defaults: HqPublicConfig = { maintenanceMode: false, registrationEnabled: true, allowBookPublishing: true, communityEnabled: true, announcement: '' };

export function useHqPublicConfig(): HqPublicConfig {
  const [config, setConfig] = useState(defaults);
  useEffect(() => onSnapshot(doc(db, 'hqConfig', 'platform'), (snapshot) => {
    if (!snapshot.exists()) { setConfig(defaults); return; }
    const data = snapshot.data();
    setConfig({
      maintenanceMode: data.maintenanceMode === true,
      registrationEnabled: data.registrationEnabled !== false,
      allowBookPublishing: data.allowBookPublishing !== false,
      communityEnabled: data.communityEnabled !== false,
      announcement: typeof data.announcement === 'string' ? data.announcement.slice(0, 500) : '',
    });
  }, () => setConfig(defaults)), []);
  return config;
}
