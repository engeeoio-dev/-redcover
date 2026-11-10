# Redcover Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants
1. **Default Deny Catch-All**: Every path not explicitly matched is denied (`allow read, write: if false;`).
2. **PII Split-Collection Isolation**: Public `/users/{userId}` profiles never store `email`, `phone`, or billing identifiers. Private account data (`email`, `readingReminders`, `notificationSettings`, `theme`, `subscriptionExpiry`) is strictly isolated in `/users/{userId}/private/{docId}` and only readable/writable by the owner (`request.auth.uid == userId`) or a verified administrator (`isAdmin()`).
3. **Self-Assigned Role Prevention**: Users registering `/users/{userId}` can only set `role` to `'user'` or `'author'` (never `'admin'`) unless `isAdmin()` is true. During profile updates, `role`, `uid`, and `createdAt` are immutable for non-admins.
4. **Master Gate Relational Sync**: Every `/books/{bookId}/chapters/{chapterId}` write verifies that the parent `/books/{bookId}` exists and its `authorId == request.auth.uid` (or `isAdmin()`). Every `/chats/{chatId}/messages/{messageId}` write verifies that the parent `/chats/{chatId}` exists and includes `request.auth.uid` as `participantA` or `participantB`.
5. **Query Enforcer (No Blanket List)**: Every `allow list` rule evaluates `resource.data` directly without invoking `get()` or `exists()` inside `list`.
6. **Temporal Integrity**: All `createdAt` fields on `create` must equal `request.time`, and all `updatedAt` fields on `update` must equal `request.time`. `createdAt` is immortal on `update`.
7. **Terminal State Locking**: Reports (`status in ['resolved', 'dismissed']`) and removed books (`status == 'removed'`) are locked against non-admin updates.

## 2. The "Dirty Dozen" Payloads
1. **Payload 1 (Privilege Escalation on Signup)**: `POST /users/attacker123` with `{ role: "admin", ... }` by a non-admin user -> `PERMISSION_DENIED`.
2. **Payload 2 (Shadow Field Injection)**: `POST /books/book1` with `{ ..., isVerifiedAdminBook: true }` -> `PERMISSION_DENIED` via `hasOnly()`.
3. **Payload 3 (Unverified Email Spoof)**: Request with `auth.token.email == 'pangoworld01@gmail.com'` but `email_verified == false` attempting admin write -> `PERMISSION_DENIED`.
4. **Payload 4 (PII Leak Attempt)**: Authenticated user `userB` calling `GET /users/userA/private/info` -> `PERMISSION_DENIED`.
5. **Payload 5 (Identity Spoofing on Book Create)**: `userA` creating `/books/book1` with `authorId: "userB"` -> `PERMISSION_DENIED`.
6. **Payload 6 (Orphaned Chapter Write)**: Creating `/books/nonExistentBook/chapters/ch1` -> `PERMISSION_DENIED` via Master Gate `exists()`/`get()`.
7. **Payload 7 (Cross-User Reading Progress Scrape)**: `userA` listing `/readingProgress` where `isPublic == false` for `userB` -> `PERMISSION_DENIED`.
8. **Payload 8 (Timestamp Forgery)**: Creating `/reviews/rev1` with `createdAt: Timestamp.fromMillis(1000)` != `request.time` -> `PERMISSION_DENIED`.
9. **Payload 9 (Immortal Field Mutation)**: Updating `/books/book1` to change `authorId` or `createdAt` -> `PERMISSION_DENIED`.
10. **Payload 10 (Terminal State Bypass)**: Non-admin updating `/reports/rep1` after `status == 'resolved'` -> `PERMISSION_DENIED`.
11. **Payload 11 (Denial-of-Wallet 1MB String)**: Updating `bio` on `/users/userA` with a 5,000-character string (`> 1000`) -> `PERMISSION_DENIED`.
12. **Payload 12 (Unauthorized Chat Message Injection)**: `userC` posting to `/chats/chatAB/messages/msg1` where `userC` is neither `participantA` nor `participantB` -> `PERMISSION_DENIED`.
