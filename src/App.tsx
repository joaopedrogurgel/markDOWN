import { useCallback, useState } from 'react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Landing } from './components/Landing';
import { Workspace } from './components/Workspace';
import { useConversions } from './hooks/useConversions';
import { useTheme } from './hooks/useTheme';
import { useWindowFileDrop } from './hooks/useWindowFileDrop';
import styles from './App.module.css';

const EXAMPLE_URL = `${import.meta.env.BASE_URL}exemplo.pdf`;

export default function App() {
  const conversions = useConversions();
  const { theme, toggle } = useTheme();
  const { addFiles } = conversions;
  const dragging = useWindowFileDrop(addFiles);
  const [loadingExample, setLoadingExample] = useState(false);

  const loadExample = useCallback(async () => {
    setLoadingExample(true);
    try {
      const response = await fetch(EXAMPLE_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      addFiles([new File([blob], 'exemplo.pdf', { type: 'application/pdf' })]);
    } catch {
      addFiles([new File([], 'exemplo.pdf', { type: 'application/pdf' })]);
    } finally {
      setLoadingExample(false);
    }
  }, [addFiles]);

  const hasFiles = conversions.items.length > 0;

  return (
    <div className={styles.app}>
      <a className={styles.skip} href="#conteudo">
        Pular para o conteúdo
      </a>
      <Header theme={theme} onToggleTheme={toggle} onHome={hasFiles ? conversions.clear : undefined} />
      <div id="conteudo" className={styles.content}>
        {hasFiles ? (
          <Workspace conversions={conversions} />
        ) : (
          <Landing
            dragging={dragging}
            options={conversions.options}
            onOptionsChange={conversions.setOptions}
            onFiles={addFiles}
            onExample={loadExample}
            loadingExample={loadingExample}
          />
        )}
      </div>
      {hasFiles ? (
        dragging && (
          <div className={styles.dropOverlay} aria-hidden>
            <p>Solte para adicionar à lista</p>
          </div>
        )
      ) : (
        <Footer />
      )}
    </div>
  );
}
