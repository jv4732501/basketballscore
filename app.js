'use strict';

const VERSION = '1.0.0';

function clone(obj) {
  return structuredClone(obj);
}

function emptyMyStats() {
  return {
    pts: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    stl: 0,
    blk: 0,
    ast: 0,
    to: 0,
    pf: 0,
    onCourt: false,
    inClock: null,
    courtSecs: 0,
  };
}

function periodLabel(period, numHalves) {
  return period <= numHalves ? 'H' + period : 'OT' + (period - numHalves);
}

const BONUS = 7,
  DOUBLE_BONUS = 10;
function bonusState(fouls) {
  if (fouls >= DOUBLE_BONUS) return 'double';
  if (fouls >= BONUS) return 'bonus';
  return 'none';
}

function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60),
    s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
function parseClock(str) {
  const m = /^(\d+):([0-5]?\d)$/.exec(String(str).trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function fmtShot(made, att) {
  return made + '/' + att;
}

function newGame({ config, myTeam, oppTeam }) {
  return {
    screen: 'game',
    config: { ...config },
    myTeam: {
      id: myTeam.id,
      name: myTeam.name,
      players: myTeam.players.map((p) => ({
        id: p.id,
        num: p.num,
        name: p.name,
        ...emptyMyStats(),
      })),
    },
    oppTeam: {
      ...(oppTeam.id !== undefined && { id: oppTeam.id }),
      name: oppTeam.name,
      players: oppTeam.players.map((p) => ({
        id: p.id,
        num: p.num,
        name: p.name,
        ...emptyMyStats(),
      })),
    },
    period: 1,
    clock: { remainingSec: config.halfLengthMin * 60, running: false, startedAt: null },
    score: { my: 0, opp: 0 },
    possession: 'my',
    teamFouls: { my: 0, opp: 0 },
    timeouts: { my: 0, opp: 0 },
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
  if (g.clock.running) g.clock.startedAt = nowMs; // rebase so it keeps counting from the new value
  return g;
}

const STAT_TYPES = ['2pt', '3pt', 'ft', 'oreb', 'dreb', 'stl', 'blk', 'ast', 'to', 'foul'];
const SHOT_INFO = {
  '2pt': { made: 'fgm', att: 'fga', pts: 2, label: '2PT' },
  '3pt': { made: 'tpm', att: 'tpa', pts: 3, label: '3PT' },
  ft: { made: 'ftm', att: 'fta', pts: 1, label: 'FT' },
};
const PLAIN_LABEL = {
  oreb: 'offensive rebound',
  dreb: 'defensive rebound',
  stl: 'steal',
  blk: 'block',
  ast: 'assist',
  to: 'turnover',
  foul: 'foul',
};

function findPlayer(team, playerId) {
  return team.players.find((p) => p.id === playerId) ?? null;
}

function playerTag(p) {
  return p.name && !p.name.startsWith('#') ? `#${p.num} ${p.name}` : `#${p.num}`;
}

function recordStat(game, { team, playerId, stat, modifier = undefined, made = true }, nowMs) {
  if (!STAT_TYPES.includes(stat)) return game;

  let g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = findPlayer(t, playerId);
  if (!p) return game;

  const rev = { kind: 'stat', team, playerId, fields: {}, score: 0, teamFoul: 0 };
  let type, detail;
  const mod = modifier ? ` (${modifier})` : '';

  if (SHOT_INFO[stat]) {
    const info = SHOT_INFO[stat];
    p[info.att] += 1;
    rev.fields[info.att] = 1;
    if (made) {
      p[info.made] += 1;
      rev.fields[info.made] = 1;
      p.pts += info.pts;
      g.score[team] += info.pts;
      rev.fields.pts = info.pts;
      rev.score = info.pts;
      type = stat + '_made';
      detail = `${playerTag(p)} ${info.label}${mod}`;
    } else {
      type = stat + '_miss';
      detail = `${playerTag(p)} missed ${info.label}${mod}`;
    }
  } else if (stat === 'foul') {
    p.pf += 1;
    rev.fields.pf = 1;
    g.teamFouls[team] += 1;
    rev.teamFoul = 1;
    type = 'foul';
    detail = `${playerTag(p)} foul${mod}`;
  } else {
    p[stat] += 1;
    rev.fields[stat] = 1;
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
  const rev = { kind: 'sub', team, playerId, onCourt: false, inClock: null, courtSecsDelta: 0 };
  return pushLog(
    g,
    { team, playerId, type: 'sub_in', detail: `${playerTag(p)} subs in`, rev },
    nowMs,
  );
}

function subOut(game, team, playerId, nowMs) {
  const g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = findPlayer(t, playerId);
  if (!p || !p.onCourt) return game;
  const delta = p.inClock - clockRemaining(g.clock, nowMs);
  const rev = {
    kind: 'sub',
    team,
    playerId,
    onCourt: true,
    inClock: p.inClock,
    courtSecsDelta: delta,
  };
  p.courtSecs += delta;
  p.onCourt = false;
  p.inClock = null;
  return pushLog(
    g,
    { team, playerId, type: 'sub_out', detail: `${playerTag(p)} subs out`, rev },
    nowMs,
  );
}

function fmtMinutes(secs) {
  return ((secs || 0) / 60).toFixed(1);
}
function playerEff(p) {
  const missFG = p.fga + p.tpa - (p.fgm + p.tpm);
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
  if (applied === 0) return game; // clamped no-op — don't log
  g.score[team] = next;
  const sign = applied >= 0 ? '+' + applied : String(applied);
  g = pushLog(
    g,
    {
      team,
      type: 'score_adj',
      detail: `${teamDisplayName(g, team)} score ${sign}`,
      rev: { kind: 'score', team, score: applied },
    },
    nowMs,
  );
  return g;
}

function adjustTeamFouls(game, team, delta, nowMs) {
  let g = clone(game);
  const next = Math.max(0, g.teamFouls[team] + delta);
  const applied = next - g.teamFouls[team];
  if (applied === 0) return game; // clamped no-op — don't log
  g.teamFouls[team] = next;
  const sign = applied >= 0 ? '+' + applied : String(applied);
  g = pushLog(
    g,
    {
      team,
      type: 'team_foul_adj',
      detail: `${teamDisplayName(g, team)} team fouls ${sign}`,
      rev: { kind: 'teamfoul', team, delta: applied },
    },
    nowMs,
  );
  return g;
}

function adjustTimeouts(game, team, delta, nowMs) {
  let g = clone(game);
  const next = Math.max(0, g.timeouts[team] + delta);
  const applied = next - g.timeouts[team];
  if (applied === 0) return game; // clamped no-op — don't log
  g.timeouts[team] = next;
  const sign = applied >= 0 ? '+' + applied : String(applied);
  g = pushLog(
    g,
    {
      team,
      type: 'timeout_adj',
      detail: `${teamDisplayName(g, team)} timeouts ${sign}`,
      rev: { kind: 'timeoutadj', team, delta: applied },
    },
    nowMs,
  );
  return g;
}

function togglePossession(game, nowMs) {
  let g = clone(game);
  const prev = g.possession;
  g.possession = prev === 'my' ? 'opp' : 'my';
  g = pushLog(
    g,
    {
      type: 'possession',
      detail: `Possession: ${teamDisplayName(g, g.possession)}`,
      rev: { kind: 'possession', prev },
    },
    nowMs,
  );
  return g;
}

function swapHomeAway(game, nowMs) {
  let g = clone(game);
  const prev = g.config.myTeamSide;
  g.config.myTeamSide = prev === 'home' ? 'away' : 'home';
  g = pushLog(
    g,
    { type: 'swap_sides', detail: 'Home/Away swapped', rev: { kind: 'swaphomeaway', prev } },
    nowMs,
  );
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
    for (const p of t.players) if (p.onCourt && p.inClock != null) p.courtSecs += p.inClock - rem;
  return g;
}

// Precondition: caller must reset the clock to the new period's full length first.
function reopenOnCourt(game) {
  const g = clone(game);
  const rem = g.clock.remainingSec;
  for (const t of [g.myTeam, g.oppTeam]) for (const p of t.players) if (p.onCourt) p.inClock = rem;
  return g;
}

function endHalf(game, nowMs) {
  let g = stopClock(game, nowMs);
  g = closeOnCourt(g);
  g = snapshotPeriod(g);
  const label = periodLabel(g.period, g.config.numHalves);
  g.period += 1;
  g.clock = { remainingSec: g.config.halfLengthMin * 60, running: false, startedAt: null };
  g = reopenOnCourt(g);
  g.teamFouls = { my: 0, opp: 0 };
  g = pushLog(g, { type: 'end_period', detail: `End of ${label}` }, nowMs);
  return g;
}

function addOvertime(game, nowMs) {
  let g = stopClock(game, nowMs);
  g = closeOnCourt(g);
  g = snapshotPeriod(g);
  const label = periodLabel(g.period, g.config.numHalves);
  g.period += 1;
  g.clock = { remainingSec: g.config.otLengthMin * 60, running: false, startedAt: null };
  g = reopenOnCourt(g);
  g.teamFouls = { my: 0, opp: 0 };
  g = setPossession(g, g.possession === 'my' ? 'opp' : 'my');
  g = pushLog(g, { type: 'end_period', detail: `End of ${label} — overtime` }, nowMs);
  return g;
}

function endGame(game, nowMs) {
  let g = stopClock(game, nowMs);
  g = closeOnCourt(g);
  g = snapshotPeriod(g);
  g.screen = 'summary';
  g = pushLog(g, { type: 'end_game', detail: 'Final' }, nowMs);
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
  } else if (rev.kind === 'sub') {
    const t = rev.team === 'my' ? g.myTeam : g.oppTeam;
    const p = findPlayer(t, rev.playerId);
    if (p) {
      p.onCourt = rev.onCourt;
      p.inClock = rev.inClock;
      p.courtSecs -= rev.courtSecsDelta;
    }
  } else if (rev.kind === 'swaphomeaway') {
    g.config.myTeamSide = rev.prev;
  }
  return g;
}

function addPlayerToGame(game, team, { id, num, name }) {
  const g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  t.players.push({ id, num, name, ...emptyMyStats() });
  return g;
}

function editPlayer(game, team, id, { num, name }) {
  const g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = t.players.find((x) => x.id === id);
  if (!p) return game;
  p.num = num;
  p.name = name;
  return g;
}

function teamToSave(game) {
  return {
    id: game.myTeam.id,
    name: game.myTeam.name,
    players: game.myTeam.players.map((p) => ({ id: p.id, num: p.num, name: p.name })),
  };
}

function migrateGame(game) {
  if (!game) return game;
  const fix = (p) => {
    const np = { ...emptyMyStats(), ...p };
    if (typeof p.reb === 'number') np.dreb += p.reb; // fold legacy single rebound into defensive
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
  if (i >= 0) arr[i] = game;
  else arr.push(game);
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

function serialize(value) {
  return JSON.stringify(value);
}
function deserialize(str) {
  try {
    return str == null ? null : JSON.parse(str);
  } catch {
    return null;
  }
}
function isResumable(game) {
  return !!game && game.screen === 'game';
}

function buildBackup(state, nowMs) {
  return {
    app: 'hoopscore',
    formatVersion: 1,
    exportedAt: new Date(nowMs).toISOString(),
    teams: clone(state.teams),
    history: clone(state.history),
    game: state.game ? clone(state.game) : null,
  };
}

function validateBackup(obj) {
  const notBackup = { ok: false, reason: 'Not a HoopScore backup file.' };
  if (!obj || typeof obj !== 'object' || obj.app !== 'hoopscore') return notBackup;
  if (typeof obj.formatVersion === 'number' && obj.formatVersion > 1)
    return { ok: false, reason: 'This backup was made by a newer version of HoopScore.' };
  const teams = obj.teams ?? [];
  const history = obj.history ?? [];
  if (!Array.isArray(teams) || !Array.isArray(history)) return notBackup;
  return {
    ok: true,
    backup: {
      teams: teams.filter((t) => t && typeof t === 'object'),
      history: history.filter((g) => g && typeof g === 'object').map((g) => migrateGame(g)),
      game: obj.game && typeof obj.game === 'object' ? migrateGame(obj.game) : null,
    },
  };
}

function mergeBackup(state, backup) {
  const teams = state.teams.slice();
  let teamsAdded = 0;
  let teamsUpdated = 0;
  for (const t of backup.teams) {
    const i = teams.findIndex((x) => x.id === t.id);
    if (i >= 0) {
      teams[i] = t;
      teamsUpdated += 1;
    } else {
      teams.push(t);
      teamsAdded += 1;
    }
  }
  let history = state.history;
  let gamesAdded = 0;
  let gamesUpdated = 0;
  for (const g of backup.history) {
    if (history.some((x) => x.id === g.id)) gamesUpdated += 1;
    else gamesAdded += 1;
    history = upsertHistory(history, g);
  }
  let game = state.game;
  let gameRestored = false;
  let gameSkipped = false;
  if (backup.game) {
    if (isResumable(state.game)) {
      gameSkipped = true;
    } else {
      game = backup.game;
      gameRestored = true;
    }
  }
  return {
    state: { teams, history, game },
    summary: { teamsAdded, teamsUpdated, gamesAdded, gamesUpdated, gameRestored, gameSkipped },
  };
}

// ===== EXPORT SHIM (test runner only; browser ignores) =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VERSION,
    clone,
    emptyMyStats,
    periodLabel,
    bonusState,
    fmtClock,
    parseClock,
    fmtShot,
    newGame,
    clockRemaining,
    startClock,
    stopClock,
    toggleClock,
    adjustClock,
    recordStat,
    STAT_TYPES,
    adjustScore,
    adjustTeamFouls,
    adjustTimeouts,
    togglePossession,
    swapHomeAway,
    setPossession,
    endHalf,
    addOvertime,
    endGame,
    undo,
    teamToSave,
    addPlayerToGame,
    editPlayer,
    serialize,
    deserialize,
    isResumable,
    buildBackup,
    validateBackup,
    mergeBackup,
    migrateGame,
    upsertHistory,
    removeFromHistory,
    reopenGame,
    subIn,
    subOut,
    fmtMinutes,
    playerEff,
    buildSummaryText,
  };
}

// ===== SHELL =====
const KEYS = {
  teams: 'hoops.teams',
  game: 'hoops.game',
  theme: 'hoops.theme',
  history: 'hoops.history',
};
let state = { teams: [], game: null, theme: 'dark', history: [] };
let homeView = 'setup';

function saveTeams() {
  localStorage.setItem(KEYS.teams, serialize(state.teams));
}
function saveGame() {
  if (state.game) localStorage.setItem(KEYS.game, serialize(state.game));
  else localStorage.removeItem(KEYS.game);
}
function saveHistory() {
  localStorage.setItem(KEYS.history, serialize(state.history));
}
function saveTheme() {
  localStorage.setItem(KEYS.theme, state.theme);
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}
function loadAll() {
  state.teams = deserialize(localStorage.getItem(KEYS.teams)) || [];
  state.game = migrateGame(deserialize(localStorage.getItem(KEYS.game)));
  state.history = deserialize(localStorage.getItem(KEYS.history)) || [];
  const t = localStorage.getItem(KEYS.theme);
  state.theme = t === 'light' || t === 'dark' ? t : 'dark'; // default dark
}

const ALL_SECTIONS = ['nav', 'setup', 'teams', 'history', 'game', 'summary'];
function showOnly(...visible) {
  for (const id of ALL_SECTIONS) document.getElementById(id).hidden = !visible.includes(id);
  document.documentElement.classList.toggle('screen-game', visible.includes('game'));
}

function renderNav() {
  const tabs = [
    ['setup', 'New Game'],
    ['teams', 'Teams'],
    ['history', 'History'],
  ];
  document.getElementById('nav').innerHTML =
    tabs
      .map(
        ([v, label]) =>
          `<button class="navtab ${homeView === v ? 'active' : ''}" data-nav="${v}">${label}</button>`,
      )
      .join('') + `<button class="navhelp" id="btn-help" title="Help">?</button>`;
  el_each(
    '[data-nav]',
    (b) =>
      (b.onclick = () => {
        homeView = b.dataset.nav;
        render();
      }),
  );
  document.getElementById('btn-help').onclick = openHelpDialog;
}

function render() {
  stopTick(); // Clear any running interval before routing; renderGame() re-starts it.
  const g = state.game;
  if (g && g.screen === 'game') {
    showOnly('game');
    renderGame();
    return;
  }
  if (g && g.screen === 'summary') {
    showOnly('summary');
    renderSummary();
    return;
  }
  // Home (no active game): tab bar + active tab content.
  renderNav();
  if (homeView === 'teams') {
    showOnly('nav', 'teams');
    renderTeams();
  } else if (homeView === 'history') {
    showOnly('nav', 'history');
    renderHistory();
  } else {
    showOnly('nav', 'setup');
    renderSetup();
  }
}

// --- Teams editing state (null = list view; object = editing a team) ---
let teamEdit = null;
let addOpen = null; // 'my' | 'opp' | null — which column's add-form is open
let collapsedTeam = null; // 'my' | 'opp' | null — which player column is collapsed
let missArm = false; // when true, the next shot tap records a miss, then disarms
let missLock = false; // when true, MISS stays armed across shots until double-clicked off
let flashKey = null; // key of the grid button to flash blue on the next render, or null
let lastPlayerClick = null; // { id, at } | null — double-click-to-edit detection for player buttons

// --- Setup screen state (draft, lives only while on setup) ---
let setupDraft = null;
function defaultDraft() {
  const defaultOppTeam = state.teams[1] ?? state.teams[0];
  return {
    myTeamId: state.teams[0]?.id ?? null,
    activePlayerIds: state.teams[0] ? state.teams[0].players.map((p) => p.id) : [],
    oppTeamId: defaultOppTeam?.id ?? null,
    activeOppPlayerIds: defaultOppTeam ? defaultOppTeam.players.map((p) => p.id) : [],
    halfLengthMin: 18,
    numHalves: 2,
    otLengthMin: 4,
    myTeamSide: 'home',
  };
}

function makeLocalId() {
  return 'id' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function renderSetup() {
  if (!setupDraft) setupDraft = defaultDraft();
  const d = setupDraft;
  if (!state.teams.some((t) => t.id === d.myTeamId)) {
    d.myTeamId = state.teams[0]?.id ?? null;
    d.activePlayerIds = state.teams[0] ? state.teams[0].players.map((p) => p.id) : [];
  }
  if (!state.teams.some((t) => t.id === d.oppTeamId)) {
    const fallback = state.teams[1] ?? state.teams[0];
    d.oppTeamId = fallback?.id ?? null;
    d.activeOppPlayerIds = fallback ? fallback.players.map((p) => p.id) : [];
  }
  const el = document.getElementById('setup');
  const resumable = isResumable(state.game);
  const banner = resumable
    ? `
    <div class="resume-banner">
      Resume ${esc(state.game.myTeam.name)} vs ${esc(state.game.oppTeam.name)} —
      ${periodLabel(state.game.period, state.game.config.numHalves)}
      ${fmtClock(clockRemaining(state.game.clock, Date.now()))}
      <div class="resume-actions">
        <button id="btn-resume">Resume</button>
        <button id="btn-discard" class="danger">Discard</button>
      </div>
    </div>`
    : '';

  el.innerHTML = `
    ${banner}
    <section class="card">
      ${
        state.teams.length
          ? `
        <div class="my-team-row">
          <h2>Team 1</h2>
          <select id="my-team-select">
            ${state.teams.map((t) => `<option value="${t.id}" ${t.id === d.myTeamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
        </div>
        <ul class="roster">${renderActiveRosterFor(d.myTeamId, d.activePlayerIds, 'my')}</ul>`
          : `<h2>Team 1</h2><p class="muted">Create a team on team tab.</p>`
      }
    </section>

    <section class="card">
      ${
        state.teams.length
          ? `
        <div class="my-team-row">
          <h2>Team 2</h2>
          <select id="opp-team-select">
            ${state.teams.map((t) => `<option value="${t.id}" ${t.id === d.oppTeamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
        </div>
        <ul class="roster">${renderActiveRosterFor(d.oppTeamId, d.activeOppPlayerIds, 'opp')}</ul>`
          : `<h2>Team 2</h2><p class="muted">Create a team on team tab.</p>`
      }
    </section>

    <details class="card">
      <summary>Settings</summary>
      <label>Period length (min) <input id="half-len" type="number" value="${d.halfLengthMin}"></label>
      <label>Number of periods <input id="num-halves" type="number" value="${d.numHalves}"></label>
      <label>OT length (min) <input id="ot-len" type="number" value="${d.otLengthMin}"></label>
    </details>

    <section class="card">
      <h2>Team 1 is</h2>
      <div class="toggle">
        <button class="${d.myTeamSide === 'home' ? 'active' : ''}" data-side="home">Home</button>
        <button class="${d.myTeamSide === 'away' ? 'active' : ''}" data-side="away">Away</button>
      </div>
    </section>

    <section class="card start-card">
      <button id="btn-start-home" class="startbtn">Start</button>
      <p id="setup-error" class="error"></p>
    </section>

    <section class="card">
      <h2>Backup</h2>
      <div class="backup-actions">
        <button id="btn-export">Export data</button>
        <button id="btn-import">Import data</button>
      </div>
    </section>
  `;
  wireSetup();
}

function currentMyTeamName(d) {
  const t = state.teams.find((x) => x.id === d.myTeamId);
  return t ? t.name : '';
}

function renderActiveRosterFor(teamId, activeIds, which) {
  const t = state.teams.find((x) => x.id === teamId);
  if (!t || !t.players.length) return `<p class="muted">No players on this team yet.</p>`;
  return t.players
    .map(
      (p) => `
    <li>
      <label><input type="checkbox" data-active-${which}="${p.id}" ${activeIds.includes(p.id) ? 'checked' : ''}><span>#${p.num} ${esc(p.name || '')}</span></label>
    </li>`,
    )
    .join('');
}

function renderRoster(players) {
  if (!players.length) return `<p class="muted">Add players</p>`;
  return (
    `<ul class="list">` +
    players
      .map(
        (p, i) => `
        <li class="listrow">
          <span class="listmain">#${p.num} ${esc(p.name || '')}</span>
          <button data-editbtn="te:${i}">Edit</button>
          <button data-rm="te:${i}" class="danger">Delete</button>
        </li>`,
      )
      .join('') +
    `</ul>`
  );
}

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

function initials(name) {
  return (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function importMessage(s) {
  const teams = s.teamsAdded + s.teamsUpdated;
  const games = s.gamesAdded + s.gamesUpdated;
  let msg = `Imported ${teams} team${teams === 1 ? '' : 's'} (${s.teamsUpdated} updated) and ${games} game${games === 1 ? '' : 's'} (${s.gamesUpdated} updated).`;
  if (s.gameRestored) msg += ' In-progress game restored.';
  if (s.gameSkipped)
    msg += " Skipped the backup's in-progress game (a game is already in progress here).";
  return msg;
}

function wireSetup() {
  const d = setupDraft;
  const $ = (id) => document.getElementById(id);

  $('btn-resume') && ($('btn-resume').onclick = resumeGame);
  $('btn-discard') && ($('btn-discard').onclick = discardGame);

  $('btn-export') &&
    ($('btn-export').onclick = () => {
      const json = serialize(buildBackup(state, Date.now()));
      const filename = `hoopscore-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const download = () => {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
      const file = new File([json], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch((e) => {
          if (e.name !== 'AbortError') download();
        });
      } else {
        download();
      }
    });

  $('btn-import') &&
    ($('btn-import').onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = () => {
        const f = input.files && input.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          const result = validateBackup(deserialize(reader.result));
          if (!result.ok) {
            alert(result.reason);
            return;
          }
          const { state: merged, summary } = mergeBackup(state, result.backup);
          state.teams = merged.teams;
          state.history = merged.history;
          state.game = merged.game;
          saveTeams();
          saveHistory();
          saveGame();
          alert(importMessage(summary));
          render();
        };
        reader.onerror = () => alert('Could not read the file.');
        reader.readAsText(f);
      };
      input.click();
    });

  const sel = $('my-team-select');
  if (sel)
    sel.onchange = () => {
      d.myTeamId = sel.value;
      const t = state.teams.find((x) => x.id === sel.value);
      d.activePlayerIds = t ? t.players.map((p) => p.id) : [];
      renderSetup();
    };
  el_each(
    '[data-active-my]',
    (cb) =>
      (cb.onchange = () => {
        const id = cb.dataset.activeMy;
        if (cb.checked) {
          if (!d.activePlayerIds.includes(id)) d.activePlayerIds.push(id);
        } else {
          d.activePlayerIds = d.activePlayerIds.filter((x) => x !== id);
        }
      }),
  );
  el_each(
    '[data-active-opp]',
    (cb) =>
      (cb.onchange = () => {
        const id = cb.dataset.activeOpp;
        if (cb.checked) {
          if (!d.activeOppPlayerIds.includes(id)) d.activeOppPlayerIds.push(id);
        } else {
          d.activeOppPlayerIds = d.activeOppPlayerIds.filter((x) => x !== id);
        }
      }),
  );
  const oppSel = $('opp-team-select');
  if (oppSel)
    oppSel.onchange = () => {
      d.oppTeamId = oppSel.value;
      const t = state.teams.find((x) => x.id === oppSel.value);
      d.activeOppPlayerIds = t ? t.players.map((p) => p.id) : [];
      renderSetup();
    };

  for (const len of ['half-len', 'num-halves', 'ot-len']) {
    const map = { 'half-len': 'halfLengthMin', 'num-halves': 'numHalves', 'ot-len': 'otLengthMin' };
    $(len) &&
      ($(len).oninput = (e) => {
        d[map[len]] = parseInt(e.target.value, 10) || d[map[len]];
      });
  }

  el_each(
    '[data-side]',
    (b) =>
      (b.onclick = () => {
        d.myTeamSide = b.dataset.side;
        renderSetup();
      }),
  );
  el_each(
    '[data-theme-set]',
    (b) =>
      (b.onclick = () => {
        state.theme = b.dataset.themeSet;
        saveTheme();
        applyTheme();
        renderSetup();
      }),
  );
  // Home team gets initial possession; clock stays stopped until manually started.
  const sb = document.getElementById('btn-start-home');
  if (sb) sb.onclick = () => startGame(d.myTeamSide === 'home' ? 'my' : 'opp', false);
}

function el_each(sel, fn) {
  document.querySelectorAll(sel).forEach(fn);
}

function renderTeams() {
  const el = document.getElementById('teams');
  if (teamEdit) {
    renderTeamEditor(el);
    return;
  }

  const rows = state.teams.length
    ? state.teams
        .map(
          (t) => `
        <li class="listrow">
          <span class="listmain">${esc(t.name)} <span class="muted">(${t.players.length})</span></span>
          <button data-edit-team="${t.id}">Edit</button>
          <button data-del-team="${t.id}" class="danger">Delete</button>
        </li>`,
        )
        .join('')
    : `<p class="muted">No saved teams yet.</p>`;

  el.innerHTML = `<h1>Teams</h1><button id="btn-add-team">+ Add Team</button><ul class="list">${rows}</ul>`;

  document.getElementById('btn-add-team').onclick = () => {
    teamEdit = { id: makeLocalId(), name: '', players: [] };
    renderTeams();
  };

  el_each(
    '[data-edit-team]',
    (b) =>
      (b.onclick = () => {
        const t = state.teams.find((x) => x.id === b.dataset.editTeam);
        teamEdit = { id: t.id, name: t.name, players: clone(t.players) };
        renderTeams();
      }),
  );
  el_each(
    '[data-del-team]',
    (b) =>
      (b.onclick = () => {
        const t = state.teams.find((x) => x.id === b.dataset.delTeam);
        if (!confirm(`Delete team "${t.name}"? This cannot be undone.`)) return;
        state.teams = state.teams.filter((x) => x.id !== b.dataset.delTeam);
        saveTeams();
        renderTeams();
      }),
  );
}

function renderTeamEditor(el) {
  const d = teamEdit;
  el.innerHTML = `
    <h1>Edit Team</h1>
    <section class="card">
      <label>Team name <input id="te-name" value="${esc(d.name)}"></label>
      <div id="te-players">${renderRoster(d.players)}</div>
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
  $('te-name').oninput = (e) => {
    d.name = e.target.value;
  };
  const add = () => {
    const num = parseInt($('te-add-num').value, 10);
    if (isNaN(num)) return;
    d.players.push({ id: makeLocalId(), num, name: $('te-add-name').value.trim() });
    renderTeams();
    document.getElementById('te-add-num').focus();
  };
  $('te-add-btn').onclick = add;
  $('te-add-num').onkeydown = (e) => {
    if (e.key === 'Enter') add();
  };
  el_each(
    '[data-rm]',
    (b) =>
      (b.onclick = () => {
        const [, i] = b.dataset.rm.split(':'); // "te:i"
        const p = d.players[parseInt(i, 10)];
        if (!confirm(`Remove #${p.num}${p.name ? ' ' + p.name : ''} from the roster?`)) return;
        d.players.splice(parseInt(i, 10), 1);
        renderTeams();
      }),
  );
  el_each(
    '[data-editbtn]',
    (b) =>
      (b.onclick = () => {
        const [, i] = b.dataset.editbtn.split(':'); // "te:i"
        openRosterEditDialog(parseInt(i, 10));
      }),
  );
  $('te-save').onclick = () => {
    if (!d.name.trim()) {
      $('te-error').textContent = 'Enter a team name.';
      return;
    }
    const t = state.teams.find((x) => x.id === d.id);
    if (t) {
      t.name = d.name.trim();
      t.players = clone(d.players);
    } else {
      state.teams.push({ id: d.id, name: d.name.trim(), players: clone(d.players) });
    }
    saveTeams();
    teamEdit = null;
    renderTeams();
  };
  $('te-cancel').onclick = () => {
    teamEdit = null;
    renderTeams();
  };
}
function renderHistory() {
  const el = document.getElementById('history');
  const games = state.history.slice().reverse(); // newest first
  const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString() : '');
  const rows = games.length
    ? games
        .map((g) => {
          const my = g.score?.my ?? 0,
            opp = g.score?.opp ?? 0;
          const wl = my > opp ? 'W' : my < opp ? 'L' : 'T';
          const myName = g.myTeam?.name ?? 'My Team',
            oppName = g.oppTeam?.name ?? 'Opp';
          return `
          <li class="listrow">
            <span class="listmain">${esc(myName)} vs ${esc(oppName)}
              <span class="muted">${fmtDate(g.date)} · ${my}–${opp} ${wl}</span></span>
            <button data-open-game="${g.id}">Open</button>
            <button data-del-game="${g.id}" class="danger">Delete</button>
          </li>`;
        })
        .join('')
    : `<p class="muted">No finished games yet.</p>`;

  el.innerHTML = `<h1>History</h1><ul class="list">${rows}</ul>`;

  el_each('[data-open-game]', (b) => (b.onclick = () => openHistoryGame(b.dataset.openGame)));
  el_each(
    '[data-del-game]',
    (b) =>
      (b.onclick = () => {
        if (!confirm('Delete this game from history?')) return;
        state.history = removeFromHistory(state.history, b.dataset.delGame);
        saveHistory();
        renderHistory();
      }),
  );
}

function openHistoryGame(id) {
  const entry = state.history.find((g) => g.id === id);
  if (!entry) return;
  if (state.game && state.game.screen === 'game' && state.game.id !== id) {
    if (!confirm('Discard the current in-progress game and open this one?')) return;
  }
  state.game = reopenGame(entry);
  addOpen = null;
  collapsedTeam = null;
  lastPlayerClick = null;
  missArm = false;
  missLock = false;
  saveGame();
  render();
}

function startGame(tipWinner, startClock = true) {
  const d = setupDraft;
  const err = document.getElementById('setup-error');
  const myTeam = state.teams.find((t) => t.id === d.myTeamId);
  if (!myTeam) {
    err.textContent = 'Select a team from the Teams tab first.';
    return;
  }
  const activePlayers = myTeam.players.filter((p) => d.activePlayerIds.includes(p.id));

  const oppTeam = state.teams.find((t) => t.id === d.oppTeamId);
  if (!oppTeam) {
    err.textContent = 'Select a second team from the Teams tab first.';
    return;
  }
  if (oppTeam.id === myTeam.id) {
    err.textContent = 'Team 1 and Team 2 must be different.';
    return;
  }
  const activeOppPlayers = oppTeam.players.filter((p) => d.activeOppPlayerIds.includes(p.id));

  let g = newGame({
    config: {
      halfLengthMin: d.halfLengthMin,
      numHalves: d.numHalves,
      otLengthMin: d.otLengthMin,
      myTeamSide: d.myTeamSide,
    },
    myTeam: { id: myTeam.id, name: myTeam.name, players: activePlayers },
    oppTeam: { id: oppTeam.id, name: oppTeam.name, players: activeOppPlayers },
  });
  g.id = makeLocalId();
  g.date = Date.now();
  g = setPossession(g, tipWinner);
  if (startClock) g = toggleClock(g, Date.now()); // tip-off starts the clock (Start button leaves it stopped)
  state.game = g;
  setupDraft = null;
  addOpen = null;
  collapsedTeam = null;
  lastPlayerClick = null;
  missArm = false;
  missLock = false;
  saveGame();
  render();
}

function resumeGame() {
  render();
} // state.game already screen:'game'
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
    my: i === 0 ? ps.my : ps.my - g.periodScores[i - 1].my,
    opp: i === 0 ? ps.opp : ps.opp - g.periodScores[i - 1].opp,
  }));

  document.getElementById('summary').innerHTML = `
    <div class="sum-actions no-print">
      <button id="sum-print">Print</button>
      <button id="sum-share" ${typeof navigator.share === 'function' ? '' : 'hidden'}>Share</button>
      <button id="sum-new">New Game</button>
    </div>
    <h1>Final</h1>
    <div class="final">
      <span>${esc(teamName(g, leftTeam))} ${g.score[leftTeam]}</span> –
      <span>${g.score[rightTeam]} ${esc(teamName(g, rightTeam))}</span>
    </div>

    <h2>Scoring by period</h2>
    <table class="bs"><thead><tr><th>Team</th>
      ${deltas.map((_, i) => `<th>${periodLabel(i + 1, g.config.numHalves)}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>
        <tr><td>${esc(teamName(g, leftTeam))}</td>${deltas.map((d) => `<td>${d[leftTeam]}</td>`).join('')}<td>${g.score[leftTeam]}</td></tr>
        <tr><td>${esc(teamName(g, rightTeam))}</td>${deltas.map((d) => `<td>${d[rightTeam]}</td>`).join('')}<td>${g.score[rightTeam]}</td></tr>
      </tbody></table>

    ${boxScore(leftTeam === 'my' ? g.myTeam : g.oppTeam)}
    ${boxScore(rightTeam === 'my' ? g.myTeam : g.oppTeam)}

    <h2>Game log</h2>
    <div class="log">${g.log.map((e) => `<div>${e.clockText} ${periodLabel(e.period, g.config.numHalves)} — ${esc(e.detail)}</div>`).join('')}</div>
  `;
  document.getElementById('sum-print').onclick = () => window.print();
  const share = document.getElementById('sum-share');
  if (share && !share.hidden)
    share.onclick = () => {
      const text = buildSummaryText(g, leftTeam, rightTeam, deltas);
      const title = `${g.myTeam.name} vs ${g.oppTeam.name}`;
      const filename =
        `${g.myTeam.name}-vs-${g.oppTeam.name}`.replace(/[^a-z0-9-]+/gi, '-') + '.txt';
      const file = new File([text], filename, { type: 'text/plain' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(() => {});
      } else {
        navigator.share({ title, text }).catch(() => {});
      }
    };
  document.getElementById('sum-new').onclick = newGameFromSummary;
}

function boxScore(team) {
  const cols = [
    'PTS',
    'FG',
    '3PT',
    'FT',
    'OREB',
    'DREB',
    'REB',
    'STL',
    'BLK',
    'AST',
    'TO',
    'FLS',
    'MIN',
    'EFF',
  ];
  const players = team.players.slice().sort((a, b) => a.num - b.num);
  const rows = players
    .map(
      (p) => `
    <tr><td>#${p.num} ${esc(p.name || '')}</td>
      <td>${p.pts}</td><td>${fmtShot(p.fgm + p.tpm, p.fga + p.tpa)}</td><td>${fmtShot(p.tpm, p.tpa)}</td>
      <td>${fmtShot(p.ftm, p.fta)}</td><td>${p.oreb}</td><td>${p.dreb}</td><td>${p.oreb + p.dreb}</td>
      <td>${p.stl}</td><td>${p.blk}</td>
      <td>${p.ast}</td><td>${p.to}</td><td>${p.pf}</td><td>${fmtMinutes(p.courtSecs)}</td><td>${playerEff(p)}</td></tr>`,
    )
    .join('');
  const sum = (f) => players.reduce((n, p) => n + f(p), 0);
  const t = {
    pts: sum((p) => p.pts),
    fgm: sum((p) => p.fgm),
    fga: sum((p) => p.fga),
    tpm: sum((p) => p.tpm),
    tpa: sum((p) => p.tpa),
    ftm: sum((p) => p.ftm),
    fta: sum((p) => p.fta),
    oreb: sum((p) => p.oreb),
    dreb: sum((p) => p.dreb),
    stl: sum((p) => p.stl),
    blk: sum((p) => p.blk),
    ast: sum((p) => p.ast),
    to: sum((p) => p.to),
    pf: sum((p) => p.pf),
    courtSecs: sum((p) => p.courtSecs || 0),
    eff: sum((p) => playerEff(p)),
  };
  const total = `
    <tr class="totrow"><td>TOTAL</td>
      <td>${t.pts}</td><td>${fmtShot(t.fgm + t.tpm, t.fga + t.tpa)}</td><td>${fmtShot(t.tpm, t.tpa)}</td>
      <td>${fmtShot(t.ftm, t.fta)}</td><td>${t.oreb}</td><td>${t.dreb}</td><td>${t.oreb + t.dreb}</td>
      <td>${t.stl}</td><td>${t.blk}</td>
      <td>${t.ast}</td><td>${t.to}</td><td>${t.pf}</td><td>${fmtMinutes(t.courtSecs)}</td><td>${t.eff}</td></tr>`;
  return `<h2>${esc(team.name)}</h2><table class="bs"><thead><tr><th>Player</th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}${total}</tbody></table>`;
}

function boxScoreText(team) {
  const players = team.players.slice().sort((a, b) => a.num - b.num);
  const playerLine = (label, p) =>
    `${label}: ${p.pts} PTS, ${fmtShot(p.fgm + p.tpm, p.fga + p.tpa)} FG, ${fmtShot(p.tpm, p.tpa)} 3PT, ${fmtShot(p.ftm, p.fta)} FT, ${p.oreb} OREB, ${p.dreb} DREB, ${p.oreb + p.dreb} REB, ${p.stl} STL, ${p.blk} BLK, ${p.ast} AST, ${p.to} TO, ${p.pf} FLS, ${fmtMinutes(p.courtSecs)} MIN, ${playerEff(p)} EFF`;
  const lines = [`${team.name} box score`];
  players.forEach((p) => {
    lines.push(playerLine(`#${p.num} ${p.name || ''}`.trim(), p));
  });
  const sum = (f) => players.reduce((n, p) => n + f(p), 0);
  const t = {
    pts: sum((p) => p.pts),
    fgm: sum((p) => p.fgm),
    fga: sum((p) => p.fga),
    tpm: sum((p) => p.tpm),
    tpa: sum((p) => p.tpa),
    ftm: sum((p) => p.ftm),
    fta: sum((p) => p.fta),
    oreb: sum((p) => p.oreb),
    dreb: sum((p) => p.dreb),
    stl: sum((p) => p.stl),
    blk: sum((p) => p.blk),
    ast: sum((p) => p.ast),
    to: sum((p) => p.to),
    pf: sum((p) => p.pf),
    courtSecs: sum((p) => p.courtSecs || 0),
  };
  lines.push(playerLine('TOTAL', t));
  return lines.join('\n');
}

function buildSummaryText(g, leftTeam, rightTeam, deltas) {
  const teamOf = (team) => (team === 'my' ? g.myTeam : g.oppTeam);
  const lines = [];
  lines.push(`${g.myTeam.name} vs ${g.oppTeam.name}`);
  lines.push('');
  lines.push(
    `FINAL: ${teamName(g, leftTeam)} ${g.score[leftTeam]} – ${g.score[rightTeam]} ${teamName(g, rightTeam)}`,
  );
  lines.push('');
  lines.push('Scoring by period');
  const periodHeader = deltas.map((_, i) => periodLabel(i + 1, g.config.numHalves)).join(' ');
  lines.push(`${periodHeader} Total`);
  lines.push(
    `${teamName(g, leftTeam)}: ${deltas.map((d) => d[leftTeam]).join(' ')} ${g.score[leftTeam]}`,
  );
  lines.push(
    `${teamName(g, rightTeam)}: ${deltas.map((d) => d[rightTeam]).join(' ')} ${g.score[rightTeam]}`,
  );
  lines.push('');
  lines.push(boxScoreText(teamOf(leftTeam)));
  lines.push('');
  lines.push(boxScoreText(teamOf(rightTeam)));
  lines.push('');
  lines.push('Game log');
  g.log.forEach((e) => {
    lines.push(`${e.clockText} ${periodLabel(e.period, g.config.numHalves)} – ${e.detail}`);
  });
  return lines.join('\n');
}

function newGameFromSummary() {
  state.game = null;
  saveGame();
  setupDraft = defaultDraft();
  homeView = 'setup';
  render();
}

const MODIFIERS = {
  '2pt': ['Layup', 'Dunk', 'Mid-range'],
  '3pt': ['Long distance'],
  foul: ['Shooting', 'Technical', 'On the ground'],
};

function commit(producer) {
  // producer: (game, nowMs) => game
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
      if (rem <= 0) commit((game, now) => stopClock(game, now)); // auto-stop at 0:00
    }
  }, 250);
}
function stopTick() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

