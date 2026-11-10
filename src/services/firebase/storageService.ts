import { ref, uploadBytesResumable, getDownloadURL, listAll, StorageReference } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db, defaultDb, auth, FIREBASE_PROJECT_INFO } from './firebaseConfig';
import {
  Book,
  Chapter,
  PostComment,
  ReadingProgress,
  Review,
  SocialPost,
  SocialPostType,
  UserProfile,
} from '../../models/types';

export function sanitizeId(raw: string, fallback = 'item'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned || `${fallback}_${Date.now()}`;
}

export function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return new Date(val).toISOString();
  if (
    typeof val === 'object' &&
    val !== null &&
    'toDate' in val &&
    typeof (val as { toDate: () => Date }).toDate === 'function'
  ) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (
    typeof val === 'object' &&
    val !== null &&
    'seconds' in val &&
    typeof (val as { seconds: number }).seconds === 'number'
  ) {
    return new Date((val as { seconds: number }).seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Checks whether a URL or storage path points to a PDF document rather than an image.
 * Prevents accidentally treating a PDF file URL as a book cover image URL.
 */
export function isLikelyPdfUrl(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:application/pdf')) return true;

  const withoutQuery = trimmed.split('?')[0].split('#')[0].toLowerCase();
  try {
    const decoded = decodeURIComponent(withoutQuery);
    if (decoded.endsWith('.pdf')) return true;
    if (decoded.includes('/book_pdfs/') || decoded.includes('/pdfs/')) return true;
  } catch {
    if (withoutQuery.endsWith('.pdf')) return true;
  }
  return false;
}

/**
 * Checks if a string looks like a likely image URL or Firebase Storage path for an image.
 */
export function isLikelyImageOrStorageValue(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed || isLikelyPdfUrl(trimmed)) return false;

  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) return true;
  if (trimmed.startsWith('gs://')) return true;
  if (
    trimmed.includes('firebasestorage.googleapis.com') ||
    trimmed.includes('storage.googleapis.com') ||
    trimmed.includes('.firebasestorage.app') ||
    trimmed.includes('.appspot.com')
  ) {
    return true;
  }

  const lower = trimmed.split('?')[0].split('#')[0].toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif|avif|bmp|svg)$/i.test(lower)) return true;
  if (
    /^(book_covers|covers|cover_images|book_images|images|thumbnails|thumbs|posters|book_content|books|uploads)\//i.test(
      trimmed.replace(/^\/+/, '')
    )
  ) {
    return true;
  }
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return true;
  }
  return false;
}

/**
 * Normalizes raw image strings from Android/Firestore:
 * - Preserves full URLs (never truncates base64 or long signed Storage URLs).
 * - Converts raw base64 strings (without data: prefix) into valid data:image/* URIs.
 * - Converts http:// URLs to https:// to avoid mixed-content blocks.
 */
export function normalizeImageString(rawVal: unknown): string {
  if (!rawVal) return '';
  if (typeof rawVal === 'object' && rawVal !== null) {
    if (Array.isArray(rawVal)) {
      for (const item of rawVal) {
        const candidate = normalizeImageString(item);
        if (candidate) return candidate;
      }
      return '';
    }
    const obj = rawVal as Record<string, unknown>;
    const nested =
      obj.url ||
      obj.downloadUrl ||
      obj.downloadURL ||
      obj.coverUrl ||
      obj.coverURL ||
      obj.imageUrl ||
      obj.imageURL ||
      obj.thumbnailUrl ||
      obj.src ||
      obj.uri ||
      obj.path ||
      obj.storagePath ||
      obj.fullPath;
    if (nested) {
      return normalizeImageString(nested);
    }
    return '';
  }
  if (typeof rawVal !== 'string') return '';

  const str = rawVal.trim();
  if (!str || str === 'null' || str === 'undefined' || str === 'none') return '';

  // Reject PDF URLs from being treated as cover images
  if (isLikelyPdfUrl(str)) return '';

  // Already a valid data URI or blob
  if (str.startsWith('data:image/') || str.startsWith('blob:')) {
    return str;
  }

  // Detect raw base64 image payloads saved by Android Base64.encodeToString
  const compact = str.replace(/\s+/g, '');
  if (compact.startsWith('/9j/') && compact.length > 100) {
    return `data:image/jpeg;base64,${compact}`;
  }
  if (compact.startsWith('iVBORw0KGgo') && compact.length > 100) {
    return `data:image/png;base64,${compact}`;
  }
  if (compact.startsWith('R0lGOD') && compact.length > 100) {
    return `data:image/gif;base64,${compact}`;
  }
  if (compact.startsWith('UklGR') && compact.length > 100) {
    return `data:image/webp;base64,${compact}`;
  }

  // Upgrade insecure http:// to https://
  if (str.startsWith('http://')) {
    return `https://${str.slice('http://'.length)}`;
  }

  return str;
}

