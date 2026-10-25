# Analisador do Sorriso em Movimento (analisador-sorriso-movimento)

Abrir no navegador: [mborille.github.io/analisador-sorriso-movimento/analisador-sorriso-movimento.html](https://mborille.github.io/analisador-sorriso-movimento/analisador-sorriso-movimento.html)

Analisa um vídeo curto (ou duas fotos) do paciente e mede, no navegador, a abertura interlabial, a largura da boca, o índice do sorriso, a exposição dos dentes, o corredor bucal, a gengiva visível no centro e o arco do sorriso. O app encontra os lábios quadro a quadro, sugere o quadro de repouso e o de sorriso máximo, e deixa marcar quadros de fala (som E, som F/V).

## Arquivos

- `analisador-sorriso-movimento.html`: app de um arquivo só. Abra no navegador (computador ou celular). O vídeo e as fotos não saem do aparelho.
- `nucleo/modelo.js`: o cálculo em JavaScript puro (escala, correção de inclinação, segmentação por cor, medidas).
- `nucleo/teste_modelo.js`: testes do cálculo com rosto sintético. Rode com `node teste_modelo.js` dentro da pasta `nucleo`.

## Dependência

Os pontos do rosto vêm do MediaPipe Face Mesh (Google, licença Apache 2.0), baixado do jsDelivr na primeira abertura (cerca de 10 MB). Sem internet no primeiro uso, o detector não carrega. Nenhuma imagem é enviada a servidor.

## Método

1. Detecção de 478 pontos faciais. A distância entre as pupilas (63 mm por padrão, editável) vira a régua em milímetros.
2. A imagem é nivelada pela linha das pupilas. Quadros com giro do rosto acima de 15 graus são descartados da escolha automática.
3. Abertura interlabial e largura vêm dos pontos do contorno interno dos lábios.
4. Dentes e gengiva dentro da boca são separados por cor (brilho, saturação e vermelhidão). Disso saem a largura dos dentes visíveis, o corredor bucal (espaço lateral sobre a largura interna), a gengiva visível no centro e a altura da primeira fileira de dentes.
5. O arco do sorriso compara a curvatura da borda incisal superior com a do lábio inferior (consonante, reta, reversa), só quando há separação visível entre dentes superiores e inferiores.

## Limites (declarar em qualquer publicação)

- As medidas em milímetros são estimativas pela distância interpupilar. Cada 3 mm de erro nela muda as medidas em cerca de 5%.
- Corredor bucal, gengiva e arco são leituras automáticas por cor e dependem de luz, cor do dente e resolução. Devem ser conferidos na imagem.
- Não foi validado contra medidas clínicas nem contra outros softwares. É ferramenta educacional e de documentação, não diagnóstica.
- Rosto de frente e boca com boa resolução dão resultados melhores. Boca pequena na imagem gera aviso.

## Licença

MIT. Veja `LICENSE`.

## Como citar

Veja `CITATION.cff`.

DOI: https://doi.org/10.6084/m9.figshare.34715979
