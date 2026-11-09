# Ferramentas de recorte

Scripts usados para transformar o PDF da apostila nas imagens `q01..q80.webp` (enunciado) e `c01..c80.webp` (comentário) que estão no bucket privado `banco-questoes`. Precisam de `pymupdf` e `pillow`.

1. `marcar_questoes.py <pasta-de-trabalho> <apostila.pdf>` acha onde começa cada "QUESTÃO N" e cada "Comentários:" e grava `marks.json`.
2. `recortar_questoes.py <pasta-de-trabalho> <apostila.pdf>` recorta cada questão (juntando páginas quando ela quebra) e salva em `<pasta-de-trabalho>/crops/`.

O PDF e as imagens não entram no repositório (estão no `.gitignore`).

## Alternativas separadas (botões clicáveis)

3. `achar_alternativas.py <pasta> <apostila.pdf>` acha o "A)" a "E)" de cada questão e grava `alts.json`.
4. `recortar_alternativas.py <pasta> <apostila.pdf>` gera `eNN.webp` (enunciado sem alternativas) e `aNNX.webp` (cada alternativa) em `<pasta>/crops2/`. Cada linha de texto e cada imagem do PDF é atribuída à letra correta (as frações e figuras ficam centralizadas no "X)", os expoentes são linhas separadas), o "X)" impresso é apagado e as bordas do cartão são removidas.

Se as imagens `e`/`a` de uma questão não estiverem no bucket, o site cai sozinho no modo antigo (imagem inteira e botões A–E).

## Simulados do revisaí (aba de parceria)

5. `recortar_revisai.py <simulado.pdf> <base> <saida.json>` recorta os Simulados 1 (base 100, questões 101–190) e 2 (base 200, questões 201–290) em `eNNN.webp`, `aNNNX.webp` e `cNNN.webp` dentro de `./crops`. O layout é em duas colunas e cada questão cabe numa coluna; o gabarito sai da grade do "Gabarito comentado" e é conferido com a letra de cada comentário. O JSON traz número, área • assunto e origem (ENEM/OBMEP/Autoral) de cada questão.