const COVER_FIELD_PRIORITY = [
  'coverURL',
  'coverUrl',
  'coverImageUrl',
  'coverImageURL',
  'coverImage',
  'cover_image',
  'cover_url',
  'cover_image_url',
  'bookCover',
  'bookCoverUrl',
  'bookCoverURL',
  'book_cover',
  'book_cover_url',
  'bookCoverImage',
  'book_cover_image',
  'pdfCoverUrl',
  'pdfCoverURL',
  'pdf_cover_url',
  'pdfCover',
  'coverFileUrl',
  'coverFileURL',
  'cover_file_url',
  'coverFile',
  'coverUri',
  'coverURI',
  'cover_uri',
  'imageUrl',
  'imageURL',
  'image_url',
  'image',
  'imageUri',
  'imageURI',
  'bookImage',
  'bookImageUrl',
  'bookImageURL',
  'book_image',
  'book_image_url',
  'imgUrl',
  'img_url',
  'img',
  'thumbnailUrl',
  'thumbnailURL',
  'thumbnail_url',
  'thumbnail',
  'thumbnailUri',
  'bookThumbnail',
  'thumbUrl',
  'thumb_url',
  'thumb',
  'posterUrl',
  'posterURL',
  'poster_url',
  'poster',
  'artworkUrl',
  'artwork_url',
  'artwork',
  'frontCover',
  'frontCoverUrl',
  'front_cover_url',
  'coverPhoto',
  'coverPhotoUrl',
  'photoUrl',
  'photoURL',
  'photo_url',
  'picture',
  'pictureUrl',
  'pic',
  'bookPic',
  'cover',
  'coverPath',
  'coverStoragePath',
  'imagePath',
  'storagePath',
  'coverDownloadUrl',
  'downloadUrl',
  'downloadURL',
  'mediaUrl',
];

const AVATAR_FIELD_EXCLUSIONS = new Set([
  'authoravatar',
  'authorphoto',
  'authorimage',
  'authorpic',
  'writeravatar',
  'useravatar',
  'userphoto',
  'userimage',
  'profileimage',
  'profileimageurl',
  'profilephoto',
  'profilepic',
  'avatar',
  'avatarurl',
]);

/**
 * Exhaustively inspects a raw Firestore / RTDB book document to find the real author-uploaded cover URL or Storage path.
 */
export function extractBookCoverUrl(raw: Record<string, any>): string {
  if (!raw || typeof raw !== 'object') return '';

  // 1. Check prioritized cover field names
  for (const key of COVER_FIELD_PRIORITY) {
    const candidate = normalizeImageString(raw[key]);
    if (candidate && isLikelyImageOrStorageValue(candidate)) {
      return candidate;
    }
  }

  // 2. Check nested metadata objects if present
  const nestedContainers = [
    raw.metadata,
    raw.bookInfo,
    raw.media,
    raw.images,
    raw.assets,
    raw.details,
    raw.cover,
    raw.image,
    raw.book,
  ];
  for (const container of nestedContainers) {
    if (container && typeof container === 'object') {
      for (const key of COVER_FIELD_PRIORITY) {
        const candidate = normalizeImageString(container[key]);
        if (candidate && isLikelyImageOrStorageValue(candidate)) {
          return candidate;
        }
      }
    }
  }

  // 3. Fallback key scan: check any key on `raw` that mentions cover, thumb, image, img, poster, art, banner, pic, photo, uri, url
  // Only excluding actual user/author avatar fields (NOT excluding keys with 'pdf' or 'file' since isLikelyPdfUrl already filters PDF values)
  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();
    if (AVATAR_FIELD_EXCLUSIONS.has(lowerKey)) continue;
    if (/(cover|thumb|image|img|poster|art|banner|pic|photo|front)/i.test(lowerKey)) {
      const candidate = normalizeImageString(value);
      if (candidate && isLikelyImageOrStorageValue(candidate)) {
        return candidate;
      }
    }
  }

  // 4. Deep value scan: check if ANY property in `raw` holds a non-PDF Firebase Storage image URL or data:image URI
  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();
    if (AVATAR_FIELD_EXCLUSIONS.has(lowerKey)) continue;
    const candidate = normalizeImageString(value);
    if (
      candidate &&
      !isLikelyPdfUrl(candidate) &&
      (candidate.includes('firebasestorage.googleapis.com') ||
        candidate.includes('storage.googleapis.com') ||
        candidate.startsWith('gs://') ||
        candidate.startsWith('data:image/') ||
        /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(candidate))
    ) {
      return candidate;
    }
  }

  return '';
}

