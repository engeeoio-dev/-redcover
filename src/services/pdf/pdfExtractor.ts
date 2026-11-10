import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using Vite's asset URL resolution with a reliable CDN fallback
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface ExtractedPdfChapter {
  chapterNumber: number;
  title: string;
  content: string;
  pageStart: number;
  pageEnd: number;
}

export interface ExtractedPdfResult {
  title: string;
  author: string;
  subject: string;
  numPages: number;
  totalWords: number;
  chapters: ExtractedPdfChapter[];
  coverBlob: Blob | null;
  coverDataUrl: string;
  summaryPreview: string;
}

/**
 * Reconstructs clean, human-readable paragraphs from a single PDF page's text items
 * by inspecting Y-coordinate jumps and line endings.
 */
function buildPageParagraphs(items: any[]): string {
  if (!items || items.length === 0) return '';

  const lines: { y: number; text: string; fontSize: number }[] = [];
  let currentLineText = '';
  let lastY: number | null = null;
  let currentFontSize = 12;

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem.str !== 'string') continue;
    const str = rawItem.str;
    const transform = Array.isArray(rawItem.transform) ? rawItem.transform : [12, 0, 0, 12, 0, 0];
    const y = Number(transform[5] || 0);
    const fontSize = Math.abs(Number(transform[0] || transform[3] || 12));

    if (lastY === null || Math.abs(y - lastY) <= Math.max(4, fontSize * 0.45)) {
      if (currentLineText && !currentLineText.endsWith(' ') && !str.startsWith(' ')) {
        currentLineText += ' ';
      }
      currentLineText += str;
      currentFontSize = Math.max(currentFontSize, fontSize);
    } else {
      const trimmed = currentLineText.replace(/\s+/g, ' ').trim();
      if (trimmed) {
        lines.push({ y: lastY, text: trimmed, fontSize: currentFontSize });
      }
      currentLineText = str;
      currentFontSize = fontSize;
    }
    lastY = y;
  }

  const finalTrimmed = currentLineText.replace(/\s+/g, ' ').trim();
  if (finalTrimmed && lastY !== null) {
    lines.push({ y: lastY, text: finalTrimmed, fontSize: currentFontSize });
  }

  if (lines.length === 0) return '';

  // Estimate median line spacing and font size to detect headings & paragraph breaks
  const fontSizes = lines.map((l) => l.fontSize).sort((a, b) => a - b);
  const medianFont = fontSizes[Math.floor(fontSizes.length / 2)] || 12;

  const paragraphs: string[] = [];
  let currentPara = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : null;

    // Skip standalone page numbers at very top or bottom
    if ((i === 0 || i === lines.length - 1) && /^\d{1,4}$/.test(line.text)) {
      continue;
    }

    const isHeading =
      (line.fontSize >= medianFont * 1.25 && line.text.length <= 90) ||
      /^(chapter|part|prologue|epilogue|section|unit|module)\s+([0-9ivxlcdm]+|[a-z]+)/i.test(
        line.text
      );

    const verticalGap = prevLine ? Math.abs(prevLine.y - line.y) : 0;
    const isNewParagraph =
      !prevLine ||
      isHeading ||
      verticalGap > medianFont * 1.85 ||
      /[.!?।”"']$/.test(prevLine.text) && prevLine.text.length < 65;

    if (isHeading) {
      if (currentPara.trim()) {
        paragraphs.push(currentPara.trim());
        currentPara = '';
      }
      paragraphs.push(`## ${line.text}`);
    } else if (isNewParagraph && currentPara.trim()) {
      paragraphs.push(currentPara.trim());
      currentPara = line.text;
    } else {
      if (currentPara.endsWith('-') && /^[a-z]/.test(line.text)) {
        currentPara = currentPara.slice(0, -1) + line.text;
      } else {
        currentPara = currentPara ? `${currentPara} ${line.text}` : line.text;
      }
    }
  }

  if (currentPara.trim()) {
    paragraphs.push(currentPara.trim());
  }

  return paragraphs.join('\n\n');
}

/**
 * Groups page texts into logical chapters (by detected Chapter headings or 5-page reading sections).
 */
