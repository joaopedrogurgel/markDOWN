import type { ConversionOptions } from '../lib/markdown';
import styles from './OptionsPanel.module.css';

const FIELDS: Array<{ key: keyof ConversionOptions; label: string; hint: string }> = [
  { key: 'detectHeadings', label: 'Títulos', hint: 'Textos maiores ou em negrito viram #, ## e ###' },
  { key: 'detectLists', label: 'Listas', hint: 'Marcadores e numeração viram listas Markdown' },
  { key: 'detectTables', label: 'Tabelas', hint: 'Texto alinhado em grade vira tabela Markdown' },
  { key: 'detectColumns', label: 'Duas colunas', hint: 'Lê a coluna da esquerda antes da direita' },
  {
    key: 'removeRepeatedLines',
    label: 'Limpar cabeçalhos e rodapés',
    hint: 'Remove linhas repetidas e números de página',
  },
  { key: 'pageBreaks', label: 'Separar páginas', hint: 'Insere uma linha --- entre as páginas' },
];

interface OptionsPanelProps {
  options: ConversionOptions;
  onChange: (options: ConversionOptions) => void;
  layout?: 'row' | 'column';
}

export function OptionsPanel({ options, onChange, layout = 'row' }: OptionsPanelProps) {
  return (
    <fieldset className={styles.panel} data-layout={layout}>
      <legend className={styles.legend}>Opções de conversão</legend>
      {FIELDS.map(({ key, label, hint }) => (
        <label key={key} className={styles.option}>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={options[key]}
            onChange={(event) => onChange({ ...options, [key]: event.target.checked })}
          />
          <span className={styles.text}>
            <span className={styles.label}>{label}</span>
            <span className={styles.hint}>{hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
