import { useId, useRef, type ReactNode } from 'react';

interface FilePickerProps {
  onFiles: (files: File[]) => void;
  className?: string;
  variant?: 'primary' | 'default' | 'ghost';
  children: ReactNode;
}

/** A button that opens the system file dialog for PDFs. */
export function FilePicker({
  onFiles,
  className = 'button',
  variant = 'default',
  children,
}: FilePickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  return (
    <>
      <input
        ref={input}
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="visually-hidden"
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = ''; // allow choosing the same file again
        }}
      />
      <button
        type="button"
        className={className}
        data-variant={variant}
        onClick={() => input.current?.click()}
      >
        {children}
      </button>
    </>
  );
}