function groupPagesIntoChapters(
  pageTexts: { pageNumber: number; text: string }[],
  fallbackTitle: string
): ExtractedPdfChapter[] {
  const nonEmptyPages = pageTexts.filter((p) => p.text.trim().length > 0);
  if (nonEmptyPages.length === 0) {
    return [
      {
        chapterNumber: 1,
        title: `${fallbackTitle} — Section 1`,
        content:
          'This PDF document contains scanned images or non-selectable text. You can switch to Original PDF View in the top toolbar if needed.',
        pageStart: 1,
        pageEnd: Math.max(1, pageTexts.length),
      },
    ];
  }

  const chapters: ExtractedPdfChapter[] = [];
  let currentTitle = '';
  let currentContentParts: string[] = [];
  let currentStartPage = nonEmptyPages[0].pageNumber;
  let currentEndPage = nonEmptyPages[0].pageNumber;
  let pagesInCurrentBatch = 0;

  const flushChapter = () => {
    const joined = currentContentParts.join('\n\n').trim();
    if (!joined) return;
    const num = chapters.length + 1;
    const defaultTitle =
      currentStartPage === currentEndPage
        ? `Section ${num} (Page ${currentStartPage})`
        : `Section ${num} (Pages ${currentStartPage}–${currentEndPage})`;
    chapters.push({
      chapterNumber: num,
      title: (currentTitle || defaultTitle).slice(0, 200),
      content: joined.slice(0, 95000),
      pageStart: currentStartPage,
      pageEnd: currentEndPage,
    });
    currentTitle = '';
    currentContentParts = [];
    pagesInCurrentBatch = 0;
  };

  for (const page of nonEmptyPages) {
    const firstBlock = page.text.split(/\n\s*\n/)[0]?.replace(/^#+\s*/, '').trim() || '';
    const looksLikeChapterStart =
      /^(chapter|part|prologue|epilogue|book|unit|module)\s+([0-9ivxlcdm]+|[a-z]+)/i.test(
        firstBlock
      ) && firstBlock.length <= 100;

    if (
      (looksLikeChapterStart && currentContentParts.length > 0) ||
      pagesInCurrentBatch >= 6 ||
      currentContentParts.join('\n\n').length > 24000
    ) {
      flushChapter();
      currentStartPage = page.pageNumber;
    }

    if (!currentTitle && looksLikeChapterStart) {
      currentTitle = firstBlock;
    }
    if (currentContentParts.length === 0) {
      currentStartPage = page.pageNumber;
    }
    currentEndPage = page.pageNumber;
    currentContentParts.push(page.text);
    pagesInCurrentBatch += 1;
  }

  flushChapter();

  return chapters.length > 0
    ? chapters
    : [
        {
          chapterNumber: 1,
          title: fallbackTitle || 'Chapter 1',
          content: nonEmptyPages.map((p) => p.text).join('\n\n').slice(0, 95000),
          pageStart: 1,
          pageEnd: pageTexts.length,
        },
      ];
}

/**
 * Renders the first page of a loaded PDF document onto an offscreen canvas and returns
 * a high-resolution JPEG Blob (for Storage) + a compact JPEG Data URL <= 4800 chars (for Firestore fallback).
 */
async function renderFirstPageCover(
  pdfDoc: pdfjsLib.PDFDocumentProxy
): Promise<{ blob: Blob | null; dataUrl: string }> {
  try {
    const page = await pdfDoc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = 600;
    const scale = Math.min(2.0, Math.max(0.5, targetWidth / Math.max(1, baseViewport.width)));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: null, dataUrl: '' };

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as any).promise;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
    );

    // Produce a compact dataUrl guaranteed <= 4800 chars so it fits inside Firestore's 5000-char coverURL rule
    let compactDataUrl = '';
    const candidateWidths = [160, 130, 105, 85];
    const candidateQualities = [0.62, 0.52, 0.42];
    for (const w of candidateWidths) {
      const ratio = canvas.height / Math.max(1, canvas.width);
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = w;
      thumbCanvas.height = Math.max(1, Math.round(w * ratio));
      const tCtx = thumbCanvas.getContext('2d');
      if (!tCtx) continue;
      tCtx.fillStyle = '#FFFFFF';
      tCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
      tCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

      for (const q of candidateQualities) {
        const candidate = thumbCanvas.toDataURL('image/jpeg', q);
        if (candidate.length <= 4800) {
          compactDataUrl = candidate;
          break;
        }
      }
      if (compactDataUrl) break;
    }

    return { blob, dataUrl: compactDataUrl };
  } catch (err) {
    console.warn('[Redcover PDF] Could not render Page 1 cover preview:', err);
    return { blob: null, dataUrl: '' };
  }
}

