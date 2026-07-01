'use strict';

const VERSION = '1.0.0';

function clone(obj) { return structuredClone(obj); }

function emptyMyStats() {
  return { pts:0, fgm:0, fga:0, tpm:0, tpa:0, ftm:0, fta:0, oreb:0, dreb:0, stl:0, blk:0, ast:0, to:0, pf:0,
    onCourt:false, inClock:null, courtSecs:0 };
}

function periodLabel(period, numHalves) {
  return period <= numHalves ? 'H' + period : 'OT' + (period - numHalves);
}

const BONUS = 7, DOUBLE_BONUS = 10;
function bonusState(fouls) {
  if (fouls >= DOUBLE_BONUS) return 'double';
  if (fouls >= BONUS) return 'bonus';
  return 'none';
}

function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
function parseClock(str) {
  const m = /^(\d+):([0-5]?\d)$/.exec(String(str).trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function fmtShot(made, att) { return made + '/' + att; }

function newGame({ config, myTeam, oppTeam }) {
  return {
    screen: 'game',
    config: { ...config },
    myTeam: {
      id: myTeam.id,
      name: myTeam.name,
      players: myTeam.players.map((p) => ({ id:p.id, num:p.num, name:p.name, ...emptyMyStats() })),
    },
    oppTeam: {
      name: oppTeam.name,
      players: oppTeam.players.map((p) => ({ id:p.id, num:p.num, name:p.name, ...emptyMyStats() })),
    },
    period: 1,
    clock: { remainingSec: config.halfLengthMin * 60, running: false, startedAt: null },
    score: { my:0, opp:0 },
    possession: 'my',
    teamFouls: { my:0, opp:0 },
    timeouts: { my:0, opp:0 },
    periodScores: [],
    log: [],
    selectedPlayerId: null,
    _seq: 0,
  };
}

function clockRemaining(clock, nowMs) {
  if (clock.running && clock.startedAt != null) {
    const elapsed = Math.floor((nowMs - clock.startedAt) / 1000);
    return Math.max(0, clock.remainingSec - elapsed);
  }
  return clock.remainingSec;
}

function pushLog(game, entry, nowMs) {
  const g = clone(game);
  g._seq += 1;
  g.log.push({
    id: g._seq,
    period: g.period,
    clockText: fmtClock(clockRemaining(g.clock, nowMs)),
    team: entry.team ?? null,
    playerId: entry.playerId ?? null,
    type: entry.type,
    detail: entry.detail ?? '',
    rev: entry.rev ?? null,
  });
  return g;
}

function startClock(game, nowMs) {
  if (game.clock.running || game.clock.remainingSec <= 0) return game;
  const g = clone(game);
  g.clock.running = true;
  g.clock.startedAt = nowMs;
  return g;
}

function stopClock(game, nowMs) {
  if (!game.clock.running) return game;
  const g = clone(game);
  g.clock.remainingSec = clockRemaining(game.clock, nowMs);
  g.clock.running = false;
  g.clock.startedAt = null;
  return g;
}

function toggleClock(game, nowMs) {
  return game.clock.running ? stopClock(game, nowMs) : startClock(game, nowMs);
}

function adjustClock(game, deltaSec, nowMs) {
  const g = clone(game);
  const cur = clockRemaining(g.clock, nowMs);
  g.clock.remainingSec = Math.max(0, cur + deltaSec);
  if (g.clock.running) g.clock.startedAt = nowMs;  // rebase so it keeps counting from the new value
  return g;
}

const STAT_TYPES = ['2pt','3pt','ft','oreb','dreb','stl','blk','ast','to','foul'];
const SHOT_INFO = {
  '2pt': { made:'fgm', att:'fga', pts:2, label:'2PT' },
  '3pt': { made:'tpm', att:'tpa', pts:3, label:'3PT' },
  'ft':  { made:'ftm', att:'fta', pts:1, label:'FT' },
};
const PLAIN_LABEL = { oreb:'offensive rebound', dreb:'defensive rebound', stl:'steal', blk:'block', ast:'assist', to:'turnover', foul:'foul' };

function findPlayer(team, playerId) {
  return team.players.find((p) => p.id === playerId) ?? null;
}

function playerTag(p) {
  return p.name && !p.name.startsWith('#') ? `#${p.num} ${p.name}` : `#${p.num}`;
}

function recordStat(game, { team, playerId, stat, modifier, made = true }, nowMs) {
  if (!STAT_TYPES.includes(stat)) return game;

  let g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = findPlayer(t, playerId);
  if (!p) return game;

  const rev = { kind:'stat', team, playerId, fields:{}, score:0, teamFoul:0 };
  let type, detail;
  const mod = modifier ? ` (${modifier})` : '';

  if (SHOT_INFO[stat]) {
    const info = SHOT_INFO[stat];
    p[info.att] += 1; rev.fields[info.att] = 1;
    if (made) {
      p[info.made] += 1; rev.fields[info.made] = 1;
      p.pts += info.pts; g.score[team] += info.pts;
      rev.fields.pts = info.pts; rev.score = info.pts;
      type = stat + '_made';
      detail = `${playerTag(p)} ${info.label}${mod}`;
    } else {
      type = stat + '_miss';
      detail = `${playerTag(p)} missed ${info.label}${mod}`;
    }
  } else if (stat === 'foul') {
    p.pf += 1; rev.fields.pf = 1;
    g.teamFouls[team] += 1; rev.teamFoul = 1;
    type = 'foul';
    detail = `${playerTag(p)} foul${mod}`;
  } else {
    p[stat] += 1; rev.fields[stat] = 1;
    type = stat;
    detail = `${playerTag(p)} ${PLAIN_LABEL[stat]}${mod}`;
  }

  g = pushLog(g, { team, playerId, type, detail, rev }, nowMs);
  return g;
}

function subIn(game, team, playerId, nowMs) {
  const g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = findPlayer(t, playerId);
  if (!p || p.onCourt) return game;
  p.onCourt = true;
  p.inClock = clockRemaining(g.clock, nowMs);
  return pushLog(g, { team, playerId, type:'sub_in', detail:`${playerTag(p)} subs in` }, nowMs);
}

function subOut(game, team, playerId, nowMs) {
  const g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = findPlayer(t, playerId);
  if (!p || !p.onCourt) return game;
  p.courtSecs += p.inClock - clockRemaining(g.clock, nowMs);
  p.onCourt = false;
  p.inClock = null;
  return pushLog(g, { team, playerId, type:'sub_out', detail:`${playerTag(p)} subs out` }, nowMs);
}

function fmtMinutes(secs) { return ((secs || 0) / 60).toFixed(1); }
function playerEff(p) {
  const missFG = (p.fga + p.tpa) - (p.fgm + p.tpm);
  const missFT = p.fta - p.ftm;
  return p.pts + (p.oreb + p.dreb) + p.ast + p.stl + p.blk - missFG - missFT - p.to;
}

function teamDisplayName(game, team) {
  return team === 'my' ? game.myTeam.name : game.oppTeam.name;
}

function adjustScore(game, team, delta, nowMs) {
  let g = clone(game);
  const next = Math.max(0, g.score[team] + delta);
  const applied = next - g.score[team];
  if (applied === 0) return game;   // clamped no-op — don't log
  g.score[team] = next;
  const sign = applied >= 0 ? '+' + applied : String(applied);
  g = pushLog(g, {
    team, type: 'score_adj',
    detail: `${teamDisplayName(g, team)} score ${sign}`,
    rev: { kind: 'score', team, score: applied },
  }, nowMs);
  return g;
}

function adjustTeamFouls(game, team, delta, nowMs) {
  let g = clone(game);
  const next = Math.max(0, g.teamFouls[team] + delta);
  const applied = next - g.teamFouls[team];
  if (applied === 0) return game;   // clamped no-op — don't log
  g.teamFouls[team] = next;
  const sign = applied >= 0 ? '+' + applied : String(applied);
  g = pushLog(g, {
    team, type: 'team_foul_adj',
    detail: `${teamDisplayName(g, team)} team fouls ${sign}`,
    rev: { kind: 'teamfoul', team, delta: applied },
  }, nowMs);
  return g;
}

function adjustTimeouts(game, team, delta, nowMs) {
  let g = clone(game);
  const next = Math.max(0, g.timeouts[team] + delta);
  const applied = next - g.timeouts[team];
  if (applied === 0) return game;   // clamped no-op — don't log
  g.timeouts[team] = next;
  const sign = applied >= 0 ? '+' + applied : String(applied);
  g = pushLog(g, {
    team, type: 'timeout_adj',
    detail: `${teamDisplayName(g, team)} timeouts ${sign}`,
    rev: { kind: 'timeoutadj', team, delta: applied },
  }, nowMs);
  return g;
}

function togglePossession(game, nowMs) {
  let g = clone(game);
  const prev = g.possession;
  g.possession = prev === 'my' ? 'opp' : 'my';
  g = pushLog(g, {
    type: 'possession',
    detail: `Possession: ${teamDisplayName(g, g.possession)}`,
    rev: { kind: 'possession', prev },
  }, nowMs);
  return g;
}

function setPossession(game, team) {
  const g = clone(game);
  g.possession = team;
  return g;
}

function snapshotPeriod(game) {
  const g = clone(game);
  g.periodScores.push({ my: g.score.my, opp: g.score.opp });
  return g;
}

// Precondition: caller must stopClock first — reads the frozen clock.remainingSec.
function closeOnCourt(game) {
  const g = clone(game);
  const rem = g.clock.remainingSec;
  for (const t of [g.myTeam, g.oppTeam])
    for (const p of t.players)
      if (p.onCourt && p.inClock != null) p.courtSecs += p.inClock - rem;
  return g;
}

// Precondition: caller must reset the clock to the new period's full length first.
function reopenOnCourt(game) {
  const g = clone(game);
  const rem = g.clock.remainingSec;
  for (const t of [g.myTeam, g.oppTeam])
    for (const p of t.players)
      if (p.onCourt) p.inClock = rem;
  return g;
}

function endHalf(game, nowMs) {
  let g = stopClock(game, nowMs);
  g = closeOnCourt(g);
  g = snapshotPeriod(g);
  const label = periodLabel(g.period, g.config.numHalves);
  g.period += 1;
  g.clock = { remainingSec: g.config.halfLengthMin * 60, running:false, startedAt:null };
  g = reopenOnCourt(g);
  g.teamFouls = { my:0, opp:0 };
  g = pushLog(g, { type:'end_period', detail:`End of ${label}` }, nowMs);
  return g;
}

function addOvertime(game, nowMs) {
  let g = stopClock(game, nowMs);
  g = closeOnCourt(g);
  g = snapshotPeriod(g);
  const label = periodLabel(g.period, g.config.numHalves);
  g.period += 1;
  g.clock = { remainingSec: g.config.otLengthMin * 60, running:false, startedAt:null };
  g = reopenOnCourt(g);
  g.teamFouls = { my:0, opp:0 };
  g = setPossession(g, g.possession === 'my' ? 'opp' : 'my');
  g = pushLog(g, { type:'end_period', detail:`End of ${label} — overtime` }, nowMs);
  return g;
}

function endGame(game, nowMs) {
  let g = stopClock(game, nowMs);
  g = closeOnCourt(g);
  g = snapshotPeriod(g);
  g.screen = 'summary';
  g = pushLog(g, { type:'end_game', detail:'Final' }, nowMs);
  return g;
}

function undo(game) {
  if (game.log.length === 0) return game;
  const last = game.log[game.log.length - 1];
  const rev = last.rev;
  if (!rev) return game;

  const g = clone(game);
  g.log.pop();

  if (rev.kind === 'stat') {
    const t = rev.team === 'my' ? g.myTeam : g.oppTeam;
    const p = findPlayer(t, rev.playerId);
    if (p) for (const [field, n] of Object.entries(rev.fields)) p[field] -= n;
    g.score[rev.team] -= rev.score;
    g.teamFouls[rev.team] -= rev.teamFoul;
  } else if (rev.kind === 'score') {
    g.score[rev.team] -= rev.score;
  } else if (rev.kind === 'possession') {
    g.possession = rev.prev;
  } else if (rev.kind === 'timeoutadj') {
    g.timeouts[rev.team] -= rev.delta;
  } else if (rev.kind === 'teamfoul') {
    g.teamFouls[rev.team] -= rev.delta;
  }
  return g;
}

function addPlayerToGame(game, team, { id, num, name }) {
  const g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  t.players.push({ id, num, name, ...emptyMyStats() });
  return g;
}

function teamToSave(game) {
  return {
    id: game.myTeam.id,
    name: game.myTeam.name,
    players: game.myTeam.players.map((p) => ({ id:p.id, num:p.num, name:p.name })),
  };
}

function migrateGame(game) {
  if (!game) return game;
  const fix = (p) => {
    const np = { ...emptyMyStats(), ...p };
    if (typeof p.reb === 'number') np.dreb += p.reb;   // fold legacy single rebound into defensive
    delete np.reb;
    return np;
  };
  if (game.myTeam && game.myTeam.players) game.myTeam.players = game.myTeam.players.map(fix);
  if (game.oppTeam && game.oppTeam.players) game.oppTeam.players = game.oppTeam.players.map(fix);
  delete game.makeMode;
  return game;
}

function upsertHistory(history, game) {
  const arr = history.slice();
  const i = arr.findIndex((g) => g.id === game.id);
  if (i >= 0) arr[i] = game; else arr.push(game);
  return arr;
}

function removeFromHistory(history, id) {
  return history.filter((g) => g.id !== id);
}

function reopenGame(game) {
  const g = clone(game);
  g.screen = 'game';
  if (g.log.length && g.log[g.log.length - 1].type === 'end_game') g.log.pop();
  if (g.periodScores.length) g.periodScores.pop();
  return g;
}

function serialize(value) { return JSON.stringify(value); }
function deserialize(str) {
  try { return str == null ? null : JSON.parse(str); }
  catch { return null; }
}
function isResumable(game) { return !!game && game.screen === 'game'; }

// ===== EXPORT SHIM (test runner only; browser ignores) =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VERSION, clone, emptyMyStats, periodLabel, bonusState,
    fmtClock, parseClock, fmtShot, newGame,
    clockRemaining, startClock, stopClock, toggleClock, adjustClock,
    recordStat, STAT_TYPES,
    adjustScore, adjustTeamFouls, adjustTimeouts, togglePossession, setPossession,
    endHalf, addOvertime, endGame,
    undo,
    teamToSave, addPlayerToGame,
    serialize, deserialize, isResumable, migrateGame,
    upsertHistory, removeFromHistory, reopenGame,
    subIn, subOut, fmtMinutes, playerEff,
  };
}