function renderGame() {
  const g = state.game;
  const el = document.getElementById('game');
  const tf = g.teamFouls,
    bn = (team) => bonusState(tf[team]);
  const bonusBadge = (team) =>
    bn(team) === 'double'
      ? '<span class="badge dbl">BB</span>'
      : bn(team) === 'bonus'
        ? '<span class="badge bon">B</span>'
        : '';

  // Physical left/right follows myTeamSide (display only)
  const myLeft = g.config.myTeamSide === 'home';
  const leftTeam = myLeft ? 'my' : 'opp';
  const rightTeam = myLeft ? 'opp' : 'my';
  const sideBadge = (side) =>
    `<button class="badge side" data-swap-sides title="Double-tap to swap Home/Away">${side === 'home' ? 'H' : 'A'}</button>`;

  el.innerHTML = `
    <header class="gh">
      <div class="score-box">
        <div class="tn">${esc(teamName(g, leftTeam))} ${sideBadge(myLeft ? 'home' : 'away')}</div>
        <div class="sc" data-actlog="score:${leftTeam}">${g.score[leftTeam]}</div>
        <div class="adj"><button data-adj="${leftTeam}:-1" ${g.score[leftTeam] === 0 ? 'disabled' : ''}>−</button><button data-adj="${leftTeam}:1">+</button></div>
      </div>
      <div class="clock">
        <div class="clockrow">
          <button class="clkstep" data-clk="-1">−</button>
          <div id="clock-display" class="cd">${fmtClock(clockRemaining(g.clock, Date.now()))}</div>
          <button class="clkstep" data-clk="1">+</button>
        </div>
        <div class="period">${periodLabel(g.period, g.config.numHalves)}</div>
        <div class="cbtns"><button id="clk-toggle" class="${g.clock.running ? 'stop' : 'start'}">${g.clock.running ? 'STOP' : 'START'}</button></div>
      </div>
      <div class="score-box">
        <div class="tn">${esc(teamName(g, rightTeam))} ${sideBadge(myLeft ? 'away' : 'home')}</div>
        <div class="sc" data-actlog="score:${rightTeam}">${g.score[rightTeam]}</div>
        <div class="adj"><button data-adj="${rightTeam}:-1" ${g.score[rightTeam] === 0 ? 'disabled' : ''}>−</button><button data-adj="${rightTeam}:1">+</button></div>
      </div>
    </header>

    <div class="infobar">
      <span class="tf"><span class="statlbl" data-actlog="fouls:${leftTeam}">FS: ${tf[leftTeam]}</span>
        <button class="tfadj" data-tf="${leftTeam}:-1" ${g.teamFouls[leftTeam] === 0 ? 'disabled' : ''}>−</button><button class="tfadj" data-tf="${leftTeam}:1">+</button> ${bonusBadge(leftTeam)}</span>
      <button id="poss">POS:${g.possession === leftTeam ? '◀' : '▶'}</button>
      <span class="tf"><span class="statlbl" data-actlog="fouls:${rightTeam}">FS: ${tf[rightTeam]}</span>
        <button class="tfadj" data-tf="${rightTeam}:-1" ${g.teamFouls[rightTeam] === 0 ? 'disabled' : ''}>−</button><button class="tfadj" data-tf="${rightTeam}:1">+</button> ${bonusBadge(rightTeam)}</span>
    </div>
    <div class="infobar small">
      <span class="tf"><span class="statlbl" data-actlog="to:${leftTeam}">TO: ${g.timeouts[leftTeam]}</span>
        <button class="tfadj" data-to="${leftTeam}:-1" ${g.timeouts[leftTeam] === 0 ? 'disabled' : ''}>−</button><button class="tfadj" data-to="${leftTeam}:1">+</button></span>
      <span class="period-ctl">${
        g.period < g.config.numHalves
          ? `<button id="btn-endhalf">END HALF</button>`
          : `<button id="btn-endgame">END GAME</button><button id="btn-ot">+OT</button>`
      }</span>
      <span class="tf"><span class="statlbl" data-actlog="to:${rightTeam}">TO: ${g.timeouts[rightTeam]}</span>
        <button class="tfadj" data-to="${rightTeam}:-1" ${g.timeouts[rightTeam] === 0 ? 'disabled' : ''}>−</button><button class="tfadj" data-to="${rightTeam}:1">+</button></span>
    </div>

    <div class="court">
      <div class="col${colClass(leftTeam, rightTeam)}">${renderPlayers(g, leftTeam)}</div>
      <div class="controls">${renderControls(g)}</div>
      <div class="col${colClass(rightTeam, leftTeam)}">${renderPlayers(g, rightTeam)}</div>
    </div>
  `;
  wireGame();
  startTick();
}

