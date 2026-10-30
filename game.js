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
const JOKER = -1; // zählt als jede Farbe

// Spielfeld: 13 Rauten im Muster 3-2-3-2-3 (Rasterpunkte, bei denen x und y beide gerade oder beide ungerade sind)
const GRID_SIZE = 5;
const POINTS = Array.from({ length: 25 }, (_, k) => [k % 5, Math.floor(k / 5)]).filter(([x, y]) => (x + y) % 2 === 0);
// Drei Felder in gleichem Abstand entlang einer dieser Richtungen bilden eine Reihe
const LINES = [];
{
  const at = (x, y) => POINTS.findIndex(([px, py]) => px === x && py === y);
  POINTS.forEach(([x, y], i) => [[2, 0], [0, 2], [1, 1], [1, -1]].forEach(([dx, dy]) => {
    const b = at(x + dx, y + dy), c = at(x + 2 * dx, y + 2 * dy);
    if (b >= 0 && c >= 0) LINES.push([i, b, c]);
  }));
}

const MODES = {
  classic: { name: 'Klassik',  desc: '9 Level à 10 Züge. 3 s pro Zug (Schwer: 2 s), 3 Fehler und du bist raus.' },
  chaos:   { name: 'Chaos',    desc: 'Endlos: Start mit 4 s pro Zug, jeder Treffer macht es schneller. Dazu Sonderzüge, Combos und Blitz-Punkte.' },
  rush:    { name: 'Zeitjagd', desc: '30 s auf der Uhr. Treffer +1,5 s, Fehler −2 s. Wie viele Punkte schaffst du?' },
  duel:    { name: 'Duell',    desc: 'Zwei Spieler gleichzeitig an einem iPhone. Wer zuerst tippt, punktet. Blitz-Treffer sabotieren den Gegner.' },
};

const LEVELS = 9;
const ROUNDS = 10;            // Züge pro Level (Klassik)
const MOVE_TIMES = [3, 3, 2]; // Sekunden pro Zug je Schwierigkeit (Klassik)
const POP_MS = 220;           // Dauer der Aufplopp-Animation, danach läuft die Zeit
const HINT_MS = 1400;         // so lange wird die Lösung nach Zeitablauf gezeigt
const MAX_MISTAKES = 3;
const BLITZ = 1.0;            // Treffer schneller als das = Blitz
const HITS_PER_STAGE = 6;     // Chaos/Zeitjagd: alle 6 Treffer wird es schwerer
const CHAOS = { start: 4, step: 0.08, min: 1.2, specialChance: 0.4 };
const RUSH = { start: 30, hit: 1.5, miss: 2 };
const DUEL = { win: 7, times: [4, 3.5, 3], sabotageMs: 1000 };
const DIFF_NAMES = ['Leicht', 'Mittel', 'Schwer'];
const PLAYER_COLORS = ['#ffd23f', '#3d8bff'];

// Sonderzüge im Chaos-Modus; `from` = ab welcher Stufe, `time` = Zeitfaktor für den Zug
const SPECIALS = {
  joker:    { from: 2, time: 1,   label: '🌈 Joker', info: 'Das Regenbogenfeld zählt als jede Farbe' },
  double:   { from: 3, time: 1.6, label: '✌️ Doppelzug', info: 'Zwei Lücken – finde beide!' },
  spin:     { from: 4, time: 1,   label: '🌀 Dreher', info: 'Das Feld dreht sich' },
  blackout: { from: 5, time: 1.3, label: '🌑 Blackout', info: 'Merk dir die Farben!' },
};

function levelParams(level, diff) {
  return {
    colors: Math.min(COLORS.length, 3 + Math.floor((level - 1) / 2) + diff),
    // Mehr leere Felder = mehr Kandidaten, unter denen man das richtige finden muss
    empties: Math.min(POINTS.length - 4, 3 + Math.floor((level - 1) / 2) + diff),
    moveTime: MOVE_TIMES[diff],
  };
}

