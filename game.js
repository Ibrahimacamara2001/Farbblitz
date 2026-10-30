'use strict';

// ---------- Konfiguration ----------
const COLORS = [
  { id: 'red',    name: 'Rot',    hex: '#ff4d5e' },
  { id: 'blue',   name: 'Blau',   hex: '#3d8bff' },
  { id: 'green',  name: 'Grün',   hex: '#3ddc84' },
  { id: 'yellow', name: 'Gelb',   hex: '#ffe14d' },
  { id: 'orange', name: 'Orange', hex: '#ff9b3d' },
  { id: 'white',  name: 'Weiß',   hex: '#f2f2f2' },
];
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
const LEVELS = 9;
const MAX_MISTAKES = 3;
const LEVEL_TIMEOUT = 30; // Sekunden
const DIFF_NAMES = ['Leicht', 'Mittel', 'Schwer'];
const PLAYER_COLORS = ['#ffd23f', '#3d8bff', '#3ddc84', '#ff4d5e'];

function levelParams(level, diff) {
  const flashMs = Math.max(260, [1150, 900, 700][diff] * Math.pow(0.9, level - 1));
  const colors = Math.min(COLORS.length, 3 + Math.floor((level - 1) / 2) + diff);
  return {
    flashMs,
    spawnMs: flashMs * 0.42,
    maxLit: Math.min(6, 2 + Math.floor(level / 3) + diff),
    colors,
    targetChance: Math.max(0.3, 1.6 / colors),
    // Ab Level 4 (Mittel/Schwer) wechselt die Zielfarbe nach jedem Treffer
    shiftingTarget: diff >= 1 && level >= 4,
    // Ab Level 7 auf Schwer erlöschen eigene Felder wieder nach 4 s
    decayMs: diff === 2 && level >= 7 ? 4000 : 0,
  };
}

// ---------- Helfer ----------
const $ = (s) => document.querySelector(s);
const rand = (n) => Math.floor(Math.random() * n);
const fmt = (t) => (t == null || !isFinite(t) ? '—' : t.toFixed(2) + ' s');

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

function storeGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function storeSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* privat/blockiert */ }
}

// ---------- Sound & Haptik ----------
let audio;
function beep(freq, dur = 0.08, type = 'sine', vol = 0.15) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + dur);
  } catch { /* kein Audio */ }
}
const buzz = (ms) => { if (navigator.vibrate) navigator.vibrate(ms); };
const sfx = {
  hit: () => { beep(880, 0.07, 'triangle'); buzz(10); },
  miss: () => { beep(140, 0.22, 'sawtooth', 0.12); buzz([40, 30, 40]); },
  win: () => { [660, 880, 1100].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'triangle'), i * 90)); },
  tick: () => beep(520, 0.06, 'square', 0.08),
  go: () => beep(1040, 0.15, 'square', 0.1),
};

// ---------- Spielzustand ----------
const settings = { players: 1, diff: 0 };
let game = null;   // gesamte Partie
let run = null;    // aktueller Durchgang eines Spielers

function newGame() {
  game = {
    diff: settings.diff,
    level: 1,
    players: Array.from({ length: settings.players }, (_, i) => ({
      name: settings.players === 1 ? 'Du' : `Spieler ${i + 1}`,
      color: PLAYER_COLORS[i],
      mistakes: 0,
      out: false,
      points: 0,
      total: 0,
      levelTime: null,
    })),
    turn: 0,
  };
}

const solo = () => game.players.length === 1;
const active = () => game.players.filter((p) => !p.out);

// ---------- Board ----------
const board = $('#board');
const cells = [];
for (let i = 0; i < 9; i++) {
  const b = document.createElement('button');
  b.className = 'cell';
  b.setAttribute('aria-label', `Feld ${i + 1}`);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(i); });
  board.appendChild(b);
  cells.push(b);
}

function paint(i) {
  const c = run.cells[i];
  const el = cells[i];
  const col = c.claimed != null ? COLORS[c.claimed] : c.color != null ? COLORS[c.color] : null;
  el.style.background = col ? col.hex : '';
  el.style.setProperty('--glow', col ? col.hex : 'transparent');
  el.classList.toggle('lit', !!col);
  el.classList.toggle('claimed', c.claimed != null);
}