function teamName(g, team) {
  return team === 'my' ? g.myTeam.name : g.oppTeam.name;
}

function colClass(team, otherTeam) {
  if (collapsedTeam === team) return ' collapsed';
  if (collapsedTeam === otherTeam) return ' wide';
  return '';
}

function renderPlayers(g, team) {
  if (collapsedTeam === team) {
    return `<button class="expandbtn" data-expand="${team}">Expand</button>`;
  }
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const rows = t.players
    .slice()
    .sort((a, b) => b.onCourt - a.onCourt || a.num - b.num)
    .map(
      (p) => `
    <button class="pl ${g.selectedPlayerId === p.id ? 'sel' : ''}" data-pl="${team}:${p.id}">
      <span class="plhdr"><span class="pnum${p.onCourt ? ' oncourt' : ''}">#${p.num}</span> ${esc(initials(p.name))}</span>
      <span class="pp">${p.pts} pts · ${p.pf} f</span>
    </button>`,
    )
    .join('');
  const addUI =
    addOpen === team
      ? `<div class="addpl">
         <input class="num" type="number" inputmode="numeric" placeholder="#" data-addnum="${team}">
         <input placeholder="Name" data-addname="${team}">
         <button data-addgo="${team}">Add</button>
         <button data-addclose="${team}">Close</button>
       </div>`
      : `<button class="colbtn" data-addopen="${team}">+ Add</button>`;
  return (
    rows + addUI + `<button class="colbtn collapsebtn" data-collapse="${team}">Collapse</button>`
  );
}

