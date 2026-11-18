import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { pagesToMarkdown, type ConversionOptions, type PageText } from '../lib/markdown';
import { ExtractError, extractPdf } from '../lib/pdf/extract';
import * as storage from '../lib/storage';
import { reportError, track } from '../lib/telemetry';

export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export type ItemStatus = 'queued' | 'reading' | 'done' | 'error';

export interface ConversionItem {
  id: string;
  name: string;
  size: number;
  status: ItemStatus;
  progress: { page: number; total: number } | null;
  pages: PageText[] | null;
  /** Markdown generated from `pages` with the current options. */
  markdown: string;
  /** The user's edits, if any. Takes precedence over `markdown`. */
  draft: string | null;
  error: string | null;
  durationMs: number | null;
  /** True when the item came back from the history of an earlier visit. */
  restored: boolean;
}

interface State {
  items: ConversionItem[];
  selectedId: string | null;
  options: ConversionOptions;
}

type Action =
  | { type: 'add'; items: ConversionItem[] }
  | { type: 'restore'; items: storage.StoredItem[] }
  | { type: 'start'; id: string }
  | { type: 'progress'; id: string; page: number; total: number }
  | { type: 'done'; id: string; pages: PageText[]; durationMs: number }
  | { type: 'fail'; id: string; error: string }
  | { type: 'remove'; id: string }
  | { type: 'select'; id: string }
  | { type: 'edit'; id: string; draft: string }
  | { type: 'discardDraft'; id: string }
  | { type: 'setOptions'; options: ConversionOptions }
  | { type: 'clear' };

const update = (
  items: ConversionItem[],
  id: string,
  patch: (item: ConversionItem) => Partial<ConversionItem>,
) => items.map((item) => (item.id === id ? { ...item, ...patch(item) } : item));

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add':
      return {
        ...state,
        items: [...state.items, ...action.items],
        selectedId: action.items[0]?.id ?? state.selectedId,
      };
    case 'restore': {
      const known = new Set(state.items.map((item) => item.id));
      const restored: ConversionItem[] = action.items
        .filter((stored) => !known.has(stored.id))
        .map((stored) => ({
          id: stored.id,
          name: stored.name,
          size: stored.size,
          status: 'done',
          progress: null,
          pages: stored.pages,
          markdown: pagesToMarkdown(stored.pages, state.options),
          draft: stored.draft,
          error: null,
          durationMs: stored.durationMs,
          restored: true,
        }));
      if (!restored.length) return state;
      return {
        ...state,
        items: [...restored, ...state.items],
        selectedId: state.selectedId ?? restored[0].id,
      };
    }
    case 'start':
      return { ...state, items: update(state.items, action.id, () => ({ status: 'reading' })) };
    case 'progress':
      return {
        ...state,
        items: update(state.items, action.id, () => ({
          progress: { page: action.page, total: action.total },
        })),
      };
    case 'done':
      return {
        ...state,
        items: update(state.items, action.id, () => ({
          status: 'done',
          pages: action.pages,
          markdown: pagesToMarkdown(action.pages, state.options),
          durationMs: action.durationMs,
        })),
      };
    case 'fail':
      return {
        ...state,
        items: update(state.items, action.id, () => ({ status: 'error', error: action.error })),
      };
    case 'remove': {
      const index = state.items.findIndex((item) => item.id === action.id);
      const items = state.items.filter((item) => item.id !== action.id);
      const selectedId =
        state.selectedId === action.id
          ? (items[Math.min(index, items.length - 1)]?.id ?? null)
          : state.selectedId;
      return { ...state, items, selectedId };
    }
    case 'select':
      return { ...state, selectedId: action.id };
    case 'edit':
      return { ...state, items: update(state.items, action.id, () => ({ draft: action.draft })) };
    case 'discardDraft':
      return { ...state, items: update(state.items, action.id, () => ({ draft: null })) };
    case 'setOptions':
      return {
        ...state,
        options: action.options,
        items: state.items.map((item) =>
          item.pages ? { ...item, markdown: pagesToMarkdown(item.pages, action.options) } : item,
        ),
      };
    case 'clear':
      return { ...state, items: [], selectedId: null };
  }
}

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

function validate(file: File): string | null {
  if (!isPdf(file)) return 'Só arquivos PDF são aceitos.';
  if (file.size === 0) return 'O arquivo está vazio.';
  if (file.size > MAX_FILE_BYTES) return 'O arquivo passa de 100 MB.';
  return null;
}

const toStored = (item: ConversionItem): storage.StoredItem => ({
  id: item.id,
  name: item.name,
  size: item.size,
  pages: item.pages ?? [],
  draft: item.draft,
  durationMs: item.durationMs,
  savedAt: Date.now(),
});

/**
 * Owns the list of files: converts them one at a time, keeps their Markdown in sync
 * with the options and, when history is on, keeps finished files between visits.
 */