// ===== SHELL =====
const KEYS = { teams: 'hoops.teams', game: 'hoops.game', theme: 'hoops.theme', history: 'hoops.history' };
let state = { teams: [], game: null, theme: 'dark', history: [] };
let homeView = 'setup';

function saveTeams() { localStorage.setItem(KEYS.teams, serialize(state.teams)); }
function saveGame() {
  if (state.game) localStorage.setItem(KEYS.game, serialize(state.game));
  else localStorage.removeItem(KEYS.game);
}
function saveHistory() { localStorage.setItem(KEYS.history, serialize(state.history)); }
function saveTheme() { localStorage.setItem(KEYS.theme, state.theme); }
function applyTheme() { document.documentElement.setAttribute('data-theme', state.theme); }
function loadAll() {
  state.teams = deserialize(localStorage.getItem(KEYS.teams)) || [];
  state.game = migrateGame(deserialize(localStorage.getItem(KEYS.game)));
  state.history = deserialize(localStorage.getItem(KEYS.history)) || [];
  const t = localStorage.getItem(KEYS.theme);
  state.theme = (t === 'light' || t === 'dark') ? t : 'dark';   // default dark
}

const ALL_SECTIONS = ['nav','setup','teams','history','game','summary'];
function showOnly(...visible) {
  for (const id of ALL_SECTIONS) document.getElementById(id).hidden = !visible.includes(id);
}

