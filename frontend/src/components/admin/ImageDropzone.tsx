import { useCallback, useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageDropzoneProps {
  onFiles: (files: File[]) => Promise<void> | void;
  multiple?: boolean;
  uploading?: boolean;
  label?: string;
  className?: string;
}

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX = 8 * 1024 * 1024;

/** Drag & drop + click-to-browse uploader with client-side validation (Task 7). */
export function ImageDropzone({
  onFiles,
  multiple = true,
  uploading = false,
  label = 'اسحب الصور هنا أو اضغط للاختيار',
  className,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const files = Array.from(fileList);
      const invalid = files.find((f) => !ACCEPT.includes(f.type) || f.size > MAX);
      if (invalid) {
        setError('ملف غير صالح: يُسمح بصور JPEG/PNG/WEBP/AVIF حتى 8 ميجابايت');
        return;
      }
      setError(null);
      void onFiles(multiple ? files : files.slice(0, 1));
    },
    [onFiles, multiple],
  );

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(e.dataTransfer.files);
        }}
        disabled={uploading}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
          dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50',
          uploading && 'pointer-events-none opacity-70',
        )}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        ) : (
          <ImagePlus className="h-8 w-8 text-muted-foreground" />
        )}
        <span className="text-sm text-muted-foreground">{uploading ? 'جارٍ الرفع...' : label}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(',')}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