// ---------- Helfer ----------
const $ = (s) => document.querySelector(s);
const rand = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rand(a.length)];
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
  // Combo: Tonhöhe steigt mit dem Multiplikator
  hit: (mult = 1) => { [660, 880, 1100].forEach((f, i) => setTimeout(() => beep(f * (1 + (mult - 1) * 0.12), 0.1, 'triangle'), i * 70)); buzz(15); },
  blitz: () => [1200, 1600].forEach((f, i) => setTimeout(() => beep(f, 0.08, 'square', 0.08), 200 + i * 60)),
  miss: () => { beep(140, 0.22, 'sawtooth', 0.12); buzz([40, 30, 40]); },
  special: () => [500, 750, 1000, 1250].forEach((f, i) => setTimeout(() => beep(f, 0.07, 'sine', 0.1), i * 50)),
  tick: () => beep(520, 0.06, 'square', 0.08),
  go: () => beep(1040, 0.15, 'square', 0.1),
};

// ---------- Rätsel ----------
// Alle (Feld, Farbe)-Paare, mit denen ein leeres Feld eine Dreierreihe ergibt
function solutions(board, ncolors) {
  const found = new Set();
  board.forEach((v, e) => {
    if (v !== null) return;
    for (const l of LINES) {
      if (!l.includes(e)) continue;
      const others = l.filter((k) => k !== e).map((k) => board[k]);
      if (others.some((o) => o == null)) continue;
      const real = others.filter((o) => o !== JOKER);
      if (real.length === 0) for (let c = 0; c < ncolors; c++) found.add(e + ':' + c);
      else if (real.every((o) => o === real[0])) found.add(e + ':' + real[0]);
    }
  });
  return [...found];
}

function hasComplete(board) {
  return LINES.some((l) => {
    const v = l.map((k) => board[k]);
    if (v.some((o) => o == null)) return false;
    const real = v.filter((o) => o !== JOKER);
    return real.every((o) => o === real[0]);
  });
}

// Die Reihe, die `cell` mit `color` vervollständigt
function lineFor(board, cell, color) {
  return LINES.find((l) => l.includes(cell) && l.every((k) => k === cell || board[k] === color || board[k] === JOKER));
}

// Genau die vorgesehenen Lücken ergeben eine Reihe – jede nur mit genau einer Farbe.
// opts: { double, joker, decoys }
function makePuzzle(p, opts = {}) {
  const n = POINTS.length;
  const want = opts.double ? 2 : 1;
  const ncolors = p.colors;
  for (let tries = 0; tries < 4000; tries++) {
    const board = new Array(n).fill(undefined);
    const answers = [];
    let fail = false;

    for (let a = 0; a < want && !fail; a++) {
      const free = LINES.filter((l) => l.every((k) => board[k] === undefined));
      if (!free.length) { fail = true; break; }
      const line = pick(free);
      const color = answers.length && Math.random() < 0.7 ? (answers[0].color + 1 + rand(ncolors - 1)) % ncolors : rand(ncolors);
      const cell = pick(line);
      line.forEach((k) => (board[k] = k === cell ? null : color));
      if (opts.joker && a === 0) board[pick(line.filter((k) => k !== cell))] = JOKER;
      answers.push({ cell, color });
    }
    if (fail) continue;

    // Täuschungen: zwei gleiche Farben, aber das dritte Feld ist schon falsch belegt
    for (let d = 0; d < (opts.decoys || 0); d++) {
      const free = LINES.filter((l) => l.every((k) => board[k] === undefined));
      if (!free.length) break;
      const line = shuffle([...pick(free)]);
      const c = rand(ncolors);
      board[line[0]] = c;
      board[line[1]] = c;
      board[line[2]] = (c + 1 + rand(ncolors - 1)) % ncolors;
    }

    const rest = shuffle([...Array(n).keys()].filter((k) => board[k] === undefined));
    const extraEmpty = Math.max(0, p.empties - want);
    rest.slice(0, extraEmpty).forEach((k) => (board[k] = null));
    rest.slice(extraEmpty).forEach((k) => (board[k] = rand(ncolors)));

    if (hasComplete(board)) continue;
    const key = (a) => a.cell + ':' + a.color;
    const sol = solutions(board, ncolors);
    if (sol.length !== want || !answers.every((a) => sol.includes(key(a)))) continue;
    // Beim Doppelzug: nach dem ersten Treffer darf nur noch die andere Lücke passen
    if (want === 2 && !answers.every((a, i) => {
      const b2 = board.slice();
      b2[a.cell] = a.color;
      const s2 = solutions(b2, ncolors);
      return s2.length === 1 && s2[0] === key(answers[1 - i]);
    })) continue;

    return { board, answers };
  }
  return null;
}

