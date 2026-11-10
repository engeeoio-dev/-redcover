import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  FileText,
  Upload,
  Plus,
  Trash2,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Eye,
  Edit3,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Quote,
  Minus,
  Sparkles,
  Users,
  Globe,
  Maximize2,
  Minimize2,
  Search,
  Copy,
  Download,
  Sun,
  Moon,
  ChevronLeft,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Scissors,
  LayoutGrid,
  Settings,
  Layers,
  X,
  Headphones,
} from 'lucide-react';
import { useRedcover } from '../contexts/RedcoverContext';
import { Book, BookFormat, BookReadingMode, REDCOVER_CATEGORIES } from '../models/types';
import { uploadFileToRedcoverStorage } from '../services/firebase/storageService';
import { extractPdfTextAndCoverFromFile } from '../services/pdf/pdfExtractor';
import { ImageCropModal } from '../components/common/ImageCropModal';
import { BookCover } from '../components/common/UIPrimitives';

interface EditableChapter {
  id?: string;
  chapterNumber: number;
  title: string;
  content: string;
  notes?: string;
  status?: 'draft' | 'revised' | 'final';
}

interface CharacterNote {
  id: string;
  name: string;
  role: string;
  traits: string;
}

interface WorldNote {
  id: string;
  title: string;
  category: string;
  details: string;
}

interface MediaAsset {
  id: string;
  url: string;
  name: string;
  caption: string;
  createdAt: string;
}

type StudioScreen =
  | 'overview'
  | 'details'
  | 'chapters'
  | 'editor'
  | 'bible'
  | 'media'
  | 'preview'
  | 'publishing';

type DashboardTab = 'all' | 'drafts' | 'published' | 'new' | 'upload';
type EditorPaper = 'light' | 'sepia' | 'dark';

const STUDIO_CATEGORIES = REDCOVER_CATEGORIES.filter((c) => c !== 'All');

