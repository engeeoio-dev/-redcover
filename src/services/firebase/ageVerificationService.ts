import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseConfig';

export type VerifiedAgeBand = 'under12' | '12plus' | '16plus' | '18plus';

export async function verifyGoogleAccountAge(accessToken: string): Promise<VerifiedAgeBand> {
  if (!accessToken) throw new Error('Google did not provide birthday permission.');
  const result = await httpsCallable<{ accessToken: string }, { ageBand: VerifiedAgeBand }>(
    functions,
    'verifyGoogleAccountAge'
  )({ accessToken });
  return result.data.ageBand;
}