function renderNav() {
  const tabs = [['setup','New Game'],['teams','Teams'],['history','History']];
  document.getElementById('nav').innerHTML = tabs
    .map(([v,label]) => `<button class="navtab ${homeView===v?'active':''}" data-nav="${v}">${label}</button>`)
    .join('');
  el_each('[data-nav]', (b) => b.onclick = () => { homeView = b.dataset.nav; render(); });
}

function render() {
  stopTick(); // Clear any running interval before routing; renderGame() re-starts it.
  const g = state.game;
  if (g && g.screen === 'game') { showOnly('game'); renderGame(); return; }
  if (g && g.screen === 'summary') { showOnly('summary'); renderSummary(); return; }
  // Home (no active game): tab bar + active tab content.
  renderNav();
  if (homeView === 'teams') { showOnly('nav','teams'); renderTeams(); }
  else if (homeView === 'history') { showOnly('nav','history'); renderHistory(); }
  else { showOnly('nav','setup'); renderSetup(); }
}

// --- Teams editing state (null = list view; object = editing a team) ---
let teamEdit = null;
let addOpen = null;   // 'my' | 'opp' | null — which column's add-form is open
let missArm = false;   // when true, the next shot tap records a miss, then disarms
let flashKey = null;   // key of the grid button to flash blue on the next render, or null

// --- Setup screen state (draft, lives only while on setup) ---
let setupDraft = null;
function defaultDraft() {
  return {
    myTeamId: state.teams[0]?.id ?? null,
    newTeam: state.teams.length === 0,   // first run forces "new team"
    newTeamName: '',
    myPlayers: state.teams[0] ? clone(state.teams[0].players) : [],
    oppName: '',
    oppPlayers: [],
    halfLengthMin: 18, numHalves: 2, otLengthMin: 4,
    myTeamSide: 'home',
  };
}

