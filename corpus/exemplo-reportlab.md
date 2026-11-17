# Relatório trimestral de produto

*Um documento de exemplo para testar a conversão*

## Visão geral

A conversão acontece inteiramente no navegador: o arquivo é lido pelo pdf.js, as linhas são reagrupadas pela posição na página e cada bloco recebe a marcação equivalente em Markdown. Parágrafos longos que quebram de linha voltam a ser um único parágrafo, e palavras hifenizadas no fim da linha são reconstruídas automaticamente.

O texto pode conter trechos em **negrito** no meio da frase, que viram marcação **forte** no Markdown.

### Destaques do período

- Tempo médio de conversão abaixo de um segundo para documentos de até 20 páginas.
- Nenhum arquivo é enviado a servidores externos.
- Suporte a listas, títulos e cabeçalhos repetidos.

## Próximos passos

1. Detectar tabelas simples.
2. Exportar vários arquivos de uma vez.
3. Reconhecer texto em PDFs escaneados.

## Metodologia

Cada página é lida como um conjunto de trechos de texto com posição, tamanho de fonte e peso. Trechos que compartilham a mesma linha de base são unidos em uma linha visual, respeitando os espaços entre eles.

O tamanho de fonte mais frequente no documento é tratado como corpo de texto. Tamanhos visivelmente maiores tornam-se títulos, do maior para o menor, e linhas curtas em negrito viram subtítulos.

## Limitações conhecidas

Documentos em várias colunas, tabelas complexas e PDFs escaneados sem camada de texto ainda exigem revisão manual. Para esses casos, o editor ao lado da visualização permite ajustar o resultado antes de baixar o arquivo.

Cabeçalhos e rodapés que se repetem em várias páginas são removidos automaticamente, assim como a numeração de páginas, para que o texto final fique contínuo e fácil de reutilizar em documentação, wikis e repositórios.

## Conclusão

Os resultados indicam que a abordagem baseada em posição e tamanho de fonte é suficiente para a maioria dos documentos de texto corrido.
