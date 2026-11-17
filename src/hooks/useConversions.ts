import { useCallback, useEffect, useReducer, useRef } from 'react';
import { DEFAULT_OPTIONS, pagesToMarkdown, type ConversionOptions, type PageText } from '../lib/markdown';
import { ExtractError, extractPdf } from '../lib/pdf/extract';

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
}

interface State {
  items: ConversionItem[];
  selectedId: string | null;
  options: ConversionOptions;
}

type Action =
  | { type: 'add'; items: ConversionItem[] }
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
        selectedId: state.selectedId ?? action.items[0]?.id ?? null,
      };
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

/** Owns the list of files, converts them one at a time and keeps their Markdown in sync with the options. */
export function useConversions() {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    selectedId: null,
    options: DEFAULT_OPTIONS,
  });
  const files = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());

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
      .then(({ pages }) => dispatch({ type: 'done', id, pages, durationMs: performance.now() - started }))
      .catch((error: unknown) => {
        if (error instanceof ExtractError && error.code === 'aborted') return;
        const message =
          error instanceof ExtractError ? error.message : 'Não foi possível converter este arquivo.';
        dispatch({ type: 'fail', id, error: message });
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

  return {
    ...state,
    selected: state.items.find((item) => item.id === state.selectedId) ?? null,
    addFiles,
    remove,
    clear,
    select: useCallback((id: string) => dispatch({ type: 'select', id }), []),
    edit: useCallback((id: string, draft: string) => dispatch({ type: 'edit', id, draft }), []),
    discardDraft: useCallback((id: string) => dispatch({ type: 'discardDraft', id }), []),
    setOptions: useCallback((options: ConversionOptions) => dispatch({ type: 'setOptions', options }), []),
  };
}

export type Conversions = ReturnType<typeof useConversions>;

export const currentMarkdown = (item: ConversionItem) => item.draft ?? item.markdown;
