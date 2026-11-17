# Changelog

## 2.0.0 — 2026-11-17

O projeto passa a se chamar **markDOWN**.

### Conversão

- Páginas em duas colunas são lidas na ordem certa, mantendo títulos e resumos de largura inteira no lugar.
- Tabelas alinhadas em grade viram tabelas GFM, com o cabeçalho na primeira linha.
- Itálico e links do PDF são preservados; a pontuação logo depois de um link fica fora dele.
- Parágrafos marcados por recuo da primeira linha (comum no LaTeX) são separados corretamente.
- Marcadores de lista distantes do texto (Word, LibreOffice) são reconhecidos.
- Caracteres como `*` e `` ` `` no texto do PDF são escapados para não virarem formatação.
- Novas opções: **Tabelas** e **Duas colunas**, ambas ligadas por padrão.

### Interface

- Editor com destaque de sintaxe (CodeMirror 6), carregado sob demanda.
- Rolagem da visualização sincronizada com o editor no modo lado a lado.
- Download de todos os arquivos convertidos em um `.zip`.
- Histórico local: os arquivos voltam na próxima visita, com opção de desligar e limpar.
- As opções de conversão ficam salvas entre visitas.
- Funciona offline e pode ser instalado como app (PWA).

### Qualidade e operação

- Corpus de cinco PDFs gerados por Chrome, pdfLaTeX, LibreOffice e ReportLab, com nota de semelhança cobrada no CI. Média de 0,757 na v1.0 para 0,998 na v2.0.
- Testes no navegador com Playwright, em desktop e celular, incluindo o uso offline.
- Limite de 100 KB (gzip) para a página inicial, conferido no CI.
- Monitoramento de erros (Sentry) e métricas anônimas (GoatCounter), opcionais e sem conteúdo de documentos.
- Dependabot semanal para npm e GitHub Actions.

## 1.0.0 — 2026-11-16

Primeira versão: conversão de PDF em Markdown no navegador, com títulos, listas, negrito, parágrafos e remoção de cabeçalhos e rodapés; editor com visualização lado a lado, tema escuro e layout responsivo.
