import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { currentMarkdown, type Conversions, type ConversionItem } from '../hooks/useConversions';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { downloadText, downloadZip } from '../lib/download';
import { formatDuration, plural, toMarkdownName } from '../lib/format';
import { countWords } from '../lib/markdown';
import { track } from '../lib/telemetry';
import { FileList } from './FileList';
import { FilePicker } from './FilePicker';
import { CopyIcon, DownloadIcon, UndoIcon, UploadIcon } from './Icons';
import { OptionsPanel } from './OptionsPanel';
import { SourceEditor } from './SourceEditor';
import styles from './Workspace.module.css';

// Both are sizeable and only needed once a file is open.
const MarkdownPreview = lazy(() => import('./MarkdownPreview'));
const MarkdownEditor = lazy(() => import('./MarkdownEditor'));

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
  const finished = items.filter((item) => item.status === 'done' && item.markdown.trim());

  const downloadAll = () => {
    track('downloaded-zip');
    void downloadZip(
      'markdown.zip',
      finished.map((item) => ({ name: toMarkdownName(item.name), content: currentMarkdown(item) })),
    );
  };

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
        {finished.length > 1 && (
          <button type="button" className="button" onClick={downloadAll}>
            <DownloadIcon />
            Baixar todos (.zip)
          </button>
        )}
        <details className={styles.options} open={isWide || undefined}>
          <summary className={styles.optionsSummary}>Opções de conversão</summary>
          <OptionsPanel options={options} onChange={conversions.setOptions} layout="column" />
          <HistorySetting conversions={conversions} />
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

/**
 * Scrolls the preview so it shows the same part of the document as the editor:
 * headings are the anchors, and the space between two headings is interpolated.
 */
function scrollPreviewTo(pane: HTMLElement, markdown: string, topLine: number) {
  const lines = markdown.split('\n');
  const headingLines: number[] = [];
  lines.forEach((line, index) => {
    if (/^#{1,6}\s/.test(line)) headingLines.push(index + 1);
  });
  const headings = [...pane.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')];
  const offset = (element: HTMLElement) =>
    element.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;

  const passed = headingLines.filter((line) => line <= topLine).length;
  const fromLine = passed ? headingLines[passed - 1] : 1;
  const toLine = headingLines[passed] ?? lines.length;
  const fromTop = passed && headings[passed - 1] ? offset(headings[passed - 1]) : 0;
  const toTop = headings[passed] ? offset(headings[passed]) : pane.scrollHeight - pane.clientHeight;
  const fraction = Math.min(1, Math.max(0, (topLine - fromLine) / Math.max(1, toLine - fromLine)));
  pane.scrollTop = fromTop + fraction * (toTop - fromTop);
}

function Result({ item, mode, onModeChange, isWide, conversions }: ResultProps) {
  const previewPane = useRef<HTMLDivElement>(null);
  const markdown = currentMarkdown(item);
  const label = `Markdown de ${item.name}`;
  const { edit } = conversions;
  const onEdit = useCallback((value: string) => edit(item.id, value), [edit, item.id]);
  const syncPreview = useCallback(
    (topLine: number) => {
      if (previewPane.current) scrollPreviewTo(previewPane.current, markdown, topLine);
    },
    [markdown],
  );

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
          <div className={styles.pane} data-kind="source">
            <Suspense fallback={<SourceEditor value={markdown} onChange={onEdit} label={label} />}>
              <MarkdownEditor
                value={markdown}
                onChange={onEdit}
                label={label}
                onTopLineChange={mode === 'split' ? syncPreview : undefined}
              />
            </Suspense>
          </div>
        )}
        {mode !== 'source' && (
          <div ref={previewPane} className={styles.pane} data-kind="preview">
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
      track('copied');
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
            onClick={() => {
              downloadText(toMarkdownName(item.name), markdown);
              track('downloaded');
            }}
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

/** Lets people keep their files between visits, or not, and clear what is kept. */
function HistorySetting({ conversions }: { conversions: Conversions }) {
  const { historyEnabled, setHistoryEnabled, clearHistory } = conversions;
  return (
    <div className={styles.history}>
      <label className={styles.historyToggle}>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={historyEnabled}
          onChange={(event) => setHistoryEnabled(event.target.checked)}
        />
        Guardar arquivos neste navegador
      </label>
      <p className={styles.historyNote}>
        {historyEnabled
          ? 'Os arquivos convertidos ficam salvos só neste aparelho e voltam na próxima visita. Em computadores compartilhados, desligue ou limpe ao terminar.'
          : 'Os arquivos somem ao fechar ou recarregar a página.'}
      </p>
      {historyEnabled && (
        <button type="button" className="button" data-variant="ghost" onClick={clearHistory}>
          Limpar histórico
        </button>
      )}
    </div>
  );
}
