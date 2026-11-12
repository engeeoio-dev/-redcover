import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../services/firebase/firebaseConfig';

interface Campaign { id: string; name: string; startAt: string; endAt: string; priority: number; logoUrl: string; }

export function useHqBranding(): Campaign | null {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'hqBrandCampaigns'), orderBy('priority', 'desc'), limit(50)), (snapshot) => {
    setCampaigns(snapshot.docs.map((doc) => ({
      id: doc.id, name: String(doc.get('name') || ''), startAt: String(doc.get('startAt') || ''),
      endAt: String(doc.get('endAt') || ''), priority: Number(doc.get('priority') || 0), logoUrl: String(doc.get('logoUrl') || ''),
    })));
  }, () => setCampaigns([])), []);
  const now = Date.now();
  return campaigns.filter((campaign) => campaign.logoUrl && Date.parse(campaign.startAt) <= now && Date.parse(campaign.endAt) > now).sort((a, b) => b.priority - a.priority)[0] || null;
}