function setTarget(idx) {
  run.target = idx;
  const t = $('#target');
  t.style.background = COLORS[idx].hex;
  t.style.color = COLORS[idx].hex;
  t.setAttribute('aria-label', COLORS[idx].name);
}

function pickTarget(avoid) {
  let t;
  do { t = rand(run.p.colors); } while (t === avoid && run.p.colors > 1);
  return t;
}

// ---------- Ablauf eines Durchgangs ----------
function startRun() {
  const player = game.players[game.turn];
  const p = levelParams(game.level, game.diff);
  run = {
    player,
    p,
    cells: Array.from({ length: 9 }, () => ({ color: null, until: 0, claimed: null, claimedAt: 0 })),
    target: 0,
    start: performance.now(),
    nextSpawn: 0,
    over: false,
    raf: 0,
  };
  cells.forEach((el) => el.classList.remove('win', 'wrong'));
  cells.forEach((_, i) => paint(i));
  setTarget(pickTarget(-1));
  $('#hud-level').textContent = `Level ${game.level}/${LEVELS} · ${DIFF_NAMES[game.diff]}`;
  $('#hud-player').textContent = solo() ? '' : player.name;
  $('#hud-player').style.color = player.color;
  renderLives();
  show('screen-game');
  run.raf = requestAnimationFrame(loop);
}

function renderLives() {
  const left = MAX_MISTAKES - run.player.mistakes;
  $('#hud-lives').textContent = '♥'.repeat(Math.max(0, left)) + '♡'.repeat(Math.max(0, MAX_MISTAKES - left));
}

function loop(now) {
  if (!run || run.over) return;
  const t = (now - run.start) / 1000;
  $('#hud-time').textContent = t.toFixed(2);
  if (t >= LEVEL_TIMEOUT) return endRun(false, 'timeout');

  const { p } = run;
  // Abgelaufene Blitze löschen, ggf. eigene Felder zerfallen lassen
  run.cells.forEach((c, i) => {
    if (c.color != null && now >= c.until) { c.color = null; paint(i); }
    if (p.decayMs && c.claimed != null && now - c.claimedAt > p.decayMs) { c.claimed = null; paint(i); }
  });

  // Neue Blitze erzeugen
  if (now >= run.nextSpawn) {
    const free = run.cells.map((c, i) => i).filter((i) => run.cells[i].claimed == null && run.cells[i].color == null);
    const lit = run.cells.filter((c) => c.color != null).length;
    if (free.length && lit < p.maxLit) {
      const i = free[rand(free.length)];
      const c = run.cells[i];
      c.color = Math.random() < p.targetChance ? run.target : pickTarget(run.target);
      c.until = now + p.flashMs * (0.75 + Math.random() * 0.5);
      paint(i);
    }
    run.nextSpawn = now + p.spawnMs * (0.6 + Math.random() * 0.8);
  }
  run.raf = requestAnimationFrame(loop);
}

function tap(i) {
  if (!run || run.over) return;
  const c = run.cells[i];
  if (c.claimed != null) return;

  if (c.color === run.target) {
    c.claimed = c.color;
    c.claimedAt = performance.now();
    c.color = null;
    paint(i);
    sfx.hit();
    const line = LINES.find((l) => l.every((k) => run.cells[k].claimed != null));
    if (line) {
      line.forEach((k) => cells[k].classList.add('win'));
      return endRun(true);
    }
    if (run.p.shiftingTarget) setTarget(pickTarget(run.target));
  } else {
    // Fehler: falsche Farbe oder leeres Feld
    run.player.mistakes++;
    sfx.miss();
    cells[i].classList.remove('wrong');
    void cells[i].offsetWidth;
    cells[i].classList.add('wrong');
    board.classList.remove('miss');
    void board.offsetWidth;
    board.classList.add('miss');
    renderLives();
    if (run.player.mistakes >= MAX_MISTAKES) return endRun(false, 'out');
  }
}

