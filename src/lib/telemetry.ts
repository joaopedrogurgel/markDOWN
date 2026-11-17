/**
 * Optional, privacy-preserving telemetry. Both parts stay off unless configured
 * at build time, and neither ever sends a document's name or content.
 *
 *   VITE_SENTRY_DSN       error reports (exception type, message and stack trace only)
 *   VITE_GOATCOUNTER_URL  anonymous event counts, without cookies
 */
export type TelemetryEvent =
  'converted' | 'no-text' | 'failed' | 'copied' | 'downloaded' | 'downloaded-zip' | 'example-opened';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const GOATCOUNTER_URL = import.meta.env.VITE_GOATCOUNTER_URL as string | undefined;

type GoatCounter = { count: (vars: { path: string; title?: string; event: boolean }) => void };
type SentryModule = typeof import('@sentry/browser');

let sentry: Promise<SentryModule | null> | null = null;

/** Loads the error reporter on first use, so it costs nothing when not configured. */
function getSentry(): Promise<SentryModule | null> {
  if (!SENTRY_DSN) return Promise.resolve(null);
  sentry ??= import('@sentry/browser')
    .then((module) => {
      module.init({
        dsn: SENTRY_DSN,
        defaultIntegrations: false,
        integrations: [module.globalHandlersIntegration(), module.dedupeIntegration()],
        beforeSend: scrubEvent,
        beforeBreadcrumb: () => null,
      });
      return module;
    })
    .catch(() => null);
  return sentry;
}

/** Keeps only what explains a crash: never URLs with file names, user data or breadcrumbs. */
export function scrubEvent<
  T extends { request?: unknown; user?: unknown; breadcrumbs?: unknown; extra?: unknown },
>(event: T): T {
  delete event.request;
  delete event.user;
  delete event.breadcrumbs;
  delete event.extra;
  return event;
}

export function startTelemetry(): void {
  if (SENTRY_DSN) void getSentry();
  if (GOATCOUNTER_URL && typeof document !== 'undefined') {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://gc.zgo.at/count.js';
    script.dataset.goatcounter = GOATCOUNTER_URL;
    document.head.append(script);
  }
}

export function track(event: TelemetryEvent): void {
  if (!GOATCOUNTER_URL) return;
  const counter = (window as unknown as { goatcounter?: GoatCounter }).goatcounter;
  counter?.count({ path: `evento/${event}`, title: event, event: true });
}

export function reportError(error: unknown): void {
  if (!SENTRY_DSN) return;
  void getSentry().then((module) => module?.captureException(error));
}
