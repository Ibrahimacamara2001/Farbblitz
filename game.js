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
// Spielfelder: Punkte auf einem Raster + Schrittweiten, entlang derer drei Felder eine Reihe bilden
const LAYOUTS = {
  cross: {
    name: 'Gitter',
    size: 5,
    // 3-2-3-2-3: alle Punkte, bei denen x und y beide gerade oder beide ungerade sind
    points: Array.from({ length: 25 }, (_, k) => [k % 5, Math.floor(k / 5)]).filter(([x, y]) => (x + y) % 2 === 0),
    steps: [[2, 0], [0, 2], [1, 1], [1, -1]],
  },
  grid: {
    name: '3×3',
    size: 3,
    points: Array.from({ length: 9 }, (_, k) => [k % 3, Math.floor(k / 3)]),
    steps: [[1, 0], [0, 1], [1, 1], [1, -1]],
  },
};
for (const L of Object.values(LAYOUTS)) {
  const at = (x, y) => L.points.findIndex(([px, py]) => px === x && py === y);
  L.lines = [];
  L.points.forEach(([x, y], i) => L.steps.forEach(([dx, dy]) => {
    const b = at(x + dx, y + dy), c = at(x + 2 * dx, y + 2 * dy);
    if (b >= 0 && c >= 0) L.lines.push([i, b, c]);
  }));
}
const LEVELS = 9;
const ROUNDS = 10;         // Züge pro Level
const MOVE_TIMES = [3, 3, 2]; // Sekunden pro Zug je Schwierigkeit
const POP_MS = 220;        // Dauer der Aufplopp-Animation, danach läuft die Zeit
const HINT_MS = 1400;      // so lange wird die Lösung nach Zeitablauf gezeigt
const MAX_MISTAKES = 3;
const DIFF_NAMES = ['Leicht', 'Mittel', 'Schwer'];
const PLAYER_COLORS = ['#ffd23f', '#3d8bff', '#3ddc84', '#ff4d5e'];

function levelParams(level, diff, layout) {
  const n = LAYOUTS[layout].points.length;
  return {
    colors: Math.min(COLORS.length, 3 + Math.floor((level - 1) / 2) + diff),
    // Mehr leere Felder = mehr Kandidaten, unter denen man das richtige finden muss
    empties: Math.min(n - 4, 2 + Math.floor((level - 1) / 2) + diff + (n > 9 ? 1 : 0)),
    moveTime: MOVE_TIMES[diff],
  };
}

// ---------- Helfer ----------
const $ = (s) => document.querySelector(s);
const rand = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
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
  pop: () => beep(760, 0.06, 'triangle', 0.08),
  hit: () => { [660, 880, 1100].forEach((f, i) => setTimeout(() => beep(f, 0.1, 'triangle'), i * 70)); buzz(15); },
  miss: () => { beep(140, 0.22, 'sawtooth', 0.12); buzz([40, 30, 40]); },
  tick: () => beep(520, 0.06, 'square', 0.08),
  go: () => beep(1040, 0.15, 'square', 0.1),
};

// ---------- Rätsel erzeugen ----------
// Genau ein leeres Feld ergibt eine Dreierreihe – und das nur mit genau einer Farbe.
function makePuzzle(L, p) {
  const n = L.points.length;
  for (let tries = 0; tries < 5000; tries++) {
    const color = rand(p.colors);
    const line = L.lines[rand(L.lines.length)];
    const answer = line[rand(3)];
    const board = new Array(n).fill(undefined);
    line.forEach((k) => (board[k] = k === answer ? null : color));

    const rest = shuffle([...Array(n).keys()].filter((k) => !line.includes(k)));
    rest.slice(0, p.empties - 1).forEach((k) => (board[k] = null));
    rest.slice(p.empties - 1).forEach((k) => (board[k] = rand(p.colors)));

    // Keine fertige Reihe; jede Reihe aus zwei gleichen Farben + Lücke muss genau die Lösung sein
    const ok = L.lines.every((l) => {
      const filled = l.filter((k) => board[k] != null);
      const empty = l.filter((k) => board[k] === null);
      const same = filled.length >= 2 && filled.every((k) => board[k] === board[filled[0]]);
      if (filled.length === 3 && same) return false;
      if (filled.length === 2 && same) return empty[0] === answer && board[filled[0]] === color;
      return true;
    });
    if (ok) return { board, color, answer };
  }
  throw new Error('Kein Rätsel gefunden');
}

// ---------- Spielzustand ----------
const settings = { players: 1, diff: 0, layout: 'cross' };
let game = null;   // gesamte Partie
let run = null;    // aktueller Durchgang (ein Level) eines Spielers