// ---------- Board ----------
// Baut ein Spielfeld in `el` und liefert die Feld-Buttons
function buildBoard(el, onTap) {
  el.innerHTML = '';
  el.className = 'board';
  // Rauten: Abstand u zwischen Rasterpunkten, Kantenlänge a, g = Füllgrad
  const g = 0.84, u = 100 / (GRID_SIZE - 1 + 2 * g), a = Math.SQRT2 * u * g;
  return POINTS.map(([x, y], i) => {
    const b = document.createElement('button');
    b.className = 'cell';
    b.setAttribute('aria-label', `Feld ${i + 1}`);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); onTap(i); });
    b.style.width = b.style.height = a + '%';
    b.style.left = (x * u + g * u - a / 2) + '%';
    b.style.top = (y * u + g * u - a / 2) + '%';
    el.appendChild(b);
    return b;
  });
}

function paintCell(el, color) {
  const col = color == null || color === JOKER ? null : COLORS[color];
  el.style.background = col ? col.hex : '';
  el.style.setProperty('--glow', col ? col.hex : color === JOKER ? '#ffffff' : 'transparent');
  el.classList.toggle('lit', color != null);
  el.classList.toggle('joker', color === JOKER);
}

function showPuzzle(cellEls, puzzle) {
  cellEls.forEach((el, i) => {
    el.className = 'cell';
    paintCell(el, puzzle.board[i]);
    if (puzzle.board[i] != null) el.classList.add('pop');
  });
}

function revealAnswers(cellEls, boardEl, puzzle, answers) {
  answers.forEach(({ cell, color }) => {
    cellEls[cell].style.setProperty('--glow', COLORS[color].hex);
    cellEls[cell].classList.add('hint');
    lineFor(puzzle.board, cell, color).forEach((k) => k !== cell && cellEls[k].classList.add('hint-line'));
  });
  boardEl.classList.add('hinting');
}

function markWin(cellEls, puzzle, { cell, color }) {
  paintCell(cellEls[cell], color);
  lineFor(puzzle.board, cell, color).forEach((k) => cellEls[k].classList.add('win'));
}

function shake(el) {
  el.classList.remove('wrong');
  void el.offsetWidth;
  el.classList.add('wrong');
}

// ---------- Spielzustand ----------
const settings = { diff: 0, mode: 'classic' };
let game = null;   // gesamte Partie
let run = null;    // aktueller Durchgang (Klassik: ein Level)

const scoring = () => game.mode === 'chaos' || game.mode === 'rush';

function newGame() {
  game = {
    mode: MODES[settings.mode] ? settings.mode : 'classic',
    diff: settings.diff,
    level: 1,
    mistakes: 0,
    total: 0,
  };
}

// ---------- Einzelspieler-Ablauf (Klassik, Chaos, Zeitjagd) ----------
const board = $('#board');
let cells = [];

function startRun() {
  cells = buildBoard(board, tap);
  run = {
    p: levelParams(game.level, game.diff),
    round: 0,
    time: 0,          // Summe der Reaktionszeiten (Klassik)
    state: 'idle',    // idle | pop | play | won | hint | over
    timers: [],
    raf: 0,
    clockRaf: 0,
    // Punkte-Modi
    score: 0,
    hits: 0,
    streak: 0,
    bestStreak: 0,
    blitzes: 0,
    moveTime: game.mode === 'chaos' ? CHAOS.start : MOVE_TIMES[game.diff],
    clock: RUSH.start,
  };
  const m = game.mode;
  $('#hud-level').textContent = m === 'classic'
    ? `Level ${game.level}/${LEVELS} · ${DIFF_NAMES[game.diff]}`
    : `${MODES[m].name} · ${DIFF_NAMES[game.diff]}`;
  $('#hud-mid-label').textContent = m === 'classic' ? 'Zug' : 'Punkte';
  $('#hud-lives').style.visibility = m === 'rush' ? 'hidden' : 'visible';
  renderLives();
  renderCombo();
  show('screen-game');
  if (m === 'rush') {
    run.clockStart = null;
    run.clockRaf = requestAnimationFrame(rushLoop);
  }
  nextRound();
}

