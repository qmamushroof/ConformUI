import { type ClipboardEvent, type DragEvent, type FC, useRef, useState } from 'react';
import { Icon, type IconName } from './icon';

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';
export const IMAGE_LIMITS_HELP = 'PNG, JPEG or WebP, up to 20 MB and 8192 px per side.';

/** Button, file picker, drop and paste for one image (SPEC-PROJ-01, SPEC-PROJ-02). */
export interface ImageDropZoneProps {
  label: string;
  onFile(file: File): void;
  disabled?: boolean;
  /** Replaces the default help line; formats and limits stay printed (SPEC-PROJ-02). */
  help?: string;
  error?: string;
  icon?: IconName;
  /** Id of an element that describes a problem with this zone. */
  describedBy?: string;
}

export const ImageDropZone: FC<ImageDropZoneProps> = ({ label, onFile, disabled, help, error, icon, describedBy }) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const f = e.dataTransfer?.files?.[0];
    if (f) onFile(f);
  };

  const onPaste = (e: ClipboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    for (const item of Array.from(e.clipboardData?.items ?? [])) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) {
          e.preventDefault();
          e.stopPropagation();
          onFile(f);
          return;
        }
      }
    }
  };

  return (
    <>
      <button
        type="button"
        className={`drop${over ? ' is-over' : ''}${error ? ' is-invalid' : ''}`}
        disabled={disabled}
        aria-describedby={describedBy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onPaste={onPaste}
      >
        <Icon name={icon ?? 'upload'} large />
        <span className="t">{label}</span>
        <span className="help">{help ?? IMAGE_LIMITS_HELP}</span>
        {error ? (
          <span className="error">
            <Icon name="alert" small />
            {error}
          </span>
        ) : null}
      </button>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </>
  );
};
