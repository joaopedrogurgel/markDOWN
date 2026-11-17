import type { CSSProperties } from 'react';
import type { ConversionItem } from '../hooks/useConversions';
import { formatBytes } from '../lib/format';
import { CloseIcon, FileIcon } from './Icons';
import styles from './FileList.module.css';

interface FileListProps {
  items: ConversionItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

function statusText(item: ConversionItem): string {
  switch (item.status) {
    case 'queued':
      return 'Na fila';
    case 'reading':
      return item.progress ? `Lendo ${item.progress.page} de ${item.progress.total}` : 'Abrindo…';
    case 'error':
      return item.error ?? 'Erro';
    case 'done':
      return item.draft !== null ? 'Editado' : formatBytes(item.size);
  }
}

export function FileList({ items, selectedId, onSelect, onRemove }: FileListProps) {
  return (
    <ul className={styles.list} aria-label="Arquivos enviados">
      {items.map((item) => {
        const progress = item.progress ? item.progress.page / item.progress.total : 0;
        return (
          <li
            key={item.id}
            className={styles.item}
            data-status={item.status}
            aria-current={item.id === selectedId || undefined}
          >
            <button type="button" className={styles.select} onClick={() => onSelect(item.id)}>
              <FileIcon className={styles.icon} />
              <span className={styles.name} title={item.name}>
                {item.name}
              </span>
              <span className={styles.status} role={item.status === 'error' ? 'alert' : undefined}>
                {statusText(item)}
              </span>
              {item.status === 'reading' && (
                <span
                  className={styles.progress}
                  style={{ '--progress': progress } as CSSProperties}
                  aria-hidden
                />
              )}
            </button>
            <button
              type="button"
              className={styles.remove}
              onClick={() => onRemove(item.id)}
              aria-label={`Remover ${item.name}`}
              title="Remover"
            >
              <CloseIcon />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
