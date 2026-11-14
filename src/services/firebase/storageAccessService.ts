import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseConfig';

type SignedReadResult = { url: string; expiresAt: string };

export async function getBookPdfAccessUrl(bookId: string): Promise<string> {
  const result = await httpsCallable<{ bookId: string }, SignedReadResult>(functions, 'getBookPdfAccess')({ bookId });
  return result.data.url;
}

export async function getChatAttachmentAccessUrl(
  conversationId: string,
  messageId: string,
  conversationType: 'direct' | 'group'
): Promise<string> {
  const result = await httpsCallable<{
    conversationId: string;
    messageId: string;
    conversationType: 'direct' | 'group';
  }, SignedReadResult>(functions, 'getChatAttachmentAccess')({ conversationId, messageId, conversationType });
  return result.data.url;
}
