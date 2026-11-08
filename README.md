# Dados de RPG ao Vivo

Role D4, D6, D8, D10, D12, D20 e D100 com os amigos na mesma sala. Cada pessoa entra com o nome do personagem. O servidor registra uma única rolagem por vez; todos recebem o mesmo tipo de dado, número e histórico.

## Jogar

1. Abra [Dados de RPG ao Vivo](https://guilhermecmt.github.io/d20-ao-vivo/).
2. Digite o nome do seu personagem e crie uma sala.
3. Envie o link de convite. Quem entrar pelo link informa o nome do próprio personagem e clica em **Entrar**.
4. Escolha o dado e clique em **Jogar**. A animação termina no mesmo número para todos.

A sala continua disponível mesmo se quem a criou fechar a página. As jogadas ficam guardadas no serviço de salas; jogadores ativos aparecem durante 15 segundos após a última atualização. Compartilhe o código apenas com o grupo: qualquer pessoa com ele pode entrar e rolar.

## Código

- `src/`: página e dados 3D, compilados pelo Vite e publicados no GitHub Pages.
- `backend/`: código do serviço de salas, publicado em [Sites](https://d20-sala-api-guilherme.adroitmixer16.chatgpt.site) com Cloudflare D1.
- `tests/`: teste de faces dos dados e teste de três personagens vendo a mesma rolagem.

```bash
npm ci
npm run dev
npm run build
node --test tests/dice.test.mjs
node --test tests/rooms.test.mjs
```

O teste de salas usa `http://127.0.0.1:8787` por padrão. Defina `DICE_API_BASE` para testar o serviço publicado. Para rodar o backend localmente, entre em `backend/`, execute `npm ci`, `npm run build`, aplique a migração D1 conforme `backend/README.md` e inicie com `npm start`.