function newGame() {
  game = {
    diff: settings.diff,
    layout: LAYOUTS[settings.layout] ? settings.layout : 'cross',
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
let cells = [];

function buildBoard(key) {
  const L = LAYOUTS[key];
  board.innerHTML = '';
  board.className = 'board ' + key;
  // Rauten im Gitter: Abstand u zwischen Rasterpunkten, Kantenlänge a, g = Füllgrad
  const g = 0.84, u = 100 / (L.size - 1 + 2 * g), a = Math.SQRT2 * u * g;
  cells = L.points.map(([x, y], i) => {
    const b = document.createElement('button');
    b.className = 'cell';
    b.setAttribute('aria-label', `Feld ${i + 1}`);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(i); });
    if (key === 'cross') {
      b.style.width = b.style.height = a + '%';
      b.style.left = (x * u + g * u - a / 2) + '%';
      b.style.top = (y * u + g * u - a / 2) + '%';
    }
    board.appendChild(b);
    return b;
  });
}

function paint(i, color) {
  const el = cells[i];
  const col = color == null ? null : COLORS[color];
  el.style.background = col ? col.hex : '';
  el.style.setProperty('--glow', col ? col.hex : 'transparent');
  el.classList.toggle('lit', !!col);
}

// ---------- Ablauf eines Levels ----------
function startRun() {
  const player = game.players[game.turn];
  buildBoard(game.layout);
  run = {
    player,
    L: LAYOUTS[game.layout],
    p: levelParams(game.level, game.diff, game.layout),
    round: 0,
    time: 0,          // Summe der Reaktionszeiten
    state: 'idle',    // idle | pop | play | hint | over
    timers: [],
    raf: 0,
  };
  $('#hud-level').textContent = `Level ${game.level}/${LEVELS} · ${DIFF_NAMES[game.diff]}`;
  $('#hud-player').textContent = solo() ? '' : player.name;
  $('#hud-player').style.color = player.color;
  renderLives();
  show('screen-game');
  nextRound();
}

function later(fn, ms) { run.timers.push(setTimeout(fn, ms)); }

function nextRound() {
  run.round++;
  $('#hud-round').textContent = `${run.round}/${ROUNDS}`;
  run.puzzle = makePuzzle(run.L, run.p);
  run.state = 'pop';
  board.classList.remove('hinting', 'miss');
  cells.forEach((el, i) => {
    el.className = 'cell';
    paint(i, null);
  });
  setBar(1);
  $('#hud-time').textContent = run.p.moveTime.toFixed(1);

  // Alle Farben ploppen gleichzeitig auf und bleiben dann stehen
  run.puzzle.board.forEach((c, i) => {
    if (c == null) return;
    paint(i, c);
    cells[i].classList.add('pop');
  });
  sfx.pop();
  later(() => {
    run.state = 'play';
    run.start = performance.now();
    run.raf = requestAnimationFrame(loop);
  }, POP_MS);
}

function setBar(frac) {
  const bar = $('#timebar i');
  bar.style.width = Math.max(0, frac) * 100 + '%';
  bar.style.background = frac > 0.5 ? 'var(--green)' : frac > 0.25 ? 'var(--orange)' : 'var(--red)';
}

function renderLives() {
  const left = MAX_MISTAKES - run.player.mistakes;
  $('#hud-lives').textContent = '♥'.repeat(Math.max(0, left)) + '♡'.repeat(Math.max(0, MAX_MISTAKES - left));
}

function loop(now) {
  if (!run || run.state !== 'play') return;
  const left = run.p.moveTime - (now - run.start) / 1000;
  $('#hud-time').textContent = Math.max(0, left).toFixed(1);
  setBar(left / run.p.moveTime);
  if (left <= 0) return timeUp();
  run.raf = requestAnimationFrame(loop);
}

function mistake() {
  run.player.mistakes++;
  sfx.miss();
  board.classList.remove('miss');
  void board.offsetWidth;
  board.classList.add('miss');
  renderLives();
  return run.player.mistakes >= MAX_MISTAKES;
}

function timeUp() {
  run.state = 'hint';
  run.time += run.p.moveTime;
  const out = mistake();
  // Zeigen, welches Feld richtig gewesen wäre
  const el = cells[run.puzzle.answer];
  el.style.setProperty('--glow', COLORS[run.puzzle.color].hex);
  el.classList.add('hint');
  const { board: b, color, answer } = run.puzzle;
  run.L.lines.find((l) => l.includes(answer) && l.every((k) => k === answer || b[k] === color))
    .forEach((k) => k !== answer && cells[k].classList.add('hint-line'));
  board.classList.add('hinting');
  later(() => (out ? endRun('out') : advance()), HINT_MS);
}

function tap(i) {
  if (!run || run.state !== 'play') return;
  const { puzzle } = run;
  if (i === puzzle.answer) {
    run.state = 'won';
    cancelAnimationFrame(run.raf);
    run.time += (performance.now() - run.start) / 1000;
    paint(i, puzzle.color);
    const line = run.L.lines.find((l) => l.includes(i) && l.every((k) => k === i || puzzle.board[k] === puzzle.color));
    line.forEach((k) => cells[k].classList.add('win'));
    sfx.hit();
    later(advance, 550);
  } else {
    cells[i].classList.remove('wrong');
    void cells[i].offsetWidth;
    cells[i].classList.add('wrong');
    if (mistake()) {
      run.state = 'over';
      cancelAnimationFrame(run.raf);
      later(() => endRun('out'), 400);
    }
  }
}

