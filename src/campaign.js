import './campaign.css';
import { CONDITIONS, LIMITS, emptyCampaign, normalizeCampaign, turnOrder, nextTurn, removeCombatant, changeHp, integer, storageKey } from './campaign-state.js';

export function createCampaign({ notify }) {
  const $ = id => document.getElementById(id);
  let room = '';
  let state = emptyCampaign();
  let pendingImport = null;
  let importRoom = '';
  let canSave = true;
  const node = (tag, className = '', value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = String(value);
    return element;
  };
  const button = (label, glyph, action, id) => {
    const element = node('button', 'icon-button', glyph);
    element.type = 'button';
    element.setAttribute('aria-label', label);
    element.title = label;
    element.dataset.action = action;
    element.dataset.id = id;
    return element;
  };
  const empty = (list, glyph, title, description) => {
    const element = node('li', 'camp-empty');
    element.append(node('span', '', glyph), node('strong', '', title), node('p', '', description));
    list.append(element);
  };
  const numberInput = (label, value, min, max, action, id) => {
    const input = node('input');
    Object.assign(input, { type: 'number', value, min, max, step: '1' });
    input.setAttribute('aria-label', label);
    input.dataset.action = action;
    input.dataset.id = id;
    return input;
  };

  function saveStatus(saved) {
    $('campaign-scope').textContent = `${saved ? 'Salvo neste navegador' : 'Não salvo · exporte uma cópia'} · ${room ? `caderno da sala ${room}` : 'caderno solo'}`;
  }

  function save() {
    if (!canSave) { saveStatus(false); return; }
    try {
      localStorage.setItem(storageKey(room), JSON.stringify(state));
      saveStatus(true);
    } catch {
      saveStatus(false);
      notify('O navegador não conseguiu salvar. Exporte o caderno para guardar suas alterações.');
    }
  }

  function load() {
    canSave = true;
    try {
      const saved = localStorage.getItem(storageKey(room));
      state = saved ? normalizeCampaign(JSON.parse(saved)) : emptyCampaign();
    } catch {
      state = emptyCampaign();
      canSave = false;
      notify('Não foi possível abrir o caderno salvo. Os dados anteriores foram preservados; importe uma cópia para continuar.');
    }
    render();
    saveStatus(canSave);
  }

  function renderCombat() {
    const list = $('combat-list');
    list.replaceChildren();
    const order = turnOrder(state);
    $('combat-count').textContent = order.length;
    $('combat-round').textContent = `RODADA ${state.round}`;
    const active = order.find(entry => entry.id === state.activeId);
    $('combat-turn').textContent = active ? `Vez de ${active.name}` : 'O encontro aguarda seus personagens.';
    $('combat-next').textContent = active ? 'Próximo turno →' : 'Iniciar encontro →';
    $('combat-next').disabled = !order.length;
    $('combat-reset').disabled = !order.length;
    if (!order.length) empty(list, '⚔', 'A mesa está pronta.', 'Inclua personagens e adversários para acompanhar a iniciativa, os pontos de vida e cada turno.');
    order.forEach(entry => {
      const row = node('li', `combat-row${entry.id === state.activeId ? ' is-active' : ''}${entry.hp === 0 ? ' is-down' : ''}`);
      if (entry.id === state.activeId) row.setAttribute('aria-current', 'true');
      const initiative = node('div', 'combat-initiative');
      const initiativeLabel = node('label', '', 'INICIATIVA');
      const initiativeInput = numberInput(`Iniciativa de ${entry.name}`, entry.initiative, -99, 999, 'initiative', entry.id);
      initiativeInput.id = `initiative-${entry.id}`;
      initiativeLabel.htmlFor = initiativeInput.id;
      initiative.append(initiativeLabel, initiativeInput);
      const person = node('div', 'combat-person');
      person.append(node('strong', 'combat-name', entry.name), node('span', `combat-kind ${entry.kind}`, entry.kind === 'enemy' ? 'Adversário' : 'Aliado'));
      if (entry.id === state.activeId) person.append(node('span', 'turn-indicator', '✦ TURNO ATUAL'));
      const hp = node('div', 'hp-control');
      const controls = node('div', 'hp-inputs');
      const damage = button(`Tirar 1 PV de ${entry.name}`, '−', 'damage', entry.id);
      const heal = button(`Curar 1 PV de ${entry.name}`, '+', 'heal', entry.id);
      damage.disabled = entry.hp === 0;
      heal.disabled = entry.hp === entry.maxHp;
      controls.append(damage, numberInput(`PV atuais de ${entry.name}`, entry.hp, 0, entry.maxHp, 'hp', entry.id), node('span', '', `/ ${entry.maxHp} PV`), heal);
      const meter = node('progress', `hp-meter${entry.hp <= entry.maxHp / 3 ? ' low' : ''}`);
      meter.max = entry.maxHp;
      meter.value = entry.hp;
      meter.setAttribute('aria-label', `Vida de ${entry.name}`);
      hp.append(node('span', 'hp-label', 'PONTOS DE VIDA'), controls, meter);
      const condition = node('div', 'condition-field');
      const conditionLabel = node('label', '', 'CONDIÇÃO');
      const select = node('select');
      select.id = `condition-${entry.id}`;
      conditionLabel.htmlFor = select.id;
      select.setAttribute('aria-label', `Condição de ${entry.name}`);
      select.dataset.action = 'condition';
      select.dataset.id = entry.id;
      CONDITIONS.forEach(value => {
        const option = node('option', '', value || 'Sem condição');
        option.value = value;
        select.append(option);
      });
      select.value = entry.condition;
      condition.append(conditionLabel, select);
      const remove = button(`Remover ${entry.name} do encontro`, '×', 'remove-combatant', entry.id);
      remove.classList.add('remove-button');
      row.append(initiative, person, hp, condition, remove);
      list.append(row);
    });
  }

  function renderQuests() {
    const list = $('quest-list');
    list.replaceChildren();
    const done = state.quests.filter(entry => entry.done).length;
    $('quest-count').textContent = state.quests.length - done;
    $('quest-progress').textContent = `${done} de ${state.quests.length} concluídas`;
    if (!state.quests.length) empty(list, '✧', 'Toda aventura tem um propósito.', 'Registre a primeira missão e marque cada conquista do grupo.');
    state.quests.forEach(entry => {
      const row = node('li', `quest-row${entry.done ? ' done' : ''}`);
      const label = node('label');
      const check = node('input');
      check.type = 'checkbox';
      check.checked = entry.done;
      check.dataset.action = 'quest-done';
      check.dataset.id = entry.id;
      label.append(check, node('span', '', entry.title));
      const remove = button(`Remover missão: ${entry.title}`, '×', 'remove-quest', entry.id);
      remove.classList.add('remove-button');
      row.append(label, remove);
      list.append(row);
    });
  }

  function renderItems() {
    const list = $('item-list');
    list.replaceChildren();
    $('item-count').textContent = state.items.length;
    if (!state.items.length) empty(list, '♜', 'Há espaço para novas descobertas.', 'Guarde provisões, moedas e tesouros. Registre quem carrega cada item.');
    state.items.forEach(entry => {
      const row = node('li', 'item-row');
      const description = node('div', 'item-description');
      description.append(node('strong', '', entry.name), node('span', '', `Com: ${entry.owner || 'Grupo'}`));
      const quantity = node('div', 'quantity-control');
      const decrease = button(`Usar uma unidade de ${entry.name}`, '−', 'use-item', entry.id);
      decrease.disabled = entry.quantity === 0;
      const increase = button(`Acrescentar uma unidade de ${entry.name}`, '+', 'add-item', entry.id);
      increase.disabled = entry.quantity === 9999;
      quantity.append(decrease, numberInput(`Quantidade de ${entry.name}`, entry.quantity, 0, 9999, 'quantity', entry.id), increase);
      const remove = button(`Remover item: ${entry.name}`, '×', 'remove-item', entry.id);
      remove.classList.add('remove-button');
      row.append(node('span', 'item-symbol', '✧'), description, quantity, remove);
      list.append(row);
    });
  }

  function render() {
    $('campaign-name').value = state.name;
    $('campaign-notes').value = state.notes;
    renderCombat();
    renderQuests();
    renderItems();
  }

  // Restore keyboard focus after rows are rebuilt, including after reordering.
  function update(renderList) {
    const focused = document.activeElement;
    const action = focused?.dataset.action;
    const id = focused?.dataset.id;
    save();
    renderList();
    if (action && id) {
      const target = [...$('campaign').querySelectorAll('[data-action]')]
        .find(element => element.dataset.action === action && element.dataset.id === id);
      if (target && !target.disabled) target.focus({ preventScroll: true });
    }
  }

  const tabs = [...$('campaign-tabs').querySelectorAll('[role="tab"]')];
  $('campaign-open').addEventListener('click', () => {
    $('campaign').scrollIntoView({ block: 'start' });
    tabs.find(tab => tab.getAttribute('aria-selected') === 'true').focus({ preventScroll: true });
  });
  function selectTab(tab) {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      $(item.getAttribute('aria-controls')).hidden = !selected;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[next]);
      tabs[next].focus();
    });
  });

  $('campaign-name').addEventListener('input', event => { state.name = event.target.value.slice(0, 64); save(); });
  $('campaign-notes').addEventListener('input', event => { state.notes = event.target.value.slice(0, 20000); save(); });
  $('combat-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('combat-name').value.trim();
    if (!name) { $('combat-name').focus(); return; }
    if (state.combatants.length >= LIMITS.combatants) { notify('Este encontro já tem 60 participantes.'); return; }
    const hp = integer($('combat-hp').value, 1, 9999, 20);
    state.combatants.push({ id: crypto.randomUUID(), name: name.slice(0, 40), kind: $('combat-kind').value,
      initiative: integer($('combat-initiative').value, -99, 999), hp, maxHp: hp, condition: '' });
    update(renderCombat);
    $('combat-name').value = '';
    $('combat-name').focus();
  });
  $('combat-next').addEventListener('click', () => { nextTurn(state); update(renderCombat); });
  $('combat-reset').addEventListener('click', () => { state.round = 1; state.activeId = null; update(renderCombat); });
  $('quest-form').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('quest-title').value.trim();
    if (!title) { $('quest-title').focus(); return; }
    if (state.quests.length >= LIMITS.quests) { notify('O caderno já tem 100 missões.'); return; }
    state.quests.push({ id: crypto.randomUUID(), title: title.slice(0, 160), done: false });
    update(renderQuests);
    $('quest-title').value = '';
    $('quest-title').focus();
  });
  $('item-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('item-name').value.trim();
    if (!name) { $('item-name').focus(); return; }
    if (state.items.length >= LIMITS.items) { notify('O inventário já tem 150 tipos de item.'); return; }
    state.items.push({ id: crypto.randomUUID(), name: name.slice(0, 80), owner: $('item-owner').value.trim().slice(0, 40), quantity: integer($('item-quantity').value, 1, 9999, 1) });
    update(renderItems);
    $('item-name').value = '';
    $('item-quantity').value = '1';
    $('item-name').focus();
  });

  $('campaign').addEventListener('click', event => {
    const target = event.target.closest('button[data-action]');
    if (!target) return;
    const { action, id } = target.dataset;
    const fighter = state.combatants.find(entry => entry.id === id);
    const item = state.items.find(entry => entry.id === id);
    if (action === 'remove-combatant' && fighter) { removeCombatant(state, id); update(renderCombat); }
    else if (['damage', 'heal'].includes(action) && fighter) { changeHp(fighter, action === 'damage' ? -1 : 1); update(renderCombat); }
    else if (action === 'remove-quest') { state.quests = state.quests.filter(entry => entry.id !== id); update(renderQuests); }
    else if (action === 'remove-item') { state.items = state.items.filter(entry => entry.id !== id); update(renderItems); }
    else if (['use-item', 'add-item'].includes(action) && item) { item.quantity = integer(item.quantity + (action === 'use-item' ? -1 : 1), 0, 9999); update(renderItems); }
  });
  $('campaign').addEventListener('change', event => {
    const { action, id } = event.target.dataset;
    if (!action) return;
    const fighter = state.combatants.find(entry => entry.id === id);
    if (fighter && action === 'initiative') { fighter.initiative = integer(event.target.value, -99, 999); update(renderCombat); }
    else if (fighter && action === 'hp') { fighter.hp = integer(event.target.value, 0, fighter.maxHp); update(renderCombat); }
    else if (fighter && action === 'condition') { fighter.condition = CONDITIONS.includes(event.target.value) ? event.target.value : ''; save(); }
    else if (action === 'quest-done') {
      const quest = state.quests.find(entry => entry.id === id);
      if (quest) { quest.done = event.target.checked; update(renderQuests); }
    } else if (action === 'quantity') {
      const item = state.items.find(entry => entry.id === id);
      if (item) { item.quantity = integer(event.target.value, 0, 9999); update(renderItems); }
    }
  });

  $('campaign-export').addEventListener('click', () => {
    const file = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = node('a');
    link.href = url;
    const slug = state.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'campanha';
    link.download = `${slug}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Cópia da campanha exportada.');
  });
  $('campaign-import').addEventListener('click', () => $('campaign-file').click());
  $('campaign-file').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const targetRoom = room;
    try {
      if (file.size > 300000) throw new Error('O arquivo de campanha deve ter até 300 KB.');
      const imported = normalizeCampaign(JSON.parse(await file.text()));
      if (room !== targetRoom) throw new Error('A sala mudou. Escolha o arquivo novamente.');
      pendingImport = imported;
      importRoom = room;
      $('import-description').textContent = `${pendingImport.name || 'Campanha sem nome'} · ${pendingImport.combatants.length} participantes, ${pendingImport.quests.length} missões e ${pendingImport.items.length} itens.`;
      $('campaign-import-dialog').returnValue = '';
      $('campaign-import-dialog').showModal();
    } catch (error) {
      pendingImport = null;
      notify(error instanceof SyntaxError ? 'O arquivo não contém uma campanha JSON válida.' : error.message);
    }
  });
  $('campaign-import-dialog').addEventListener('close', () => {
    if ($('campaign-import-dialog').returnValue === 'import' && pendingImport && importRoom === room) {
      state = pendingImport;
      canSave = true;
      save();
      render();
      notify('Campanha importada. Boa aventura!');
    }
    pendingImport = null;
  });

  // A second tab can update this browser's notebook; never imply server sync.
  window.addEventListener('storage', event => {
    if (event.key !== storageKey(room) && event.key !== null) return;
    if (document.activeElement?.matches('#campaign input, #campaign textarea, #campaign select')) {
      canSave = false;
      saveStatus(false);
      notify('O caderno mudou em outra aba. Exporte suas alterações antes de atualizar a página.');
      return;
    }
    load();
  });
  load();
  return {
    setRoom(code) {
      if (code === room) return;
      pendingImport = null;
      if ($('campaign-import-dialog').open) $('campaign-import-dialog').close('cancel');
      room = code;
      load();
    },
  };
}
