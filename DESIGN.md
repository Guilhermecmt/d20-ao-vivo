# Dados ao Vivo

Ferramenta para jogadores e mestres consultarem durante uma sessão. A rolagem é a atividade principal; sala, histórico e caderno ficam próximos e legíveis.

## Identidade

A referência é uma mesa de jogo com dados e caderno, em vez de uma página promocional de fantasia. O dado 3D é o elemento de destaque. As demais partes organizam o trabalho do grupo sem competir com ele.

Paleta:

- Base e fundo: `#6410C9`, roxo definido pelo usuário.
- Painéis e bandeja: `#4D0D9B`, com áreas elevadas em `#570EAE`.
- Campos e áreas internas: `#35076D` e `#3D087D`.
- Textos e elementos neutros: `#E9E9E9`.
- Texto secundário: `#DED3EB`.
- Ação principal e destaques: `#FFD54A`, amarelo quente, com hover em `#FFE380`.

O roxo é a base de toda a página. O amarelo destaca rolagens, ações principais, foco e turno atual. O cinza claro aparece nos títulos, nos textos e nos botões secundários. As cores ficam centralizadas nas variáveis de `src/style.css`; os componentes do caderno reutilizam essas variáveis. O dado 3D usa o mesmo roxo, arestas amarelas e números em cinza claro.

## Tipografia

- Bitter, pesos 500 a 700: marca, títulos e resultado da rolagem.
- Public Sans, pesos 400 a 700: formulários, ações, dados e explicações.
- Números de iniciativa, quantidades, horários e PV usam algarismos tabulares.
- A interface usa caixa normal e títulos com escala consistente, sem destacar uma palavra isolada por cor ou itálico.

## Organização

No computador, a bandeja de dados fica à esquerda e a sala com o histórico à direita. O caderno ocupa a largura disponível abaixo. No celular, as ferramentas se empilham, os formulários se reorganizam e as listas mantêm controles legíveis.

O caderno usa linhas para participantes e itens, com separadores discretos. Apenas o turno atual ganha destaque. Botões principais têm preenchimento; ações auxiliares usam contorno ou texto.

## Texto e comportamento

Os textos descrevem a ação: Rolar D20, Criar sala, Exportar cópia. Estados vazios explicam como começar. O armazenamento local é informado perto do nome da campanha e no rodapé do caderno.

Não usar travessões decorativos nem slogans. O resultado ainda não sorteado é representado por `?`. Reticências tipográficas indicam espera.

Sem rotação contínua em repouso. A animação responde à rolagem e respeita a preferência por movimento reduzido. Exclusões do caderno podem ser desfeitas até a próxima alteração.

## Revisão

Verificar navegação por teclado, foco visível, contraste, nomes longos, campos vazios, importação inválida, telas de 320 px e o fluxo de convite. A conferência visual precisa ocorrer em um navegador disponível; registrar quando essa verificação não puder ser feita.