function endRun(won, reason) {
  run.over = true;
  cancelAnimationFrame(run.raf);
  const time = (performance.now() - run.start) / 1000;
  const pl = run.player;
  pl.levelTime = won ? time : null;
  if (won) { pl.total += time; sfx.win(); }
  if (reason === 'out') pl.out = true;
  setTimeout(() => afterRun(won, reason, time), won ? 650 : 350);
}

// ---------- Nach dem Durchgang ----------
let nextAction = null;

function afterRun(won, reason, time) {
  const pl = run.player;
  const title = $('#res-title');
  const table = $('#res-table');
  table.innerHTML = '';

  if (solo()) {
    if (won && game.level === LEVELS) return finishGame();
    if (!won && reason === 'out') return finishGame();
    title.textContent = won ? `Level ${game.level} geschafft!` : 'Zeit abgelaufen';
    $('#res-time').textContent = won ? fmt(time) : '—';
    $('#res-sub').textContent = won
      ? `Gesamtzeit: ${fmt(pl.total)} · Fehler: ${pl.mistakes}/${MAX_MISTAKES}`
      : 'Versuch das Level noch einmal.';
    if (won) game.level++;
    nextAction = () => showReady();
    show('screen-result');
    return;
  }

  // Mehrspieler: nächster aktiver Spieler im selben Level?
  const next = nextPlayerIndex(game.turn);
  title.textContent = pl.out ? `${pl.name} ist raus!` : won ? `${pl.name}: geschafft!` : `${pl.name}: Zeit abgelaufen`;
  title.style.color = pl.color;
  $('#res-time').textContent = won ? fmt(time) : '—';
  $('#res-sub').textContent = `Fehler: ${pl.mistakes}/${MAX_MISTAKES}`;

  if (next != null) {
    game.turn = next;
    nextAction = () => showReady();
  } else {
    // Level fertig: schnellster bekommt den Punkt
    const finished = game.players.filter((p) => p.levelTime != null);
    let winner = null;
    if (finished.length) {
      winner = finished.reduce((a, b) => (b.levelTime < a.levelTime ? b : a));
      winner.points++;
    }
    $('#res-sub').textContent += winner ? ` · Levelsieg: ${winner.name} (${fmt(winner.levelTime)})` : ' · Niemand hat das Level geschafft';
    renderTable(table, true);
    const remaining = active();
    if (game.level >= LEVELS || remaining.length <= 1) {
      nextAction = () => finishGame();
    } else {
      game.level++;
      game.players.forEach((p) => (p.levelTime = null));
      game.turn = game.players.indexOf(remaining[0]);
      nextAction = () => showReady();
    }
  }
  show('screen-result');
}

function nextPlayerIndex(from) {
  for (let i = from + 1; i < game.players.length; i++) if (!game.players[i].out) return i;
  return null;
}

function renderTable(el, withLevel) {
  const sorted = [...game.players].sort((a, b) => (a.out - b.out) || (b.points - a.points) || (a.total - b.total));
  const lead = sorted[0];
  el.innerHTML = '';
  sorted.forEach((p) => {
    const r = document.createElement('div');
    r.className = 'row' + (p.out ? ' out' : '') + (p === lead && !p.out ? ' lead' : '');
    const left = document.createElement('span');
    left.textContent = p.name;
    left.style.color = p.color;
    const right = document.createElement('span');
    right.textContent = `${p.points} Pkt` + (withLevel ? ` · ${fmt(p.levelTime)}` : '') + ` · ${'♥'.repeat(MAX_MISTAKES - p.mistakes)}`;
    r.append(left, right);
    el.appendChild(r);
  });
}

