# Ferramentas de recorte

Scripts usados para transformar o PDF da apostila nas imagens `q01..q80.webp` (enunciado) e `c01..c80.webp` (comentário) que estão no bucket privado `banco-questoes`. Precisam de `pymupdf` e `pillow`.

1. `marcar_questoes.py <pasta-de-trabalho> <apostila.pdf>` acha onde começa cada "QUESTÃO N" e cada "Comentários:" e grava `marks.json`.
2. `recortar_questoes.py <pasta-de-trabalho> <apostila.pdf>` recorta cada questão (juntando páginas quando ela quebra) e salva em `<pasta-de-trabalho>/crops/`.

O PDF e as imagens não entram no repositório (estão no `.gitignore`).