export const CreateBookPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const editBookIdFromUrl = searchParams.get('edit') || undefined;
  const navigate = useNavigate();
  const {
    currentUser,
    books,
    getBookChapters,
    publishOrSaveBook,
    deleteBook,
    addToast,
    theme,
  } = useRedcover();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Studio Mode: either on Main Create Dashboard or inside a Book Workspace
  const [workspaceOpen, setWorkspaceOpen] = useState<boolean>(Boolean(editBookIdFromUrl));
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('all');

  // Active Book Workspace Screen (8 dedicated screens)
  const [activeScreen, setActiveScreen] = useState<StudioScreen>('editor');

  // Book Metadata State
  const [activeBookId, setActiveBookId] = useState<string | undefined>(editBookIdFromUrl);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(STUDIO_CATEGORIES[0] || 'Fiction');
  const [format, setFormat] = useState<BookFormat>('story');
  const [availableModes, setAvailableModes] = useState<BookReadingMode[]>(['text', 'audio']);
  const [language, setLanguage] = useState('English');
  const [coverURL, setCoverURL] = useState('');
  const [fileURL, setFileURL] = useState('');
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [wordCountGoal, setWordCountGoal] = useState<number>(15000);

  // Upload & PDF Extraction States
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [pdfExtractStage, setPdfExtractStage] = useState('');
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfExtractedSummary, setPdfExtractedSummary] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaProgress, setMediaProgress] = useState(0);

  // Chapters State
  const [chapters, setChapters] = useState<EditableChapter[]>([
    {
      chapterNumber: 1,
      title: 'Chapter 1: The Beginning',
      content: '',
      notes: '',
      status: 'draft',
    },
  ]);
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);

  // Undo / Redo History per chapter
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Story Bible & Media Library State
  const [characters, setCharacters] = useState<CharacterNote[]>([
    { id: 'c1', name: 'Protagonist', role: 'Lead', traits: 'Core motivation, flaw, and arc...' },
  ]);
  const [worldNotes, setWorldNotes] = useState<WorldNote[]>([
    { id: 'w1', title: 'Primary Setting', category: 'Location', details: 'Atmosphere, rules, and timeline...' },
  ]);
  const [mediaLibrary, setMediaLibrary] = useState<MediaAsset[]>([]);

  // Image Insertion Popover Controls
  const [imageInsertOpen, setImageInsertOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [selectedImageSize, setSelectedImageSize] = useState<'sm' | 'md' | 'lg' | 'full'>('md');
  const [selectedImageAlign, setSelectedImageAlign] = useState<'left' | 'center' | 'right'>('center');
  const [selectedImageCaption, setSelectedImageCaption] = useState('');

  // Editor Preferences & Tools
  const [zenMode, setZenMode] = useState(false);
  const [mobileChaptersOpen, setMobileChaptersOpen] = useState(false);
  const [editorPaper, setEditorPaper] = useState<EditorPaper>(
    theme === 'dark' ? 'dark' : 'light'
  );
  const [editorFontSize, setEditorFontSize] = useState<number>(17);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  useEffect(() => {
    setEditorPaper(theme === 'dark' ? 'dark' : 'light');
  }, [theme]);

  // Status States
  const [loadingBook, setLoadingBook] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filter current user's books
  const myBooks = useMemo(() => {
    if (!currentUser) return [];
    return books
      .filter((b) => b.authorId === currentUser.uid)
      .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
  }, [books, currentUser]);

  // Sync URL query param `?edit=bookId` with workspace state
  useEffect(() => {
    if (editBookIdFromUrl) {
      setActiveBookId(editBookIdFromUrl);
      setWorkspaceOpen(true);
    }
  }, [editBookIdFromUrl]);

  // Load local Story Bible & Media Library from localStorage
  useEffect(() => {
    const storageKey = `redcover_studio_meta_${activeBookId || 'new'}_${currentUser?.uid || 'anon'}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.characters)) setCharacters(parsed.characters);
        if (Array.isArray(parsed.worldNotes)) setWorldNotes(parsed.worldNotes);
        if (Array.isArray(parsed.mediaLibrary)) setMediaLibrary(parsed.mediaLibrary);
        if (typeof parsed.subtitle === 'string') setSubtitle(parsed.subtitle);
        if (typeof parsed.wordCountGoal === 'number') setWordCountGoal(parsed.wordCountGoal);
      } catch {
        // Ignore parse error
      }
    }
  }, [activeBookId, currentUser]);

  // Persist local Story Bible & Media Library
  useEffect(() => {
    if (!currentUser) return;
    const storageKey = `redcover_studio_meta_${activeBookId || 'new'}_${currentUser.uid}`;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        characters,
        worldNotes,
        mediaLibrary,
        subtitle,
        wordCountGoal,
      })
    );
  }, [characters, worldNotes, mediaLibrary, subtitle, wordCountGoal, activeBookId, currentUser]);

  // Load existing book if editing
  useEffect(() => {
    if (!activeBookId) return;
    const found = books.find((b) => b.id === activeBookId);
    if (!found) return;

    setTitle(found.title || '');
    setSubtitle(found.shortDescription || '');
    setDescription(found.description || '');
    setCategory(found.category || STUDIO_CATEGORIES[0] || 'Fiction');
    setFormat(found.format || 'story');
    setAvailableModes(
      found.availableModes || (found.format === 'pdf' ? ['pdf', 'text', 'audio'] : ['text', 'audio'])
    );
    setLanguage(found.language || 'English');
    setCoverURL(found.coverURL || '');
    setFileURL(found.fileURL || '');

    if (found.coverURL) {
      setMediaLibrary((prev) =>
        prev.some((m) => m.url === found.coverURL)
          ? prev
          : [
              {
                id: 'cover-asset',
                url: found.coverURL,
                name: 'Book Cover',
                caption: found.title,
                createdAt: found.createdAt || new Date().toISOString(),
              },
              ...prev,
            ]
      );
    }

    let cancelled = false;
    setLoadingBook(true);
    getBookChapters(found.id)
      .then((loaded) => {
        if (cancelled) return;
        if (loaded.length > 0) {
          setChapters(
            loaded.map((c) => ({
              id: c.id,
              chapterNumber: c.chapterNumber,
              title: c.title,
              content: c.content,
              notes: '',
              status: 'draft' as const,
            }))
          );
          setActiveChapterIdx(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBook(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeBookId, books, getBookChapters]);

  // Open an existing book in the studio workspace
  const openBookInStudio = (book: Book, initialScreen: StudioScreen = 'overview') => {
    setActiveBookId(book.id);
    setWorkspaceOpen(true);
    setActiveScreen(initialScreen);
    setSearchParams({ edit: book.id });
  };

  // Start a brand new book in the studio workspace or Upload Book flow
  const resetBookForm = (initialFormat: BookFormat = 'story') => {
    setActiveBookId(undefined);
    setTitle('');
    setSubtitle('');
    setDescription('');
    setCategory(STUDIO_CATEGORIES[0] || 'Fiction');
    setFormat(initialFormat);
    setAvailableModes(initialFormat === 'pdf' ? [] : ['text', 'audio']);
    setLanguage('English');
    setCoverURL('');
    setFileURL('');
    setPdfPageCount(0);
    setPdfFileName('');
    setPdfExtractedSummary('');
    setPdfExtractStage('');
    setChapters([
      {
        chapterNumber: 1,
        title: 'Chapter 1: The Beginning',
        content: '',
        notes: '',
        status: 'draft',
      },
    ]);
    setActiveChapterIdx(0);
    setError('');
    setSuccessMsg('');
  };

  const startNewBookInStudio = (initialFormat: BookFormat = 'story') => {
    resetBookForm(initialFormat);
    if (initialFormat === 'pdf') setAvailableModes(['pdf', 'text', 'audio']);
    setWorkspaceOpen(true);
    setActiveScreen(initialFormat === 'pdf' ? 'details' : 'editor');
    setSearchParams({});
  };

  const openUploadBookTab = () => {
    resetBookForm('pdf');
    setAvailableModes([]);
    setWorkspaceOpen(false);
    setDashboardTab('upload');
    setSearchParams({});
  };

  const openCreateBookTab = () => {
    resetBookForm('story');
    setAvailableModes(['text', 'audio']);
    setWorkspaceOpen(false);
    setDashboardTab('new');
    setSearchParams({});
  };

  // Cover Upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentUser) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file for the cover.');
      return;
    }

    setCoverCropFile(file);
  };

  const handleCroppedCoverUpload = async (file: File) => {
    if (!currentUser) return;
    setUploadingCover(true);
    setCoverProgress(0);
    setError('');
    try {
      const targetKey = activeBookId || currentUser.uid;
      const url = await uploadFileToRedcoverStorage('book_covers', targetKey, file, setCoverProgress);
      setCoverURL(url);
      setMediaLibrary((prev) => [
        {
          id: `media-${Date.now()}`,
          url,
          name: file.name,
          caption: 'Book Cover',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      addToast('Cover uploaded to Firebase Storage.', 'success');
      setCoverCropFile(null);
    } catch (err: any) {
      setError(err?.message || 'Cover upload failed.');
      throw new Error(err?.message || 'Cover upload failed.');
    } finally {
      setUploadingCover(false);
    }
  };

  const coverCropDialog = coverCropFile ? (
    <ImageCropModal
      file={coverCropFile}
      kind="book-cover"
      onCancel={() => setCoverCropFile(null)}
      onSave={handleCroppedCoverUpload}
    />
  ) : null;

  // PDF Upload + Automatic PDF-to-Text & Page-1 Cover Extraction
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentUser) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a valid PDF document.');
      return;
    }
    if (availableModes.length === 0) {
      setError('Choose at least one book format before selecting the PDF.');
      return;
    }

    const wantsPdf = availableModes.includes('pdf');
    const wantsText = availableModes.includes('text') || availableModes.includes('audio');
    setFormat(wantsPdf ? 'pdf' : 'story');
    setPdfFileName(file.name);
    setUploadingPdf(true);
    setExtractingPdf(true);
    setPdfProgress(0);
    setError('');

    try {
      const targetKey = activeBookId || currentUser.uid;

      // 1. Extract text chapters & Page 1 cover from the PDF in parallel with Storage upload
      const extractionPromise = extractPdfTextAndCoverFromFile(file, (stage) => {
        setPdfExtractStage(stage);
      });
      const uploadPromise = wantsPdf
        ? uploadFileToRedcoverStorage('book_pdfs', targetKey, file, setPdfProgress)
        : Promise.resolve('');

      const [extracted, uploadedPdfUrl] = await Promise.all([extractionPromise, uploadPromise]);

      setFileURL(uploadedPdfUrl);
      setPdfPageCount(extracted.numPages);
      setPdfExtractedSummary(wantsText ? extracted.summaryPreview : '');

      if (!title.trim() && extracted.title) {
        setTitle(extracted.title);
      }
      if (!description.trim() && extracted.summaryPreview) {
        setDescription(extracted.summaryPreview);
      }
      if (!subtitle.trim() && extracted.subject) {
        setSubtitle(extracted.subject.slice(0, 140));
      }

      if (wantsText && extracted.chapters.length > 0) {
        setChapters(
          extracted.chapters.map((ch) => ({
            chapterNumber: ch.chapterNumber,
            title: ch.title,
            content: ch.content,
            notes: `Extracted from PDF Pages ${ch.pageStart}–${ch.pageEnd}`,
            status: 'final' as const,
          }))
        );
        setActiveChapterIdx(0);
      } else {
        setChapters([]);
        setActiveChapterIdx(0);
      }

      // If the user has not uploaded a custom cover yet, automatically use Page 1 of the PDF as the book cover!
      if (!coverURL) {
        if (
          uploadedPdfUrl.startsWith('https://redcover.app/pdf-text-edition/') &&
          extracted.coverDataUrl
        ) {
          setCoverURL(extracted.coverDataUrl);
        } else if (extracted.coverBlob) {
          try {
            setUploadingCover(true);
            const coverFile = new File(
              [extracted.coverBlob],
              `${file.name.replace(/\.pdf$/i, '')}_cover.jpg`,
              { type: 'image/jpeg' }
            );
            const autoCoverUrl = await uploadFileToRedcoverStorage(
              'book_covers',
              targetKey,
              coverFile,
              setCoverProgress
            );
            setCoverURL(autoCoverUrl || extracted.coverDataUrl);
          } catch {
            if (extracted.coverDataUrl) {
              setCoverURL(extracted.coverDataUrl);
            }
          } finally {
            setUploadingCover(false);
          }
        }
      }

      const selectedFormatLabels = availableModes
        .map((mode) => ({ pdf: 'original PDF', text: 'text', audio: 'audio narration' })[mode])
        .join(', ');
      addToast(
        wantsText
          ? `PDF processed for ${selectedFormatLabels}: ${extracted.chapters.length} text chapters.`
          : `Original PDF ready for publishing (${extracted.numPages} pages).`,
        'success'
      );
    } catch (err: any) {
      setError(err?.message || 'PDF upload or text extraction failed.');
    } finally {
      setUploadingPdf(false);
      setExtractingPdf(false);
    }
  };

  // Media Library / Manuscript Image Upload to Firebase Storage
  const handleManuscriptImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    autoSelectForInsert = true
  ) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    setUploadingMedia(true);
    setMediaProgress(0);
    setError('');
    try {
      const targetKey = activeBookId || currentUser.uid;
      const url = await uploadFileToRedcoverStorage('book_covers', targetKey, file, setMediaProgress);
      const newAsset: MediaAsset = {
        id: `img-${Date.now()}`,
        url,
        name: file.name,
        caption: '',
        createdAt: new Date().toISOString(),
      };
      setMediaLibrary((prev) => [newAsset, ...prev]);
      if (autoSelectForInsert) {
        setSelectedImageUrl(url);
        setImageInsertOpen(true);
      }
      addToast('Image uploaded to Media Library.', 'success');
    } catch (err: any) {
      setError(err?.message || 'Image upload failed.');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Chapter Management
  const handleAddChapter = () => {
    const nextNum = chapters.length + 1;
    const nextChapters: EditableChapter[] = [
      ...chapters,
      {
        chapterNumber: nextNum,
        title: `Chapter ${nextNum}: Untitled`,
        content: '',
        notes: '',
        status: 'draft',
      },
    ];
    setChapters(nextChapters);
    setActiveChapterIdx(nextChapters.length - 1);
  };

  const handleDuplicateChapter = (index: number) => {
    const source = chapters[index];
    if (!source) return;
    const copy: EditableChapter = {
      chapterNumber: chapters.length + 1,
      title: `${source.title} (Copy)`,
      content: source.content,
      notes: source.notes || '',
      status: 'draft',
    };
    const next = [...chapters];
    next.splice(index + 1, 0, copy);
    const reindexed = next.map((c, i) => ({ ...c, chapterNumber: i + 1 }));
    setChapters(reindexed);
    setActiveChapterIdx(index + 1);
  };

  const handleRemoveChapter = (index: number) => {
    if (chapters.length <= 1) return;
    const filtered = chapters
      .filter((_, i) => i !== index)
      .map((ch, idx) => ({ ...ch, chapterNumber: idx + 1 }));
    setChapters(filtered);
    setActiveChapterIdx((prev) => Math.max(0, Math.min(prev, filtered.length - 1)));
  };

  const handleMoveChapter = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= chapters.length) return;
    const copy = [...chapters];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    const reindexed = copy.map((ch, idx) => ({ ...ch, chapterNumber: idx + 1 }));
    setChapters(reindexed);
    setActiveChapterIdx(targetIdx);
  };

  const handleChapterChange = (
    index: number,
    field: 'title' | 'content' | 'notes' | 'status',
    value: string
  ) => {
    if (field === 'content') {
      const currentContent = chapters[index]?.content || '';
      setHistoryStack((prev) => [...prev.slice(-29), currentContent]);
      setRedoStack([]);
    }
    setChapters((prev) =>
      prev.map((ch, idx) => (idx === index ? { ...ch, [field]: value } : ch))
    );
  };

  // Undo & Redo
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    const current = chapters[activeChapterIdx]?.content || '';
    setRedoStack((prev) => [current, ...prev]);
    setHistoryStack((prev) => prev.slice(0, -1));
    setChapters((prev) =>
      prev.map((ch, idx) => (idx === activeChapterIdx ? { ...ch, content: previous } : ch))
    );
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextVal = redoStack[0];
    const current = chapters[activeChapterIdx]?.content || '';
    setHistoryStack((prev) => [...prev, current]);
    setRedoStack((prev) => prev.slice(1));
    setChapters((prev) =>
      prev.map((ch, idx) => (idx === activeChapterIdx ? { ...ch, content: nextVal } : ch))
    );
  };

  // Rich Text Formatting Helpers
  const applyFormatting = (
    type:
      | 'bold'
      | 'italic'
      | 'h1'
      | 'h2'
      | 'quote'
      | 'divider'
      | 'pagebreak'
      | 'dialogue'
  ) => {
    const textarea = textareaRef.current;
    const currentChapter = chapters[activeChapterIdx];
    if (!textarea || !currentChapter) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = currentChapter.content;
    const selected = text.substring(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch (type) {
      case 'bold':
        replacement = `**${selected || 'bold text'}**`;
        cursorOffset = selected ? replacement.length : 2;
        break;
      case 'italic':
        replacement = `*${selected || 'italic text'}*`;
        cursorOffset = selected ? replacement.length : 1;
        break;
      case 'h1':
        replacement = `\n# ${selected || 'Section Heading'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'h2':
        replacement = `\n## ${selected || 'Subheading'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'quote':
        replacement = `\n> ${selected || 'Quoted passage or epigraph...'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'divider':
        replacement = `\n\n─── ❖ ───\n\n`;
        cursorOffset = replacement.length;
        break;
      case 'pagebreak':
        replacement = `\n\n=== PAGE BREAK ===\n\n`;
        cursorOffset = replacement.length;
        break;
      case 'dialogue':
        replacement = `\n“${selected || 'Speak here,'}” `;
        cursorOffset = replacement.length;
        break;
    }

    const updated = text.substring(0, start) + replacement + text.substring(end);
    handleChapterChange(activeChapterIdx, 'content', updated);

    setTimeout(() => {
      textarea.focus();
      const pos = start + cursorOffset;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  // Insert Image at Cursor in Manuscript Editor
  const handleInsertImageAtCursor = () => {
    if (!selectedImageUrl.trim()) return;
    const textarea = textareaRef.current;
    const currentChapter = chapters[activeChapterIdx];
    if (!currentChapter) return;

    const cleanCaption = selectedImageCaption.replace(/\|/g, ' ').trim();
    const imageBlock = `\n\n[image:${selectedImageUrl.trim()}|${selectedImageSize}|${selectedImageAlign}|${cleanCaption}]\n\n`;

    const text = currentChapter.content || '';
    const start = textarea ? textarea.selectionStart : text.length;
    const end = textarea ? textarea.selectionEnd : text.length;
    const updated = text.substring(0, start) + imageBlock + text.substring(end);

    handleChapterChange(activeChapterIdx, 'content', updated);
    setImageInsertOpen(false);
    setSelectedImageCaption('');
    setActiveScreen('editor');
  };

  // Update inline image size or alignment directly from manuscript image cards
  const updateInlineImageToken = (
    rawToken: string,
    newSize: 'sm' | 'md' | 'lg' | 'full',
    newAlign: 'left' | 'center' | 'right',
    newCaption: string
  ) => {
    const currentChapter = chapters[activeChapterIdx];
    if (!currentChapter) return;
    const inner = rawToken.slice(7, -1);
    const [imgUrl = ''] = inner.split('|');
    const replacement = `[image:${imgUrl}|${newSize}|${newAlign}|${newCaption.replace(/\|/g, ' ')}]`;
    const updated = currentChapter.content.replace(rawToken, replacement);
    handleChapterChange(activeChapterIdx, 'content', updated);
  };

  const removeInlineImageToken = (rawToken: string) => {
    const currentChapter = chapters[activeChapterIdx];
    if (!currentChapter) return;
    const updated = currentChapter.content.replace(rawToken, '').replace(/\n{3,}/g, '\n\n');
    handleChapterChange(activeChapterIdx, 'content', updated);
  };

  // Find and Replace in current chapter
  const handleReplaceInChapter = () => {
    if (!findQuery.trim()) return;
    const currentChapter = chapters[activeChapterIdx];
    if (!currentChapter) return;
    const updated = currentChapter.content.split(findQuery).join(replaceQuery);
    handleChapterChange(activeChapterIdx, 'content', updated);
    setSuccessMsg(`Replaced occurrences of "${findQuery}".`);
  };

  // Export Manuscript as Markdown
  const handleExportManuscript = () => {
    const fullText = [
      `# ${title || 'Untitled Book'}`,
      subtitle ? `_${subtitle}_` : '',
      `By ${currentUser?.displayName || 'Author'}`,
      description ? `\n> ${description}\n` : '',
      ...chapters.map(
        (ch) => `\n\n## Chapter ${ch.chapterNumber}: ${ch.title}\n\n${ch.content}`
      ),
    ]
      .filter(Boolean)
      .join('\n');

    const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'manuscript').toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Word Counts & Analytics
  const chapterWordCounts = useMemo(() => {
    return chapters.map((ch) =>
      ch.content.trim() ? ch.content.trim().split(/\s+/).length : 0
    );
  }, [chapters]);

  const totalWordCount = useMemo(
    () => chapterWordCounts.reduce((acc, n) => acc + n, 0),
    [chapterWordCounts]
  );

  const activeChapterWords = chapterWordCounts[activeChapterIdx] || 0;
  const activeReadingMinutes = Math.max(1, Math.ceil(activeChapterWords / 200));

  // Extract inline images in active chapter for quick visual management
  const activeChapterImages = useMemo(() => {
    const content = chapters[activeChapterIdx]?.content || '';
    const matches = content.match(/\[image:[^\]]+\]/g) || [];
    return matches.map((token) => {
      const inner = token.slice(7, -1);
      const [url = '', size = 'md', align = 'center', caption = ''] = inner.split('|');
      return {
        token,
        url,
        size: (size as 'sm' | 'md' | 'lg' | 'full') || 'md',
        align: (align as 'left' | 'center' | 'right') || 'center',
        caption,
      };
    });
  }, [chapters, activeChapterIdx]);

  // Save Draft or Publish Book via RedcoverContext
  const handleSaveBook = async (status: 'draft' | 'published') => {
    if (!currentUser) {
      navigate('/auth');
      return;
    }
    setError('');
    setSuccessMsg('');

    const effectiveTitle = title.trim() || (status === 'draft' ? 'Untitled Manuscript' : '');
    if (!effectiveTitle) {
      const msg = 'Please enter a book title before publishing.';
      setError(msg);
      addToast(msg, 'info');
      setActiveScreen('details');
      return;
    }

    if (status === 'published') {
      if (!description.trim()) {
        const msg = 'Please write a book synopsis in Book Details before publishing.';
        setError(msg);
        addToast(msg, 'info');
        setActiveScreen('details');
        return;
      }
      if (format === 'pdf' && !fileURL) {
        const msg = 'Please upload a PDF file in Book Details before publishing.';
        setError(msg);
        addToast(msg, 'info');
        setActiveScreen('details');
        return;
      }
      if (format === 'story') {
        const hasValidChapter = chapters.some((c) => c.title.trim() && c.content.trim());
        if (!hasValidChapter) {
          const msg = 'Please write content in at least one chapter before publishing.';
          setError(msg);
          addToast(msg, 'info');
          setActiveScreen('editor');
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (!title.trim() && status === 'draft') {
        setTitle(effectiveTitle);
      }
      const includesText = availableModes.includes('text') || availableModes.includes('audio');
      const chaptersToPersist = !includesText
        ? []
        : chapters.length > 0 && chapters.some((ch) => ch.content.trim().length > 0)
          ? chapters.map((ch, idx) => ({
              id: ch.id,
              chapterNumber: idx + 1,
              title: ch.title.trim() || `Chapter ${idx + 1}`,
              content: ch.content.trim() || description.trim() || effectiveTitle,
            }))
          : [
              {
                chapterNumber: 1,
                title: effectiveTitle,
                content: description.trim() || effectiveTitle,
              },
            ];

      const savedBookId = await publishOrSaveBook(
        {
          id: activeBookId,
          title: effectiveTitle,
          description: description.trim(),
          shortDescription:
            subtitle.trim() || description.trim().slice(0, 140) || effectiveTitle,
          coverURL: coverURL.trim(),
          fileURL: format === 'pdf' ? fileURL : '',
          format,
          availableModes,
          category,
          language,
          chaptersCount: includesText ? Math.max(1, chaptersToPersist.length) : 0,
          featured: false,
          status,
        },
        chaptersToPersist
      );

      setActiveBookId(savedBookId);
      setSearchParams({ edit: savedBookId });
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedTime(timeStr);
      setSuccessMsg(
        status === 'published'
          ? 'Book published to Redcover!'
          : `Saved at ${timeStr}`
      );
      if (!workspaceOpen && status === 'published') {
        navigate(`/read/${savedBookId}`);
      }
    } catch (err: any) {
      console.error('Error saving book:', err);
      setError(err?.message || 'Failed to save your book.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBook = async (bookId: string, bookTitle: string) => {
    if (!currentUser) return;
    try {
      await deleteBook(bookId);
      if (activeBookId === bookId) {
        setWorkspaceOpen(false);
        setActiveBookId(undefined);
        setSearchParams({});
      }
      setSuccessMsg(`Deleted "${bookTitle}".`);
    } catch (err) {
      console.error('Failed to delete book:', err);
      setError('Could not delete book.');
    }
  };

  // Render formatted chapter blocks for Preview & Live Reader
  const renderFormattedBlocks = (content: string) => {
    return (content || '').split(/\n\s*\n/).map((block, i) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      if (
        trimmed === '* * *' ||
        trimmed === '***' ||
        trimmed === '---' ||
        trimmed.includes('─── ❖ ───')
      ) {
        return (
          <div
            key={i}
            className="py-4 text-center text-[#E43136] tracking-[0.4em] font-semibold select-none"
          >
            ─── ❖ ───
          </div>
        );
      }

      if (trimmed === '=== PAGE BREAK ===' || trimmed === '[pagebreak]') {
        return (
          <div
            key={i}
            className="my-6 py-2.5 border-y border-dashed border-current/20 text-center text-[11px] uppercase tracking-[0.25em] opacity-60 select-none"
          >
            Page Break
          </div>
        );
      }

      if (trimmed.startsWith('[image:') && trimmed.endsWith(']')) {
        const inner = trimmed.slice(7, -1);
        const [imgUrl = '', size = 'md', align = 'center', caption = ''] = inner.split('|');
        const sizeClass =
          size === 'sm'
            ? 'max-w-[200px]'
            : size === 'lg'
            ? 'max-w-[500px]'
            : size === 'full'
            ? 'w-full'
            : 'max-w-[340px]';
        const alignClass =
          align === 'left' ? 'mr-auto' : align === 'right' ? 'ml-auto' : 'mx-auto';

        return (
          <figure key={i} className={`my-5 ${sizeClass} ${alignClass}`}>
            <img
              src={imgUrl}
              alt={caption || 'Manuscript illustration'}
              className="w-full h-auto rounded-xl border border-current/10 object-cover shadow-sm"
            />
            {caption && (
              <figcaption className="mt-2 text-center text-xs opacity-75 italic">
                {caption}
              </figcaption>
            )}
          </figure>
        );
      }

      if (trimmed.startsWith('## ')) {
        return (
          <h4 key={i} className="font-display text-xl font-bold pt-4 pb-1">
            {trimmed.slice(3)}
          </h4>
        );
      }
      if (trimmed.startsWith('# ')) {
        return (
          <h3 key={i} className="font-display text-2xl font-bold pt-5 pb-1">
            {trimmed.slice(2)}
          </h3>
        );
      }
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote
            key={i}
            className="border-l-4 border-[#E43136] pl-4 py-1.5 italic opacity-85 bg-current/[0.03] rounded-r-lg"
          >
            {trimmed.replace(/^>\s?/, '')}
          </blockquote>
        );
      }

      return (
        <p
          key={i}
          className={`whitespace-pre-line ${
            i === 0
              ? 'first-letter:float-left first-letter:text-4xl first-letter:font-bold first-letter:pr-2.5 first-letter:leading-none first-letter:text-[#E43136]'
              : ''
          }`}
        >
          {trimmed}
        </p>
      );
    });
  };

  if (loadingBook) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#E43136] border-t-transparent animate-spin" />
      </div>
    );
  }

  const currentChapter = chapters[activeChapterIdx] || chapters[0];

  const paperClasses =
    editorPaper === 'dark'
      ? 'bg-black text-[#F5F5F7] border-[#22222A]'
      : editorPaper === 'sepia'
      ? 'bg-[#F6EFE2] text-[#2D2419] border-[#DFD2B8]'
      : 'bg-white dark:bg-[#0A0A0D] text-[#202020] dark:text-[#F5F5F7] border-[#DDDDE3] dark:border-[#22222A]';

  const filteredDashboardBooks = myBooks.filter((b) => {
    if (dashboardTab === 'drafts') return b.status === 'draft';
    if (dashboardTab === 'published') return b.status === 'published';
    return true;
  });

  // ============================================================================
  // VIEW 1: MAIN CREATE DASHBOARD (WHEN NO BOOK WORKSPACE IS OPEN)
  // ============================================================================
  if (!workspaceOpen) {
    return (
      <div className="flex-1 min-h-0 w-full max-w-[1440px] mx-auto flex flex-col overflow-hidden bg-white dark:bg-[#16161A] md:border-x border-[#DDDDE3] dark:border-[#2C2C35]">
        {/* Fixed Top Studio Header */}
        <header className="shrink-0 h-14 px-4 sm:px-6 border-b border-[#DDDDE3] dark:border-[#2C2C35] flex items-center justify-between gap-4 bg-white dark:bg-[#1E1E24]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#E43136] text-white flex items-center justify-center shrink-0">
              <Edit3 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-[#202020] dark:text-[#F4F4F6] truncate">
                Author Studio
              </h1>
              <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] truncate">
                Create or manage your books.
              </p>
            </div>
          </div>

          {/* Dashboard Navigation Tabs with 2 Explicit Creation Options: Create Book & Upload Book */}
          <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setDashboardTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                dashboardTab === 'all'
                  ? 'bg-[#202020] text-white dark:bg-white dark:text-black'
                  : 'text-[#6E6E77] dark:text-[#9E9EA8] hover:bg-[#FAFAFB] dark:hover:bg-[#26262E]'
              }`}
            >
              My Books ({myBooks.length})
            </button>
            <button
              type="button"
              onClick={() => setDashboardTab('drafts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                dashboardTab === 'drafts'
                  ? 'bg-[#202020] text-white dark:bg-white dark:text-black'
                  : 'text-[#6E6E77] dark:text-[#9E9EA8] hover:bg-[#FAFAFB] dark:hover:bg-[#26262E]'
              }`}
            >
              Drafts ({myBooks.filter((b) => b.status === 'draft').length})
            </button>
            <button
              type="button"
              onClick={() => setDashboardTab('published')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                dashboardTab === 'published'
                  ? 'bg-[#202020] text-white dark:bg-white dark:text-black'
                  : 'text-[#6E6E77] dark:text-[#9E9EA8] hover:bg-[#FAFAFB] dark:hover:bg-[#26262E]'
              }`}
            >
              Published ({myBooks.filter((b) => b.status === 'published').length})
            </button>

            <div className="h-4 w-px bg-[#DDDDE3] dark:bg-[#2C2C35] mx-1 shrink-0" />

            {/* Option 1: Create Book */}
            <button
              type="button"
              onClick={openCreateBookTab}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                dashboardTab === 'new'
                  ? 'bg-[#E43136] text-white'
                  : 'border border-[#DDDDE3] dark:border-[#2C2C35] text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-[#E43136] group-hover:text-current" />
              <span>1. Create Book</span>
            </button>

            {/* Option 2: Upload Book (PDF -> Text & Audio) */}
            <button
              type="button"
              onClick={openUploadBookTab}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                dashboardTab === 'upload'
                  ? 'bg-[#E43136] text-white'
                  : 'bg-[#FFF3F4] dark:bg-[#261417] border border-[#E43136]/40 text-[#E43136] hover:bg-[#E43136] hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>2. Upload Book</span>
            </button>
          </nav>
        </header>

        {/* Scrollable Content Panel inside Fixed Viewport */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#FAFAFB] dark:bg-[#000000]">
          {dashboardTab === 'new' ? (
            /* ================================================================ */
            /* OPTION 1: CREATE ORIGINAL BOOK (WRITE STORY)                     */
            /* ================================================================ */
            <div className="max-w-2xl mx-auto bg-white dark:bg-[#111111] rounded-2xl border border-[#DDDDE3] dark:border-[#262626] p-6 space-y-5 shadow-xs">
              <div className="flex items-start justify-between gap-4 border-b border-[#F1F1F4] dark:border-[#262626] pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#E43136]">
                    Option 1 · Original Manuscript Studio
                  </span>
                  <h2 className="text-lg font-bold text-[#202020] dark:text-[#F4F4F6] mt-0.5">
                    Create Book (Write Original Story)
                  </h2>
                  <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] mt-0.5">
                    Write chapters in our distraction-free book editor with Story Bible, formatting tools, and Multi-Voice Audio support.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openUploadBookTab}
                  className="px-3 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#262626] text-xs font-semibold hover:border-[#E43136] whitespace-nowrap cursor-pointer shrink-0"
                >
                  Switch to Upload PDF →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {/* Cover Preview & Upload */}
                <div className="flex flex-col items-center">
                  <BookCover
                    book={{
                      id: 'new-story-draft',
                      title: title || 'Your Book Title',
                      authorName: currentUser?.displayName || 'Author',
                      coverURL,
                      category,
                      format: 'story',
                    }}
                    size="md"
                    className="w-36 mb-3"
                  />
                  <label className="w-full py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#262626] hover:border-[#E43136] text-xs font-semibold text-center cursor-pointer inline-flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#E43136]" />
                    <span>{uploadingCover ? `Uploading ${coverProgress}%` : 'Upload Cover'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Story Details */}
                <div className="sm:col-span-2 space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-[#202020] dark:text-[#F4F4F6]">
                      Book Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter your book title..."
                      className="w-full py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#262626] bg-[#FAFAFB] dark:bg-[#0A0A0A] text-sm focus:outline-none focus:border-[#E43136]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-[#202020] dark:text-[#F4F4F6]">
                      Subtitle / Tagline
                    </label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="A short hook for readers..."
                      className="w-full py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#262626] bg-[#FAFAFB] dark:bg-[#0A0A0A] text-xs focus:outline-none focus:border-[#E43136]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-[#202020] dark:text-[#F4F4F6]">
                        Category / Genre *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#262626] bg-[#FAFAFB] dark:bg-[#0A0A0A] text-xs font-medium focus:outline-none focus:border-[#E43136]"
                      >
                        {STUDIO_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-[#202020] dark:text-[#F4F4F6]">
                        Language *
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#262626] bg-[#FAFAFB] dark:bg-[#0A0A0A] text-xs font-medium focus:outline-none focus:border-[#E43136]"
                      >
                        {['English', 'Hindi', 'Hinglish', 'Urdu', 'Spanish', 'French'].map((lang) => (
                          <option key={lang} value={lang}>
                            {lang}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-[#202020] dark:text-[#F4F4F6]">
                      Book Description / Synopsis
                    </label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What is your story about?"
                      className="w-full p-3 rounded-lg border border-[#DDDDE3] dark:border-[#262626] bg-[#FAFAFB] dark:bg-[#0A0A0A] text-xs focus:outline-none focus:border-[#E43136] resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F1F1F4] dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => setDashboardTab('all')}
                  className="px-4 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#262626] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormat('story');
                    setActiveBookId(undefined);
                    setWorkspaceOpen(true);
                    setActiveScreen('editor');
                  }}
                  className="px-5 py-2.5 rounded-lg bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Start Writing Chapters
                </button>
              </div>
            </div>
          ) : dashboardTab === 'upload' ? (
            /* ================================================================ */
            /* OPTION 2: UPLOAD BOOK (DIRECT PDF -> TEXT & MULTI-VOICE AUDIO)   */
            /* ================================================================ */
            <div className="max-w-4xl mx-auto bg-white dark:bg-[#111111] rounded-2xl border border-[#DDDDE3] dark:border-[#262626] p-5 sm:p-7 space-y-6 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#F1F1F4] dark:border-[#262626] pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#E43136]">
                    Option 2 · Direct PDF Book Uploader
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F4F4F6] mt-0.5">
                    Upload PDF Source & Choose Reader Formats
                  </h2>
                  <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] mt-0.5">
                    Choose the editions readers can use, then upload a PDF source to create them. You can keep the original PDF, extract text, add browser narration, or combine formats.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateBookTab}
                  className="px-3 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#262626] text-xs font-semibold hover:border-[#E43136] whitespace-nowrap cursor-pointer shrink-0"
                >
                  Switch to Write Original Story →
                </button>
              </div>

              {(error || successMsg) && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
                    error
                      ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <span>{error || successMsg}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <fieldset className="space-y-2">
                <legend className="text-xs font-bold text-[#202020] dark:text-[#F4F4F6]">
                  Choose reader formats
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    { mode: 'text', label: 'Text', detail: 'Readable chapters' },
                    { mode: 'audio', label: 'Audio', detail: 'Text-to-speech narration' },
                    { mode: 'pdf', label: 'Original PDF', detail: 'Page-by-page book reader' },
                  ] as const).map((option) => (
                    <label
                      key={option.mode}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer ${
                        availableModes.includes(option.mode)
                          ? 'border-[#E43136] bg-[#FFF3F4] dark:bg-[#2D1619]'
                          : 'border-[#DDDDE3] dark:border-[#2C2C35]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={availableModes.includes(option.mode)}
                        disabled={uploadingPdf || extractingPdf || Boolean(pdfFileName)}
                        onChange={(event) => {
                          setAvailableModes((current) =>
                            event.target.checked
                              ? [...current, option.mode]
                              : current.filter((mode) => mode !== option.mode)
                          );
                          setError('');
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#E43136]"
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold">{option.label}</span>
                        <span className="mt-0.5 block text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                          {option.detail}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                  Choose formats before uploading. Audio is browser narration of extracted text.
                </p>
              </fieldset>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Step 1 (PDF File) & Step 2 (Book Cover) */}
                <div className="lg:col-span-4 space-y-4">
                  {/* Step 1: Select PDF File */}
                  <div className="p-4 rounded-xl border-2 border-dashed border-[#E43136]/40 bg-[#FFF3F4]/40 dark:bg-[#1A1012] space-y-2.5 text-center">
                    <FileText className="w-8 h-8 text-[#E43136] mx-auto" />
                    <div>
                      <h3 className="text-xs font-bold text-[#202020] dark:text-[#F4F4F6]">
                        Step 1: Select PDF Source File *
                      </h3>
                      <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] mt-0.5">
                        {pdfFileName
                          ? `${pdfFileName} (${pdfPageCount} pages)`
                          : 'Upload any .pdf book up to 25MB'}
                      </p>
                    </div>

                    <label className="w-full py-2.5 px-4 rounded-lg bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingPdf || extractingPdf
                          ? pdfExtractStage || `Uploading ${pdfProgress}%...`
                          : pdfFileName
                          ? 'Replace PDF Source'
                          : 'Choose PDF Source'}
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={handlePdfUpload}
                        className="hidden"
                      />
                    </label>

                    {fileURL && !extractingPdf && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {availableModes.includes('text') || availableModes.includes('audio')
                            ? `Converted to ${chapters.length} Text Chapters (${totalWordCount.toLocaleString()} words)`
                            : `Original PDF ready (${pdfPageCount} pages)`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Book Cover Upload */}
                  <div className="p-4 rounded-xl border border-[#DDDDE3] dark:border-[#262626] bg-[#FAFAFB] dark:bg-[#0A0A0A] flex flex-col items-center text-center space-y-3">
                    <span className="text-xs font-bold text-[#202020] dark:text-[#F4F4F6]">
                      Step 2: Book Cover Image
                    </span>
                    <BookCover
                      book={{
                        id: activeBookId || 'upload-pdf-preview',
                        title: title || 'PDF Book Title',
                        authorName: currentUser?.displayName || 'Author',
                        coverURL,
                        category,
                        format: 'pdf',
                      }}
                      size="md"
                      className="w-36 shadow-md rounded-lg overflow-hidden"
                    />
                    <label className="w-full py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#262626] hover:border-[#E43136] bg-white dark:bg-[#141414] text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors">
                      <ImageIcon className="w-3.5 h-3.5 text-[#E43136]" />
                      <span>
                        {uploadingCover
                          ? `Uploading Cover ${coverProgress}%...`
                          : coverURL
                          ? 'Change Cover Image'
                          : 'Upload Cover Image'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8]">
                      Page 1 of your PDF is automatically captured as the cover if you don’t upload a separate image.
                    </p>
                  </div>
                </div>

                {/* Right Column: Step 3 (Complete Details & Extracted Text Preview) */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold mb-1 text-[#202020] dark:text-[#F4F4F6]">
                        Book Title *
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter complete book title..."
                        className="w-full py-2.5 px-3.5 rounded-lg border border-[#DDDDE3] dark:border-[#262626] bg-[#FAFAFB] dark:bg-[#0A0A0A] text-sm font-semibold focus:outline-none focus:border-[#E43136]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold mb-1 text-[#202020] dark:text-[#F4F4F6]">
                        Subtitle / Short Tagline
                      </label>
                      <input
                        type="text"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="Short tagline or edition note..."
                        className="w-full py-2 px-3.5 rounded-lg border border-[#DDDDE3] dark:border-[#262626] bg-[#FAFAFB] dark:bg-[#0A0A0A] text-xs focus:outline-none focus:border-[#E43136]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1 text-[#202020] dark:text-[#F4F4F6]">
                        Category / Genre *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full py-2.5 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#262626] bg-[#FAFAFB] dark:bg-[#0A0A0A] text-xs font-medium focus:outline-none focus:border-[#E43136]"
                      >
                        {STUDIO_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1 text-[#202020] dark:text-[#F4F4F6]">
                        Book Language *
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full py-2.5 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#262626] bg-[#FAFAFB] dark:bg-[#0A0A0A] text-xs font-medium focus:outline-none focus:border-[#E43136]"
                      >
                        {['English', 'Hindi', 'Hinglish', 'Urdu', 'Spanish', 'French'].map((lang) => (
                          <option key={lang} value={lang}>
                            {lang}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
                          Complete Book Description / Synopsis *
                        </label>
                        {pdfExtractedSummary && (
                          <button
                            type="button"
                            onClick={() => setDescription(pdfExtractedSummary)}
                            className="text-[11px] font-semibold text-[#E43136] hover:underline cursor-pointer"
                          >
                            Auto-Fill from PDF Text
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Write a clear description of what readers will learn or experience in this book..."
                        className="w-full p-3 rounded-lg border border-[#DDDDE3] dark:border-[#262626] bg-[#FAFAFB] dark:bg-[#0A0A0A] text-xs leading-relaxed focus:outline-none focus:border-[#E43136] resize-none"
                      />
                    </div>
                  </div>

                  {/* Extracted Text Format & Audio Preview Box */}
                  <div className="rounded-xl border border-[#DDDDE3] dark:border-[#262626] bg-[#FAFAFB] dark:bg-[#0A0A0A] p-3.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Headphones className="w-4 h-4 text-[#E43136]" />
                        <span className="text-xs font-bold text-[#202020] dark:text-[#F4F4F6]">
                          {availableModes.includes('text') || availableModes.includes('audio')
                            ? `Text & Audio Preview (${chapters.length} Sections)`
                            : `Original PDF Edition (${pdfPageCount} Pages)`}
                        </span>
                      </div>
                      {fileURL &&
                        (availableModes.includes('text') || availableModes.includes('audio')) && (
                        <button
                          type="button"
                          onClick={() => {
                            setWorkspaceOpen(true);
                            setActiveScreen('editor');
                          }}
                          className="text-[11px] font-semibold text-[#E43136] hover:underline cursor-pointer"
                        >
                          Edit Extracted Text in Studio →
                        </button>
                      )}
                    </div>

                    {chapters[0]?.content ? (
                      <div className="max-h-36 overflow-y-auto rounded-lg bg-white dark:bg-[#141414] border border-[#DDDDE3] dark:border-[#262626] p-3 text-xs text-[#202020] dark:text-[#F4F4F6] leading-relaxed whitespace-pre-line">
                        {chapters[0].content.slice(0, 700)}
                        {chapters[0].content.length > 700 ? '...' : ''}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8]">
                        {availableModes.includes('text') || availableModes.includes('audio')
                          ? 'After selecting the PDF source, extracted text and browser narration will be prepared here.'
                          : 'The original PDF will open as a page-by-page edition without creating text chapters.'}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F1F1F4] dark:border-[#262626]">
                    <button
                      type="button"
                      onClick={() => setDashboardTab('all')}
                      className="px-4 py-2.5 rounded-lg border border-[#DDDDE3] dark:border-[#262626] text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        disabled={saving || uploadingPdf || extractingPdf}
                        onClick={() => handleSaveBook('draft')}
                        className="px-4 py-2.5 rounded-lg border border-[#DDDDE3] dark:border-[#262626] hover:border-[#E43136] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Draft</span>
                      </button>

                      <button
                        type="button"
                        disabled={saving || uploadingPdf || extractingPdf}
                        onClick={() => handleSaveBook('published')}
                        className="px-5 py-2.5 rounded-lg bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {saving ? 'Uploading & Publishing...' : 'Upload & Publish Book'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : filteredDashboardBooks.length === 0 ? (
            <div className="max-w-2xl mx-auto my-8 space-y-6">
              {/* Two Big Option Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={openCreateBookTab}
                  className="text-left bg-white dark:bg-[#111111] rounded-2xl border border-[#DDDDE3] dark:border-[#262626] hover:border-[#E43136] p-6 space-y-3 transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FFF3F4] dark:bg-[#261417] text-[#E43136] flex items-center justify-center">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#E43136]">
                      Option 1
                    </span>
                    <h3 className="text-base font-bold text-[#202020] dark:text-[#F4F4F6] mt-0.5">
                      Create Book (Write Story)
                    </h3>
                    <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] mt-1 leading-relaxed">
                      Write an original book chapter-by-chapter with our professional manuscript editor, Story Bible, and media tools.
                    </p>
                  </div>
                  <div className="pt-1 text-xs font-semibold text-[#E43136] inline-flex items-center gap-1">
                    <span>Start Writing</span>
                    <span>→</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={openUploadBookTab}
                  className="text-left bg-white dark:bg-[#111111] rounded-2xl border border-[#DDDDE3] dark:border-[#262626] hover:border-[#E43136] p-6 space-y-3 transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FFF3F4] dark:bg-[#261417] text-[#E43136] flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#E43136]">
                      Option 2
                    </span>
                    <h3 className="text-base font-bold text-[#202020] dark:text-[#F4F4F6] mt-0.5">
                      Upload a Book
                    </h3>
                    <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] mt-1 leading-relaxed">
                      Upload a PDF source and choose which reader formats to offer.
                    </p>
                  </div>
                  <div className="pt-1 text-xs font-semibold text-[#E43136] inline-flex items-center gap-1">
                    <span>Upload PDF Book</span>
                    <span>→</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-5">
              {/* Two Prominent Option Cards at Top of Author Studio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={openCreateBookTab}
                  className="text-left bg-white dark:bg-[#111111] rounded-xl border border-[#DDDDE3] dark:border-[#262626] hover:border-[#E43136] p-4 flex items-center gap-4 transition-colors cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#FFF3F4] dark:bg-[#261417] text-[#E43136] flex items-center justify-center shrink-0">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#E43136]">
                      Option 1 · Original Manuscript
                    </span>
                    <h3 className="text-sm font-bold text-[#202020] dark:text-[#F4F4F6] truncate">
                      Create Book (Write Original Story)
                    </h3>
                    <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] truncate">
                      Write chapters from scratch in the Author Studio
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={openUploadBookTab}
                  className="text-left bg-white dark:bg-[#111111] rounded-xl border border-[#DDDDE3] dark:border-[#262626] hover:border-[#E43136] p-4 flex items-center gap-4 transition-colors cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#FFF3F4] dark:bg-[#261417] text-[#E43136] flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#E43136]">
                      Option 2 · Direct PDF Upload
                    </span>
                    <h3 className="text-sm font-bold text-[#202020] dark:text-[#F4F4F6] truncate">
                      Upload Book (PDF → Text & Multi-Voice Audio)
                    </h3>
                    <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] truncate">
                      Upload PDF file, cover, title & synopsis in one step
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E6E77] dark:text-[#9E9EA8]">
                  Showing {filteredDashboardBooks.length}{' '}
                  {filteredDashboardBooks.length === 1 ? 'book' : 'books'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDashboardBooks.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white dark:bg-[#1E1E24] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4 flex gap-3.5 hover:border-[#E43136]/50 transition-colors"
                  >
                    <BookCover
                      book={b}
                      size="sm"
                      className="w-20 shrink-0"
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              b.status === 'published'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {b.status}
                          </span>
                          <span className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] truncate">
                            {b.category}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-[#202020] dark:text-[#F4F4F6] truncate mt-1">
                          {b.title}
                        </h3>
                        <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] mt-0.5">
                          {b.format === 'pdf'
                            ? 'PDF Edition'
                            : `${b.chaptersCount || 1} chapters`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 pt-2">
                        <button
                          type="button"
                          onClick={() => openBookInStudio(b, 'editor')}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#E43136] hover:bg-[#B9272D] text-white text-[11px] font-semibold text-center cursor-pointer"
                        >
                          Write
                        </button>
                        <button
                          type="button"
                          onClick={() => openBookInStudio(b, 'overview')}
                          className="py-1.5 px-2.5 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] text-[11px] font-semibold hover:bg-[#FAFAFB] dark:hover:bg-[#26262E] cursor-pointer"
                        >
                          Studio
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBook(b.id, b.title)}
                          title="Delete book"
                          className="p-1.5 rounded-lg text-[#6E6E77] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      {coverCropDialog}
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: DEDICATED BOOK WORKSPACE (8 DEDICATED SCREENS, FRAME-FIT)
  // ============================================================================
  const STUDIO_SCREENS: { id: StudioScreen; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { id: 'details', label: 'Book Details', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'chapters', label: 'Chapters', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'editor', label: 'Manuscript Editor', icon: <Edit3 className="w-3.5 h-3.5" /> },
    { id: 'bible', label: 'Story Bible', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'media', label: 'Media Library', icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { id: 'preview', label: 'Preview', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'publishing', label: 'Publishing', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className={
        zenMode
          ? 'fixed inset-0 z-50 bg-[#FAFAFB] dark:bg-[#121216] flex flex-col overflow-hidden'
          : 'flex-1 min-h-0 w-full max-w-[1440px] mx-auto flex flex-col overflow-hidden bg-white dark:bg-[#16161A] md:border-x border-[#DDDDE3] dark:border-[#2C2C35]'
      }
    >
      {/* Top Studio Bar: Navigation + Save Status + Quick Save/Publish */}
      <header className="shrink-0 h-13 px-3 sm:px-5 border-b border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#1E1E24] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {!zenMode && (
            <button
              type="button"
              onClick={() => {
                setWorkspaceOpen(false);
                setSearchParams({});
              }}
              className="p-1.5 rounded-lg hover:bg-[#FAFAFB] dark:hover:bg-[#26262E] text-xs font-semibold text-[#6E6E77] dark:text-[#9E9EA8] inline-flex items-center gap-1 cursor-pointer shrink-0"
              title="Back to All Books"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Books</span>
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-[#202020] dark:text-[#F4F4F6] truncate max-w-[180px] sm:max-w-[260px]">
              {title.trim() || 'Untitled Book'}
            </h1>
            <p className="text-[10px] text-[#6E6E77] dark:text-[#9E9EA8] truncate">
              {totalWordCount.toLocaleString()} words · {chapters.length} ch
              {lastSavedTime ? ` · Saved ${lastSavedTime}` : ''}
            </p>
          </div>
        </div>

        {/* 8 Screen Switcher Tabs */}
        {!zenMode && (
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {STUDIO_SCREENS.map((scr) => (
              <button
                key={scr.id}
                type="button"
                onClick={() => setActiveScreen(scr.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  activeScreen === scr.id
                    ? 'bg-[#E43136] text-white'
                    : 'text-[#6E6E77] dark:text-[#9E9EA8] hover:bg-[#FAFAFB] dark:hover:bg-[#26262E]'
                }`}
              >
                {scr.icon}
                <span>{scr.label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* Right Actions: Save Draft & Publish */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeScreen === 'editor' && (
            <button
              type="button"
              onClick={() => setZenMode((z) => !z)}
              className="p-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-medium hover:bg-[#FAFAFB] dark:hover:bg-[#26262E] cursor-pointer"
              title={zenMode ? 'Exit Distraction-Free Mode' : 'Distraction-Free Mode'}
            >
              {zenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveBook('draft')}
            className="py-1.5 px-2.5 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] hover:bg-[#FAFAFB] dark:hover:bg-[#26262E] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveBook('published')}
            className="py-1.5 px-3 rounded-lg bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish</span>
          </button>
        </div>
      </header>

      {/* Compact Toast Status Banner */}
      {(error || successMsg) && (
        <div className="shrink-0 px-4 py-1.5 bg-[#FAFAFB] dark:bg-[#18181F] border-b border-[#DDDDE3] dark:border-[#2C2C35] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {error ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}
            <span className={error ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
              {error || successMsg}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError('');
              setSuccessMsg('');
            }}
            className="p-0.5 text-[#6E6E77] hover:text-[#202020] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 1: OVERVIEW                                                   */}
      {/* ==================================================================== */}
      {activeScreen === 'overview' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#FAFAFB] dark:bg-[#141418]">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-[#1E1E24] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-5 flex flex-col items-center text-center">
              <BookCover
                book={{
                  id: activeBookId || 'draft',
                  title: title || 'Untitled Book',
                  authorName: currentUser?.displayName || 'Author',
                  coverURL,
                  category,
                  format,
                }}
                size="md"
                className="w-32 mb-3"
              />
              <h2 className="text-sm font-bold text-[#202020] dark:text-[#F4F4F6]">
                {title || 'Untitled Book'}
              </h2>
              <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] mt-0.5">{category}</p>
              <button
                type="button"
                onClick={() => setActiveScreen('details')}
                className="mt-3 w-full py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold hover:bg-[#FAFAFB] dark:hover:bg-[#26262E] cursor-pointer"
              >
                Edit Cover & Details
              </button>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-[#1E1E24] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4">
                  <span className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8]">Total Words</span>
                  <p className="text-xl font-bold text-[#202020] dark:text-[#F4F4F6] mt-1">
                    {totalWordCount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white dark:bg-[#1E1E24] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4">
                  <span className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8]">Chapters</span>
                  <p className="text-xl font-bold text-[#202020] dark:text-[#F4F4F6] mt-1">
                    {chapters.length}
                  </p>
                </div>
                <div className="bg-white dark:bg-[#1E1E24] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4">
                  <span className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8]">Media Assets</span>
                  <p className="text-xl font-bold text-[#202020] dark:text-[#F4F4F6] mt-1">
                    {mediaLibrary.length}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#1E1E24] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#6E6E77] dark:text-[#9E9EA8]">
                  Studio Workspaces
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {STUDIO_SCREENS.filter((s) => s.id !== 'overview').map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveScreen(s.id)}
                      className="p-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136] text-left transition-colors cursor-pointer flex items-center gap-2.5"
                    >
                      <span className="text-[#E43136]">{s.icon}</span>
                      <span className="text-xs font-semibold">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 2: BOOK DETAILS                                               */}
      {/* ==================================================================== */}
      {activeScreen === 'details' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#FAFAFB] dark:bg-[#141418]">
          <div className="max-w-3xl mx-auto bg-white dark:bg-[#1E1E24] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-5 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Cover Upload */}
              <div className="flex flex-col items-center">
                <BookCover
                  book={{
                    id: activeBookId || 'draft',
                    title: title || 'Book Cover',
                    authorName: currentUser?.displayName || 'Author',
                    coverURL,
                    category,
                    format,
                  }}
                  size="md"
                  className="w-36 mb-3"
                />
                <label className="w-full py-2 px-3 rounded-lg bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold text-center cursor-pointer inline-flex items-center justify-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingCover ? `Uploading ${coverProgress}%` : 'Upload Cover'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Metadata Fields */}
              <div className="sm:col-span-2 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold mb-1">Book Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter book title..."
                    className="w-full py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#16161A] text-sm font-semibold focus:outline-none focus:border-[#E43136]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Tagline / Subtitle</label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Optional hook or subtitle..."
                    className="w-full py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#16161A] text-xs focus:outline-none focus:border-[#E43136]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#16161A] text-xs font-medium"
                    >
                      {STUDIO_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Language</label>
                    <input
                      type="text"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#16161A] text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Book Synopsis *</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your book for readers..."
                    className="w-full p-3 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#16161A] text-xs leading-relaxed focus:outline-none focus:border-[#E43136] resize-none"
                  />
                </div>

                {format === 'pdf' && (
                  <div className="pt-2 border-t border-[#DDDDE3] dark:border-[#2C2C35]">
                    <label className="block text-xs font-semibold mb-1.5">PDF Document File</label>
                    <div className="flex items-center gap-3">
                      <label className="py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 hover:bg-[#FAFAFB]">
                        <Upload className="w-3.5 h-3.5 text-[#E43136]" />
                        <span>{uploadingPdf ? `Uploading ${pdfProgress}%` : 'Choose PDF File'}</span>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handlePdfUpload}
                          className="hidden"
                        />
                      </label>
                      {fileURL && (
                        <span className="text-xs text-emerald-600 font-medium truncate">
                          PDF attached
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 3: CHAPTER MANAGER                                            */}
      {/* ==================================================================== */}
      {activeScreen === 'chapters' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#FAFAFB] dark:bg-[#141418]">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#202020] dark:text-[#F4F4F6]">
                  Chapters ({chapters.length})
                </h2>
                <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
                  Reorder, duplicate, or select a chapter to open in the Manuscript Editor.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddChapter}
                className="py-2 px-3.5 rounded-lg bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Chapter
              </button>
            </div>

            <div className="space-y-2">
              {chapters.map((ch, idx) => (
                <div
                  key={ch.id || idx}
                  className="bg-white dark:bg-[#1E1E24] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#E43136]">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={ch.title}
                        onChange={(e) => handleChapterChange(idx, 'title', e.target.value)}
                        className="text-xs sm:text-sm font-bold bg-transparent border-b border-transparent focus:border-[#E43136] focus:outline-none flex-1 truncate"
                      />
                    </div>
                    <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] mt-0.5">
                      {chapterWordCounts[idx] || 0} words
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveChapter(idx, 'up')}
                      className="p-1.5 rounded-lg hover:bg-[#FAFAFB] dark:hover:bg-[#26262E] disabled:opacity-30 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === chapters.length - 1}
                      onClick={() => handleMoveChapter(idx, 'down')}
                      className="p-1.5 rounded-lg hover:bg-[#FAFAFB] dark:hover:bg-[#26262E] disabled:opacity-30 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateChapter(idx)}
                      className="p-1.5 rounded-lg hover:bg-[#FAFAFB] dark:hover:bg-[#26262E] cursor-pointer"
                      title="Duplicate chapter"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {chapters.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveChapter(idx)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        title="Delete chapter"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChapterIdx(idx);
                        setActiveScreen('editor');
                      }}
                      className="ml-1 py-1.5 px-3 rounded-lg bg-[#E43136] text-white text-xs font-semibold cursor-pointer"
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 4: MANUSCRIPT EDITOR (FIXED VIEWPORT, ZERO OUTER SCROLL)      */}
      {/* ==================================================================== */}
      {activeScreen === 'editor' && (
        <div className="flex-1 min-h-0 flex overflow-hidden relative">
          {/* Left Chapter Sidebar (Desktop fixed, Mobile slide-over drawer) */}
          <aside
            className={`${
              mobileChaptersOpen
                ? 'fixed inset-y-0 left-0 z-40 w-64 flex'
                : 'hidden lg:flex w-60'
            } shrink-0 border-r border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#18181F] flex-col overflow-hidden`}
          >
            <div className="p-3 border-b border-[#DDDDE3] dark:border-[#2C2C35] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E6E77] dark:text-[#9E9EA8]">
                Chapters ({chapters.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleAddChapter}
                  className="py-1 px-2 rounded-md bg-[#E43136] text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
                {mobileChaptersOpen && (
                  <button
                    type="button"
                    onClick={() => setMobileChaptersOpen(false)}
                    className="p-1 rounded-md lg:hidden"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
              {chapters.map((ch, idx) => {
                const isActive = idx === activeChapterIdx;
                return (
                  <button
                    key={ch.id || idx}
                    type="button"
                    onClick={() => {
                      setActiveChapterIdx(idx);
                      setMobileChaptersOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      isActive
                        ? 'bg-[#FBE5E8] dark:bg-[#E43136]/20 text-[#E43136] font-semibold'
                        : 'hover:bg-white dark:hover:bg-[#22222A] text-[#202020] dark:text-[#F4F4F6]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs truncate">{ch.title || `Chapter ${idx + 1}`}</p>
                      <span className="text-[10px] opacity-70">
                        {chapterWordCounts[idx] || 0} words
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Manuscript Column: Fixed Formatting Toolbar + Scrollable Canvas + Fixed Footer */}
          <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${paperClasses}`}>
            {/* Fixed Editor Formatting Toolbar */}
            <div className="shrink-0 px-3 py-2 border-b border-current/10 flex items-center justify-between gap-2 flex-wrap bg-current/[0.02]">
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setMobileChaptersOpen((o) => !o)}
                  className="lg:hidden py-1 px-2 rounded border border-current/15 text-xs font-semibold mr-1 cursor-pointer"
                >
                  Ch #{activeChapterIdx + 1}
                </button>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyStack.length === 0}
                  title="Undo"
                  className="p-1.5 rounded hover:bg-current/10 disabled:opacity-30 cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  title="Redo"
                  className="p-1.5 rounded hover:bg-current/10 disabled:opacity-30 cursor-pointer"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <span className="h-4 w-px bg-current/15 mx-0.5" />
                <button
                  type="button"
                  onClick={() => applyFormatting('h1')}
                  title="Heading 1"
                  className="p-1.5 rounded hover:bg-current/10 cursor-pointer"
                >
                  <Heading1 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('h2')}
                  title="Heading 2"
                  className="p-1.5 rounded hover:bg-current/10 cursor-pointer"
                >
                  <Heading2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('bold')}
                  title="Bold"
                  className="p-1.5 rounded hover:bg-current/10 cursor-pointer"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('italic')}
                  title="Italic"
                  className="p-1.5 rounded hover:bg-current/10 cursor-pointer"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('quote')}
                  title="Quote"
                  className="p-1.5 rounded hover:bg-current/10 cursor-pointer"
                >
                  <Quote className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('dialogue')}
                  title="Insert Dialogue Quotes"
                  className="px-2 py-1 rounded hover:bg-current/10 text-xs font-serif font-bold cursor-pointer"
                >
                  “ ”
                </button>
                <span className="h-4 w-px bg-current/15 mx-0.5" />
                {/* Insert Image at Cursor */}
                <button
                  type="button"
                  onClick={() => setImageInsertOpen((o) => !o)}
                  className="py-1 px-2 rounded bg-[#E43136]/10 text-[#E43136] hover:bg-[#E43136]/20 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Insert Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('divider')}
                  title="Insert Scene Break"
                  className="py-1 px-2 rounded hover:bg-current/10 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Scene Break</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('pagebreak')}
                  title="Insert Page Break"
                  className="py-1 px-2 rounded hover:bg-current/10 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Page Break</span>
                </button>
              </div>

              {/* Right Editor Controls: Find/Replace & Paper Theme */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowFindReplace((f) => !f)}
                  title="Find & Replace"
                  className={`p-1.5 rounded cursor-pointer ${
                    showFindReplace ? 'bg-[#E43136] text-white' : 'hover:bg-current/10'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditorPaper((p) =>
                      p === 'light' ? 'sepia' : p === 'sepia' ? 'dark' : 'light'
                    )
                  }
                  title="Switch paper mode (Light / Sepia / Dark)"
                  className="p-1.5 rounded hover:bg-current/10 cursor-pointer"
                >
                  {editorPaper === 'dark' ? (
                    <Moon className="w-3.5 h-3.5" />
                  ) : (
                    <Sun className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Optional Find & Replace Bar */}
            {showFindReplace && (
              <div className="shrink-0 px-4 py-2 border-b border-current/10 bg-current/[0.03] flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="text"
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  placeholder="Find in chapter..."
                  className="py-1 px-2.5 rounded border border-current/20 bg-transparent"
                />
                <input
                  type="text"
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  placeholder="Replace with..."
                  className="py-1 px-2.5 rounded border border-current/20 bg-transparent"
                />
                <button
                  type="button"
                  onClick={handleReplaceInChapter}
                  className="py-1 px-3 rounded bg-[#E43136] text-white font-semibold cursor-pointer"
                >
                  Replace All
                </button>
              </div>
            )}

            {/* Image Insertion & Positioning Bar */}
            {imageInsertOpen && (
              <div className="shrink-0 px-4 py-3 border-b border-current/15 bg-current/[0.04] space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Insert Image into Manuscript at Cursor</span>
                  <button
                    type="button"
                    onClick={() => setImageInsertOpen(false)}
                    className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-center">
                  <div className="flex items-center gap-2">
                    <label className="py-1.5 px-3 rounded-lg bg-[#E43136] text-white font-semibold cursor-pointer inline-flex items-center gap-1.5 shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingMedia ? `Uploading ${mediaProgress}%` : 'Upload Image'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleManuscriptImageUpload(e, true)}
                        className="hidden"
                      />
                    </label>
                    {mediaLibrary.length > 0 && (
                      <select
                        value={selectedImageUrl}
                        onChange={(e) => setSelectedImageUrl(e.target.value)}
                        className="py-1.5 px-2 rounded border border-current/20 bg-transparent text-xs truncate max-w-[140px]"
                      >
                        <option value="" className="text-black">
                          Or pick uploaded...
                        </option>
                        {mediaLibrary.map((m) => (
                          <option key={m.id} value={m.url} className="text-black">
                            {m.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Size selector */}
                  <div className="flex items-center gap-1">
                    <span className="opacity-70 mr-1">Size:</span>
                    {(['sm', 'md', 'lg', 'full'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedImageSize(sz)}
                        className={`px-2 py-1 rounded border text-[11px] font-semibold uppercase cursor-pointer ${
                          selectedImageSize === sz
                            ? 'border-[#E43136] bg-[#E43136] text-white'
                            : 'border-current/20'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>

                  {/* Alignment selector */}
                  <div className="flex items-center gap-1">
                    <span className="opacity-70 mr-1">Align:</span>
                    {[
                      { id: 'left', icon: <AlignLeft className="w-3.5 h-3.5" /> },
                      { id: 'center', icon: <AlignCenter className="w-3.5 h-3.5" /> },
                      { id: 'right', icon: <AlignRight className="w-3.5 h-3.5" /> },
                    ].map((al) => (
                      <button
                        key={al.id}
                        type="button"
                        onClick={() => setSelectedImageAlign(al.id as 'left' | 'center' | 'right')}
                        className={`p-1.5 rounded border cursor-pointer ${
                          selectedImageAlign === al.id
                            ? 'border-[#E43136] bg-[#E43136] text-white'
                            : 'border-current/20'
                        }`}
                      >
                        {al.icon}
                      </button>
                    ))}
                  </div>

                  {/* Caption + Insert Button */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={selectedImageCaption}
                      onChange={(e) => setSelectedImageCaption(e.target.value)}
                      placeholder="Image caption..."
                      className="flex-1 py-1 px-2 rounded border border-current/20 bg-transparent text-xs"
                    />
                    <button
                      type="button"
                      disabled={!selectedImageUrl}
                      onClick={handleInsertImageAtCursor}
                      className="py-1.5 px-3 rounded-lg bg-[#E43136] text-white font-semibold disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      Insert
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Independently Scrollable Manuscript Writing Canvas */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-10 py-6">
              <div className="max-w-3xl mx-auto flex flex-col min-h-full">
                {/* Chapter Title Input */}
                <div className="mb-4 pb-3 border-b border-current/10 flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={currentChapter.title}
                    onChange={(e) =>
                      handleChapterChange(activeChapterIdx, 'title', e.target.value)
                    }
                    placeholder={`Chapter ${activeChapterIdx + 1} Title...`}
                    className="w-full font-display text-xl sm:text-2xl font-bold bg-transparent focus:outline-none"
                  />
                </div>

                {/* Manuscript Textarea */}
                <textarea
                  ref={textareaRef}
                  value={currentChapter.content}
                  onChange={(e) =>
                    handleChapterChange(activeChapterIdx, 'content', e.target.value)
                  }
                  style={{ fontSize: `${editorFontSize}px` }}
                  placeholder="Begin writing your chapter here... Use the toolbar above to format text, add scene/page breaks, or insert illustrations at your cursor."
                  className="w-full flex-1 min-h-[340px] bg-transparent font-display leading-[1.85] focus:outline-none resize-none"
                />

                {/* Interactive Inline Image Cards Manager for images inside this chapter */}
                {activeChapterImages.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-current/10 space-y-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                      Embedded Chapter Illustrations ({activeChapterImages.length}) — Resize & Align
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeChapterImages.map((img, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl border border-current/15 bg-current/[0.02] flex gap-3 items-center"
                        >
                          <img
                            src={img.url}
                            alt={img.caption || 'Chapter image'}
                            className="w-14 h-14 rounded-lg object-cover shrink-0 border border-current/10"
                          />
                          <div className="flex-1 min-w-0 space-y-1.5 text-[11px]">
                            <div className="flex items-center gap-1 flex-wrap">
                              {(['sm', 'md', 'lg', 'full'] as const).map((sz) => (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() =>
                                    updateInlineImageToken(img.token, sz, img.align, img.caption)
                                  }
                                  className={`px-1.5 py-0.5 rounded uppercase font-semibold cursor-pointer ${
                                    img.size === sz
                                      ? 'bg-[#E43136] text-white'
                                      : 'border border-current/20'
                                  }`}
                                >
                                  {sz}
                                </button>
                              ))}
                              <span className="mx-0.5 opacity-30">|</span>
                              {(['left', 'center', 'right'] as const).map((al) => (
                                <button
                                  key={al}
                                  type="button"
                                  onClick={() =>
                                    updateInlineImageToken(img.token, img.size, al, img.caption)
                                  }
                                  className={`px-1.5 py-0.5 rounded capitalize font-semibold cursor-pointer ${
                                    img.align === al
                                      ? 'bg-[#E43136] text-white'
                                      : 'border border-current/20'
                                  }`}
                                >
                                  {al}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => removeInlineImageToken(img.token)}
                                className="ml-auto text-red-500 hover:underline cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                            <input
                              type="text"
                              value={img.caption}
                              onChange={(e) =>
                                updateInlineImageToken(
                                  img.token,
                                  img.size,
                                  img.align,
                                  e.target.value
                                )
                              }
                              placeholder="Caption..."
                              className="w-full py-0.5 px-2 rounded border border-current/15 bg-transparent text-[11px]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Bottom Editor Status Bar */}
            <footer className="shrink-0 h-9 px-4 border-t border-current/10 flex items-center justify-between text-[11px] opacity-75">
              <div className="flex items-center gap-3">
                <span>
                  Chapter {activeChapterIdx + 1} of {chapters.length}
                </span>
                <span>·</span>
                <span>{activeChapterWords.toLocaleString()} words</span>
                <span>·</span>
                <span>~{activeReadingMinutes} min read</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditorFontSize((s) => Math.max(14, s - 1))}
                  className="px-1.5 py-0.5 rounded border border-current/20 cursor-pointer"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => setEditorFontSize((s) => Math.min(24, s + 1))}
                  className="px-1.5 py-0.5 rounded border border-current/20 cursor-pointer"
                >
                  A+
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreen('preview')}
                  className="ml-2 text-[#E43136] font-semibold hover:underline cursor-pointer"
                >
                  Preview Chapter →
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 5: STORY BIBLE                                                */}
      {/* ==================================================================== */}
      {activeScreen === 'bible' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#FAFAFB] dark:bg-[#141418]">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Characters Panel */}
            <div className="bg-white dark:bg-[#1E1E24] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#E43136]" />
                  <span>Characters ({characters.length})</span>
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setCharacters((prev) => [
                      ...prev,
                      {
                        id: `char-${Date.now()}`,
                        name: 'New Character',
                        role: 'Supporting',
                        traits: '',
                      },
                    ])
                  }
                  className="py-1 px-2.5 rounded-lg bg-[#E43136] text-white text-xs font-semibold cursor-pointer"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-2.5">
                {characters.map((c, idx) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#16161A] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) =>
                          setCharacters((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, name: e.target.value } : item
                            )
                          )
                        }
                        className="text-xs font-bold bg-transparent border-b border-transparent focus:border-[#E43136] focus:outline-none"
                      />
                      <input
                        type="text"
                        value={c.role}
                        onChange={(e) =>
                          setCharacters((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, role: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Role"
                        className="text-[11px] text-[#E43136] font-semibold bg-transparent text-right w-24 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCharacters((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-[#6E6E77] hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={c.traits}
                      onChange={(e) =>
                        setCharacters((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, traits: e.target.value } : item
                          )
                        )
                      }
                      placeholder="Motivation, personality traits, arc..."
                      className="w-full text-xs bg-transparent focus:outline-none resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Worldbuilding & Plot Notes Panel */}
            <div className="bg-white dark:bg-[#1E1E24] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#E43136]" />
                  <span>World & Plot Notes ({worldNotes.length})</span>
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setWorldNotes((prev) => [
                      ...prev,
                      {
                        id: `world-${Date.now()}`,
                        title: 'New Setting / Lore',
                        category: 'Location',
                        details: '',
                      },
                    ])
                  }
                  className="py-1 px-2.5 rounded-lg bg-[#E43136] text-white text-xs font-semibold cursor-pointer"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-2.5">
                {worldNotes.map((w, idx) => (
                  <div
                    key={w.id}
                    className="p-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#16161A] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={w.title}
                        onChange={(e) =>
                          setWorldNotes((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, title: e.target.value } : item
                            )
                          )
                        }
                        className="text-xs font-bold bg-transparent border-b border-transparent focus:border-[#E43136] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setWorldNotes((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-[#6E6E77] hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={w.details}
                      onChange={(e) =>
                        setWorldNotes((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, details: e.target.value } : item
                          )
                        )
                      }
                      placeholder="Rules, timeline, key plot details..."
                      className="w-full text-xs bg-transparent focus:outline-none resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 6: MEDIA LIBRARY (FIREBASE STORAGE)                           */}
      {/* ==================================================================== */}
      {activeScreen === 'media' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#FAFAFB] dark:bg-[#141418]">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between bg-white dark:bg-[#1E1E24] p-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35]">
              <div>
                <h2 className="text-sm font-bold">Book Media Library</h2>
                <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
                  Upload illustrations or maps to Firebase Storage and insert them into any chapter.
                </p>
              </div>
              <label className="py-2 px-3.5 rounded-lg bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingMedia ? `Uploading ${mediaProgress}%` : 'Upload Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleManuscriptImageUpload(e, false)}
                  className="hidden"
                />
              </label>
            </div>

            {mediaLibrary.length === 0 ? (
              <div className="bg-white dark:bg-[#1E1E24] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-10 text-center">
                <ImageIcon className="w-8 h-8 text-[#E43136] mx-auto mb-2 opacity-80" />
                <p className="text-xs font-semibold">No media uploaded for this book yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {mediaLibrary.map((asset) => (
                  <div
                    key={asset.id}
                    className="bg-white dark:bg-[#1E1E24] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] overflow-hidden flex flex-col"
                  >
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="w-full h-36 object-cover bg-[#FAFAFB]"
                    />
                    <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between">
                      <p className="text-[11px] font-semibold truncate">{asset.name}</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImageUrl(asset.url);
                            setImageInsertOpen(true);
                            setActiveScreen('editor');
                          }}
                          className="flex-1 py-1 px-2 rounded bg-[#E43136] text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Insert in Ch #{activeChapterIdx + 1}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCoverURL(asset.url)}
                          title="Set as Book Cover"
                          className="py-1 px-2 rounded border border-[#DDDDE3] dark:border-[#2C2C35] text-[10px] font-semibold cursor-pointer"
                        >
                          Cover
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 7: READER PREVIEW                                             */}
      {/* ==================================================================== */}
      {activeScreen === 'preview' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 bg-[#FAFAFB] dark:bg-[#141418]">
          <div className="max-w-2xl mx-auto bg-white dark:bg-[#1E1E24] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 sm:p-10 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#DDDDE3] dark:border-[#2C2C35]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#E43136]">
                  Live Reader Preview
                </span>
                <h2 className="font-display text-2xl font-bold mt-0.5">
                  {currentChapter.title}
                </h2>
              </div>
              <select
                value={activeChapterIdx}
                onChange={(e) => setActiveChapterIdx(Number(e.target.value))}
                className="py-1.5 px-2.5 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs font-semibold"
              >
                {chapters.map((ch, idx) => (
                  <option key={ch.id || idx} value={idx} className="text-black">
                    Ch {idx + 1}: {ch.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="font-display text-base leading-[1.85] space-y-4">
              {renderFormattedBlocks(currentChapter.content)}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 8: PUBLISHING SETTINGS                                        */}
      {/* ==================================================================== */}
      {activeScreen === 'publishing' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#FAFAFB] dark:bg-[#141418]">
          <div className="max-w-xl mx-auto bg-white dark:bg-[#1E1E24] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold">Publishing & Export Settings</h2>
              <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] mt-0.5">
                Configure word count goals, visibility, and publish your book to Redcover.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Target Word Count Goal ({totalWordCount.toLocaleString()} /{' '}
                  {wordCountGoal.toLocaleString()} words)
                </label>
                <input
                  type="number"
                  value={wordCountGoal}
                  onChange={(e) => setWordCountGoal(Math.max(500, Number(e.target.value)))}
                  className="w-full py-2 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#16161A] text-xs"
                />
              </div>

              <div className="p-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#16161A] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold">Export Backup (.md)</p>
                  <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8]">
                    Download all chapters as a formatted Markdown manuscript.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportManuscript}
                  className="py-1.5 px-3 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#1E1E24] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-[#DDDDE3] dark:border-[#2C2C35] flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveBook('draft')}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Save as Draft
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveBook('published')}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Publish Book Now
              </button>
            </div>
          </div>
        </div>
      )}
      {coverCropDialog}
    </div>
  );
};
