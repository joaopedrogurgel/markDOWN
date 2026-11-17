import { useCallback, useState } from 'react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Landing } from './components/Landing';
import { Workspace } from './components/Workspace';
import { useConversions } from './hooks/useConversions';
import { useTheme } from './hooks/useTheme';
import { useWindowFileDrop } from './hooks/useWindowFileDrop';
import { track } from './lib/telemetry';
import styles from './App.module.css';

const EXAMPLE_URL = `${import.meta.env.BASE_URL}exemplo.pdf`;

export default function App() {
  const conversions = useConversions();
  const { theme, toggle } = useTheme();
  const { addFiles: addToQueue, items } = conversions;
  // The landing page is the front door, also for people coming back to saved files.
  const [onLanding, setOnLanding] = useState(true);
  const [loadingExample, setLoadingExample] = useState(false);

  const addFiles = useCallback(
    (files: Iterable<File>) => {
      addToQueue(files);
      setOnLanding(false);
    },
    [addToQueue],
  );
  const dragging = useWindowFileDrop(addFiles);

  const loadExample = useCallback(async () => {
    setLoadingExample(true);
    track('example-opened');
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

  const showWorkspace = items.length > 0 && !onLanding;

  return (
    <div className={styles.app}>
      <a className={styles.skip} href="#conteudo">
        Pular para o conteúdo
      </a>
      <Header
        theme={theme}
        onToggleTheme={toggle}
        onHome={showWorkspace ? () => setOnLanding(true) : undefined}
      />
      <div id="conteudo" className={styles.content}>
        {showWorkspace ? (
          <Workspace conversions={conversions} />
        ) : (
          <Landing
            dragging={dragging}
            options={conversions.options}
            onOptionsChange={conversions.setOptions}
            onFiles={addFiles}
            onExample={loadExample}
            loadingExample={loadingExample}
            savedCount={items.length}
            onResume={() => setOnLanding(false)}
          />
        )}
      </div>
      {showWorkspace ? (
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