function renderControls(g) {
  const recent = g.log
    .slice()
    .reverse()
    .map(
      (e) =>
        `<div class="ev">${e.clockText} ${periodLabel(e.period, g.config.numHalves)} — ${esc(e.detail)}</div>`,
    )
    .join('');
  const flashClass = (key) => {
    if (flashKey === key) {
      flashKey = null;
      return ' flash';
    }
    return '';
  };
  return `
    <div class="grid">
      <button data-stat="2pt" class="${flashClass('2pt')}">2PT</button>
      <button data-stat="3pt" class="${flashClass('3pt')}">3PT</button>
      <button data-stat="ft" class="${flashClass('ft')}">FT</button>
      <button id="btn-miss" class="${missArm || missLock ? 'armed' : ''}${missLock ? ' locked' : ''}">MISS</button>
      ${['oreb', 'dreb', 'stl', 'blk', 'ast', 'to'].map((s) => `<button data-stat="${s}" class="${flashClass(s)}">${s === 'to' ? 'TOVR' : s.toUpperCase()}</button>`).join('')}
      <button data-stat="foul" class="${flashClass('foul')}">FOUL</button>
      <button id="btn-undo" class="undo${flashClass('btn-undo')}">UNDO</button>
    </div>
    <div class="recent">${recent}</div>
  `;
}

