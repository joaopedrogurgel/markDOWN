import { DEFAULT_OPTIONS, type ConversionOptions, type PageText } from './markdown';

const OPTIONS_KEY = 'markdown:options';
const HISTORY_SETTING_KEY = 'markdown:history';
const HISTORY_DB_KEY = 'markdown:history:v1';

/** A converted file as kept in the browser between visits. */
export interface StoredItem {
  id: string;
  name: string;
  size: number;
  pages: PageText[];
  draft: string | null;
  durationMs: number | null;
  savedAt: number;
}

// localStorage can be missing or throw (private mode, blocked storage); the app works without it.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saving a preference is not worth interrupting anyone.
  }
}

export function loadOptions(): ConversionOptions {
  try {
    const saved = JSON.parse(read(OPTIONS_KEY) ?? '{}') as Partial<Record<keyof ConversionOptions, unknown>>;
    const options = { ...DEFAULT_OPTIONS };
    for (const key of Object.keys(DEFAULT_OPTIONS) as Array<keyof ConversionOptions>) {
      if (typeof saved[key] === 'boolean') options[key] = saved[key];
    }
    return options;
  } catch {
    return DEFAULT_OPTIONS;
  }
}

export const saveOptions = (options: ConversionOptions) => write(OPTIONS_KEY, JSON.stringify(options));

/** History is on unless the user turned it off. */
export const isHistoryEnabled = () => read(HISTORY_SETTING_KEY) !== 'off';
export const setHistoryEnabled = (enabled: boolean) => write(HISTORY_SETTING_KEY, enabled ? 'on' : 'off');

// IndexedDB holds the extracted pages, which can be several megabytes; idb-keyval loads on first use.
const idb = () => import('idb-keyval');

export async function loadHistory(): Promise<StoredItem[]> {
  try {
    const { get } = await idb();
    const items = await get<StoredItem[]>(HISTORY_DB_KEY);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export async function saveHistory(items: StoredItem[]): Promise<void> {
  try {
    const { set } = await idb();
    await set(HISTORY_DB_KEY, items);
  } catch {
    // Quota exceeded or storage blocked: the current session keeps working.
  }
}

export async function clearHistory(): Promise<void> {
  try {
    const { del } = await idb();
    await del(HISTORY_DB_KEY);
  } catch {
    // Nothing stored, or storage blocked.
  }
}