function makeLocalId() {
  return 'id' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function renderSetup() {
  if (!setupDraft) setupDraft = defaultDraft();
  const d = setupDraft;
  const el = document.getElementById('setup');
  const resumable = isResumable(state.game);
  const banner = resumable ? `
    <div class="resume-banner">
      Resume ${esc(state.game.myTeam.name)} vs ${esc(state.game.oppTeam.name)} —
      ${periodLabel(state.game.period, state.game.config.numHalves)}
      ${fmtClock(clockRemaining(state.game.clock, Date.now()))}
      <div class="resume-actions">
        <button id="btn-resume">Resume</button>
        <button id="btn-discard" class="danger">Discard</button>
      </div>
    </div>` : '';

  el.innerHTML = `
    ${banner}
    <h1>HoopScore</h1>
    <section class="card">
      <h2>My Team</h2>
      ${state.teams.length ? `
        <label>Saved team
          <select id="my-team-select">
            <option value="__new">+ New team</option>
            ${state.teams.map((t) => `<option value="${t.id}" ${t.id===d.myTeamId&&!d.newTeam?'selected':''}>${esc(t.name)}</option>`).join('')}
          </select>
        </label>` : ''}
      ${d.newTeam ? `<label>Team name <input id="new-team-name" value="${esc(d.newTeamName)}" placeholder="e.g. Lakers"></label>` : ''}
      <div id="my-players">${renderRoster(d.myPlayers, 'my')}</div>
      <div class="add-player">
        <input id="my-add-num" type="number" inputmode="numeric" placeholder="#" class="num">
        <input id="my-add-name" placeholder="Name (optional)">
        <button id="my-add-btn">Add</button>
      </div>
    </section>

    <section class="card">
      <h2>Opponent</h2>
      <label>Opponent name <input id="opp-name" value="${esc(d.oppName)}" placeholder="e.g. Celtics"></label>
      <div id="opp-players">${renderRoster(d.oppPlayers, 'opp')}</div>
      <div class="add-player">
        <input id="opp-add-num" type="number" inputmode="numeric" placeholder="#" class="num">
        <input id="opp-add-name" placeholder="Name (optional)">
        <button id="opp-add-btn">Add</button>
      </div>
    </section>

    <details class="card">
      <summary>Settings</summary>
      <label>Half length (min) <input id="half-len" type="number" value="${d.halfLengthMin}"></label>
      <label>Number of halves <input id="num-halves" type="number" value="${d.numHalves}"></label>
      <label>OT length (min) <input id="ot-len" type="number" value="${d.otLengthMin}"></label>
    </details>

    <section class="card">
      <h2>My team is</h2>
      <div class="toggle">
        <button class="${d.myTeamSide==='home'?'active':''}" data-side="home">Home</button>
        <button class="${d.myTeamSide==='away'?'active':''}" data-side="away">Away</button>
      </div>
    </section>

    <section class="card">
      <h2>Theme</h2>
      <div class="toggle">
        <button class="${state.theme==='dark'?'active':''}" data-theme-set="dark">Dark</button>
        <button class="${state.theme==='light'?'active':''}" data-theme-set="light">Light</button>
      </div>
    </section>

    <section class="card">
      <h2>Who won the tip?</h2>
      <div class="tip-row">
        <button class="tip" data-tip="my">${esc(d.newTeam ? (d.newTeamName||'My Team') : (currentMyTeamName(d)||'My Team'))}</button>
        <button class="tip" data-tip="opp">${esc(d.oppName||'Opponent')}</button>
      </div>
      <button id="btn-start-home" class="startbtn">Start</button>
      <p id="setup-error" class="error"></p>
    </section>
  `;
  wireSetup();
}

function currentMyTeamName(d) {
  const t = state.teams.find((x) => x.id === d.myTeamId);
  return t ? t.name : '';
}

function renderRoster(players, which) {
  if (!players.length) return `<p class="muted">No players yet</p>`;
  return `<ul class="roster">` + players.map((p, i) =>
    `<li>#${p.num} ${esc(p.name || '')}<button data-rm="${which}:${i}" class="rm">×</button></li>`
  ).join('') + `</ul>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function initials(name) {
  return (name || '').trim().split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('');
}

function wireSetup() {
  const d = setupDraft;
  const $ = (id) => document.getElementById(id);

  $('btn-resume') && ($('btn-resume').onclick = resumeGame);
  $('btn-discard') && ($('btn-discard').onclick = discardGame);

  const sel = $('my-team-select');
  if (sel) sel.onchange = () => {
    if (sel.value === '__new') { d.newTeam = true; d.myTeamId = null; d.myPlayers = []; }
    else {
      d.newTeam = false; d.myTeamId = sel.value;
      d.myPlayers = clone(state.teams.find((t) => t.id === sel.value).players);
    }
    renderSetup();
  };
  $('new-team-name') && ($('new-team-name').oninput = (e) => { d.newTeamName = e.target.value; });
  $('opp-name') && ($('opp-name').oninput = (e) => { d.oppName = e.target.value; });

  $('my-add-btn').onclick = () => addPlayer('my', $('my-add-num'), $('my-add-name'));
  $('opp-add-btn').onclick = () => addPlayer('opp', $('opp-add-num'), $('opp-add-name'));
  $('my-add-num').onkeydown = (e) => { if (e.key === 'Enter') $('my-add-btn').click(); };
  $('opp-add-num').onkeydown = (e) => { if (e.key === 'Enter') $('opp-add-btn').click(); };

  for (const len of ['half-len','num-halves','ot-len']) {
    const map = { 'half-len':'halfLengthMin','num-halves':'numHalves','ot-len':'otLengthMin' };
    $(len) && ($(len).oninput = (e) => { d[map[len]] = parseInt(e.target.value,10) || d[map[len]]; });
  }

  el_each('[data-side]', (b) => b.onclick = () => { d.myTeamSide = b.dataset.side; renderSetup(); });
  el_each('[data-theme-set]', (b) => b.onclick = () => {
    state.theme = b.dataset.themeSet; saveTheme(); applyTheme(); renderSetup();
  });
  el_each('[data-rm]', (b) => b.onclick = () => {
    const [which, i] = b.dataset.rm.split(':');
    (which==='my'?d.myPlayers:d.oppPlayers).splice(parseInt(i,10),1);
    renderSetup();
  });
  el_each('[data-tip]', (b) => b.onclick = () => startGame(b.dataset.tip));
  // "Start" skips the tip: possession goes to whichever team is on the home side.
  const sb = document.getElementById('btn-start-home');
  if (sb) sb.onclick = () => startGame(d.myTeamSide === 'home' ? 'my' : 'opp', false);
}

function el_each(sel, fn) { document.querySelectorAll(sel).forEach(fn); }

function addPlayer(which, numEl, nameEl) {
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return;
  const list = which==='my' ? setupDraft.myPlayers : setupDraft.oppPlayers;
  list.push({ id: makeLocalId(), num, name: nameEl.value.trim() });
  renderSetup();
}

function renderTeams() {
  const el = document.getElementById('teams');
  if (teamEdit) { renderTeamEditor(el); return; }

  const rows = state.teams.length
    ? state.teams.map((t) => `
        <li class="listrow">
          <span class="listmain">${esc(t.name)} <span class="muted">(${t.players.length})</span></span>
          <button data-edit-team="${t.id}">Edit</button>
          <button data-del-team="${t.id}" class="danger">Delete</button>
        </li>`).join('')
    : `<p class="muted">No saved teams yet. Create one from New Game.</p>`;

  el.innerHTML = `<h1>Teams</h1><ul class="list">${rows}</ul>`;

  el_each('[data-edit-team]', (b) => b.onclick = () => {
    const t = state.teams.find((x) => x.id === b.dataset.editTeam);
    teamEdit = { id: t.id, name: t.name, players: clone(t.players) };
    renderTeams();
  });
  el_each('[data-del-team]', (b) => b.onclick = () => {
    const t = state.teams.find((x) => x.id === b.dataset.delTeam);
    if (!confirm(`Delete team "${t.name}"? This cannot be undone.`)) return;
    state.teams = state.teams.filter((x) => x.id !== b.dataset.delTeam);
    saveTeams();
    renderTeams();
  });
}

function renderTeamEditor(el) {
  const d = teamEdit;
  el.innerHTML = `
    <h1>Edit Team</h1>
    <section class="card">
      <label>Team name <input id="te-name" value="${esc(d.name)}"></label>
      <div id="te-players">${renderRoster(d.players, 'te')}</div>
      <div class="add-player">
        <input id="te-add-num" type="number" inputmode="numeric" placeholder="#" class="num">
        <input id="te-add-name" placeholder="Name (optional)">
        <button id="te-add-btn">Add</button>
      </div>
    </section>
    <div class="tip-row">
      <button id="te-save" class="tip">Save</button>
      <button id="te-cancel">Cancel</button>
    </div>
    <p id="te-error" class="error"></p>
  `;

  const $ = (id) => document.getElementById(id);
  $('te-name').oninput = (e) => { d.name = e.target.value; };
  const add = () => {
    const num = parseInt($('te-add-num').value, 10);
    if (isNaN(num)) return;
    d.players.push({ id: makeLocalId(), num, name: $('te-add-name').value.trim() });
    renderTeams();
  };
  $('te-add-btn').onclick = add;
  $('te-add-num').onkeydown = (e) => { if (e.key === 'Enter') add(); };
  el_each('[data-rm]', (b) => b.onclick = () => {
    const [, i] = b.dataset.rm.split(':');   // "te:i"
    d.players.splice(parseInt(i, 10), 1);
    renderTeams();
  });
  $('te-save').onclick = () => {
    if (!d.name.trim()) { $('te-error').textContent = 'Enter a team name.'; return; }
    const t = state.teams.find((x) => x.id === d.id);
    if (t) { t.name = d.name.trim(); t.players = clone(d.players); }
    saveTeams();
    teamEdit = null;
    renderTeams();
  };
  $('te-cancel').onclick = () => { teamEdit = null; renderTeams(); };
}
function renderHistory() {
  const el = document.getElementById('history');
  const games = state.history.slice().reverse();   // newest first
  const fmtDate = (ms) => ms ? new Date(ms).toLocaleDateString() : '';
  const rows = games.length
    ? games.map((g) => {
        const my = g.score?.my ?? 0, opp = g.score?.opp ?? 0;
        const wl = my > opp ? 'W' : my < opp ? 'L' : 'T';
        const myName = g.myTeam?.name ?? 'My Team', oppName = g.oppTeam?.name ?? 'Opp';
        return `
          <li class="listrow">
            <span class="listmain">${esc(myName)} vs ${esc(oppName)}
              <span class="muted">${fmtDate(g.date)} · ${my}–${opp} ${wl}</span></span>
            <button data-open-game="${g.id}">Open</button>
            <button data-del-game="${g.id}" class="danger">Delete</button>
          </li>`;
      }).join('')
    : `<p class="muted">No finished games yet.</p>`;

  el.innerHTML = `<h1>History</h1><ul class="list">${rows}</ul>`;

  el_each('[data-open-game]', (b) => b.onclick = () => openHistoryGame(b.dataset.openGame));
  el_each('[data-del-game]', (b) => b.onclick = () => {
    if (!confirm('Delete this game from history?')) return;
    state.history = removeFromHistory(state.history, b.dataset.delGame);
    saveHistory();
    renderHistory();
  });
}

function openHistoryGame(id) {
  const entry = state.history.find((g) => g.id === id);
  if (!entry) return;
  if (state.game && state.game.screen === 'game' && state.game.id !== id) {
    if (!confirm('Discard the current in-progress game and open this one?')) return;
  }
  state.game = reopenGame(entry);
  addOpen = null;
  missArm = false;
  saveGame();
  render();
}

function startGame(tipWinner, startClock = true) {
  const d = setupDraft;
  const err = document.getElementById('setup-error');
  const myName = d.newTeam ? d.newTeamName.trim() : currentMyTeamName(d);
  if (!myName) { err.textContent = 'Enter your team name.'; return; }
  if (!d.oppName.trim()) { err.textContent = 'Enter the opponent name.'; return; }

  // Persist a new team to saved teams (or update the selected one)
  let myTeamId = d.myTeamId;
  if (d.newTeam) {
    myTeamId = makeLocalId();
    state.teams.push({ id: myTeamId, name: myName, players: clone(d.myPlayers) });
  } else {
    const t = state.teams.find((x) => x.id === myTeamId);
    if (t) { t.name = myName; t.players = clone(d.myPlayers); }
  }
  saveTeams();

  let g = newGame({
    config: { halfLengthMin:d.halfLengthMin, numHalves:d.numHalves, otLengthMin:d.otLengthMin, myTeamSide:d.myTeamSide },
    myTeam: { id: myTeamId, name: myName, players: d.myPlayers },
    oppTeam: { name: d.oppName.trim(), players: d.oppPlayers },
  });
  g.id = makeLocalId();
  g.date = Date.now();
  g = setPossession(g, tipWinner);
  if (startClock) g = toggleClock(g, Date.now());   // tip-off starts the clock (Start button leaves it stopped)
  state.game = g;
  setupDraft = null;
  addOpen = null;
  missArm = false;
  saveGame();
  render();
}

function resumeGame() { render(); }   // state.game already screen:'game'
function discardGame() {
  if (!confirm('Discard the in-progress game? This cannot be undone.')) return;
  state.game = null;
  saveGame();
  setupDraft = defaultDraft();
  render();
}

function renderSummary() {
  stopTick();
  const g = state.game;
  const myLeft = g.config.myTeamSide === 'home';
  const leftTeam = myLeft ? 'my' : 'opp';
  const rightTeam = myLeft ? 'opp' : 'my';
  const deltas = g.periodScores.map((ps, i) => ({
    my: i===0 ? ps.my : ps.my - g.periodScores[i-1].my,
    opp: i===0 ? ps.opp : ps.opp - g.periodScores[i-1].opp,
  }));

  document.getElementById('summary').innerHTML = `
    <div class="sum-actions no-print">
      <button id="sum-print">Save PDF</button>
      <button id="sum-share" ${typeof navigator.share==='function'?'':'hidden'}>Share</button>
      <button id="sum-new">New Game</button>
    </div>
    <h1>Final</h1>
    <div class="final">
      <span>${esc(teamName(g,leftTeam))} ${g.score[leftTeam]}</span> –
      <span>${g.score[rightTeam]} ${esc(teamName(g,rightTeam))}</span>
    </div>

    <h2>Scoring by period</h2>
    <table class="bs"><thead><tr><th>Team</th>
      ${deltas.map((_,i)=>`<th>${periodLabel(i+1,g.config.numHalves)}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>
        <tr><td>${esc(teamName(g,leftTeam))}</td>${deltas.map((d)=>`<td>${d[leftTeam]}</td>`).join('')}<td>${g.score[leftTeam]}</td></tr>
        <tr><td>${esc(teamName(g,rightTeam))}</td>${deltas.map((d)=>`<td>${d[rightTeam]}</td>`).join('')}<td>${g.score[rightTeam]}</td></tr>
      </tbody></table>

    ${boxScore(leftTeam === 'my' ? g.myTeam : g.oppTeam)}
    ${boxScore(rightTeam === 'my' ? g.myTeam : g.oppTeam)}

    <h2>Game log</h2>
    <div class="log">${g.log.map((e)=>`<div>${e.clockText} ${periodLabel(e.period,g.config.numHalves)} — ${esc(e.detail)}</div>`).join('')}</div>
  `;
  document.getElementById('sum-print').onclick = () => window.print();
  const share = document.getElementById('sum-share');
  if (share && !share.hidden) share.onclick = () => navigator.share({
    title: `${g.myTeam.name} vs ${g.oppTeam.name}`,
    text: `${g.myTeam.name} ${g.score.my} – ${g.score.opp} ${g.oppTeam.name}`,
  }).catch(()=>{});
  document.getElementById('sum-new').onclick = newGameFromSummary;
}

function boxScore(team) {
  const cols = ['PTS','FG','3PT','FT','OREB','DREB','REB','STL','BLK','AST','TO','FLS','MIN','EFF'];
  const players = team.players.slice().sort((a,b)=>a.num-b.num);
  const rows = players.map((p)=>`
    <tr><td>#${p.num} ${esc(p.name||'')}</td>
      <td>${p.pts}</td><td>${fmtShot(p.fgm+p.tpm,p.fga+p.tpa)}</td><td>${fmtShot(p.tpm,p.tpa)}</td>
      <td>${fmtShot(p.ftm,p.fta)}</td><td>${p.oreb}</td><td>${p.dreb}</td><td>${p.oreb+p.dreb}</td>
      <td>${p.stl}</td><td>${p.blk}</td>
      <td>${p.ast}</td><td>${p.to}</td><td>${p.pf}</td><td>${fmtMinutes(p.courtSecs)}</td><td>${playerEff(p)}</td></tr>`).join('');
  const sum = (f) => players.reduce((n,p)=>n+f(p), 0);
  const t = {
    pts:sum(p=>p.pts), fgm:sum(p=>p.fgm), fga:sum(p=>p.fga), tpm:sum(p=>p.tpm), tpa:sum(p=>p.tpa),
    ftm:sum(p=>p.ftm), fta:sum(p=>p.fta), oreb:sum(p=>p.oreb), dreb:sum(p=>p.dreb),
    stl:sum(p=>p.stl), blk:sum(p=>p.blk), ast:sum(p=>p.ast), to:sum(p=>p.to), pf:sum(p=>p.pf),
    courtSecs:sum(p=>p.courtSecs||0), eff:sum(p=>playerEff(p)),
  };
  const total = `
    <tr class="totrow"><td>TOTAL</td>
      <td>${t.pts}</td><td>${fmtShot(t.fgm+t.tpm,t.fga+t.tpa)}</td><td>${fmtShot(t.tpm,t.tpa)}</td>
      <td>${fmtShot(t.ftm,t.fta)}</td><td>${t.oreb}</td><td>${t.dreb}</td><td>${t.oreb+t.dreb}</td>
      <td>${t.stl}</td><td>${t.blk}</td>
      <td>${t.ast}</td><td>${t.to}</td><td>${t.pf}</td><td>${fmtMinutes(t.courtSecs)}</td><td>${t.eff}</td></tr>`;
  return `<h2>${esc(team.name)}</h2><table class="bs"><thead><tr><th>Player</th>${cols.map((c)=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}${total}</tbody></table>`;
}

function newGameFromSummary() {
  state.game = null;
  saveGame();
  setupDraft = defaultDraft();
  homeView = 'setup';
  render();
}

const MODIFIERS = {
  '2pt': ['Layup','Dunk','Mid-range'],
  '3pt': ['Long distance'],
  'foul': ['Shooting','Technical','On the ground'],
};

function commit(producer) {            // producer: (game, nowMs) => game
  state.game = producer(state.game, Date.now());
  saveGame();
  render();
}

let tickHandle = null;
function startTick() {
  stopTick();
  tickHandle = setInterval(() => {
    const g = state.game;
    if (!g || g.screen !== 'game') return stopTick();
    if (g.clock.running) {
      const rem = clockRemaining(g.clock, Date.now());
      document.getElementById('clock-display').textContent = fmtClock(rem);
      if (rem <= 0) commit((game, now) => stopClock(game, now));  // auto-stop at 0:00
    }
  }, 250);
}
function stopTick() { if (tickHandle) { clearInterval(tickHandle); tickHandle = null; } }

function renderGame() {
  const g = state.game;
  const el = document.getElementById('game');
  const tf = g.teamFouls, bn = (team) => bonusState(tf[team]);
  const bonusBadge = (team) => bn(team)==='double' ? '<span class="badge dbl">BB</span>'
    : bn(team)==='bonus' ? '<span class="badge bon">B</span>' : '';

  // Physical left/right follows myTeamSide (display only)
  const myLeft = g.config.myTeamSide === 'home';
  const leftTeam = myLeft ? 'my' : 'opp';
  const rightTeam = myLeft ? 'opp' : 'my';

  el.innerHTML = `
    <header class="gh">
      <div class="score-box">
        <div class="tn">${esc(teamName(g,leftTeam))}</div>
        <div class="sc">${g.score[leftTeam]}</div>
        <div class="adj"><button data-adj="${leftTeam}:-1" ${g.score[leftTeam]===0?'disabled':''}>−</button><button data-adj="${leftTeam}:1">＋</button></div>
      </div>
      <div class="clock">
        <div class="clockrow">
          <button class="clkstep" data-clk="-1">−</button>
          <div id="clock-display" class="cd">${fmtClock(clockRemaining(g.clock, Date.now()))}</div>
          <button class="clkstep" data-clk="1">＋</button>
        </div>
        <div class="period">${periodLabel(g.period, g.config.numHalves)}</div>
        <div class="cbtns"><button id="clk-toggle" class="${g.clock.running?'stop':'start'}">${g.clock.running?'STOP':'START'}</button></div>
      </div>
      <div class="score-box">
        <div class="tn">${esc(teamName(g,rightTeam))}</div>
        <div class="sc">${g.score[rightTeam]}</div>
        <div class="adj"><button data-adj="${rightTeam}:-1" ${g.score[rightTeam]===0?'disabled':''}>−</button><button data-adj="${rightTeam}:1">＋</button></div>
      </div>
    </header>

    <div class="infobar">
      <span class="tf">Fouls: ${tf[leftTeam]}
        <button class="tfadj" data-tf="${leftTeam}:-1" ${g.teamFouls[leftTeam]===0?'disabled':''}>−</button><button class="tfadj" data-tf="${leftTeam}:1">＋</button> ${bonusBadge(leftTeam)}</span>
      <button id="poss">Pos: ${g.possession===leftTeam?'◀':'▶'}</button>
      <span class="tf">Fouls: ${tf[rightTeam]}
        <button class="tfadj" data-tf="${rightTeam}:-1" ${g.teamFouls[rightTeam]===0?'disabled':''}>−</button><button class="tfadj" data-tf="${rightTeam}:1">＋</button> ${bonusBadge(rightTeam)}</span>
    </div>
    <div class="infobar small">
      <span class="tf">TO: ${g.timeouts[leftTeam]}
        <button class="tfadj" data-to="${leftTeam}:-1" ${g.timeouts[leftTeam]===0?'disabled':''}>−</button><button class="tfadj" data-to="${leftTeam}:1">＋</button></span>
      <span class="period-ctl">${g.period < g.config.numHalves
        ? `<button id="btn-endhalf">END HALF</button>`
        : `<button id="btn-endgame">END GAME</button><button id="btn-ot">+OT</button>`}</span>
      <span class="tf">TO: ${g.timeouts[rightTeam]}
        <button class="tfadj" data-to="${rightTeam}:-1" ${g.timeouts[rightTeam]===0?'disabled':''}>−</button><button class="tfadj" data-to="${rightTeam}:1">＋</button></span>
    </div>

    <div class="court">
      <div class="col">${renderPlayers(g, leftTeam)}</div>
      <div class="controls">${renderControls(g)}</div>
      <div class="col">${renderPlayers(g, rightTeam)}</div>
    </div>
  `;
  wireGame();
  startTick();
}

function teamName(g, team) { return team==='my' ? g.myTeam.name : g.oppTeam.name; }

function renderPlayers(g, team) {
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const rows = t.players.map((p) => `
    <button class="pl ${g.selectedPlayerId===p.id?'sel':''}" data-pl="${team}:${p.id}">
      <span class="plhdr"><span class="pnum${p.onCourt?' oncourt':''}">#${p.num}</span> ${esc(initials(p.name))}</span>
      <span class="pp">${p.pts} pts · ${p.pf} f</span>
    </button>`).join('');
  const addUI = addOpen === team
    ? `<div class="addpl">
         <input class="num" type="number" inputmode="numeric" placeholder="#" data-addnum="${team}">
         <input placeholder="Name" data-addname="${team}">
         <button data-addgo="${team}">Add</button>
         <button data-addclose="${team}">Close</button>
       </div>`
    : `<button class="addbtn" data-addopen="${team}">+ Add</button>`;
  return rows + addUI;
}

function renderControls(g) {
  const recent = g.log.slice(-10).reverse()
    .map((e)=>`<div class="ev">${e.clockText} ${periodLabel(e.period,g.config.numHalves)} — ${esc(e.detail)}</div>`)
    .join('');
  const flashClass = (key) => {
    if (flashKey === key) { flashKey = null; return ' flash'; }
    return '';
  };
  return `
    <div class="grid">
      <button data-stat="2pt" class="${flashClass('2pt')}">2PT</button>
      <button data-stat="3pt" class="${flashClass('3pt')}">3PT</button>
      <button data-stat="ft" class="${flashClass('ft')}">FT</button>
      <button id="btn-miss" class="${missArm?'armed':''}${flashClass('btn-miss')}">MISS</button>
      ${['oreb','dreb','stl','blk','ast','to'].map((s)=>`<button data-stat="${s}" class="${flashClass(s)}">${s==='to'?'TOVR':s.toUpperCase()}</button>`).join('')}
      <button data-stat="foul" class="${flashClass('foul')}">FOUL</button>
      <button id="btn-undo" class="undo${flashClass('btn-undo')}">UNDO</button>
    </div>
    <div class="recent">${recent}</div>
  `;
}

function selectedTeam(g) {
  if (!g.selectedPlayerId) return null;
  if (g.myTeam.players.some((p)=>p.id===g.selectedPlayerId)) return 'my';
  if (g.oppTeam.players.some((p)=>p.id===g.selectedPlayerId)) return 'opp';
  return null;
}

function wireGame() {
  const g = state.game;
  const $ = (id) => document.getElementById(id);

  el_each('[data-pl]', (b) => attachPlayerPress(b));

  el_each('[data-addopen]', (b) => b.onclick = () => { addOpen = b.dataset.addopen; render(); });
  el_each('[data-addclose]', (b) => b.onclick = () => { addOpen = null; render(); });
  el_each('[data-addgo]', (b) => b.onclick = () => addGamePlayerFromForm(b.dataset.addgo));
  el_each('[data-addnum]', (b) => b.onkeydown = (e) => {
    if (e.key === 'Enter') document.querySelector(`[data-addgo="${b.dataset.addnum}"]`).click();
  });

  el_each('[data-adj]', (b) => b.onclick = () => {
    const [team, delta] = b.dataset.adj.split(':');
    commit((game, now) => adjustScore(game, team, parseInt(delta,10), now));
  });

  el_each('[data-tf]', (b) => b.onclick = () => {
    const [team, delta] = b.dataset.tf.split(':');
    commit((game, now) => adjustTeamFouls(game, team, parseInt(delta,10), now));
  });

  el_each('[data-to]', (b) => b.onclick = () => {
    const [team, delta] = b.dataset.to.split(':');
    commit((game, now) => adjustTimeouts(game, team, parseInt(delta,10), now));
  });

  // Stat buttons: quick tap = no modifier; long-press = modifier menu
  el_each('[data-stat]', (b) => {
    const stat = b.dataset.stat;
    attachPressHandlers(b, stat);
  });

  $('poss') && ($('poss').onclick = () => commit((game,now)=>togglePossession(game,now)));
  $('clk-toggle') && ($('clk-toggle').onclick = () => commit((game,now)=>toggleClock(game,now)));
  el_each('[data-clk]', (b) => attachClockPress(b));

  $('btn-miss') && ($('btn-miss').onclick = () => { flashKey = 'btn-miss'; missArm = !missArm; render(); });
  $('btn-undo') && ($('btn-undo').onclick = () => { flashKey = 'btn-undo'; commit((game)=>undo(game)); });
  $('btn-endhalf') && ($('btn-endhalf').onclick = () => commit((game,now)=>endHalf(game,now)));
  $('btn-endgame') && ($('btn-endgame').onclick = () => {
    commit((game,now)=>endGame(game,now));
    if (!state.game.id) state.game.id = makeLocalId();
    state.history = upsertHistory(state.history, clone(state.game));
    saveHistory();
  });
  $('btn-ot') && ($('btn-ot').onclick = () => commit((game,now)=>addOvertime(game,now)));
}

function addGamePlayerFromForm(team) {
  const numEl = document.querySelector(`[data-addnum="${team}"]`);
  const nameEl = document.querySelector(`[data-addname="${team}"]`);
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return;                       // blank/non-numeric jersey → no-op
  const player = { id: makeLocalId(), num, name: nameEl.value.trim() };
  commit((game) => addPlayerToGame(game, team, player));   // mutate → save → render
  if (team === 'my') {                          // persist to the saved team
    const t = state.teams.find((x) => x.id === state.game.myTeam.id);
    if (t) { t.players.push({ id: player.id, num: player.num, name: player.name }); saveTeams(); }
  }
}

function recordSelectedStat(stat, opts = {}) {
  const g = state.game;
  const team = selectedTeam(g);
  if (!team) return;
  commit((game, now) => recordStat(game, {
    team, playerId: g.selectedPlayerId, stat,
    modifier: opts.modifier ?? null,
    made: opts.made ?? true,
  }, now));
}

function attachPressHandlers(btn, stat) {
  const hasMenu = !!SHOT_INFO[stat] || stat === 'foul';   // shots: Miss(+mods); foul: mods
  let timer = null, longFired = false;
  const start = () => {
    longFired = false;
    if (!hasMenu) return;
    timer = setTimeout(() => { longFired = true; openStatMenu(btn, stat); }, 500);
  };
  const end = () => { if (timer) { clearTimeout(timer); timer = null; } };
  btn.addEventListener('touchstart', start, { passive:true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());   // suppress long-press browser menu
  btn.onclick = () => {
    if (longFired) { longFired = false; return; }
    const hasTeam = !!selectedTeam(state.game);
    if (SHOT_INFO[stat] && missArm && hasTeam) {
      missArm = false;
      flashKey = stat;
      recordSelectedStat(stat, { made:false });
    } else {
      if (hasTeam) flashKey = stat;
      recordSelectedStat(stat);
    }
  };
}

function closeMenu() {
  document.querySelectorAll('.popmenu, .popback').forEach((n) => n.remove());
}

function openPopover(anchorBtn, items) {
  closeMenu();
  if (!items.length) return;
  const back = document.createElement('div');
  back.className = 'popback';
  back.addEventListener('pointerdown', closeMenu);
  const menu = document.createElement('div');
  menu.className = 'popmenu';
  items.forEach((it) => {
    const b = document.createElement('button');
    b.textContent = it.label;
    b.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); it.act(); });
    menu.appendChild(b);
  });
  document.body.appendChild(back);
  document.body.appendChild(menu);
  const r = anchorBtn.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 8) + 'px';
}

