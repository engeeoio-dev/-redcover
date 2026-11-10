import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Book } from '../../models/types';

const REDCODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generates a unique 6-character uppercase A-Z RedCode (e.g. REDCOV, CRIMSN)
 */
export function generateRandomSixDigitCode(): string {
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += REDCODE_CHARS.charAt(Math.floor(Math.random() * REDCODE_CHARS.length));
  }
  return result;
}

/**
 * Atomically reserves a unique 6-digit RedCode for a book in Firestore.
 * Ensures strict uniqueness using runTransaction on the redCodes collection.
 */
export async function assignUniqueRedCodeToBook(
  bookId: string,
  bookTitle: string
): Promise<string> {
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidateCode = generateRandomSixDigitCode();
    const redCodeDocRef = doc(db, 'redCodes', candidateCode);
    const bookDocRef = doc(db, 'books', bookId);

    try {
      const assignedCode = await runTransaction(db, async (transaction) => {
        const redCodeSnap = await transaction.get(redCodeDocRef);
        if (redCodeSnap.exists()) {
          // Collision: retry with another code
          return null;
        }

        const bookSnap = await transaction.get(bookDocRef);
        if (!bookSnap.exists()) {
          throw new Error(`Book ${bookId} does not exist.`);
        }

        const existingBookData = bookSnap.data();
        if (existingBookData?.redCode) {
          // Book already has a stable RedCode
          return existingBookData.redCode as string;
        }

        transaction.set(redCodeDocRef, {
          code: candidateCode,
          bookId,
          bookTitle: (bookTitle || existingBookData?.title || 'Book').slice(0, 150),
          createdAt: serverTimestamp(),
        });

        transaction.update(bookDocRef, {
          redCode: candidateCode,
          updatedAt: serverTimestamp(),
        });

        return candidateCode;
      });

      if (assignedCode) {
        return assignedCode;
      }
    } catch (err) {
      console.warn(`RedCode assignment attempt ${attempt + 1} failed:`, err);
      // If error is not a collision, propagate or retry
      if (attempt === maxAttempts - 1) {
        throw err;
      }
    }
  }

  throw new Error('Unable to generate a unique RedCode after maximum attempts.');
}

/**
 * Accurately detects an isolated 6-digit RedCode in message text.
 * Strictly avoids detecting numbers that are part of phone numbers, dates,
 * URLs, or longer numeric strings.
 */
export function detectRedCodeInText(text: string): string | null {
  if (!text) return null;

  const clean = text.trim();
  if (
    /^\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/.test(clean) ||
    /https?:\/\//.test(clean)
  ) {
    return null;
  }

  // Look for exact 6 uppercase letters (A-Z format)
  const letterRegex = /(?<![A-Za-z0-9])([A-Z]{6})(?![A-Za-z0-9])/g;
  const letterMatches = [...clean.matchAll(letterRegex)];
  if (letterMatches.length === 1) {
    return letterMatches[0][1];
  }

  // Fallback support for numeric 6-digit codes
  const regex = /(?<![\d\-+])\b(\d{6})\b(?![\d\-+])/g;
  const matches = [...clean.matchAll(regex)];

  if (matches.length === 1) {
    return matches[0][1];
  }

  return null;
}

/**
 * Finds a book matching a given 6-digit RedCode from the catalog.
 */
export function findBookByRedCode(code: string, books: Book[]): Book | undefined {
  if (!code || code.length !== 6) return undefined;
  return books.find((b) => b.redCode === code);
}