function later(fn, ms) { run.timers.push(setTimeout(fn, ms)); }

// Parameter für den nächsten Zug je nach Modus
function moveSetup() {
  if (game.mode === 'classic') return { opts: {}, kind: null, limit: run.p.moveTime };
  const stage = Math.min(LEVELS, 1 + Math.floor(run.hits / HITS_PER_STAGE));
  run.p = levelParams(stage, game.diff);
  if (game.mode === 'rush') return { opts: {}, kind: null, limit: Infinity };

  // Chaos: Täuschungen ab Stufe 4, Sonderzüge je nach Stufe
  const decoys = stage >= 4 ? 1 + Math.floor((stage - 4) / 3) : 0;
  const unlocked = Object.keys(SPECIALS).filter((k) => stage >= SPECIALS[k].from);
  const kind = unlocked.length && Math.random() < CHAOS.specialChance ? pick(unlocked) : null;
  return {
    opts: { decoys, joker: kind === 'joker', double: kind === 'double' },
    kind,
    limit: run.moveTime * (kind ? SPECIALS[kind].time : 1),
  };
}

function nextRound() {
  run.round++;
  const setup = moveSetup();
  let puzzle = makePuzzle(run.p, setup.opts);
  if (!puzzle) { // Sonderzug passt nicht aufs Feld → normaler Zug
    setup.kind = null;
    puzzle = makePuzzle(run.p, { decoys: setup.opts.decoys });
  }
  run.puzzle = puzzle;
  run.open = puzzle.answers.slice();
  run.limit = setup.limit;
  run.kind = setup.kind;
  run.state = 'pop';
  updateMid();

  board.classList.remove('hinting', 'miss', 'spin', 'blackout');
  board.style.removeProperty('--spin');
  showPuzzle(cells, puzzle);
  sfx.pop();
  setBar(1);
  $('#hud-time').textContent = isFinite(run.limit) ? run.limit.toFixed(1) : '';

  if (run.kind) {
    banner(SPECIALS[run.kind].label, SPECIALS[run.kind].info);
    sfx.special();
  }
  if (run.kind === 'spin') {
    board.style.setProperty('--spin', pick([90, 180, 270, -90]) + 'deg');
    later(() => board.classList.add('spin'), 30);
  }
  if (run.kind === 'blackout') later(() => run.state !== 'over' && board.classList.add('blackout'), 1000);

  later(() => {
    if (run.state === 'over') return;
    run.state = 'play';
    run.start = performance.now();
    if (game.mode === 'rush' && run.clockStart == null) run.clockStart = performance.now();
    if (game.mode !== 'rush') run.raf = requestAnimationFrame(loop);
  }, POP_MS);
}

function updateMid() {
  $('#hud-round').textContent = game.mode === 'classic' ? `${run.round}/${ROUNDS}` : run.score;
}

function setBar(frac) {
  const bar = $('#timebar i');
  bar.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
  bar.style.background = frac > 0.5 ? 'var(--green)' : frac > 0.25 ? 'var(--orange)' : 'var(--red)';
}

function renderLives() {
  const left = MAX_MISTAKES - game.mistakes;
  $('#hud-lives').textContent = '♥'.repeat(Math.max(0, left)) + '♡'.repeat(Math.max(0, MAX_MISTAKES - left));
}

function multiplier() { return Math.min(5, 1 + Math.floor(run.streak / 4)); }

function renderCombo() {
  $('#hud-combo').textContent = scoring() && run.streak >= 2 ? `Combo ${run.streak} · ×${multiplier()}` : '';
}

function banner(title, text) {
  const b = $('#banner');
  b.innerHTML = '';
  const t = document.createElement('b');
  t.textContent = title;
  const s = document.createElement('span');
  s.textContent = text;
  b.append(t, s);
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
}

