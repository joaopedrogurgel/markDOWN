import styles from './SourceEditor.module.css';

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

/** Plain-text Markdown editor. A textarea keeps undo, selection and mobile keyboards native. */
export function SourceEditor({ value, onChange, label }: SourceEditorProps) {
  return (
    <div className={styles.wrap}>
      <label className="visually-hidden" htmlFor="markdown-source">
        {label}
      </label>
      <textarea
        id="markdown-source"
        className={styles.editor}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
      />
    </div>
  );
}