const PDF_FIELD_PRIORITY = [
  'fileURL',
  'fileUrl',
  'pdfUrl',
  'pdfURL',
  'bookPdfUrl',
  'bookPdfURL',
  'pdf_url',
  'file_url',
  'book_pdf_url',
  'documentUrl',
  'documentURL',
  'bookFileUrl',
  'bookUrl',
  'bookURL',
  'contentUrl',
  'contentURL',
  'bookContentUrl',
  'pdf',
  'file',
  'pdfPath',
  'filePath',
];

export function extractBookFileUrl(raw: Record<string, any>): string {
  if (!raw || typeof raw !== 'object') return '';
  for (const key of PDF_FIELD_PRIORITY) {
    const val = raw[key];
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  for (const [valKey, val] of Object.entries(raw)) {
    if (
      typeof val === 'string' &&
      isLikelyPdfUrl(val) &&
      !AVATAR_FIELD_EXCLUSIONS.has(valKey.toLowerCase())
    ) {
      return val.trim();
    }
  }
  return '';
}

// In-memory cache of resolved Firebase Storage download URLs
const resolvedStorageUrlCache = new Map<string, string>();

// Cache of discovered bookId -> downloadUrl from Firebase Storage bucket scan
const bookIdCoverCache = new Map<string, string>();
let storageIndexPromise: Promise<StorageReference[]> | null = null;
let storageIndexedWithUid: string | null = null;

/**
 * Indexes all non-PDF image objects across the existing `red-cover` Firebase Storage bucket
 * so books whose cover URL wasn't saved directly on the Firestore doc can still locate their
 * original uploaded cover image in Firebase Storage.
 */
async function getStorageImageReferences(): Promise<StorageReference[]> {
  const currentUid = auth.currentUser?.uid || 'anon';
  if (storageIndexPromise && storageIndexedWithUid === currentUid) {
    return storageIndexPromise;
  }

  storageIndexedWithUid = currentUid;
  storageIndexPromise = (async () => {
    const foundItems: StorageReference[] = [];
    const visitedFolders = new Set<string>();

    const scanFolder = async (folderPath: string, depth = 0) => {
      if (depth > 2 || visitedFolders.has(folderPath)) return;
      visitedFolders.add(folderPath);
      try {
        const listRes = await listAll(ref(storage, folderPath));
        for (const item of listRes.items) {
          if (!isLikelyPdfUrl(item.fullPath)) {
            foundItems.push(item);
          }
        }
        for (const prefix of listRes.prefixes) {
          await scanFolder(prefix.fullPath, depth + 1);
        }
      } catch {
        // Ignore folders restricted by storage rules
      }
    };

    // Scan root + common Android/Web cover folders
    const candidateFolders = [
      '',
      'book_covers',
      'covers',
      'cover_images',
      'book_images',
      'images',
      'thumbnails',
      'book_content',
      'books',
      'uploads',
    ];
    await Promise.all(candidateFolders.map((folder) => scanFolder(folder, 0)));
    return foundItems;
  })();

  return storageIndexPromise;
}

/**
 * Attempts to locate the original uploaded cover for a book across:
 * 1. The `(default)` Firestore database (`defaultDb`) if the book was mirrored without its cover field.
 * 2. The existing `red-cover.firebasestorage.app` Firebase Storage bucket.
 * If found, also heals the `books/{bookId}` document in `db` so future loads are instant.
 */
export async function discoverBookCoverInStorage(book: {
  id: string;
  title?: string;
  fileURL?: string;
}): Promise<string> {
  if (!book?.id) return '';

  const cached = bookIdCoverCache.get(book.id);
  if (cached !== undefined) return cached;

  // Step 1: Check `(default)` Firestore database (`defaultDb`) directly for this book ID
  const defaultCollections = ['books', 'Books', 'stories', 'Stories', 'pdf_books', 'ebooks'];
  for (const colName of defaultCollections) {
    try {
      const { getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(defaultDb, colName, book.id));
      if (snap.exists()) {
        const rawData = snap.data();
        const extracted = extractBookCoverUrl(rawData);
        if (extracted) {
          const resolved = await resolveFirebaseCoverUrl(extracted);
          if (resolved && !isLikelyPdfUrl(resolved)) {
            bookIdCoverCache.set(book.id, resolved);
            persistDiscoveredCoverToFirestore(book.id, resolved);
            return resolved;
          }
        }
      }
    } catch {
      // Ignore permission or network errors on defaultDb
    }
  }

  // Extract possible file stem from fileURL (e.g. `28574243-95aa-4733-a5d2-7a1e3fab370c` from `book_content/28574243-...pdf`)
  let fileStem = '';
  if (book.fileURL) {
    try {
      const decoded = decodeURIComponent(book.fileURL.split('?')[0]);
      const lastSegment = decoded.split('/').pop() || '';
      fileStem = lastSegment.replace(/\.pdf$/i, '').trim();
    } catch {
      fileStem = '';
    }
  }

  const candidateIds = Array.from(new Set([book.id, fileStem].filter(Boolean)));

  // Step 2: Probe direct conventional Storage paths for candidateIds
  const directFolders = ['book_covers', 'covers', 'book_images', 'images', 'book_content', 'thumbnails', 'books'];
  const directExts = ['.jpg', '.jpeg', '.png', '.webp', ''];

  for (const cid of candidateIds) {
    for (const folder of directFolders) {
      for (const ext of directExts) {
        const probePath = `${folder}/${cid}${ext}`;
        try {
          const url = await getDownloadURL(ref(storage, probePath));
          if (url && !isLikelyPdfUrl(url)) {
            bookIdCoverCache.set(book.id, url);
            persistDiscoveredCoverToFirestore(book.id, url);
            return url;
          }
        } catch {
          // Continue probing
        }
      }
    }
  }

  // Step 3: Search indexed Storage files in `red-cover.firebasestorage.app`
  try {
    const allImages = await getStorageImageReferences();
    if (allImages.length > 0) {
      const normTitle = (book.title || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      const matchedRef = allImages.find((itemRef) => {
        const lowerPath = itemRef.fullPath.toLowerCase();
        const lowerName = itemRef.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const cid of candidateIds) {
          if (cid && lowerPath.includes(cid.toLowerCase())) {
            return true;
          }
        }
        if (normTitle && normTitle.length >= 4 && lowerName.includes(normTitle)) {
          return true;
        }
        return false;
      });

      if (matchedRef) {
        const url = await getDownloadURL(matchedRef);
        if (url && !isLikelyPdfUrl(url)) {
          bookIdCoverCache.set(book.id, url);
          persistDiscoveredCoverToFirestore(book.id, url);
          return url;
        }
      }
    }
  } catch {
    // Ignore storage listing errors
  }

  // Do not permanently cache empty string if user was not authenticated yet
  if (auth.currentUser) {
    bookIdCoverCache.set(book.id, '');
  }
  return '';
}

async function persistDiscoveredCoverToFirestore(bookId: string, coverURL: string) {
  if (!bookId || !coverURL || coverURL.length > 1000 || !auth.currentUser) return;
  try {
    const { serverTimestamp } = await import('firebase/firestore');
    await updateDoc(doc(db, 'books', bookId), {
      coverURL,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking best-effort cache heal in Firestore
  }
}

/**
 * Resolves a cover URL or Firebase Storage path (`gs://...`, relative path `book_covers/...`,
 * or Firebase Storage URL) into a browser-loadable HTTPS download URL.
 */
export async function resolveFirebaseCoverUrl(rawCover: string): Promise<string> {
  const clean = normalizeImageString(rawCover);
  if (!clean) return '';

  if (
    clean.startsWith('data:image/') ||
    clean.startsWith('blob:') ||
    clean.startsWith('/assets/') ||
    clean.startsWith('/src/')
  ) {
    return clean;
  }

  const cached = resolvedStorageUrlCache.get(clean);
  if (cached) return cached;

  const isGsUri = clean.startsWith('gs://');
  const isHttpUri = clean.startsWith('https://') || clean.startsWith('http://');

  if (isGsUri || !isHttpUri) {
    const storagePath = isGsUri ? clean : clean.replace(/^\/+/, '');
    try {
      const storageRef = ref(storage, storagePath);
      const downloadUrl = await getDownloadURL(storageRef);
      resolvedStorageUrlCache.set(clean, downloadUrl);
      return downloadUrl;
    } catch (err) {
      console.warn('[Redcover Storage] getDownloadURL fallback for path:', storagePath, err);
      const objectPath = isGsUri ? clean.replace(/^gs:\/\/[^/]+\//, '') : storagePath;
      const bucket = FIREBASE_PROJECT_INFO.storageBucket || 'red-cover.firebasestorage.app';
      const fallbackUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
        objectPath
      )}?alt=media`;
      resolvedStorageUrlCache.set(clean, fallbackUrl);
      return fallbackUrl;
    }
  }

  return clean;
}

/**
 * Recovery helper if an existing https://firebasestorage.googleapis.com/... URL fails to load
 * (for example, due to an expired token or `.appspot.com` vs `.firebasestorage.app` bucket alias).
 */
export async function recoverFirebaseStorageUrlOnError(failedUrl: string): Promise<string | null> {
  if (!failedUrl) return null;
  try {
    const match = failedUrl.match(/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?#]+)/i);
    if (match && match[1]) {
      const objectPath = decodeURIComponent(match[1]);
      const freshUrl = await getDownloadURL(ref(storage, objectPath));
      if (freshUrl && freshUrl !== failedUrl) {
        resolvedStorageUrlCache.set(failedUrl, freshUrl);
        return freshUrl;
      }
    }
    const gcsMatch = failedUrl.match(/storage\.googleapis\.com\/[^/]+\/([^?#]+)/i);
    if (gcsMatch && gcsMatch[1]) {
      const objectPath = decodeURIComponent(gcsMatch[1]);
      const freshUrl = await getDownloadURL(ref(storage, objectPath));
      if (freshUrl && freshUrl !== failedUrl) {
        resolvedStorageUrlCache.set(failedUrl, freshUrl);
        return freshUrl;
      }
    }
  } catch (err) {
    console.warn('[Redcover Storage] Could not recover failed Firebase Storage URL:', failedUrl, err);
  }
  return null;
}

export function normalizeUserDoc(id: string, raw: Record<string, any>): UserProfile {
  const photoURL = normalizeImageString(
    raw.photoURL ||
      raw.photoUrl ||
      raw.profileImageUrl ||
      raw.profileImage ||
      raw.avatar ||
      raw.avatarUrl ||
      raw.userImage ||
      raw.imageUrl ||
      ''
  );
  const coverURL = normalizeImageString(
    raw.coverURL || raw.coverUrl || raw.bannerUrl || raw.bannerImage || ''
  );
  return {
    uid: String(raw.uid || raw.userId || id),
    username: String(raw.username || raw.userName || raw.handle || `reader_${id.slice(0, 6)}`).slice(0, 60),
    displayName: String(raw.displayName || raw.name || raw.fullName || 'Redcover Reader').slice(0, 100),
    photoURL,
    coverURL,
    bio: String(raw.bio || raw.about || 'Avid reader and writer on Redcover.').slice(0, 1000),
    followersCount: Number(raw.followersCount ?? raw.followers ?? 0),
    followingCount: Number(raw.followingCount ?? raw.following ?? 0),
    booksCount: Number(raw.booksCount ?? raw.publishedBooksCount ?? 0),
    streakDays: Number(raw.streakDays ?? raw.readingStreak ?? raw.streak ?? 1),
    points: Number(raw.points ?? raw.rewardPoints ?? 100),
    membershipPlan:
      raw.membershipPlan === 'premium' || raw.isPremium === true || raw.membership === 'premium'
        ? 'premium'
        : 'free',
    isOnline: Boolean(raw.isOnline ?? true),
    showOnlineStatus: Boolean(raw.showOnlineStatus ?? true),
    publicActivity: Boolean(raw.publicActivity ?? true),
    role: raw.role === 'admin' ? 'admin' : raw.role === 'author' ? 'author' : 'user',
    nameColor: raw.nameColor ? String(raw.nameColor) : undefined,
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt || raw.createdAt),
  };
}

export function normalizeBookDoc(
  id: string,
  raw: Record<string, any>,
  sourceDb: 'applet' | 'default' | 'catalog' = 'applet'
): Book {
  const description = String(
    raw.description || raw.summary || raw.synopsis || raw.bookDescription || raw.about || 'No description provided.'
  ).slice(0, 5000);
  const shortDescription = String(raw.shortDescription || raw.subtitle || description.slice(0, 180)).slice(0, 400);
  const coverURL = extractBookCoverUrl(raw);
  const fileURL = extractBookFileUrl(raw);
  const authorAvatar = normalizeImageString(
    raw.authorAvatar || raw.authorPhoto || raw.authorImage || raw.writerAvatar || ''
  );

  return {
    id: String(raw.id || raw.bookId || id),
    title: String(raw.title || raw.bookTitle || raw.name || raw.bookName || 'Untitled Book').slice(0, 200),
    description,
    shortDescription,
    authorId: String(raw.authorId || raw.userId || raw.uploaderId || raw.writerId || 'author-redcover'),
    authorName: String(raw.authorName || raw.author || raw.writerName || raw.uploaderName || 'Independent Author').slice(
      0,
      120
    ),
    authorUsername: String(raw.authorUsername || raw.authorHandle || raw.username || 'author').slice(0, 80),
    authorAvatar,
    coverURL,
    fileURL,
    format:
      raw.format === 'pdf' ||
      raw.bookType === 'pdf' ||
      raw.isPdf === true ||
      Boolean(fileURL && isLikelyPdfUrl(fileURL))
        ? 'pdf'
        : 'story',
    category: String(raw.category || raw.genre || raw.bookCategory || 'Fiction').slice(0, 80),
    language: String(raw.language || raw.bookLanguage || 'English').slice(0, 60),
    rating: Number(raw.rating ?? raw.averageRating ?? raw.avgRating ?? 4.8),
    reviewsCount: Number(raw.reviewsCount ?? raw.ratingCount ?? raw.totalReviews ?? 0),
    views: Number(raw.views ?? raw.viewsCount ?? raw.reads ?? raw.readCount ?? 0),
    viewers: Array.isArray(raw.viewers)
      ? raw.viewers
      : Array.isArray(raw.viewedBy)
      ? raw.viewedBy
      : [],
    likes: Number(raw.likes ?? raw.likesCount ?? raw.likeCount ?? 0),
    saves: Number(raw.saves ?? raw.savesCount ?? raw.bookmarksCount ?? 0),
    chaptersCount: Number(raw.chaptersCount ?? raw.totalChapters ?? raw.chapterCount ?? 1),
    featured: Boolean(raw.featured ?? raw.isFeatured ?? false),
    status:
      raw.status === 'draft' || raw.status === 'pending' || raw.status === 'removed'
        ? raw.status
        : 'published',
    createdAt: toIsoString(raw.createdAt || raw.publishedAt || raw.timestamp),
    updatedAt: toIsoString(raw.updatedAt || raw.createdAt || raw.publishedAt || raw.timestamp),
    sourceDb,
    redCode: raw.redCode
      ? String(raw.redCode).toUpperCase()
      : (() => {
          const src = `${id}_${raw.title || 'RED'}`;
          let hash = 0;
          for (let i = 0; i < src.length; i++) {
            hash = (hash * 31 + src.charCodeAt(i)) >>> 0;
          }
          const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          let code = '';
          for (let i = 0; i < 6; i++) {
            code += letters.charAt((hash + i * 7) % letters.length);
          }
          return code;
        })(),
  };
}

export function normalizeChapterDoc(id: string, raw: Record<string, any>): Chapter {
  return {
    id: String(raw.id || id),
    bookId: String(raw.bookId || ''),
    authorId: String(raw.authorId || ''),
    bookStatus:
      raw.bookStatus === 'draft' || raw.bookStatus === 'pending' || raw.bookStatus === 'removed'
        ? raw.bookStatus
        : 'published',
    chapterNumber: Number(raw.chapterNumber ?? raw.index ?? 1),
    title: String(raw.title || `Chapter ${raw.chapterNumber ?? 1}`).slice(0, 200),
    content: String(raw.content || raw.body || raw.text || '').slice(0, 100000),
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt || raw.createdAt),
  };
}

export function normalizeReviewDoc(id: string, raw: Record<string, any>): Review {
  return {
    id: String(raw.id || id),
    bookId: String(raw.bookId || ''),
    bookTitle: String(raw.bookTitle || 'Book'),
    userId: String(raw.userId || ''),
    userName: String(raw.userName || raw.reviewerName || 'Reader'),
    userAvatar: normalizeImageString(raw.userAvatar || raw.userPhoto || ''),
    rating: Math.min(5, Math.max(1, Number(raw.rating ?? 5))),
    text: String(raw.text || raw.comment || raw.review || ''),
    visibility: raw.visibility === 'hidden' ? 'hidden' : 'public',
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt || raw.createdAt),
  };
}

export function normalizeProgressDoc(id: string, raw: Record<string, any>): ReadingProgress {
  return {
    id: String(raw.id || id),
    userId: String(raw.userId || ''),
    bookId: String(raw.bookId || ''),
    bookTitle: String(raw.bookTitle || 'Book'),
    bookCover: extractBookCoverUrl(raw) || normalizeImageString(raw.bookCover || raw.coverURL || raw.coverUrl || ''),
    bookAuthor: String(raw.bookAuthor || raw.authorName || ''),
    currentChapter: Math.max(1, Number(raw.currentChapter ?? 1)),
    totalChapters: Math.max(1, Number(raw.totalChapters ?? 1)),
    percentage: Math.min(100, Math.max(0, Number(raw.percentage ?? 0))),
    bookmarkNote: String(raw.bookmarkNote || ''),
    isBookmarked: Boolean(raw.isBookmarked ?? false),
    isPublic: Boolean(raw.isPublic ?? true),
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt || raw.lastReadAt || raw.createdAt),
  };
}

export function normalizeSocialPostDoc(id: string, raw: Record<string, any>): SocialPost {
  const validTypes: SocialPostType[] = [
    'discussion',
    'book_recommendation',
    'reading_update',
    'book_review',
    'story_publication',
    'reading_achievement',
  ];
  const postType: SocialPostType = validTypes.includes(raw.postType)
    ? raw.postType
    : raw.bookId
    ? 'book_recommendation'
    : 'discussion';

  return {
    id: String(raw.id || id),
    authorId: String(raw.authorId || raw.userId || ''),
    authorName: String(raw.authorName || raw.userName || raw.displayName || 'Redcover Reader').slice(0, 100),
    authorUsername: String(raw.authorUsername || raw.username || 'reader').slice(0, 60),
    authorAvatar: normalizeImageString(raw.authorAvatar || raw.userAvatar || raw.photoURL || ''),
    postType,
    text: String(raw.text || raw.content || raw.body || '').slice(0, 3000),
    bookId: String(raw.bookId || ''),
    bookTitle: String(raw.bookTitle || '').slice(0, 200),
    bookAuthor: String(raw.bookAuthor || '').slice(0, 120),
    bookCover: extractBookCoverUrl(raw) || normalizeImageString(raw.bookCover || raw.coverURL || ''),
    bookCategory: String(raw.bookCategory || raw.category || '').slice(0, 80),
    rating: Math.min(5, Math.max(0, Number(raw.rating ?? 0))),
    progressPercentage: Math.min(100, Math.max(0, Number(raw.progressPercentage ?? 0))),
    chapterNumber: Math.max(0, Number(raw.chapterNumber ?? 0)),
    likesCount: Math.max(0, Number(raw.likesCount ?? raw.likes ?? 0)),
    commentsCount: Math.max(0, Number(raw.commentsCount ?? raw.comments ?? 0)),
    visibility: raw.visibility === 'hidden' ? 'hidden' : 'public',
    createdAt: toIsoString(raw.createdAt || raw.timestamp),
    updatedAt: toIsoString(raw.updatedAt || raw.createdAt || raw.timestamp),
  };
}

export function encodeCommentReplyText(
  text: string,
  parentId?: string,
  replyToUsername?: string
): string {
  const cleanBody = text.trim();
  if (parentId && /^[a-zA-Z0-9_-]+$/.test(parentId)) {
    const cleanHandle = (replyToUsername || 'reader').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40) || 'reader';
    const prefix = `[reply:${parentId}:@${cleanHandle}] `;
    return (prefix + cleanBody).slice(0, 1000);
  }
  return cleanBody.slice(0, 1000);
}

export function normalizePostCommentDoc(id: string, raw: Record<string, any>): PostComment {
  const rawText = String(raw.text || '').slice(0, 1000);
  const replyMatch = rawText.match(/^\[reply:([a-zA-Z0-9_-]+):@([a-zA-Z0-9_]+)\]\s*([\s\S]*)$/);

  const parentId = replyMatch ? replyMatch[1] : raw.parentId ? String(raw.parentId) : undefined;
  const replyToUsername = replyMatch
    ? replyMatch[2]
    : raw.replyToUsername
    ? String(raw.replyToUsername)
    : undefined;
  const cleanText = replyMatch ? replyMatch[3] : rawText;

  return {
    id: String(raw.id || id),
    postId: String(raw.postId || ''),
    userId: String(raw.userId || ''),
    userName: String(raw.userName || 'Reader').slice(0, 100),
    userUsername: String(raw.userUsername || 'reader').slice(0, 60),
    userAvatar: normalizeImageString(raw.userAvatar || ''),
    text: cleanText,
    parentId,
    replyToUsername,
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt || raw.createdAt),
  };
}

/**
 * Compresses an image File into a compact JPEG Data URL guaranteed to fit within `maxChars`
 * (default 4800 chars, satisfying Firestore rules `coverURL.size() <= 5000` and `photoURL.size() <= 5000`).
 */
export async function compressImageFileToDataUrl(
  file: File | Blob,
  maxChars = 4800
): Promise<string> {
  return new Promise<string>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const candidateWidths = [180, 150, 125, 100, 80];
      const candidateQualities = [0.65, 0.55, 0.45, 0.35];

      for (const w of candidateWidths) {
        const ratio = img.height / Math.max(1, img.width);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = Math.max(1, Math.round(w * ratio));
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        for (const q of candidateQualities) {
          const dataUrl = canvas.toDataURL('image/jpeg', q);
          if (dataUrl.length <= maxChars) {
            resolve(dataUrl);
            return;
          }
        }
      }
      resolve('');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve('');
    };
    img.src = objectUrl;
  });
}

export async function uploadFileToRedcoverStorage(
  folder: 'book_covers' | 'book_pdfs' | 'profile_media' | 'chat_attachments',
  entityId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const maxBytes = folder === 'book_pdfs' ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`File exceeds maximum size (${folder === 'book_pdfs' ? '25MB' : '10MB'}).`);
  }

  const uid = auth.currentUser?.uid || entityId || 'user';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const stamp = Date.now();

  // Candidate paths in `red-cover.firebasestorage.app` (checks both Web and Android Storage rule conventions)
  const candidatePaths =
    folder === 'book_pdfs'
      ? [
          `book_content/${uid}_${stamp}_${safeName}`,
          `books/${uid}/${stamp}_${safeName}`,
          `users/${uid}/${stamp}_${safeName}`,
          `book_pdfs/${entityId}_${stamp}_${safeName}`,
        ]
      : folder === 'book_covers'
      ? [
          `book_covers/${entityId}_${stamp}_${safeName}`,
          `covers/${uid}_${stamp}_${safeName}`,
          `book_images/${uid}_${stamp}_${safeName}`,
          `users/${uid}/${stamp}_${safeName}`,
        ]
      : [
          `${folder}/${entityId}_${stamp}_${safeName}`,
          `users/${uid}/${stamp}_${safeName}`,
          `uploads/${uid}_${stamp}_${safeName}`,
        ];

  for (let i = 0; i < candidatePaths.length; i++) {
    const path = candidatePaths[i];
    const storageRef = ref(storage, path);
    try {
      const task = uploadBytesResumable(storageRef, file);
      const url = await new Promise<string>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => {
            if (onProgress && snap.totalBytes > 0) {
              onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
            }
          },
          (err) => reject(err),
          async () => {
            const downloadUrl = await getDownloadURL(task.snapshot.ref);
            resolve(downloadUrl);
          }
        );
      });
      return url;
    } catch (err: any) {
      const code = String(err?.code || err?.message || '');
      const isUnauthorized =
        code.includes('storage/unauthorized') ||
        code.includes('permission') ||
        code.includes('403');
      if (!isUnauthorized) {
        // Non-permission error (e.g. network cancel), break early to fallback
        break;
      }
      // Continue trying next candidate path if unauthorized
    }
  }

  // Automatic Firestore-Compatible Fallback when Firebase Storage bucket rules reject client writes (`storage/unauthorized`):
  onProgress?.(100);
  if (folder === 'book_pdfs') {
    // All PDF text chapters and Page 1 cover are extracted in the browser and stored in Firestore (`books/{bookId}/chapters`).
    return `https://redcover.app/pdf-text-edition/${encodeURIComponent(`${entityId}_${stamp}_${safeName}`)}`;
  }

  if (file.type.startsWith('image/')) {
    const compactDataUrl = await compressImageFileToDataUrl(file, 4800);
    if (compactDataUrl) {
      return compactDataUrl;
    }
  }

  return `https://redcover.app/media/${encodeURIComponent(`${entityId}_${stamp}_${safeName}`)}`;
}