function floatText(text, cls = '') {
  const f = document.createElement('div');
  f.className = 'float ' + cls;
  f.textContent = text;
  $('#board-wrap').appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

function loop(now) {
  if (!run || run.state !== 'play') return;
  const left = run.limit - (now - run.start) / 1000;
  $('#hud-time').textContent = Math.max(0, left).toFixed(1);
  setBar(left / run.limit);
  if (left <= 0) return timeUp();
  run.raf = requestAnimationFrame(loop);
}

// Zeitjagd: eine Uhr für alles
function rushLoop(now) {
  if (!run || run.state === 'over') return;
  const left = run.clockStart == null ? run.clock : run.clock - (now - run.clockStart) / 1000;
  $('#hud-time').textContent = Math.max(0, left).toFixed(1);
  setBar(left / RUSH.start);
  if (left <= 0) {
    run.state = 'over';
    later(() => endRun('timeout'), 300);
    return;
  }
  run.clockRaf = requestAnimationFrame(rushLoop);
}
function rushAdjust(delta) {
  run.clock += delta;
  floatText((delta > 0 ? '+' : '−') + Math.abs(delta).toFixed(1) + ' s', delta > 0 ? 'good' : 'bad');
}

// Fehler; liefert true, wenn man damit raus ist
function mistake() {
  sfx.miss();
  board.classList.remove('miss');
  void board.offsetWidth;
  board.classList.add('miss');
  run.streak = 0;
  renderCombo();
  if (game.mode === 'rush') { rushAdjust(-RUSH.miss); return false; }
  game.mistakes++;
  renderLives();
  return game.mistakes >= MAX_MISTAKES;
}

function timeUp() {
  run.state = 'hint';
  run.time += run.limit;
  const out = mistake();
  board.classList.remove('blackout', 'spin');
  revealAnswers(cells, board, run.puzzle, run.open);
  later(() => (out ? endRun('out') : advance()), HINT_MS);
}

function tap(i) {
  if (!run || run.state !== 'play') return;
  const hit = run.open.find((a) => a.cell === i);
  if (!hit) {
    shake(cells[i]);
    if (mistake()) {
      run.state = 'over';
      cancelAnimationFrame(run.raf);
      later(() => endRun('out'), 400);
    }
    return;
  }
  run.open = run.open.filter((a) => a !== hit);
  markWin(cells, run.puzzle, hit);
  if (run.open.length) { sfx.hit(1); return; } // Doppelzug: eine Lücke fehlt noch

  run.state = 'won';
  cancelAnimationFrame(run.raf);
  board.classList.remove('blackout');
  const t = (performance.now() - run.start) / 1000;
  run.time += t;
  run.hits++;
  scoreHit(t);
  later(advance, 550);
}

// Punkte: Grundwert + Tempobonus, mal Combo-Multiplikator, Blitz verdoppelt
function scoreHit(t) {
  run.streak++;
  run.bestStreak = Math.max(run.bestStreak, run.streak);
  const mult = multiplier();
  const blitz = t < BLITZ;
  sfx.hit(mult);
  if (blitz) sfx.blitz();
  if (scoring()) {
    const ref = game.mode === 'chaos' ? run.limit : 3;
    let pts = (100 + Math.round(100 * Math.max(0, 1 - t / ref))) * mult;
    if (blitz) { pts *= 2; run.blitzes++; }
    run.score += pts;
    floatText(`+${pts}${blitz ? ' ⚡ Blitz!' : ''}`, blitz ? 'blitz' : 'good');
    if (mult > 1 && run.streak % 4 === 0) setTimeout(() => floatText(`Combo ×${mult}!`, 'combo'), 250);
    if (game.mode === 'chaos') run.moveTime = Math.max(CHAOS.min, run.moveTime - CHAOS.step);
    if (game.mode === 'rush') rushAdjust(RUSH.hit);
    updateMid();
  } else if (blitz) {
    floatText('⚡ Blitz!', 'blitz');
  }
  renderCombo();
}

function advance() {
  if (run.state === 'over') return;
  if (game.mode === 'classic' && run.round >= ROUNDS) endRun('done');
  else nextRound();
}

function stopRun() {
  if (!run) return;
  run.state = 'over';
  cancelAnimationFrame(run.raf);
  cancelAnimationFrame(run.clockRaf);
  run.timers.forEach(clearTimeout);
}

function endRun(reason) {
  stopRun();
  if (scoring()) return finishScoreMode(reason);
  if (reason !== 'done' || game.level === LEVELS) {
    if (reason === 'done') game.total += run.time;
    return finishClassic(reason === 'done');
  }
  game.total += run.time;
  $('#res-title').textContent = `Level ${game.level} geschafft!`;
  $('#res-time').textContent = fmt(run.time);
  $('#res-sub').textContent = `Gesamtzeit: ${fmt(game.total)} · Fehler: ${game.mistakes}/${MAX_MISTAKES}`;
  game.level++;
  nextAction = () => showReady();
  showResult('Weiter');
}

// ---------- Ergebnisse ----------
let nextAction = null;

function showResult(nextLabel) {
  $('#btn-next').textContent = nextLabel;
  show('screen-result');
}

// Rekorde: Klassik = höchstes Level + Zeit, sonst Punkte
const bestKey = (mode, diff) => mode === 'classic' ? `farbblitz.best.cross.${diff}` : `farbblitz.hs.${mode}.${diff}`;

function finishClassic(allDone) {
  const title = $('#res-title');
  title.style.color = '';
  const cleared = allDone ? LEVELS : game.level - 1;
  title.textContent = allDone ? 'Alle 9 Level geschafft!' : 'Game Over';
  $('#res-time').textContent = allDone ? fmt(game.total) : `Level ${cleared}/${LEVELS}`;
  const key = bestKey('classic', game.diff);
  const best = storeGet(key, null);
  const better = cleared > 0 && (!best || cleared > best.level || (cleared === best.level && game.total < best.total));
  if (better) storeSet(key, { level: cleared, total: game.total });
  $('#res-sub').textContent = (better ? '🏆 Neue Bestleistung! ' : '') + `Gesamtzeit ${fmt(game.total)} · ${DIFF_NAMES[game.diff]}`;
  nextAction = null;
  showResult('Nochmal');
}

function finishScoreMode(reason) {
  const title = $('#res-title');
  title.style.color = '';
  title.textContent = reason === 'timeout' ? 'Zeit um!' : 'Game Over';
  $('#res-time').textContent = `${run.score} Pkt`;
  const key = bestKey(game.mode, game.diff);
  const best = storeGet(key, null);
  const better = run.score > 0 && (!best || run.score > best.score);
  if (better) storeSet(key, { score: run.score });
  const extra = game.mode === 'chaos' ? ` · Tempo am Ende ${run.moveTime.toFixed(2)} s` : '';
  $('#res-sub').textContent = (better ? '🏆 Neuer Highscore! ' : best ? `Highscore: ${best.score} · ` : '') +
    `${run.hits} Treffer · beste Combo ${run.bestStreak} · ${run.blitzes} Blitze${extra}`;
  nextAction = null;
  showResult('Nochmal');
}

// ---------- Duell: zwei Spieler gleichzeitig ----------
let duel = null;

function startDuel() {
  duel = {
    move: 0,
    state: 'idle',
    timers: [],
    raf: 0,
    sides: [0, 1].map((s) => {
      const root = $(`#duel-${s}`);
      const boardEl = root.querySelector('.board');
      const name = root.querySelector('.duel-name');
      name.textContent = `Spieler ${s + 1}`;
      name.style.color = PLAYER_COLORS[s];
      return { root, boardEl, cells: buildBoard(boardEl, (i) => duelTap(s, i)), score: 0, locked: false, sabotaged: false };
    }),
  };
  renderDuel();
  show('screen-duel');
  nextDuelMove();
}

function duelLater(fn, ms) { duel.timers.push(setTimeout(fn, ms)); }

function renderDuel() {
  duel.sides.forEach((sd) => {
    sd.root.querySelector('.duel-score').textContent = `${sd.score} / ${DUEL.win}`;
  });
  $('#duel-move').textContent = `Zug ${duel.move}`;
}

function duelStatus(s, text) { duel.sides[s].root.querySelector('.duel-status').textContent = text; }

function nextDuelMove() {
  duel.move++;
  const stage = Math.min(LEVELS, 1 + Math.floor((duel.move - 1) / 3));
  duel.puzzle = makePuzzle(levelParams(stage, game.diff));
  duel.limit = DUEL.times[game.diff];
  duel.state = 'pop';
  renderDuel();
  duel.sides.forEach((sd, s) => {
    sd.locked = false;
    sd.boardEl.classList.remove('hinting', 'miss', 'locked');
    showPuzzle(sd.cells, duel.puzzle);
    duelStatus(s, '');
    // Sabotage: Feld bleibt kurz verdeckt
    sd.root.classList.toggle('sabotaged', sd.sabotaged);
    if (sd.sabotaged) {
      duelStatus(s, '⚡ Sabotiert!');
      duelLater(() => { sd.root.classList.remove('sabotaged'); duelStatus(s, ''); }, DUEL.sabotageMs);
    }
    sd.sabotaged = false;
  });
  sfx.pop();
  duelLater(() => {
    duel.state = 'play';
    duel.start = performance.now();
    duel.raf = requestAnimationFrame(duelLoop);
  }, POP_MS);
}

function duelReveal(text) {
  duel.state = 'hint';
  cancelAnimationFrame(duel.raf);
  duel.sides.forEach((sd, s) => {
    revealAnswers(sd.cells, sd.boardEl, duel.puzzle, duel.puzzle.answers);
    if (text) duelStatus(s, text);
  });
  duelLater(nextDuelMove, HINT_MS);
}

function duelLoop(now) {
  if (!duel || duel.state !== 'play') return;
  const frac = (duel.limit - (now - duel.start) / 1000) / duel.limit;
  const bar = $('#duel-bar i');
  bar.style.width = Math.max(0, frac) * 100 + '%';
  bar.style.background = frac > 0.5 ? 'var(--green)' : frac > 0.25 ? 'var(--orange)' : 'var(--red)';
  if (frac <= 0) {
    sfx.miss();
    return duelReveal('Zeit um!');
  }
  duel.raf = requestAnimationFrame(duelLoop);
}

function duelTap(s, i) {
  if (!duel || duel.state !== 'play') return;
  const sd = duel.sides[s];
  if (sd.locked || sd.root.classList.contains('sabotaged')) return;
  const ans = duel.puzzle.answers[0];
  if (i !== ans.cell) {
    // Falsch: für diesen Zug gesperrt
    sd.locked = true;
    shake(sd.cells[i]);
    sd.boardEl.classList.add('locked');
    duelStatus(s, '✖ Gesperrt');
    sfx.miss();
    if (duel.sides.every((x) => x.locked)) duelReveal();
    return;
  }
  duel.state = 'won';
  cancelAnimationFrame(duel.raf);
  const t = (performance.now() - duel.start) / 1000;
  sd.score++;
  const other = duel.sides[1 - s];
  markWin(sd.cells, duel.puzzle, ans);
  revealAnswers(other.cells, other.boardEl, duel.puzzle, [ans]);
  sfx.hit(1 + Math.floor(sd.score / 2));
  duelStatus(s, `✔ Punkt! ${t.toFixed(2)} s`);
  duelStatus(1 - s, `Spieler ${s + 1} war schneller`);
  if (t < BLITZ) {
    // Blitz-Treffer sabotiert den Gegner im nächsten Zug
    other.sabotaged = true;
    sfx.blitz();
    duelStatus(s, `⚡ Blitz! ${t.toFixed(2)} s – Sabotage!`);
  }
  renderDuel();
  if (sd.score >= DUEL.win) duelLater(() => finishDuel(s), 900);
  else duelLater(nextDuelMove, 1000);
}

function stopDuel() {
  if (!duel) return;
  duel.state = 'over';
  cancelAnimationFrame(duel.raf);
  duel.timers.forEach(clearTimeout);
}

function finishDuel(s) {
  stopDuel();
  const title = $('#res-title');
  title.textContent = `Spieler ${s + 1} gewinnt das Duell!`;
  title.style.color = PLAYER_COLORS[s];
  $('#res-time').textContent = `${duel.sides[0].score} : ${duel.sides[1].score}`;
  $('#res-sub').textContent = `${duel.move} Züge · ${DIFF_NAMES[game.diff]}`;
  nextAction = null;
  showResult('Revanche');
}

// ---------- Bereit-Bildschirm & Countdown ----------
function showReady() {
  const m = game.mode;
  const notes = [];
  if (m === 'classic') {
    const p = levelParams(game.level, game.diff);
    $('#ready-level').textContent = `Klassik · Level ${game.level} von ${LEVELS} · ${DIFF_NAMES[game.diff]}`;
    $('#ready-player').textContent = 'Bereit?';
    notes.push(`${ROUNDS} Züge`, `${p.colors} Farben`, `${p.moveTime} s pro Zug`);
  } else if (m === 'duel') {
    $('#ready-level').textContent = `Duell · ${DIFF_NAMES[game.diff]}`;
    $('#ready-player').textContent = 'Legt das iPhone flach zwischen euch';
    notes.push(`Wer zuerst ${DUEL.win} Punkte hat, gewinnt`, 'Falsch getippt = für den Zug gesperrt', `Treffer unter ${BLITZ} s sabotiert den Gegner`);
  } else {
    $('#ready-level').textContent = `${MODES[m].name} · ${DIFF_NAMES[game.diff]}`;
    $('#ready-player').textContent = 'Bereit?';
    notes.push(MODES[m].desc);
  }
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
    setTimeout(game.mode === 'duel' ? startDuel : startRun, 300);
  }, 650);
});

