import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Upload,
  Columns,
  ScrollText,
  Bookmark,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import { Chapter } from '../../models/types';
import {
  resolveFirebaseCoverUrl,
  recoverFirebaseStorageUrlOnError,
} from '../../services/firebase/storageService';

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export type PdfFitMode = 'width' | 'page' | 'custom';
export type PdfScrollMode = 'single' | 'continuous';

interface PdfCanvasReaderProps {
  bookId: string;
  bookTitle: string;
  authorName: string;
  fileURL: string;
  chapters: Chapter[];
  initialPage: number;
  readerTheme: 'light' | 'sepia' | 'dark' | 'black';
  bookmarkedPages: number[];
  onPageChange: (page: number, totalPages: number) => void;
  onTogglePageBookmark: (page: number) => void;
  onSwitchToTextMode: () => void;
  onTapCenter?: () => void;
}

interface SingleCanvasPageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  isVisible: boolean;
  onPageVisible?: (pageNumber: number) => void;
}

const LazyPdfPageCanvas: React.FC<SingleCanvasPageProps> = ({
  pdfDoc,
  pageNumber,
  scale,
  isVisible,
  onPageVisible,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [inViewport, setInViewport] = useState(isVisible);
  const [pageDims, setPageDims] = useState<{ width: number; height: number }>({
    width: Math.round(612 * scale),
    height: Math.round(792 * scale),
  });
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInViewport(true);
            if (entry.intersectionRatio >= 0.45 && onPageVisible) {
              onPageVisible(pageNumber);
            }
          }
        }
      },
      { rootMargin: '600px 0px', threshold: [0.05, 0.45, 0.75] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onPageVisible]);

  useEffect(() => {
    if (!inViewport && !isVisible) return;
    let cancelled = false;
    let renderTask: any = null;

    const renderPage = async () => {
      try {
        setRendering(true);
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.round(viewport.width);
        const height = Math.round(viewport.height);
        setPageDims({ width, height });

        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        } as any);
        await renderTask.promise;
      } catch {
        // Ignore cancelled render task
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    renderPage();
    return () => {
      cancelled = true;
      if (renderTask && typeof renderTask.cancel === 'function') {
        try {
          renderTask.cancel();
        } catch {}
      }
    };
  }, [pdfDoc, pageNumber, scale, inViewport, isVisible]);

  return (
    <div
      ref={containerRef}
      data-pdf-page={pageNumber}
      style={{ minHeight: `${pageDims.height}px`, width: `${pageDims.width}px` }}
      className="relative mx-auto bg-white shadow-md rounded-sm overflow-hidden border border-[#DDDCE3] dark:border-[#2A2A32] transition-all"
    >
      <canvas ref={canvasRef} className="block mx-auto bg-white" />
      {rendering && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-[#E43136] border-t-transparent animate-spin" />
        </div>
      )}
      <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded bg-black/55 text-white text-[10px] font-medium tabular-nums select-none">
        Page {pageNumber}
      </div>
    </div>
  );
};

