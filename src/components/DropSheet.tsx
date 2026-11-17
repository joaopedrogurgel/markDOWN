import { FilePicker } from './FilePicker';
import { UploadIcon } from './Icons';
import styles from './DropSheet.module.css';

interface DropSheetProps {
  dragging: boolean;
  onFiles: (files: File[]) => void;
  onExample: () => void;
  loadingExample: boolean;
}

/** The main upload target, drawn as a sheet of ruled paper. */
export function DropSheet({ dragging, onFiles, onExample, loadingExample }: DropSheetProps) {
  return (
    <section className={styles.sheet} data-dragging={dragging || undefined} aria-labelledby="drop-title">
      <div className={styles.icon} aria-hidden>
        <UploadIcon />
      </div>
      <h2 id="drop-title" className={styles.title}>
        {dragging ? 'Solte para converter' : 'Arraste seus PDFs para cá'}
      </h2>
      <p className={styles.hint}>Vários arquivos de uma vez, até 100 MB cada.</p>
      <div className={styles.actions}>
        <FilePicker onFiles={onFiles} variant="primary">
          Escolher PDFs
        </FilePicker>
        <button
          type="button"
          className="button"
          data-variant="ghost"
          onClick={onExample}
          disabled={loadingExample}
        >
          {loadingExample ? 'Carregando exemplo…' : 'Testar com um PDF de exemplo'}
        </button>
      </div>
    </section>
  );
}
