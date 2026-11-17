# Leitura de documentos em duas colunas

*Equipe markDOWN, novembro de 2026*

**Resumo.** Artigos científicos, revistas e jornais costumam usar duas colunas. Quem converte esses arquivos linha a linha mistura frases das duas colunas e perde o sentido do texto. Este documento serve de teste para a ordem de leitura.

## Introdução

Um PDF não guarda parágrafos nem colunas. Ele guarda apenas trechos de texto com uma posição na página, e cabe ao leitor reconstruir a ordem em que esses trechos devem ser lidos.

Quando a página tem duas colunas, a ordem certa é descer pela coluna da esquerda até o fim e só então subir para o topo da coluna da direita. Uma leitura ingênua, de cima para baixo, alterna entre as duas a cada linha.

## Como a calha é encontrada

A calha é a faixa vertical vazia que separa as colunas. Para encontrá-la, o conversor mede quantos trechos cobrem cada posição horizontal da página e procura uma faixa estreita, perto do centro, quase sem cobertura.

Títulos e resumos que ocupam a largura inteira atravessam a calha. Eles são mantidos no lugar em que aparecem, e só o texto entre eles é dividido em colunas.

## Cuidados com tabelas

Tabelas também têm faixas vazias entre as colunas. Para não confundir uma tabela com texto em colunas, o conversor exige que as linhas de cada lado ocupem a maior parte da largura da coluna, o que quase nunca acontece com células de tabela.

Os detalhes da implementação estão no [repositório do projeto](https://github.com/joaopedrogurgel/markDOWN), com testes para cada um desses casos.

## Conclusão

Com a ordem de leitura correta, o texto convertido pode ser reaproveitado em *wikis*, documentação e repositórios sem precisar de revisão linha a linha.