/**
 * Extracts structured text chapters, metadata, and first-page cover image from a user-selected PDF File.
 */
export async function extractPdfTextAndCoverFromFile(
  file: File,
  onProgress?: (stage: string, pct: number) => void
): Promise<ExtractedPdfResult> {
  onProgress?.('Reading PDF file...', 10);
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const numPages = pdfDoc.numPages;
  const fallbackTitle = file.name
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let metaTitle = fallbackTitle;
  let metaAuthor = '';
  let metaSubject = '';

  try {
    const meta = await pdfDoc.getMetadata();
    const info = (meta?.info || {}) as Record<string, any>;
    if (typeof info.Title === 'string' && info.Title.trim() && !/untitled|microsoft|word/i.test(info.Title)) {
      metaTitle = info.Title.trim();
    }
    if (typeof info.Author === 'string' && info.Author.trim()) {
      metaAuthor = info.Author.trim();
    }
    if (typeof info.Subject === 'string' && info.Subject.trim()) {
      metaSubject = info.Subject.trim();
    }
  } catch {
    // Ignore metadata error
  }

  onProgress?.('Rendering cover preview from Page 1...', 20);
  const { blob: coverBlob, dataUrl: coverDataUrl } = await renderFirstPageCover(pdfDoc);

  const pageTexts: { pageNumber: number; text: string }[] = [];
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const pct = 20 + Math.round((pageNum / numPages) * 70);
    onProgress?.(`Extracting text from page ${pageNum} of ${numPages}...`, pct);
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStr = buildPageParagraphs(textContent.items as any[]);
      pageTexts.push({ pageNumber: pageNum, text: pageStr });
    } catch {
      pageTexts.push({ pageNumber: pageNum, text: '' });
    }
  }

  onProgress?.('Structuring chapters for Text & Audio Reader...', 95);
  const chapters = groupPagesIntoChapters(pageTexts, metaTitle || fallbackTitle);
  const fullCombinedText = chapters.map((c) => c.content).join('\n\n');
  const totalWords = fullCombinedText.trim()
    ? fullCombinedText.trim().split(/\s+/).length
    : 0;

  const firstCleanParagraphs = fullCombinedText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^#+\s*/, '').trim())
    .filter((p) => p.length > 40)
    .slice(0, 2)
    .join(' ');

  const summaryPreview = (metaSubject || firstCleanParagraphs || '').slice(0, 600);

  onProgress?.('PDF converted to Text & Audio format!', 100);
  return {
    title: metaTitle || fallbackTitle || 'Untitled Book',
    author: metaAuthor,
    subject: metaSubject,
    numPages,
    totalWords,
    chapters,
    coverBlob,
    coverDataUrl,
    summaryPreview,
  };
}

/**
 * Extracts structured text chapters from a remote PDF URL if a previously uploaded PDF book
 * does not have extracted text chapters stored in Firestore yet.
 */
export async function extractPdfTextFromUrl(
  pdfUrl: string,
  bookTitle = 'Book'
): Promise<ExtractedPdfChapter[]> {
  if (!pdfUrl) return [];
  const loadingTask = pdfjsLib.getDocument({
    url: pdfUrl,
    withCredentials: false,
  });
  const pdfDoc = await loadingTask.promise;
  const maxPages = Math.min(pdfDoc.numPages, 150);
  const pageTexts: { pageNumber: number; text: string }[] = [];

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStr = buildPageParagraphs(textContent.items as any[]);
      pageTexts.push({ pageNumber: pageNum, text: pageStr });
    } catch {
      pageTexts.push({ pageNumber: pageNum, text: '' });
    }
  }

  return groupPagesIntoChapters(pageTexts, bookTitle);
}