function selectedTeam(g) {
  if (!g.selectedPlayerId) return null;
  if (g.myTeam.players.some((p) => p.id === g.selectedPlayerId)) return 'my';
  if (g.oppTeam.players.some((p) => p.id === g.selectedPlayerId)) return 'opp';
  return null;
}

function wireGame() {
  const $ = (id) => document.getElementById(id);

  el_each('[data-pl]', (b) => attachPlayerPress(b));
  el_each('[data-actlog]', (b) => attachStatPress(b));

  el_each(
    '[data-addopen]',
    (b) =>
      (b.onclick = () => {
        addOpen = b.dataset.addopen;
        render();
        document.querySelector(`[data-addnum="${addOpen}"]`).focus();
      }),
  );
  el_each(
    '[data-addclose]',
    (b) =>
      (b.onclick = () => {
        addOpen = null;
        render();
      }),
  );
  el_each('[data-addgo]', (b) => (b.onclick = () => addGamePlayerFromForm(b.dataset.addgo)));
  el_each(
    '[data-addnum]',
    (b) =>
      (b.onkeydown = (e) => {
        if (e.key === 'Enter') document.querySelector(`[data-addgo="${b.dataset.addnum}"]`).click();
      }),
  );

  el_each(
    '[data-collapse]',
    (b) =>
      (b.onclick = () => {
        collapsedTeam = b.dataset.collapse;
        render();
      }),
  );
  el_each(
    '[data-expand]',
    (b) =>
      (b.onclick = () => {
        collapsedTeam = null;
        render();
      }),
  );

  el_each(
    '[data-adj]',
    (b) =>
      (b.onclick = () => {
        const [team, delta] = b.dataset.adj.split(':');
        commit((game, now) => adjustScore(game, team, parseInt(delta, 10), now));
      }),
  );

  el_each(
    '[data-tf]',
    (b) =>
      (b.onclick = () => {
        const [team, delta] = b.dataset.tf.split(':');
        commit((game, now) => adjustTeamFouls(game, team, parseInt(delta, 10), now));
      }),
  );

  el_each(
    '[data-to]',
    (b) =>
      (b.onclick = () => {
        const [team, delta] = b.dataset.to.split(':');
        commit((game, now) => adjustTimeouts(game, team, parseInt(delta, 10), now));
      }),
  );

  // Stat buttons: quick tap = no modifier; long-press = modifier menu
  el_each('[data-stat]', (b) => {
    const stat = b.dataset.stat;
    attachPressHandlers(b, stat);
  });

  $('poss') && ($('poss').onclick = () => commit((game, now) => togglePossession(game, now)));
  el_each(
    '[data-swap-sides]',
    (b) => (b.ondblclick = () => commit((game, now) => swapHomeAway(game, now))),
  );
  $('clk-toggle') &&
    ($('clk-toggle').onclick = () => commit((game, now) => toggleClock(game, now)));
  el_each('[data-clk]', (b) => attachClockPress(b));

  let missClickTimer = null;
  $('btn-miss') &&
    ($('btn-miss').onclick = () => {
      if (missClickTimer) {
        clearTimeout(missClickTimer);
        missClickTimer = null;
        missLock = !missLock;
        missArm = false;
        render();
        return;
      }
      missClickTimer = setTimeout(() => {
        missClickTimer = null;
        if (!missLock) {
          missArm = !missArm;
          render();
        }
      }, 300);
    });
  $('btn-undo') &&
    ($('btn-undo').onclick = () => {
      flashKey = 'btn-undo';
      commit((game) => undo(game));
    });
  $('btn-endhalf') && ($('btn-endhalf').onclick = () => commit((game, now) => endHalf(game, now)));
  $('btn-endgame') &&
    ($('btn-endgame').onclick = () => {
      commit((game, now) => endGame(game, now));
      if (!state.game.id) state.game.id = makeLocalId();
      state.history = upsertHistory(state.history, clone(state.game));
      saveHistory();
    });
  $('btn-ot') && ($('btn-ot').onclick = () => commit((game, now) => addOvertime(game, now)));
}