function finishGame() {
  const title = $('#res-title');
  title.style.color = '';
  const table = $('#res-table');
  table.innerHTML = '';

  if (solo()) {
    const pl = game.players[0];
    const cleared = pl.out ? game.level - 1 : LEVELS;
    title.textContent = cleared === LEVELS ? 'Alle 9 Level geschafft!' : 'Game Over';
    $('#res-time').textContent = cleared === LEVELS ? fmt(pl.total) : `Level ${cleared}/${LEVELS}`;
    const key = `farbblitz.best.${game.diff}`;
    const best = storeGet(key, null);
    const better = !best || cleared > best.level || (cleared === best.level && pl.total < best.total);
    if (better && cleared > 0) storeSet(key, { level: cleared, total: pl.total });
    $('#res-sub').textContent = (better && cleared > 0 ? '🏆 Neue Bestleistung! ' : '') +
      `Gesamtzeit ${fmt(pl.total)} · ${DIFF_NAMES[game.diff]}`;
  } else {
    const ranked = [...game.players].sort((a, b) => (a.out - b.out) || (b.points - a.points) || (a.total - b.total));
    const champ = ranked[0];
    title.textContent = `${champ.name} gewinnt!`;
    title.style.color = champ.color;
    $('#res-time').textContent = `${champ.points} Pkt`;
    $('#res-sub').textContent = `Gespielt bis Level ${game.level} · ${DIFF_NAMES[game.diff]}`;
    renderTable(table, false);
  }
  nextAction = null;
  $('#btn-next').textContent = 'Nochmal';
  show('screen-result');
}

// ---------- Bereit-Bildschirm & Countdown ----------
function showReady() {
  const pl = game.players[game.turn];
  const p = levelParams(game.level, game.diff);
  $('#btn-next').textContent = 'Weiter';
  $('#ready-level').textContent = `Level ${game.level} von ${LEVELS} · ${DIFF_NAMES[game.diff]}`;
  $('#ready-player').textContent = solo() ? 'Bereit?' : `${pl.name} ist dran`;
  $('#ready-player').style.color = solo() ? '' : pl.color;
  const notes = [`${p.colors} Farben`];
  if (p.shiftingTarget) notes.push('Zielfarbe wechselt nach jedem Treffer');
  if (p.decayMs) notes.push('Eigene Felder erlöschen nach 4 s');
  if (!solo()) notes.push('iPhone weitergeben!');
  $('#ready-info').textContent = notes.join(' · ');
  $('#countdown').textContent = '';
  $('#btn-go').style.visibility = 'visible';
  show('screen-ready');
}

$('#btn-go').addEventListener('click', () => {
  $('#btn-go').style.visibility = 'hidden';
  let n = 3;
  const cd = $('#countdown');
  cd.textContent = n;
  sfx.tick();
  const iv = setInterval(() => {
    n--;
    if (n > 0) { cd.textContent = n; sfx.tick(); return; }
    clearInterval(iv);
    cd.textContent = 'Los!';
    sfx.go();
    setTimeout(startRun, 300);
  }, 650);
});

// ---------- Menü ----------
function bindSeg(id, key) {
  const seg = $(id);
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    settings[key] = Number(b.dataset.v);
    storeSet('farbblitz.settings', settings);
    renderBest();
  });
}

function renderBest() {
  const best = storeGet(`farbblitz.best.${settings.diff}`, null);
  $('#best').textContent = best
    ? `Solo-Rekord (${DIFF_NAMES[settings.diff]}): Level ${best.level}/${LEVELS} · ${fmt(best.total)}`
    : '';
}

function restoreSettings() {
  Object.assign(settings, storeGet('farbblitz.settings', {}));
  [['#seg-players', 'players'], ['#seg-diff', 'diff']].forEach(([id, key]) => {
    $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === settings[key]));
  });
}

bindSeg('#seg-players', 'players');
bindSeg('#seg-diff', 'diff');
restoreSettings();
renderBest();

$('#btn-start').addEventListener('click', () => { beep(0, 0.01, 'sine', 0.0001); newGame(); showReady(); });
$('#btn-howto').addEventListener('click', () => show('screen-howto'));
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => show('screen-menu')));
$('#btn-next').addEventListener('click', () => {
  if (nextAction) nextAction();
  else { newGame(); showReady(); }
});
$('#btn-menu').addEventListener('click', () => { renderBest(); show('screen-menu'); });
$('#btn-quit').addEventListener('click', () => {
  if (run) { run.over = true; cancelAnimationFrame(run.raf); }
  renderBest();
  show('screen-menu');
});

// Doppeltipp-Zoom & Scrollen auf iOS unterbinden
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault());

// Offline-Unterstützung
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
