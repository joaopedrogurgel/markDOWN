import { lazy, Suspense, useEffect, useState } from 'react';
import { currentMarkdown, type Conversions, type ConversionItem } from '../hooks/useConversions';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { downloadText } from '../lib/download';
import { formatDuration, plural, toMarkdownName } from '../lib/format';
import { countWords } from '../lib/markdown';
import { FileList } from './FileList';
import { FilePicker } from './FilePicker';
import { CopyIcon, DownloadIcon, UndoIcon, UploadIcon } from './Icons';
import { OptionsPanel } from './OptionsPanel';
import { SourceEditor } from './SourceEditor';
import styles from './Workspace.module.css';

const MarkdownPreview = lazy(() => import('./MarkdownPreview'));

type ViewMode = 'source' | 'split' | 'preview';

const VIEWS: Array<{ mode: ViewMode; label: string; wideOnly?: boolean }> = [
  { mode: 'source', label: 'Markdown' },
  { mode: 'split', label: 'Lado a lado', wideOnly: true },
  { mode: 'preview', label: 'Visualização' },
];

export function Workspace({ conversions }: { conversions: Conversions }) {
  const { items, selected, selectedId, options } = conversions;
  const isWide = useMediaQuery('(min-width: 960px)');
  const [mode, setMode] = useState<ViewMode>('split');
  const effectiveMode = !isWide && mode === 'split' ? 'preview' : mode;

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Arquivos e opções">
        <div className={styles.sidebarHead}>
          <h2 className={styles.sidebarTitle}>{plural(items.length, 'arquivo', 'arquivos')}</h2>
          <FilePicker onFiles={conversions.addFiles} variant="default">
            <UploadIcon />
            Adicionar
          </FilePicker>
        </div>
        <FileList
          items={items}
          selectedId={selectedId}
          onSelect={conversions.select}
          onRemove={conversions.remove}
        />
        <details className={styles.options} open={isWide || undefined}>
          <summary className={styles.optionsSummary}>Opções de conversão</summary>
          <OptionsPanel options={options} onChange={conversions.setOptions} layout="column" />
        </details>
      </aside>

      <section className={styles.main} aria-label="Resultado">
        {selected ? (
          <Result
            key={selected.id}
            item={selected}
            mode={effectiveMode}
            onModeChange={setMode}
            isWide={isWide}
            conversions={conversions}
          />
        ) : null}
      </section>
    </div>
  );
}

interface ResultProps {
  item: ConversionItem;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  isWide: boolean;
  conversions: Conversions;
}

function Result({ item, mode, onModeChange, isWide, conversions }: ResultProps) {
  if (item.status === 'queued' || item.status === 'reading') {
    const { page = 0, total = 0 } = item.progress ?? {};
    return (
      <div className={styles.state} role="status">
        <p className={styles.stateTitle}>Convertendo {item.name}</p>
        <progress
          className={styles.progress}
          max={total || 1}
          value={page}
          aria-label="Progresso da leitura"
        />
        <p className={styles.stateText}>
          {item.status === 'queued'
            ? 'Aguardando o arquivo anterior.'
            : total
              ? `Página ${page} de ${total}`
              : 'Abrindo o PDF…'}
        </p>
      </div>
    );
  }

  if (item.status === 'error') {
    return (
      <div className={styles.state} data-tone="error">
        <p className={styles.stateTitle}>Não foi possível converter {item.name}</p>
        <p className={styles.stateText}>{item.error}</p>
        <button type="button" className="button" onClick={() => conversions.remove(item.id)}>
          Remover da lista
        </button>
      </div>
    );
  }

  const markdown = currentMarkdown(item);
  if (!item.markdown.trim() && item.draft === null) {
    return (
      <div className={styles.state}>
        <p className={styles.stateTitle}>Nenhum texto encontrado</p>
        <p className={styles.stateText}>
          Este PDF parece ser formado só por imagens, como um documento escaneado. Passe-o por um OCR (por
          exemplo, o do Google Drive ou do Adobe Acrobat) para criar uma camada de texto e envie de novo.
        </p>
      </div>
    );
  }

  return (
    <>
      <Toolbar
        item={item}
        markdown={markdown}
        mode={mode}
        onModeChange={onModeChange}
        isWide={isWide}
        conversions={conversions}
      />
      <div className={styles.panes} data-mode={mode}>
        {mode !== 'preview' && (
          <div className={styles.pane}>
            <SourceEditor
              value={markdown}
              onChange={(value) => conversions.edit(item.id, value)}
              label={`Markdown de ${item.name}`}
            />
          </div>
        )}
        {mode !== 'source' && (
          <div className={styles.pane} data-kind="preview">
            <Suspense fallback={<p className={styles.stateText}>Carregando visualização…</p>}>
              <MarkdownPreview markdown={markdown} />
            </Suspense>
          </div>
        )}
      </div>
    </>
  );
}

interface ToolbarProps extends ResultProps {
  markdown: string;
}

function Toolbar({ item, markdown, mode, onModeChange, isWide, conversions }: ToolbarProps) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  const pages = item.pages?.length ?? 0;
  const words = countWords(markdown);

  return (
    <div className={styles.toolbar}>
      <div className={styles.fileMeta}>
        <h2 className={styles.fileName} title={item.name}>
          {toMarkdownName(item.name)}
        </h2>
        <p className={styles.facts}>
          <span>{plural(pages, 'página', 'páginas')}</span>
          <span>{plural(words, 'palavra', 'palavras')}</span>
          {item.durationMs !== null && <span>convertido em {formatDuration(item.durationMs)}</span>}
        </p>
      </div>

      <div className={styles.controls}>
        <div className={styles.segmented} role="radiogroup" aria-label="Modo de exibição">
          {VIEWS.filter((view) => isWide || !view.wideOnly).map((view) => (
            <button
              key={view.mode}
              type="button"
              role="radio"
              aria-checked={mode === view.mode}
              className={styles.segment}
              onClick={() => onModeChange(view.mode)}
            >
              {view.label}
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          {item.draft !== null && (
            <button
              type="button"
              className="button"
              data-variant="ghost"
              onClick={() => conversions.discardDraft(item.id)}
              title="Voltar ao Markdown gerado pela conversão"
            >
              <UndoIcon />
              Descartar edições
            </button>
          )}
          <button type="button" className="button" onClick={copy}>
            <CopyIcon />
            {copied === 'ok' ? 'Copiado' : copied === 'fail' ? 'Não foi possível copiar' : 'Copiar'}
          </button>
          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => downloadText(toMarkdownName(item.name), markdown)}
          >
            <DownloadIcon />
            Baixar .md
          </button>
        </div>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {copied === 'ok' ? 'Markdown copiado para a área de transferência.' : ''}
      </p>
    </div>
  );
}