export const PdfCanvasReader: React.FC<PdfCanvasReaderProps> = ({
  bookTitle,
  authorName,
  fileURL,
  chapters,
  initialPage,
  readerTheme,
  bookmarkedPages,
  onPageChange,
  onTogglePageBookmark,
  onSwitchToTextMode,
  onTapCenter,
}) => {
  const viewportContainerRef = useRef<HTMLDivElement | null>(null);
  const localFileInputRef = useRef<HTMLInputElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<number>(15);
  const [usingPrintSheetFallback, setUsingPrintSheetFallback] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [retryCount, setRetryCount] = useState<number>(0);

  const [currentPage, setCurrentPage] = useState<number>(Math.max(1, initialPage || 1));
  const [pageInput, setPageInput] = useState<string>(String(Math.max(1, initialPage || 1)));
  const [scrollMode, setScrollMode] = useState<PdfScrollMode>('single');
  const [fitMode, setFitMode] = useState<PdfFitMode>('width');
  const [customZoom, setCustomZoom] = useState<number>(1.15);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 820,
    height: 760,
  });
  const [basePageSize, setBasePageSize] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });

  // Synthesize print-accurate pages from extracted chapters when raw PDF binary is stored as Firestore text chapters or CORS-restricted
  const synthesizedPrintPages = useMemo(() => {
    const pages: { pageNumber: number; heading: string; paragraphs: string[] }[] = [];
    const allChapters = chapters.length > 0 ? chapters : [];
    for (const ch of allChapters) {
      const blocks = (ch.content || '')
        .split(/\n\s*\n/)
        .map((b) => b.trim())
        .filter(Boolean);
      const chunkSize = 5;
      for (let i = 0; i < Math.max(1, blocks.length); i += chunkSize) {
        pages.push({
          pageNumber: pages.length + 1,
          heading: i === 0 ? ch.title : `${ch.title} (cont.)`,
          paragraphs: blocks.slice(i, i + chunkSize),
        });
      }
    }
    if (pages.length === 0) {
      pages.push({
        pageNumber: 1,
        heading: bookTitle,
        paragraphs: ['No page content available.'],
      });
    }
    return pages;
  }, [chapters, bookTitle]);

  const totalPages = pdfDoc ? pdfDoc.numPages : synthesizedPrintPages.length;

  // Observe container resize for Fit-to-Width and Fit-to-Page calculations
  useEffect(() => {
    const el = viewportContainerRef.current;
    if (!el) return;
    const updateDims = () => {
      setContainerSize({
        width: Math.max(300, el.clientWidth - 32),
        height: Math.max(400, el.clientHeight - 40),
      });
    };
    updateDims();
    const ro = new ResizeObserver(updateDims);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load PDF document via PDF.js
  useEffect(() => {
    let cancelled = false;
    let activeTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    const loadPdfFromSource = async () => {
      setLoadingPdf(true);
      setLoadProgress(15);
      setErrorMessage('');
      setUsingPrintSheetFallback(false);

      if (!fileURL || fileURL.startsWith('https://redcover.app/pdf-text-edition/')) {
        // Book was uploaded with Firestore-backed PDF chapters
        setPdfDoc(null);
        setUsingPrintSheetFallback(true);
        setLoadingPdf(false);
        return;
      }

      try {
        let resolvedUrl = fileURL;
        if (!fileURL.startsWith('http://') && !fileURL.startsWith('https://') && !fileURL.startsWith('blob:')) {
          resolvedUrl = await resolveFirebaseCoverUrl(fileURL);
        }

        const tryLoad = async (urlToLoad: string) => {
          activeTask = pdfjsLib.getDocument({
            url: urlToLoad,
            withCredentials: false,
          });
          activeTask.onProgress = (prog: { loaded: number; total: number }) => {
            if (!cancelled && prog.total > 0) {
              setLoadProgress(Math.min(95, Math.round((prog.loaded / prog.total) * 100)));
            }
          };
          return await activeTask.promise;
        };

        let loadedDoc: pdfjsLib.PDFDocumentProxy;
        try {
          loadedDoc = await tryLoad(resolvedUrl);
        } catch (firstErr) {
          const recovered = await recoverFirebaseStorageUrlOnError(resolvedUrl);
          if (recovered) {
            loadedDoc = await tryLoad(recovered);
          } else {
            throw firstErr;
          }
        }

        if (cancelled) return;
        setPdfDoc(loadedDoc);

        try {
          const firstPage = await loadedDoc.getPage(1);
          const vp = firstPage.getViewport({ scale: 1 });
          setBasePageSize({ width: vp.width || 612, height: vp.height || 792 });
        } catch {}

        const startP = Math.max(1, Math.min(loadedDoc.numPages, initialPage || 1));
        setCurrentPage(startP);
        setPageInput(String(startP));
        onPageChange(startP, loadedDoc.numPages);
      } catch (err: any) {
        if (cancelled) return;
        // If remote Storage bucket has CORS restrictions on raw ArrayBuffer requests,
        // automatically activate the high-precision Paginated Print Layout fallback if chapters exist,
        // or show the diagnostic recovery bar.
        if (chapters.length > 0) {
          setPdfDoc(null);
          setUsingPrintSheetFallback(true);
          const startP = Math.max(1, Math.min(synthesizedPrintPages.length, initialPage || 1));
          setCurrentPage(startP);
          setPageInput(String(startP));
          onPageChange(startP, synthesizedPrintPages.length);
        } else {
          setErrorMessage(
            err?.message || 'Unable to stream PDF binary directly from remote storage.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPdf(false);
        }
      }
    };

    loadPdfFromSource();
    return () => {
      cancelled = true;
      if (activeTask) {
        try {
          activeTask.destroy();
        } catch {}
      }
    };
  }, [fileURL, retryCount]);

  // Allow user to load a local PDF file directly into PDF.js canvas engine
  const handleLocalPdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingPdf(true);
    setErrorMessage('');
    try {
      const buf = await file.arrayBuffer();
      const task = pdfjsLib.getDocument({ data: buf });
      const loadedDoc = await task.promise;
      setPdfDoc(loadedDoc);
      setUsingPrintSheetFallback(false);
      const firstPage = await loadedDoc.getPage(1);
      const vp = firstPage.getViewport({ scale: 1 });
      setBasePageSize({ width: vp.width || 612, height: vp.height || 792 });
      setCurrentPage(1);
      setPageInput('1');
      onPageChange(1, loadedDoc.numPages);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not parse selected PDF file.');
    } finally {
      setLoadingPdf(false);
    }
  };

  // Compute effective scale from Fit Width / Fit Page / Custom Zoom
  const effectiveScale = useMemo(() => {
    if (fitMode === 'width') {
      const maxTargetWidth = Math.min(containerSize.width, 920);
      return Math.max(0.5, Math.min(2.2, maxTargetWidth / Math.max(1, basePageSize.width)));
    }
    if (fitMode === 'page') {
      const scaleW = containerSize.width / Math.max(1, basePageSize.width);
      const scaleH = containerSize.height / Math.max(1, basePageSize.height);
      return Math.max(0.45, Math.min(2.0, Math.min(scaleW, scaleH)));
    }
    return customZoom;
  }, [fitMode, customZoom, containerSize, basePageSize]);

  const zoomPercent = Math.round(effectiveScale * 100);

  const goToPage = useCallback(
    (targetPage: number) => {
      const clamped = Math.max(1, Math.min(totalPages, targetPage));
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      onPageChange(clamped, totalPages);

      if (scrollMode === 'continuous' && viewportContainerRef.current) {
        const pageEl = viewportContainerRef.current.querySelector(
          `[data-pdf-page="${clamped}"]`
        ) as HTMLElement | null;
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else if (viewportContainerRef.current) {
        viewportContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [totalPages, scrollMode, onPageChange]
  );

  // Sync external initialPage jumps (e.g., from Table of Contents or Bookmarks drawer)
  useEffect(() => {
    if (initialPage && initialPage !== currentPage && initialPage >= 1 && initialPage <= totalPages) {
      goToPage(initialPage);
    }
  }, [initialPage]);

  const handleVisiblePageInScroll = useCallback(
    (visiblePage: number) => {
      if (scrollMode !== 'continuous') return;
      setCurrentPage(visiblePage);
      setPageInput(String(visiblePage));
      onPageChange(visiblePage, totalPages);
    },
    [scrollMode, totalPages, onPageChange]
  );

  const handleZoomIn = () => {
    setFitMode('custom');
    setCustomZoom((z) => Math.min(2.5, Number(( (fitMode === 'custom' ? z : effectiveScale) + 0.15 ).toFixed(2))));
  };

  const handleZoomOut = () => {
    setFitMode('custom');
    setCustomZoom((z) => Math.max(0.5, Number(( (fitMode === 'custom' ? z : effectiveScale) - 0.15 ).toFixed(2))));
  };

  const isCurrentPageBookmarked = bookmarkedPages.includes(currentPage);

  const controlBarBg =
    readerTheme === 'black'
      ? 'bg-[#08080A] border-[#1F1F26] text-[#F5F5F7]'
      : readerTheme === 'dark'
      ? 'bg-[#16161C] border-[#282832] text-[#E8E8ED]'
      : readerTheme === 'sepia'
      ? 'bg-[#EFE5D2] border-[#DFD2B8] text-[#2D2419]'
      : 'bg-[#FAF9FB] border-[#DDDCE3] text-[#171717]';

  const canvasBackdropBg =
    readerTheme === 'black'
      ? 'bg-black'
      : readerTheme === 'dark'
      ? 'bg-[#0E0E12]'
      : readerTheme === 'sepia'
      ? 'bg-[#E9DEC8]'
      : 'bg-[#EDEDF2]';

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Dedicated PDF Control Sub-Toolbar */}
      <div
        className={`shrink-0 border-b px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs ${controlBarBg}`}
      >
        {/* Left: Page Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            className="p-1.5 rounded-lg border border-current/15 disabled:opacity-35 hover:border-[#E43136] cursor-pointer"
            title="Previous PDF Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = parseInt(pageInput, 10);
              if (!Number.isNaN(parsed)) goToPage(parsed);
            }}
            className="inline-flex items-center gap-1.5"
          >
            <span className="opacity-70 hidden sm:inline">Page</span>
            <input
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => {
                const parsed = parseInt(pageInput, 10);
                if (!Number.isNaN(parsed)) goToPage(parsed);
                else setPageInput(String(currentPage));
              }}
              aria-label="Current PDF page number"
              className="w-11 text-center py-1 px-1.5 rounded-md border border-current/20 bg-transparent font-semibold tabular-nums text-xs"
            />
            <span className="opacity-75 tabular-nums">/ {totalPages}</span>
          </form>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
            className="p-1.5 rounded-lg border border-current/15 disabled:opacity-35 hover:border-[#E43136] cursor-pointer"
            title="Next PDF Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onTogglePageBookmark(currentPage)}
            title={isCurrentPageBookmarked ? `Remove Bookmark on Page ${currentPage}` : `Bookmark Page ${currentPage}`}
            className={`ml-1 px-2 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
              isCurrentPageBookmarked
                ? 'border-[#E43136] bg-[#E43136]/10 text-[#E43136]'
                : 'border-current/15 hover:border-[#E43136]'
            }`}
          >
            <Bookmark className={`w-3 h-3 ${isCurrentPageBookmarked ? 'fill-[#E43136]' : ''}`} />
            <span className="hidden md:inline">
              {isCurrentPageBookmarked ? `Page ${currentPage} Saved` : 'Bookmark Page'}
            </span>
          </button>
        </div>

        {/* Center: Zoom & Fit Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg border border-current/15 hover:border-[#E43136] cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="min-w-[46px] text-center font-semibold tabular-nums text-[11px]">
            {zoomPercent}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg border border-current/15 hover:border-[#E43136] cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setFitMode('width')}
            className={`px-2 py-1 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
              fitMode === 'width'
                ? 'border-[#E43136] bg-[#E43136] text-white'
                : 'border-current/15 hover:border-[#E43136]'
            }`}
            title="Fit to Width"
          >
            <Maximize className="w-3 h-3" />
            <span className="hidden sm:inline">Fit Width</span>
          </button>

          <button
            type="button"
            onClick={() => setFitMode('page')}
            className={`px-2 py-1 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
              fitMode === 'page'
                ? 'border-[#E43136] bg-[#E43136] text-white'
                : 'border-current/15 hover:border-[#E43136]'
            }`}
            title="Fit to Page"
          >
            <Minimize className="w-3 h-3" />
            <span className="hidden sm:inline">Fit Page</span>
          </button>
        </div>

        {/* Right: Single-Page vs Continuous Scroll Mode */}
        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center rounded-lg border border-current/15 p-0.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setScrollMode('single')}
              className={`px-2 py-1 rounded-md inline-flex items-center gap-1 cursor-pointer ${
                scrollMode === 'single' ? 'bg-[#E43136] text-white' : 'opacity-75 hover:opacity-100'
              }`}
              title="Single-Page Mode"
            >
              <Columns className="w-3 h-3" />
              <span className="hidden sm:inline">Single Page</span>
            </button>
            <button
              type="button"
              onClick={() => setScrollMode('continuous')}
              className={`px-2 py-1 rounded-md inline-flex items-center gap-1 cursor-pointer ${
                scrollMode === 'continuous' ? 'bg-[#E43136] text-white' : 'opacity-75 hover:opacity-100'
              }`}
              title="Continuous Vertical Scroll Mode"
            >
              <ScrollText className="w-3 h-3" />
              <span className="hidden sm:inline">Continuous</span>
            </button>
          </div>

          <input
            ref={localFileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleLocalPdfSelect}
            className="hidden"
          />
          {usingPrintSheetFallback && (
            <button
              type="button"
              onClick={() => localFileInputRef.current?.click()}
              className="px-2 py-1 rounded-lg border border-current/20 hover:border-[#E43136] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
              title="Open local PDF file in PDF.js canvas"
            >
              <Upload className="w-3 h-3 text-[#E43136]" />
              <span className="hidden lg:inline">Load Local PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable PDF Viewport */}
      <div
        ref={viewportContainerRef}
        onClick={(e) => {
          if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT') {
            return;
          }
          onTapCenter?.();
        }}
        className={`flex-1 min-h-0 overflow-auto px-2 sm:px-6 py-6 ${canvasBackdropBg}`}
      >
        {loadingPdf ? (
          <div className="max-w-[680px] mx-auto bg-white dark:bg-[#18181F] rounded-xl shadow-md border border-[#DDDCE3] dark:border-[#2A2A32] p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#E43136] animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-[#171717] dark:text-[#F5F5F7]">
                    Rendering Original PDF Pages...
                  </h3>
                  <p className="text-xs text-[#777782]">
                    Initializing PDF.js engine ({loadProgress}%)
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#E43136] tabular-nums">{loadProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#F1F1F4] dark:bg-[#2A2A32] overflow-hidden">
              <div
                style={{ width: `${loadProgress}%` }}
                className="h-full bg-[#E43136] transition-all duration-200"
              />
            </div>
            <div className="space-y-3 animate-pulse pt-2">
              <div className="h-6 w-3/5 bg-[#F1F1F4] dark:bg-[#25252E] rounded" />
              <div className="h-4 w-full bg-[#F1F1F4] dark:bg-[#25252E] rounded" />
              <div className="h-4 w-11/12 bg-[#F1F1F4] dark:bg-[#25252E] rounded" />
              <div className="h-4 w-4/5 bg-[#F1F1F4] dark:bg-[#25252E] rounded" />
              <div className="h-64 w-full bg-[#F1F1F4] dark:bg-[#25252E] rounded-lg mt-4" />
            </div>
          </div>
        ) : errorMessage ? (
          <div className="max-w-lg mx-auto my-8 bg-white dark:bg-[#18181F] rounded-2xl border border-[#DDDCE3] dark:border-[#2A2A32] p-6 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#E43136]/10 text-[#E43136] flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#171717] dark:text-[#F5F5F7]">
              Could Not Stream Raw PDF File
            </h3>
            <p className="text-xs text-[#777782] leading-relaxed">
              {errorMessage} You can retry loading the remote file, select the PDF from your device, or read the book in Redcover Text Reader mode.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                className="py-2 px-4 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Loading PDF
              </button>
              <button
                type="button"
                onClick={() => localFileInputRef.current?.click()}
                className="py-2 px-4 rounded-xl border border-[#DDDCE3] dark:border-[#2A2A32] text-xs font-semibold text-[#171717] dark:text-[#F5F5F7] hover:border-[#E43136] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#E43136]" />
                Select Local PDF File
              </button>
              <button
                type="button"
                onClick={onSwitchToTextMode}
                className="py-2 px-4 rounded-xl border border-[#DDDCE3] dark:border-[#2A2A32] text-xs font-semibold text-[#E43136] hover:bg-[#E43136]/5 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Open in Text Reader
              </button>
            </div>
          </div>
        ) : pdfDoc ? (
          scrollMode === 'single' ? (
            <div key={`page-turn-${currentPage}`} className="py-2 pdf-page-turn">
              <LazyPdfPageCanvas
                key={`single-${currentPage}`}
                pdfDoc={pdfDoc}
                pageNumber={currentPage}
                scale={effectiveScale}
                isVisible={true}
              />
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {Array.from({ length: pdfDoc.numPages }, (_, idx) => idx + 1).map((pageNum) => (
                <LazyPdfPageCanvas
                  key={`cont-${pageNum}`}
                  pdfDoc={pdfDoc}
                  pageNumber={pageNum}
                  scale={effectiveScale}
                  isVisible={Math.abs(pageNum - currentPage) <= 1}
                  onPageVisible={handleVisiblePageInScroll}
                />
              ))}
            </div>
          )
        ) : (
          /* High-Precision Print-Sheet Page Renderer when PDF was stored via Firestore PDF-to-Text edition */
          <div className="space-y-6 py-2">
            {(scrollMode === 'single'
              ? [synthesizedPrintPages[currentPage - 1] || synthesizedPrintPages[0]]
              : synthesizedPrintPages
            ).map((sheet) => {
              const sheetWidth = Math.round(612 * effectiveScale);
              const sheetMinHeight = Math.round(792 * effectiveScale);
              const sheetFontSize = Math.max(12, Math.round(14.5 * effectiveScale));
              return (
                <div
                  key={sheet.pageNumber}
                  data-pdf-page={sheet.pageNumber}
                  style={{
                    width: `${sheetWidth}px`,
                    minHeight: `${sheetMinHeight}px`,
                    fontSize: `${sheetFontSize}px`,
                  }}
                  className={`mx-auto bg-white text-[#171717] shadow-md rounded-sm border border-[#DDDCE3] px-8 sm:px-14 py-10 sm:py-14 flex flex-col justify-between transition-all ${
                    scrollMode === 'single' ? 'pdf-page-turn' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-[#EBEBEF] pb-3 mb-6 text-[11px] text-[#777782] uppercase tracking-wider">
                      <span className="truncate max-w-[70%]">{bookTitle}</span>
                      <span>{authorName}</span>
                    </div>
                    <h4 className="font-display font-bold text-[1.15em] text-[#171717] mb-4">
                      {sheet.heading}
                    </h4>
                    <div className="font-display space-y-4 leading-[1.75] text-justify">
                      {sheet.paragraphs.map((p, idx) => (
                        <p key={idx} className="whitespace-pre-line">
                          {p.replace(/^#+\s*/, '')}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="pt-8 mt-8 border-t border-[#EBEBEF] flex items-center justify-between text-[11px] text-[#777782] tabular-nums">
                    <span>Redcover PDF Print Sheet</span>
                    <span className="font-semibold text-[#171717]">
                      Page {sheet.pageNumber} of {synthesizedPrintPages.length}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