function advance() {
  if (run.round >= ROUNDS) endRun('done');
  else nextRound();
}

function stopRun() {
  if (!run) return;
  run.state = 'over';
  cancelAnimationFrame(run.raf);
  run.timers.forEach(clearTimeout);
}

function endRun(reason) {
  stopRun();
  const pl = run.player;
  const done = reason === 'done';
  pl.levelTime = done ? run.time : null;
  if (done) pl.total += run.time;
  if (reason === 'out') pl.out = true;
  afterRun(done, reason, run.time);
}

// ---------- Nach dem Durchgang ----------
let nextAction = null;

function afterRun(won, reason, time) {
  const pl = run.player;
  const title = $('#res-title');
  const table = $('#res-table');
  table.innerHTML = '';
  title.style.color = '';

  if (solo()) {
    if (!won || game.level === LEVELS) return finishGame();
    title.textContent = `Level ${game.level} geschafft!`;
    $('#res-time').textContent = fmt(time);
    $('#res-sub').textContent = `Gesamtzeit: ${fmt(pl.total)} · Fehler: ${pl.mistakes}/${MAX_MISTAKES}`;
    game.level++;
    nextAction = () => showReady();
    show('screen-result');
    return;
  }

  // Mehrspieler: nächster aktiver Spieler im selben Level?
  const next = nextPlayerIndex(game.turn);
  title.textContent = pl.out ? `${pl.name} ist raus!` : `${pl.name}: geschafft!`;
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

const rank = (a, b) => (a.out - b.out) || (b.points - a.points) || (a.total - b.total);

function renderTable(el, withLevel) {
  const sorted = [...game.players].sort(rank);
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
  $('#res-table').innerHTML = '';

  if (solo()) {
    const pl = game.players[0];
    const cleared = pl.out ? game.level - 1 : LEVELS;
    title.textContent = cleared === LEVELS ? 'Alle 9 Level geschafft!' : 'Game Over';
    $('#res-time').textContent = cleared === LEVELS ? fmt(pl.total) : `Level ${cleared}/${LEVELS}`;
    const key = `farbblitz.best.${game.layout}.${game.diff}`;
    const best = storeGet(key, null);
    const better = !best || cleared > best.level || (cleared === best.level && pl.total < best.total);
    if (better && cleared > 0) storeSet(key, { level: cleared, total: pl.total });
    $('#res-sub').textContent = (better && cleared > 0 ? '🏆 Neue Bestleistung! ' : '') +
      `Gesamtzeit ${fmt(pl.total)} · ${LAYOUTS[game.layout].name} · ${DIFF_NAMES[game.diff]}`;
  } else {
    const champ = [...game.players].sort(rank)[0];
    title.textContent = `${champ.name} gewinnt!`;
    title.style.color = champ.color;
    $('#res-time').textContent = `${champ.points} Pkt`;
    $('#res-sub').textContent = `Gespielt bis Level ${game.level} · ${DIFF_NAMES[game.diff]}`;
    renderTable($('#res-table'), false);
  }
  nextAction = null;
  $('#btn-next').textContent = 'Nochmal';
  show('screen-result');
}

// ---------- Bereit-Bildschirm & Countdown ----------
function showReady() {
  const pl = game.players[game.turn];
  const p = levelParams(game.level, game.diff, game.layout);
  $('#btn-next').textContent = 'Weiter';
  $('#ready-level').textContent = `Level ${game.level} von ${LEVELS} · ${DIFF_NAMES[game.diff]}`;
  $('#ready-player').textContent = solo() ? 'Bereit?' : `${pl.name} ist dran`;
  $('#ready-player').style.color = solo() ? '' : pl.color;
  const notes = [`${ROUNDS} Züge`, `${p.colors} Farben`, `${p.moveTime} s pro Zug`];
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
    settings[key] = key === 'layout' ? b.dataset.v : Number(b.dataset.v);
    storeSet('farbblitz.settings', settings);
    renderBest();
  });
}

function renderBest() {
  const best = storeGet(`farbblitz.best.${settings.layout}.${settings.diff}`, null);
  $('#best').textContent = best
    ? `Solo-Rekord (${LAYOUTS[settings.layout].name}, ${DIFF_NAMES[settings.diff]}): Level ${best.level}/${LEVELS} · ${fmt(best.total)}`
    : '';
}

function restoreSettings() {
  Object.assign(settings, storeGet('farbblitz.settings', {}));
  if (!LAYOUTS[settings.layout]) settings.layout = 'cross';
  [['#seg-players', 'players'], ['#seg-diff', 'diff'], ['#seg-layout', 'layout']].forEach(([id, key]) => {
    $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(b.dataset.v) === String(settings[key])));
  });
}

bindSeg('#seg-players', 'players');
bindSeg('#seg-diff', 'diff');
bindSeg('#seg-layout', 'layout');
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
  stopRun();
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