export function useConversions() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    items: [],
    selectedId: null,
    options: storage.loadOptions(),
  }));
  const [historyEnabled, setHistoryEnabledState] = useState(storage.isHistoryEnabled);
  // With history off there is nothing to read, so it counts as loaded from the start.
  const [historyLoaded, setHistoryLoaded] = useState(() => !storage.isHistoryEnabled());
  const files = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());

  // Bring back the files of the previous visit.
  useEffect(() => {
    if (!storage.isHistoryEnabled()) return;
    let cancelled = false;
    void storage.loadHistory().then((items) => {
      if (cancelled) return;
      if (items.length) dispatch({ type: 'restore', items });
      setHistoryLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the history in step with the finished files, debounced while typing. Only
  // after it has been read, so an early save cannot wipe what is stored.
  const pendingSave = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!historyEnabled || !historyLoaded) return;
    const finished = state.items.filter((item) => item.status === 'done' && item.pages);
    pendingSave.current = setTimeout(() => void storage.saveHistory(finished.map(toStored)), 400);
    return () => clearTimeout(pendingSave.current);
  }, [state.items, historyEnabled, historyLoaded]);

  const addFiles = useCallback((list: Iterable<File>) => {
    const items: ConversionItem[] = [];
    for (const file of list) {
      const id = crypto.randomUUID();
      const error = validate(file);
      if (!error) files.current.set(id, file);
      items.push({
        id,
        name: file.name,
        size: file.size,
        status: error ? 'error' : 'queued',
        progress: null,
        pages: null,
        markdown: '',
        draft: null,
        error,
        durationMs: null,
        restored: false,
      });
    }
    if (items.length) dispatch({ type: 'add', items });
  }, []);

  // Process the queue sequentially: one PDF at a time keeps memory use predictable.
  const busy = state.items.some((item) => item.status === 'reading');
  const next = state.items.find((item) => item.status === 'queued');

  useEffect(() => {
    if (busy || !next) return;
    const file = files.current.get(next.id);
    if (!file) return;

    const { id } = next;
    const controller = new AbortController();
    controllers.current.set(id, controller);
    dispatch({ type: 'start', id });
    const started = performance.now();

    file
      .arrayBuffer()
      .then((data) =>
        extractPdf(data, {
          signal: controller.signal,
          onProgress: ({ page, total }) => dispatch({ type: 'progress', id, page, total }),
        }),
      )
      .then(({ pages }) => {
        dispatch({ type: 'done', id, pages, durationMs: performance.now() - started });
        track(pages.some((page) => page.runs.length > 0) ? 'converted' : 'no-text');
      })
      .catch((error: unknown) => {
        if (error instanceof ExtractError && error.code === 'aborted') return;
        const message =
          error instanceof ExtractError ? error.message : 'Não foi possível converter este arquivo.';
        dispatch({ type: 'fail', id, error: message });
        track('failed');
        // Damaged or protected files are the user's situation, not a bug worth reporting.
        if (!(error instanceof ExtractError) || error.code === 'unknown') reportError(error);
      })
      .finally(() => {
        controllers.current.delete(id);
        files.current.delete(id);
      });
  }, [busy, next]);

  const remove = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    files.current.delete(id);
    dispatch({ type: 'remove', id });
  }, []);

  const clear = useCallback(() => {
    controllers.current.forEach((controller) => controller.abort());
    files.current.clear();
    dispatch({ type: 'clear' });
  }, []);

  const setOptions = useCallback((options: ConversionOptions) => {
    storage.saveOptions(options);
    dispatch({ type: 'setOptions', options });
  }, []);

  const setHistoryEnabled = useCallback((enabled: boolean) => {
    storage.setHistoryEnabled(enabled);
    setHistoryEnabledState(enabled);
    if (!enabled) void storage.clearHistory();
  }, []);

  /** Resolves once the stored files are gone, so a reload right after cannot bring them back. */
  const clearHistory = useCallback(async () => {
    clearTimeout(pendingSave.current);
    await storage.clearHistory();
    dispatch({ type: 'clear' });
  }, []);

  return {
    ...state,
    selected: state.items.find((item) => item.id === state.selectedId) ?? null,
    historyEnabled,
    historyLoaded,
    addFiles,
    remove,
    clear,
    clearHistory,
    setHistoryEnabled,
    setOptions,
    select: useCallback((id: string) => dispatch({ type: 'select', id }), []),
    edit: useCallback((id: string, draft: string) => dispatch({ type: 'edit', id, draft }), []),
    discardDraft: useCallback((id: string) => dispatch({ type: 'discardDraft', id }), []),
  };
}

export type Conversions = ReturnType<typeof useConversions>;

export const currentMarkdown = (item: ConversionItem) => item.draft ?? item.markdown;