function openStatMenu(anchorBtn, stat) {
  const isShot = !!SHOT_INFO[stat];
  const items = [];
  if (isShot) items.push({ label:'Miss', act:() => recordSelectedStat(stat, { made:false }) });
  (MODIFIERS[stat] || []).forEach((m) =>
    items.push({ label:m, act:() => recordSelectedStat(stat, { made:true, modifier:m }) }));
  openPopover(anchorBtn, items);
}

function attachPlayerPress(btn) {
  const [team, id] = btn.dataset.pl.split(':');
  let timer = null, longFired = false;
  const start = () => {
    longFired = false;
    timer = setTimeout(() => { longFired = true; openPlayerMenu(btn, team, id); }, 500);
  };
  const end = () => { if (timer) { clearTimeout(timer); timer = null; } };
  btn.addEventListener('touchstart', start, { passive:true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());   // suppress long-press browser menu
  btn.onclick = () => {
    if (longFired) { longFired = false; return; }
    state.game.selectedPlayerId = (state.game.selectedPlayerId === id) ? null : id;
    saveGame(); render();
  };
}

function openPlayerMenu(anchorBtn, team, id) {
  const t = team === 'my' ? state.game.myTeam : state.game.oppTeam;
  const p = t.players.find((x) => x.id === id);
  if (!p) return;
  const subItem = p.onCourt
    ? { label:'Sub Out', act:() => commit((game,now)=>subOut(game, team, id, now)) }
    : { label:'Sub In',  act:() => commit((game,now)=>subIn(game, team, id, now)) };
  openPopover(anchorBtn, [
    { label:'Activity', act:() => openActivityDialog(team, id) },
    subItem,
  ]);
}

function closeActivityDialog() {
  document.querySelectorAll('.dialog, .dlgback').forEach((n) => n.remove());
}

function openActivityDialog(team, id) {
  const g = state.game;
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = t.players.find((x) => x.id === id);
  if (!p) return;
  const events = g.log.filter((e) => e.playerId === id).reverse();   // newest first
  const rows = events.length
    ? events.map((e) => `<div class="ev">${e.clockText} ${periodLabel(e.period, g.config.numHalves)} — ${esc(e.detail)}</div>`).join('')
    : `<p class="muted">No activity yet</p>`;
  const back = document.createElement('div');
  back.className = 'dlgback';
  back.addEventListener('pointerdown', closeActivityDialog);
  const dlg = document.createElement('div');
  dlg.className = 'dialog';
  dlg.innerHTML = `<h3>#${p.num} ${esc(initials(p.name))}</h3><div class="dlgbody">${rows}</div><button class="dlgclose">Close</button>`;
  dlg.querySelector('.dlgclose').addEventListener('click', closeActivityDialog);
  document.body.appendChild(back);
  document.body.appendChild(dlg);
}

// Clock -/+ buttons: quick tap = ±1s, long-press (500ms) = ±10s, same direction.
function attachClockPress(btn) {
  const dir = parseInt(btn.dataset.clk, 10);   // -1 or +1
  let timer = null, longFired = false;
  const start = () => {
    longFired = false;
    timer = setTimeout(() => { longFired = true; commit((game,now)=>adjustClock(game, dir*10, now)); }, 500);
  };
  const end = () => { if (timer) { clearTimeout(timer); timer = null; } };
  btn.addEventListener('touchstart', start, { passive:true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());   // suppress long-press browser menu
  btn.onclick = () => { if (longFired) { longFired = false; return; } commit((game,now)=>adjustClock(game, dir, now)); };
}

function init() {
  loadAll();
  applyTheme();
  render();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.game && state.game.screen === 'game') render();
  });
}

// ===== BOOTSTRAP (browser only; Node ignores) =====
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}
