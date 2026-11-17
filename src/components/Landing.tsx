import { plural } from '../lib/format';
import type { ConversionOptions } from '../lib/markdown';
import { DropSheet } from './DropSheet';
import { OptionsPanel } from './OptionsPanel';
import styles from './Landing.module.css';

const STEPS = [
  {
    title: 'Envie',
    text: 'Arraste um ou mais PDFs. O texto é lido aqui mesmo, no seu navegador, e nenhum arquivo vai para um servidor.',
  },
  {
    title: 'Revise',
    text: 'Compare o Markdown com a visualização lado a lado e ajuste o que precisar direto no editor.',
  },
  {
    title: 'Baixe',
    text: 'Copie o resultado ou baixe o arquivo .md, pronto para o GitHub, Notion, Obsidian ou sua documentação.',
  },
];

interface LandingProps {
  dragging: boolean;
  options: ConversionOptions;
  onOptionsChange: (options: ConversionOptions) => void;
  onFiles: (files: File[]) => void;
  onExample: () => void;
  loadingExample: boolean;
  /** Files already in the list, e.g. kept from an earlier visit. */
  savedCount: number;
  onResume: () => void;
}

export function Landing({
  dragging,
  options,
  onOptionsChange,
  onFiles,
  onExample,
  loadingExample,
  savedCount,
  onResume,
}: LandingProps) {
  return (
    <main className={styles.landing}>
      <div className={styles.intro}>
        <h1 className={styles.headline}>
          <span className={styles.hash} aria-hidden>
            #
          </span>
          Do PDF ao Markdown, sem sair do navegador.
        </h1>
        <p className={styles.lede}>
          Títulos, listas, tabelas, links e textos em duas colunas reconstruídos a partir do layout do PDF.
          Rápido, privado, gratuito e funciona até sem internet.
        </p>
        {savedCount > 0 && (
          <button type="button" className={`button ${styles.resume}`} onClick={onResume}>
            Continuar de onde parou ({plural(savedCount, 'arquivo', 'arquivos')})
          </button>
        )}
      </div>

      <div className={styles.drop}>
        <DropSheet
          dragging={dragging}
          onFiles={onFiles}
          onExample={onExample}
          loadingExample={loadingExample}
        />
      </div>

      <div className={styles.options}>
        <OptionsPanel options={options} onChange={onOptionsChange} />
      </div>

      <section className={styles.steps} aria-labelledby="steps-title">
        <h2 id="steps-title" className={styles.stepsTitle}>
          <span className={styles.hash} aria-hidden>
            ##
          </span>
          Como funciona
        </h2>
        <ol className={styles.stepList}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepMarker} aria-hidden>
                {index + 1}.
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
