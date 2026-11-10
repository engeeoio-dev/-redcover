import { Friendship, UserProfile, Book } from '../../models/types';
import { isSystemAccount } from '../../models/types';

export interface UserSuggestion {
  user: UserProfile;
  mutualFriendsCount: number;
  mutualFriendNames: string[];
  sharedCategories: string[];
  score: number;
  reason: string;
}

/**
 * Computes mutual friends between the current user and target users.
 */
export function computeMutualFriends(
  currentUserId: string,
  targetUserId: string,
  allFriendships: Friendship[],
  allUsers: UserProfile[]
): { count: number; sampleNames: string[] } {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return { count: 0, sampleNames: [] };
  }

  // Get current user's accepted friends
  const myFriendUids = new Set<string>();
  allFriendships.forEach((f) => {
    if (f.status === 'accepted') {
      if (f.requesterId === currentUserId) myFriendUids.add(f.receiverId);
      if (f.receiverId === currentUserId) myFriendUids.add(f.requesterId);
    }
  });

  // Get target user's accepted friends
  const targetFriendUids = new Set<string>();
  allFriendships.forEach((f) => {
    if (f.status === 'accepted') {
      if (f.requesterId === targetUserId) targetFriendUids.add(f.receiverId);
      if (f.receiverId === targetUserId) targetFriendUids.add(f.requesterId);
    }
  });

  // Find intersection
  const mutualUids: string[] = [];
  myFriendUids.forEach((uid) => {
    if (targetFriendUids.has(uid) && uid !== currentUserId && uid !== targetUserId) {
      mutualUids.push(uid);
    }
  });

  const userMap = new Map<string, UserProfile>();
  allUsers.forEach((u) => userMap.set(u.uid, u));

  const sampleNames = mutualUids
    .slice(0, 3)
    .map((uid) => userMap.get(uid)?.displayName || 'Reader');

  return {
    count: mutualUids.length,
    sampleNames,
  };
}

/**
 * Generates intelligent friend recommendations based on:
 * 1. Mutual friends
 * 2. Shared reading interests / favorite categories
 * 3. Activity signals
 *
 * Strictly filters out:
 * - Current user
 * - Already accepted friends
 * - Users with pending friend requests (sent or received)
 * - Blocked users
 * - The protected Redcover system account (engeeo.io@gmail.com)
 */
export function generateFriendSuggestions(
  currentUserId: string,
  allUsers: UserProfile[],
  allFriendships: Friendship[],
  allBooks: Book[],
  userSavedCategoryNames: string[] = []
): UserSuggestion[] {
  if (!currentUserId) return [];

  // Index user relationship statuses
  const relationshipStatus = new Map<string, string>();
  allFriendships.forEach((f) => {
    if (f.requesterId === currentUserId) {
      relationshipStatus.set(f.receiverId, f.status);
    } else if (f.receiverId === currentUserId) {
      relationshipStatus.set(f.requesterId, f.status);
    }
  });

  const suggestions: UserSuggestion[] = [];

  for (const candidate of allUsers) {
    // 1. Exclude self
    if (candidate.uid === currentUserId) continue;

    // 2. Exclude protected system account
    if (isSystemAccount(candidate.uid) || isSystemAccount(candidate.username)) {
      continue;
    }

    // 3. Exclude existing friends or pending requests or blocked
    const rel = relationshipStatus.get(candidate.uid);
    if (rel === 'accepted' || rel === 'pending' || rel === 'blocked') {
      continue;
    }

    // 4. Compute mutual friends
    const { count: mutualCount, sampleNames } = computeMutualFriends(
      currentUserId,
      candidate.uid,
      allFriendships,
      allUsers
    );

    // 5. Compute shared reading categories
    const candidateAuthoredBooks = allBooks.filter((b) => b.authorId === candidate.uid);
    const candidateCategories = candidateAuthoredBooks.map((b) => b.category);
    const sharedCategories = userSavedCategoryNames.filter((cat) =>
      candidateCategories.includes(cat)
    );

    // 6. Compute recommendation score
    let score = 0;
    let reason = 'Active in reading community';

    if (mutualCount > 0) {
      score += mutualCount * 15;
      reason = `${mutualCount} mutual friend${mutualCount > 1 ? 's' : ''}`;
    }

    if (sharedCategories.length > 0) {
      score += sharedCategories.length * 8;
      if (mutualCount === 0) {
        reason = `Both enjoy ${sharedCategories[0]}`;
      }
    }

    if (candidate.booksCount > 0) {
      score += candidate.booksCount * 3;
    }

    suggestions.push({
      user: candidate,
      mutualFriendsCount: mutualCount,
      mutualFriendNames: sampleNames,
      sharedCategories,
      score,
      reason,
    });
  }

  // Sort by highest score descending
  return suggestions.sort((a, b) => b.score - a.score);
}
