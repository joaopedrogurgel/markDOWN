# Heurísticas de layout na conversão de PDF

Equipe markDOWN

Novembro de 2026

## 1 Introdução

Documentos produzidos com LaTeX são comuns na academia. Eles usam fontes próprias, hifenização automática e, com frequência, duas colunas. Essas características tornam a extração de texto um desafio interessante para qualquer conversor que pretenda reconstruir a estrutura original do documento com fidelidade.

A hifenização, em particular, quebra palavras no fim da linha. Um bom conversor precisa juntar de volta essas partes para que a busca e a leitura funcionem no resultado final.

## 2 Abordagem

O conversor trabalha em etapas independentes:

1. agrupa os trechos de texto em linhas;
2. separa as colunas da página;
3. identifica títulos, listas e tabelas;
4. gera o Markdown.

Cada etapa é uma função pura, o que facilita os testes. O código está disponível em [github.com/joaopedrogurgel/markDOWN](https://github.com/joaopedrogurgel/markDOWN).

### 2.1 Estilos

Trechos em **negrito** e em *itálico* são reconhecidos pelo nome da fonte embutida no arquivo.

## 3 Resultados

A tabela abaixo resume os tipos de documento avaliados.

| Tipo | Arquivos | Páginas |
| --- | --- | --- |
| Artigos | 12 | 96 |
| Relatórios | 8 | 40 |
| Memorandos | 10 | 14 |

## 4 Conclusão

Heurísticas simples, bem testadas, resolvem a maior parte dos documentos de texto. Os casos difíceis, como fórmulas e tabelas complexas, ficam para trabalhos futuros.