// ---------- Menü ----------
function bindSeg(id, key) {
  const seg = $(id);
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    settings[key] = key === 'mode' ? b.dataset.v : Number(b.dataset.v);
    storeSet('farbblitz.settings', settings);
    renderMenu();
  });
}

function renderMenu() {
  const m = MODES[settings.mode];
  $('#mode-desc').textContent = m.desc;
  const best = settings.mode === 'duel' ? null : storeGet(bestKey(settings.mode, settings.diff), null);
  const where = `${m.name}, ${DIFF_NAMES[settings.diff]}`;
  $('#best').textContent = !best ? ''
    : best.score != null ? `Highscore (${where}): ${best.score} Pkt`
    : `Rekord (${where}): Level ${best.level}/${LEVELS} · ${fmt(best.total)}`;
}

function restoreSettings() {
  // Alte Zeitjagd-Highscores (vor dem Aufräumen) übernehmen
  [0, 1, 2].forEach((d) => {
    const old = storeGet(`farbblitz.best.rush.cross.${d}`, null);
    if (old && !storeGet(bestKey('rush', d), null)) storeSet(bestKey('rush', d), old);
  });
  const saved = storeGet('farbblitz.settings', {});
  if (MODES[saved.mode]) settings.mode = saved.mode;
  if ([0, 1, 2].includes(saved.diff)) settings.diff = saved.diff;
  [['#seg-diff', 'diff'], ['#seg-mode', 'mode']].forEach(([id, key]) => {
    $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(b.dataset.v) === String(settings[key])));
  });
}

