import { SITE } from '../config';
import type { Theme } from '../hooks/useTheme';
import { GithubIcon, MoonIcon, SunIcon } from './Icons';
import styles from './Header.module.css';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  onHome?: () => void;
}

export function Header({ theme, onToggleTheme, onHome }: HeaderProps) {
  const nextLabel = theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro';
  return (
    <header className={styles.header}>
      <a
        className={styles.brand}
        href={import.meta.env.BASE_URL}
        onClick={(event) => {
          if (!onHome) return;
          event.preventDefault();
          onHome();
        }}
      >
        <span className={styles.mark} aria-hidden>
          #
        </span>
        Pauta
      </a>
      <nav className={styles.actions} aria-label="Links">
        <a className="button" data-variant="ghost" href={SITE.repositoryUrl} target="_blank" rel="noreferrer">
          <GithubIcon />
          <span className={styles.hideSmall}>Código-fonte</span>
        </a>
        <button
          type="button"
          className="button"
          data-variant="ghost"
          onClick={onToggleTheme}
          aria-label={nextLabel}
          title={nextLabel}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </nav>
    </header>
  );
}
