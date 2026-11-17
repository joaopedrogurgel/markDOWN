import { SITE } from '../config';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <p>
        Feito por{' '}
        <a href={SITE.authorUrl} target="_blank" rel="noreferrer">
          {SITE.author}
        </a>
        .
      </p>
      <p>Seus arquivos são processados localmente e nunca deixam o seu dispositivo.</p>
    </footer>
  );
}