bindSeg('#seg-diff', 'diff');
bindSeg('#seg-mode', 'mode');
restoreSettings();
renderMenu();

$('#btn-start').addEventListener('click', () => { beep(0, 0.01, 'sine', 0.0001); newGame(); showReady(); });
$('#btn-howto').addEventListener('click', () => show('screen-howto'));
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => show('screen-menu')));
$('#btn-next').addEventListener('click', () => {
  if (nextAction) nextAction();
  else { newGame(); showReady(); }
});
$('#btn-menu').addEventListener('click', () => { renderMenu(); show('screen-menu'); });
document.querySelectorAll('[data-quit]').forEach((b) => b.addEventListener('click', () => {
  stopRun();
  stopDuel();
  renderMenu();
  show('screen-menu');
}));

// Doppeltipp-Zoom & Scrollen auf iOS unterbinden (außer im Menü und in der Anleitung)
document.addEventListener('touchmove', (e) => { if (!e.target.closest('.howto-scroll, #screen-menu')) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault());

// Offline-Unterstützung
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Beim Zurückkehren in die App nach Updates schauen
        document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update(); });
      })
      .catch(() => {});
  });
  // Neue Version übernommen → einmal neu laden (nicht mitten im Spiel)
  let reloaded = !navigator.serviceWorker.controller; // erster Besuch: nichts neu laden
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const playing = (run && run.state !== 'over') || (duel && duel.state !== 'over');
    if (reloaded || playing) return;
    reloaded = true;
    location.reload();
  });
}
