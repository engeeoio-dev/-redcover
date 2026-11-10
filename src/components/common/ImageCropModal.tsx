import React, { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

type CropKind = 'avatar' | 'cover' | 'book-cover';

interface ImageCropModalProps {
  file: File;
  kind: CropKind;
  onCancel: () => void;
  onSave: (file: File) => Promise<void>;
}

interface CropPoint {
  x: number;
  y: number;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  file,
  kind,
  onCancel,
  onSave,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropPoint>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const baseScale =
    imageSize.width && viewportSize.width
      ? Math.max(viewportSize.width / imageSize.width, viewportSize.height / imageSize.height)
      : 1;
  const scale = baseScale * zoom;
  const renderedWidth = imageSize.width * scale;
  const renderedHeight = imageSize.height * scale;

  useEffect(() => {
    if (!imageSize.width || !viewportSize.width || !viewportSize.height) return;
    setOffset({
      x: (viewportSize.width - imageSize.width * scale) / 2,
      y: (viewportSize.height - imageSize.height * scale) / 2,
    });
  }, [imageSize.width, imageSize.height, viewportSize.width, viewportSize.height, scale]);

  const clampOffset = (point: CropPoint, nextScale = scale): CropPoint => ({
    x: Math.min(0, Math.max(viewportSize.width - imageSize.width * nextScale, point.x)),
    y: Math.min(0, Math.max(viewportSize.height - imageSize.height * nextScale, point.y)),
  });

  const centerImage = (nextZoom: number) => {
    const nextScale = baseScale * nextZoom;
    setZoom(nextZoom);
    setOffset({
      x: (viewportSize.width - imageSize.width * nextScale) / 2,
      y: (viewportSize.height - imageSize.height * nextScale) / 2,
    });
  };

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image) return;
    setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    setZoom(1);
    const nextScale = Math.max(
      viewportSize.width / image.naturalWidth,
      viewportSize.height / image.naturalHeight
    );
    setOffset({
      x: (viewportSize.width - image.naturalWidth * nextScale) / 2,
      y: (viewportSize.height - image.naturalHeight * nextScale) / 2,
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset(
      clampOffset({
        x: drag.offsetX + event.clientX - drag.clientX,
        y: drag.offsetY + event.clientY - drag.clientY,
      })
    );
  };

  const handleSave = async () => {
    const image = imageRef.current;
    if (!image || !imageSize.width || !viewportSize.width) return;

    setSaving(true);
    setError('');
    try {
      const sourceX = Math.max(0, -offset.x / scale);
      const sourceY = Math.max(0, -offset.y / scale);
      const sourceWidth = viewportSize.width / scale;
      const sourceHeight = viewportSize.height / scale;
      const canvas = document.createElement('canvas');
      canvas.width = kind === 'avatar' ? 1024 : 1600;
      canvas.height = kind === 'avatar' ? 1024 : kind === 'book-cover' ? 2133 : 600;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare the cropped image.');
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('Could not crop this image.'))),
          'image/jpeg',
          0.92
        );
      });
      const filename = `${file.name.replace(/\.[^.]+$/, '')}-cropped.jpg`;
      await onSave(new File([blob], filename, { type: 'image/jpeg' }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this crop.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-3 sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-crop-title"
        className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#DDDDE3] bg-white p-4 shadow-2xl dark:border-[#2C2C35] dark:bg-[#16161A] sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="image-crop-title" className="font-display text-lg font-bold">
              Crop {kind === 'avatar' ? 'Profile Picture' : kind === 'book-cover' ? 'Book Cover' : 'Banner'}
            </h2>
            <p className="mt-0.5 text-xs text-[#777780] dark:text-[#9E9EA9]">
              Drag to reposition, then adjust zoom.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close crop dialog"
            className="rounded-lg p-2 text-[#777780] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerCancel={() => { dragRef.current = null; }}
          className={`relative mx-auto w-full touch-none select-none overflow-hidden border border-white/20 bg-black/90 ${
            kind === 'avatar'
              ? 'aspect-square max-w-[min(76vw,380px)] rounded-full'
              : kind === 'book-cover'
              ? 'mx-auto aspect-[3/4] max-w-[min(76vw,320px)] rounded-lg'
              : 'aspect-[8/3] rounded-xl'
          }`}
          style={{ cursor: 'grab' }}
        >
          {imageUrl && (
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Crop preview"
              draggable={false}
              onLoad={handleImageLoad}
              className="pointer-events-none absolute max-w-none"
              style={{
                width: renderedWidth,
                height: renderedHeight,
                left: offset.x,
                top: offset.y,
              }}
            />
          )}
        </div>

        <div className="mx-auto mt-5 flex max-w-md items-center gap-3">
          <ZoomOut className="h-4 w-4 shrink-0 text-[#777780]" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => centerImage(Number(event.target.value))}
            aria-label="Crop zoom"
            className="w-full accent-[#E43136]"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-[#777780]" />
        </div>

        {error && <p className="mt-3 text-center text-xs text-[#D9363E]">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[#777780] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !imageSize.width}
            className="rounded-lg bg-[#E43136] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C8282D] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Uploading…' : 'Apply Crop'}
          </button>
        </div>
      </section>
    </div>
  );
};