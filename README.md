# Dados de RPG ao Vivo

Role D4, D6, D8, D10, D12, D20 e D100 sozinho ou com os amigos na mesma sala. No modo compartilhado, cada pessoa entra com o nome do personagem. O servidor registra uma única rolagem por vez; todos recebem o mesmo tipo de dado, número e histórico.

## Jogar

1. Abra [Dados de RPG ao Vivo](https://guilhermecmt.github.io/d20-ao-vivo/). Escolha um dado e clique em **Jogar** para usar sem sala.
2. Para jogar com amigos, digite o nome do seu personagem e crie uma sala.
3. Envie o link de convite. Quem entrar pelo link informa o nome do próprio personagem e clica em **Entrar**.
4. Escolha o dado e clique em **Jogar**. Na sala, a animação termina no mesmo número para todos.

No modo solo, não é necessário nome nem conexão com o serviço de salas. O histórico solo fica apenas na página aberta.

## Caderno de campanha

Logo abaixo dos dados, o caderno reúne três ferramentas independentes de sistema:

- **Encontro:** aliados e adversários em ordem de iniciativa, pontos de vida, condições, turno atual e contador de rodadas. Edite a iniciativa ou os PV diretamente e use os botões para dano e cura de um ponto. Reiniciar turnos mantém os participantes e seus PV.
- **Diário:** missões com marcação de conclusão e anotações da sessão com salvamento automático.
- **Inventário:** itens, quantidades e o personagem responsável por carregá-los.

O caderno é salvo no armazenamento local deste navegador e tem um espaço separado para o modo solo e para cada código de sala. Ele **não é sincronizado entre jogadores ou dispositivos**. Use **Exportar** para baixar uma cópia JSON e **Importar** para carregá-la em outro navegador; a importação pede confirmação antes de substituir o caderno atual. Apagar os dados do navegador também apaga os cadernos, então exporte cópias das campanhas que quiser guardar. Se o armazenamento estiver indisponível, a página avisa e ainda permite exportar as alterações.

As condições são lembretes e não aplicam regras automaticamente. Participantes com zero PV continuam na ordem de iniciativa para que a mesa decida como lidar com eles.

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
node --test tests/campaign.test.mjs
node --test tests/rooms.test.mjs
```

O teste de salas usa `http://127.0.0.1:8787` por padrão. Defina `DICE_API_BASE` para testar o serviço publicado. Para rodar o backend localmente, entre em `backend/`, execute `npm ci`, `npm run build`, aplique a migração D1 conforme `backend/README.md` e inicie com `npm start`.
