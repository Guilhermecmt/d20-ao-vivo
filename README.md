# D20 ao Vivo

Um dado de vinte lados em 3D para rolar com amigos na mesma sala. O criador sorteia o resultado e envia a jogada para todos os participantes por WebRTC, usando o servidor público de sinalização do PeerJS.

## Jogar

1. Abra o [D20 ao Vivo](https://guilhermecmt.github.io/d20-ao-vivo/).
2. Escreva seu nome e clique em **Criar uma sala**.
3. Copie o convite e envie para seus amigos. Todos podem clicar em **Jogar D20**; o resultado e o histórico aparecem para todos.

O criador precisa manter a página aberta enquanto a sala estiver em uso. As salas e o histórico existem apenas durante a sessão; não há conta nem armazenamento de jogadas. Algumas redes corporativas ou restritas podem bloquear WebRTC.

## Desenvolver

```bash
npm install
npm run dev
```

`npm run build` produz os arquivos estáticos em `dist/`. O GitHub Actions publica essa pasta no GitHub Pages a cada push para `main`.

## Tecnologias

- Three.js para o dado 3D e a animação.
- PeerJS/WebRTC para sincronizar a sala entre os navegadores.
- Vite para compilar o site estático.