function backingSavedTeamId(team) {
  return team === 'my' ? state.game.myTeam.id : state.game.oppTeam.id;
}

function addGamePlayerFromForm(team) {
  const numEl = document.querySelector(`[data-addnum="${team}"]`);
  const nameEl = document.querySelector(`[data-addname="${team}"]`);
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return; // blank/non-numeric jersey → no-op
  const player = { id: makeLocalId(), num, name: nameEl.value.trim() };
  commit((game) => addPlayerToGame(game, team, player)); // mutate → save → render
  const savedId = backingSavedTeamId(team);
  if (savedId) {
    // persist to the saved team
    const t = state.teams.find((x) => x.id === savedId);
    if (t) {
      t.players.push({ id: player.id, num: player.num, name: player.name });
      saveTeams();
    }
  }
  document.querySelector(`[data-addnum="${team}"]`).focus();
}

function recordSelectedStat(stat, opts = {}) {
  const g = state.game;
  const team = selectedTeam(g);
  if (!team) return;
  commit((game, now) =>
    recordStat(
      game,
      {
        team,
        playerId: g.selectedPlayerId,
        stat,
        modifier: opts.modifier ?? null,
        made: opts.made ?? true,
      },
      now,
    ),
  );
}

function attachPressHandlers(btn, stat) {
  const hasMenu = !!SHOT_INFO[stat] || stat === 'foul'; // shots: Miss(+mods); foul: mods
  let timer = null,
    longFired = false;
  const start = () => {
    longFired = false;
    if (!hasMenu) return;
    timer = setTimeout(() => {
      longFired = true;
      openStatMenu(btn, stat);
    }, 500);
  };
  const end = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  btn.addEventListener('touchstart', start, { passive: true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault()); // suppress long-press browser menu
  btn.onclick = () => {
    if (longFired) {
      longFired = false;
      return;
    }
    const hasTeam = !!selectedTeam(state.game);
    if (SHOT_INFO[stat] && (missArm || missLock) && hasTeam) {
      if (!missLock) missArm = false;
      flashKey = stat;
      recordSelectedStat(stat, { made: false });
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
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      it.act();
    });
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
  if (isShot) items.push({ label: 'Miss', act: () => recordSelectedStat(stat, { made: false }) });
  (MODIFIERS[stat] || []).forEach((m) =>
    items.push({ label: m, act: () => recordSelectedStat(stat, { made: true, modifier: m }) }),
  );
  openPopover(anchorBtn, items);
}

function attachPlayerPress(btn) {
  const [team, id] = btn.dataset.pl.split(':');
  let timer = null,
    longFired = false;
  const start = () => {
    longFired = false;
    timer = setTimeout(() => {
      longFired = true;
      openPlayerMenu(btn, team, id);
    }, 500);
  };
  const end = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  btn.addEventListener('touchstart', start, { passive: true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault()); // suppress long-press browser menu
  btn.onclick = () => {
    if (longFired) {
      longFired = false;
      return;
    }
    // Double-click-to-edit is detected via a module-level timestamp rather than a
    // closure-local timer: selection now applies immediately (no delay), and render()
    // tears down/rewires this button on every click, so a per-closure timer wouldn't
    // survive from the first click to the second anyway.
    const now = Date.now();
    if (lastPlayerClick && lastPlayerClick.id === id && now - lastPlayerClick.at < 300) {
      lastPlayerClick = null;
      openPlayerEditDialog(team, id);
      return;
    }
    lastPlayerClick = { id, at: now };
    state.game.selectedPlayerId = state.game.selectedPlayerId === id ? null : id;
    saveGame();
    render();
  };
}

function openPlayerMenu(anchorBtn, team, id) {
  const t = team === 'my' ? state.game.myTeam : state.game.oppTeam;
  const p = t.players.find((x) => x.id === id);
  if (!p) return;
  const subItem = p.onCourt
    ? { label: 'Sub Out', act: () => commit((game, now) => subOut(game, team, id, now)) }
    : { label: 'Sub In', act: () => commit((game, now) => subIn(game, team, id, now)) };
  openPopover(anchorBtn, [{ label: 'Activity', act: () => openActivityDialog(team, id) }, subItem]);
}

function attachStatPress(btn) {
  const [kind, team] = btn.dataset.actlog.split(':');
  let timer = null;
  const start = () => {
    timer = setTimeout(() => openTeamActivityDialog(kind, team), 500);
  };
  const end = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  btn.addEventListener('touchstart', start, { passive: true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault()); // suppress long-press browser menu
}

const STAT_LOG_TYPES = {
  fouls: ['foul', 'team_foul_adj'],
  to: ['timeout_adj'],
  score: ['2pt_made', '3pt_made', 'ft_made', 'score_adj'],
};
const STAT_LOG_LABELS = { fouls: 'Fouls', to: 'Timeouts', score: 'Score' };

function openTeamActivityDialog(kind, team) {
  const g = state.game;
  const types = STAT_LOG_TYPES[kind];
  const events = g.log.filter((e) => e.team === team && types.includes(e.type)).reverse();
  const rows = events.length
    ? events
        .map(
          (e) =>
            `<div class="ev">${e.clockText} ${periodLabel(e.period, g.config.numHalves)} — ${esc(e.detail)}</div>`,
        )
        .join('')
    : `<p class="muted">No activity yet</p>`;
  const back = document.createElement('div');
  back.className = 'dlgback';
  back.addEventListener('pointerdown', closeActivityDialog);
  const dlg = document.createElement('div');
  dlg.className = 'dialog';
  dlg.innerHTML = `<h3>${esc(teamDisplayName(g, team))} ${STAT_LOG_LABELS[kind]}</h3><div class="dlgbody">${rows}</div><button class="dlgclose">Close</button>`;
  dlg.querySelector('.dlgclose').addEventListener('click', closeActivityDialog);
  document.body.appendChild(back);
  document.body.appendChild(dlg);
}

function openPlayerEditDialog(team, id) {
  const g = state.game;
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = t.players.find((x) => x.id === id);
  if (!p) return;
  const back = document.createElement('div');
  back.className = 'dlgback';
  back.addEventListener('pointerdown', closeActivityDialog);
  const dlg = document.createElement('div');
  dlg.className = 'dialog';
  dlg.innerHTML = `<h3>Edit Player</h3><div class="dlgbody"><label>Number <input id="pe-num" type="number" inputmode="numeric" value="${p.num}"></label><label>Name <input id="pe-name" value="${esc(p.name || '')}"></label><p id="pe-error" class="error"></p></div><div class="tip-row"><button id="pe-save" class="tip">Save</button><button id="pe-cancel">Cancel</button></div>`;
  document.body.appendChild(back);
  document.body.appendChild(dlg);
  dlg.querySelector('#pe-save').onclick = () => {
    const num = parseInt(dlg.querySelector('#pe-num').value, 10);
    if (isNaN(num)) {
      dlg.querySelector('#pe-error').textContent = 'Enter a jersey number.';
      return;
    }
    const name = dlg.querySelector('#pe-name').value.trim();
    commit((game) => editPlayer(game, team, id, { num, name }));
    const savedId = backingSavedTeamId(team);
    if (savedId) {
      const st = state.teams.find((x) => x.id === savedId);
      const sp = st && st.players.find((x) => x.id === id);
      if (sp) {
        sp.num = num;
        sp.name = name;
        saveTeams();
      }
    }
    closeActivityDialog();
  };
  dlg.querySelector('#pe-cancel').onclick = closeActivityDialog;
}

function openRosterEditDialog(i) {
  const d = teamEdit;
  const p = d.players[i];
  if (!p) return;
  const back = document.createElement('div');
  back.className = 'dlgback';
  back.addEventListener('pointerdown', closeActivityDialog);
  const dlg = document.createElement('div');
  dlg.className = 'dialog';
  dlg.innerHTML = `<h3>Edit Player</h3><div class="dlgbody"><label>Number <input id="pe-num" type="number" inputmode="numeric" value="${p.num}"></label><label>Name <input id="pe-name" value="${esc(p.name || '')}"></label><p id="pe-error" class="error"></p></div><div class="tip-row"><button id="pe-save" class="tip">Save</button><button id="pe-cancel">Cancel</button></div>`;
  document.body.appendChild(back);
  document.body.appendChild(dlg);
  dlg.querySelector('#pe-save').onclick = () => {
    const num = parseInt(dlg.querySelector('#pe-num').value, 10);
    if (isNaN(num)) {
      dlg.querySelector('#pe-error').textContent = 'Enter a jersey number.';
      return;
    }
    p.num = num;
    p.name = dlg.querySelector('#pe-name').value.trim();
    closeActivityDialog();
    renderTeams();
  };
  dlg.querySelector('#pe-cancel').onclick = closeActivityDialog;
}

function closeActivityDialog() {
  document.querySelectorAll('.dialog, .dlgback').forEach((n) => n.remove());
}

function openHelpDialog() {
  const back = document.createElement('div');
  back.className = 'dlgback';
  back.addEventListener('pointerdown', closeActivityDialog);
  const dlg = document.createElement('div');
  dlg.className = 'dialog';
  const shareBtn =
    typeof navigator.share === 'function'
      ? `<button class="dlgclose" id="help-share">Share / Add to Home Screen</button>`
      : '';
  dlg.innerHTML = `
    <h3>How to use HoopScore</h3>
    <div class="dlgbody">
      <ul class="helplist">
        <li>Tap a player to select them, then tap a stat button (2PT, 3PT, REB, etc.) to record it.</li>
        <li>Long-press a player for Activity / Sub In-Out. Double-tap a player to rename or renumber them.</li>
        <li>Tap MISS before recording a shot to mark just that one shot as a miss (it disarms automatically after). Double-tap MISS to lock it on — every shot records as a miss until you double-tap MISS again to unlock.</li>
        <li>Long-press a stat label (fouls, score) to see that stat's log.</li>
        <li>UNDO reverses the last action.</li>
        <li>Collapse a team's panel (below its Add button) to make the shared stat buttons bigger when you're only scoring one team.</li>
        <li>Double-tap either H/A badge to swap Home/Away.</li>
        <li>Export/Import backups from Setup if you need to clear your browser data without losing teams or history.</li>
      </ul>
      <p>This app works best added to your Home Screen as a standalone app — no browser toolbar, and it checks for updates automatically.</p>
      ${shareBtn}
    </div>
    <button class="dlgclose" id="help-close">Close</button>
  `;
  document.body.appendChild(back);
  document.body.appendChild(dlg);
  dlg.querySelector('#help-close').onclick = closeActivityDialog;
  const shareEl = dlg.querySelector('#help-share');
  if (shareEl) {
    shareEl.onclick = () => {
      navigator.share({ title: 'HoopScore', url: location.href }).catch(() => {});
    };
  }
}

function openActivityDialog(team, id) {
  const g = state.game;
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = t.players.find((x) => x.id === id);
  if (!p) return;
  const events = g.log.filter((e) => e.playerId === id).reverse(); // newest first
  const rows = events.length
    ? events
        .map(
          (e) =>
            `<div class="ev">${e.clockText} ${periodLabel(e.period, g.config.numHalves)} — ${esc(e.detail)}</div>`,
        )
        .join('')
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
  const dir = parseInt(btn.dataset.clk, 10); // -1 or +1
  let timer = null,
    longFired = false;
  const start = () => {
    longFired = false;
    timer = setTimeout(() => {
      longFired = true;
      commit((game, now) => adjustClock(game, dir * 10, now));
    }, 500);
  };
  const end = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  btn.addEventListener('touchstart', start, { passive: true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault()); // suppress long-press browser menu
  btn.onclick = () => {
    if (longFired) {
      longFired = false;
      return;
    }
    commit((game, now) => adjustClock(game, dir, now));
  };
}

// --- Update check: detect a new deploy while the app sits open/backgrounded ---
let knownAppJsHash = null;
let updateBannerDismissed = false;

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

async function checkForUpdate() {
  if (updateBannerDismissed || document.getElementById('update-banner')) return;
  try {
    const res = await fetch('app.js', { cache: 'no-store' });
    if (!res.ok) return;
    const hash = simpleHash(await res.text());
    if (knownAppJsHash === null) {
      knownAppJsHash = hash;
    } else if (hash !== knownAppJsHash) {
      showUpdateBanner();
    }
  } catch {
    // offline or blocked — non-critical background check, fail silently
  }
}

function showUpdateBanner() {
  const bar = document.createElement('div');
  bar.id = 'update-banner';
  bar.innerHTML = `
    <span>Update available</span>
    <button id="update-reload">Reload</button>
    <button id="update-dismiss" class="dismiss" title="Dismiss">×</button>
  `;
  document.body.appendChild(bar);
  document.getElementById('update-reload').onclick = () => location.reload();
  document.getElementById('update-dismiss').onclick = () => {
    updateBannerDismissed = true;
    bar.remove();
  };
}

function init() {
  loadAll();
  applyTheme();
  render();
  checkForUpdate();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkForUpdate();
      if (state.game && state.game.screen === 'game') render();
    }
  });
}

// ===== BOOTSTRAP (browser only; Node ignores) =====
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);

  // Suppress iOS's native double-tap-to-zoom rather than rely on touch-action
  // alone. Buttons are exempt: the MISS lock toggle and the player edit dialog
  // both use their own same-element double-click timers (neither re-renders
  // between the two taps), so preventing their second touchend's click would
  // break those features. Non-button double-taps (e.g. blank space) have no
  // such feature to protect.
  let lastTouchEnd = 0;
  let lastTouchTarget = null;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300 && e.target === lastTouchTarget && !e.target.closest('button'))
        e.preventDefault();
      lastTouchEnd = now;
      lastTouchTarget = e.target;
    },
    { passive: false },
  );
}
