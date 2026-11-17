import sys
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY

out = sys.argv[1]
ss = getSampleStyleSheet()
body = ParagraphStyle('b', parent=ss['BodyText'], fontName='Helvetica', fontSize=10.5, leading=15, alignment=TA_JUSTIFY, spaceAfter=8)
h1 = ParagraphStyle('h1', parent=ss['Title'], fontName='Helvetica-Bold', fontSize=24, leading=28, alignment=0, spaceAfter=6)
sub = ParagraphStyle('s', parent=body, fontName='Helvetica-Oblique', fontSize=12, leading=16, textColor='#555555')
h2 = ParagraphStyle('h2', parent=ss['Heading2'], fontName='Helvetica-Bold', fontSize=16, leading=20, spaceBefore=12)
h3 = ParagraphStyle('h3', parent=body, fontName='Helvetica-Bold', fontSize=10.5, spaceBefore=6, alignment=0)

def header_footer(c, doc):
    c.saveState(); c.setFont('Helvetica', 8); c.setFillColor('#888888')
    c.drawString(56, A4[1]-36, 'Relatório de exemplo — markDOWN')
    c.drawRightString(A4[0]-56, 30, f'Página {doc.page}')
    c.restoreState()

lorem = ("A conversão acontece inteiramente no navegador: o arquivo é lido pelo pdf.js, as linhas são reagrupadas pela posição na página "
         "e cada bloco recebe a marcação equivalente em Markdown. Parágrafos longos que quebram de linha voltam a ser um único parágrafo, "
         "e palavras hifenizadas no fim da linha são reconstruídas automaticamente.")
s = [Paragraph('Relatório trimestral de produto', h1), Paragraph('Um documento de exemplo para testar a conversão', sub), Spacer(1,10),
     Paragraph('Visão geral', h2), Paragraph(lorem, body),
     Paragraph('O texto pode conter trechos em <b>negrito</b> no meio da frase, que viram marcação <b>forte</b> no Markdown.', body),
     Paragraph('Destaques do período', h3),
     ListFlowable([ListItem(Paragraph(t, body)) for t in ['Tempo médio de conversão abaixo de um segundo para documentos de até 20 páginas.', 'Nenhum arquivo é enviado a servidores externos.', 'Suporte a listas, títulos e cabeçalhos repetidos.']], bulletType='bullet', start='•', leftIndent=14),
     Paragraph('Próximos passos', h2),
     ListFlowable([ListItem(Paragraph(t, body)) for t in ['Detectar tabelas simples.', 'Exportar vários arquivos de uma vez.', 'Reconhecer texto em PDFs escaneados.']], bulletType='1', bulletFormat='%s.', leftIndent=14),
]
extra = [
  ('Metodologia', [
    "Cada página é lida como um conjunto de trechos de texto com posição, tamanho de fonte e peso. Trechos que compartilham a mesma linha de base são unidos em uma linha visual, respeitando os espaços entre eles.",
    "O tamanho de fonte mais frequente no documento é tratado como corpo de texto. Tamanhos visivelmente maiores tornam-se títulos, do maior para o menor, e linhas curtas em negrito viram subtítulos.",
  ]),
  ('Limitações conhecidas', [
    "Documentos em várias colunas, tabelas complexas e PDFs escaneados sem camada de texto ainda exigem revisão manual. Para esses casos, o editor ao lado da visualização permite ajustar o resultado antes de baixar o arquivo.",
    "Cabeçalhos e rodapés que se repetem em várias páginas são removidos automaticamente, assim como a numeração de páginas, para que o texto final fique contínuo e fácil de reutilizar em documentação, wikis e repositórios.",
  ]),
]
for title, paras in extra:
    s.append(Paragraph(title, h2))
    for t in paras:
        s.append(Paragraph(t, body))
s += [Paragraph('Conclusão', h2), Paragraph('Os resultados indicam que a abordagem baseada em posição e tamanho de fonte é suficiente para a maioria dos documentos de texto corrido.', body)]
SimpleDocTemplate(out, pagesize=A4, leftMargin=56, rightMargin=56, topMargin=64, bottomMargin=56, title='Relatório trimestral de produto').build(s, onFirstPage=header_footer, onLaterPages=header_footer)
