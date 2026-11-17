import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { defineLanguageFacet, HighlightStyle, Language, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { drawSelection, EditorView, highlightActiveLine, keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { GFM, parser } from '@lezer/markdown';
import { useEffect, useLayoutEffect, useRef } from 'react';
import styles from './MarkdownEditor.module.css';

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  /** Called with the 1-based number of the first visible line while the editor scrolls. */
  onTopLineChange?: (line: number) => void;
}

/**
 * Markdown highlighting straight from the Lezer parser. @codemirror/lang-markdown
 * would also bundle the HTML, CSS and JavaScript parsers for embedded code (~140 KB).
 */
const markdownLanguage = new Language(defineLanguageFacet(), parser.configure(GFM), [], 'markdown');

const highlight = HighlightStyle.define([
  {
    tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6],
    color: 'var(--ink)',
    fontWeight: '700',
  },
  { tag: tags.processingInstruction, color: 'var(--syntax)' },
  { tag: tags.strong, fontWeight: '700', color: 'var(--ink)' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.link, color: 'var(--syntax)' },
  { tag: tags.url, color: 'var(--muted)' },
  { tag: tags.quote, color: 'var(--muted)' },
  { tag: tags.monospace, color: 'var(--ink-soft)' },
  { tag: tags.contentSeparator, color: 'var(--muted)' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--ink)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', fontSize: '0.875rem', lineHeight: '1.75' },
  '.cm-content': { padding: 'var(--space-5)', caretColor: 'var(--syntax)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--syntax-soft) 45%, transparent)' },
  '.cm-cursor': { borderLeftColor: 'var(--syntax)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--syntax-soft) !important',
  },
});

/** Markdown editor with syntax colouring. Loaded on demand; a textarea stands in meanwhile. */
export default function MarkdownEditor({ value, onChange, label, onTopLineChange }: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onTopLineChange });
  useLayoutEffect(() => {
    callbacks.current = { onChange, onTopLineChange };
  });
  /** True while the document is replaced from outside, so that change is not reported as an edit. */
  const syncing = useRef(false);

  // Create the editor once; later value changes are applied as transactions.
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          drawSelection(),
          highlightActiveLine(),
          EditorView.lineWrapping,
          markdownLanguage,
          syntaxHighlighting(highlight),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          theme,
          EditorView.contentAttributes.of({
            'aria-label': label,
            spellcheck: 'false',
            autocapitalize: 'off',
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !syncing.current)
              callbacks.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;

    const onScroll = () => {
      const block = editor.lineBlockAtHeight(editor.scrollDOM.scrollTop);
      callbacks.current.onTopLineChange?.(editor.state.doc.lineAt(block.from).number);
    };
    editor.scrollDOM.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      editor.scrollDOM.removeEventListener('scroll', onScroll);
      editor.destroy();
      view.current = null;
    };
    // Created once per mount on purpose: value changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outside changes (another option, "discard edits") replace the document.
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current !== value) {
      syncing.current = true;
      editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
      syncing.current = false;
    }
  }, [value]);

  return <div ref={host} className={styles.editor} />;
}
