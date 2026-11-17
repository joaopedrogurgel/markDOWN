import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './MarkdownPreview.module.css';

/** Rendered view of the Markdown. Raw HTML is ignored, so PDF content can't inject markup. */
export default function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <article className={styles.prose}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
        }}
      >
        {markdown}
      </Markdown>
    </article>
  );
}
