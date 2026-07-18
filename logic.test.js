const { test } = require('node:test');
const assert = require('node:assert');
const app = require('./app.js');

test('app.js is require-able and exports VERSION', () => {
  assert.strictEqual(typeof app, 'object');
  assert.strictEqual(typeof app.VERSION, 'string');
});

const { clone, emptyMyStats, periodLabel, bonusState, fmtClock, parseClock, fmtShot, newGame } =
  app;

test('clone is a deep copy', () => {
  const a = { x: { y: 1 } };
  const b = clone(a);
  b.x.y = 2;
  assert.strictEqual(a.x.y, 1);
});

test('empty stat shapes', () => {
  assert.deepStrictEqual(emptyMyStats(), {
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
  });
});

test('periodLabel', () => {
  assert.strictEqual(periodLabel(1, 2), 'P1');
  assert.strictEqual(periodLabel(2, 2), 'P2');
  assert.strictEqual(periodLabel(3, 2), 'OT1');
  assert.strictEqual(periodLabel(4, 2), 'OT2');
});

const { defaultWarnSecs, warnSecsFor } = app;

test('defaultWarnSecs: only the final period defaults to 60, others 30', () => {
  assert.deepStrictEqual(defaultWarnSecs(1), [60]);
  assert.deepStrictEqual(defaultWarnSecs(2), [30, 60]);
  assert.deepStrictEqual(defaultWarnSecs(4), [30, 30, 30, 60]);
});

test('warnSecsFor looks up the threshold for the current period, clamping OT to the last entry', () => {
  const config = { warnSecs: [30, 60] };
  assert.strictEqual(warnSecsFor(config, 1), 30);
  assert.strictEqual(warnSecsFor(config, 2), 60);
  assert.strictEqual(warnSecsFor(config, 3), 60); // OT reuses last regular period's value
  assert.strictEqual(warnSecsFor(config, 4), 60);
});

test('warnSecsFor falls back to 30 when warnSecs is missing', () => {
  assert.strictEqual(warnSecsFor({}, 1), 30);
});

test('bonusState thresholds', () => {
  assert.strictEqual(bonusState(6), 'none');
  assert.strictEqual(bonusState(7), 'bonus');
  assert.strictEqual(bonusState(9), 'bonus');
  assert.strictEqual(bonusState(10), 'double');
});

test('clock formatting', () => {
  assert.strictEqual(fmtClock(125), '2:05');
  assert.strictEqual(fmtClock(0), '0:00');
  assert.strictEqual(parseClock('2:05'), 125);
  assert.strictEqual(parseClock('bad'), null);
  assert.strictEqual(fmtShot(3, 7), '3/7');
});

test('parseClock rejects seconds out of range', () => {
  assert.strictEqual(parseClock('1:60'), null); // seconds must be 0–59
});

test('newGame builds initial state keyed by identity', () => {
  const g = newGame({
    config: { halfLengthMin: 18, numHalves: 2, otLengthMin: 4, myTeamSide: 'home' },
    myTeam: { id: 't1', name: 'Mine', players: [{ id: 'p1', num: 5, name: 'Smith' }] },
    oppTeam: { name: 'Them', players: [{ id: 'o1', num: 9, name: '' }] },
  });
  assert.strictEqual(g.screen, 'game');
  assert.strictEqual(g.period, 1);
  assert.strictEqual(g.clock.remainingSec, 18 * 60);
  assert.strictEqual(g.clock.running, false);
  assert.deepStrictEqual(g.score, { my: 0, opp: 0 });
  assert.deepStrictEqual(g.periodScores, []);
  assert.strictEqual(g.possession, 'my');
  assert.strictEqual(g.myTeam.players[0].pts, 0); // my players carry full stats
  assert.strictEqual(g.myTeam.players[0].oreb, 0);
  assert.strictEqual(g.oppTeam.players[0].pts, 0); // both teams carry the full stat set
  assert.strictEqual('dreb' in g.oppTeam.players[0], true);
});

test('newGame omits oppTeam.id when not provided, includes it when provided', () => {
  const base = {
    config: { halfLengthMin: 18, numHalves: 2, otLengthMin: 4, myTeamSide: 'home' },
    myTeam: { id: 'mine', name: 'Mine', players: [] },
  };
  const withoutId = newGame({ ...base, oppTeam: { name: 'Freeform Opp', players: [] } });
  assert.strictEqual('id' in withoutId.oppTeam, false);

  const withId = newGame({
    ...base,
    oppTeam: { id: 'saved-team-1', name: 'Linked Opp', players: [] },
  });
  assert.strictEqual(withId.oppTeam.id, 'saved-team-1');
});

const { clockRemaining, startClock, stopClock, toggleClock, adjustClock } = app;

function freshGame() {
  return newGame({
    config: { halfLengthMin: 18, numHalves: 2, otLengthMin: 4, myTeamSide: 'home' },
    myTeam: { id: 't1', name: 'Mine', players: [{ id: 'p1', num: 5, name: 'Smith' }] },
    oppTeam: { name: 'Them', players: [{ id: 'o1', num: 9, name: '' }] },
  });
}

test('clockRemaining counts down by real elapsed time', () => {
  const clock = { remainingSec: 100, running: true, startedAt: 1000 };
  assert.strictEqual(clockRemaining(clock, 1000), 100);
  assert.strictEqual(clockRemaining(clock, 6000), 95); // 5s elapsed
  assert.strictEqual(clockRemaining(clock, 999000), 0); // never negative
});

test('clockRemaining returns baked value when stopped', () => {
  assert.strictEqual(
    clockRemaining({ remainingSec: 42, running: false, startedAt: null }, 9e9),
    42,
  );
});

test('start then stop bakes elapsed time', () => {
  let g = freshGame();
  g = startClock(g, 1000);
  assert.strictEqual(g.clock.running, true);
  g = stopClock(g, 4000); // 3s later
  assert.strictEqual(g.clock.running, false);
  assert.strictEqual(g.clock.startedAt, null);
  assert.strictEqual(g.clock.remainingSec, 18 * 60 - 3);
});

test('toggleClock flips running', () => {
  let g = freshGame();
  g = toggleClock(g, 1000);
  assert.strictEqual(g.clock.running, true);
  g = toggleClock(g, 2000);
  assert.strictEqual(g.clock.running, false);
});

test('adjustClock nudges remaining seconds and clamps at zero (stopped)', () => {
  let g = freshGame(); // stopped, remaining = 18*60
  g = adjustClock(g, 1, 1000);
  assert.strictEqual(g.clock.remainingSec, 18 * 60 + 1);
  assert.strictEqual(g.clock.running, false);
  g = adjustClock(g, -(18 * 60 + 5), 2000); // overshoot downward
  assert.strictEqual(g.clock.remainingSec, 0); // clamped at zero
});

test('adjustClock keeps a running clock running and rebases startedAt', () => {
  let g = startClock(freshGame(), 1000); // running, startedAt=1000
  g = adjustClock(g, 5, 3000); // 2s elapsed → 18*60-2, then +5 = 18*60+3
  assert.strictEqual(g.clock.running, true);
  assert.strictEqual(g.clock.startedAt, 3000); // rebased to now
  assert.strictEqual(g.clock.remainingSec, 18 * 60 + 3);
});

const { recordStat } = app;

test('my 2pt make adds points and field goal make/attempt', () => {
  let g = freshGame();
  g = recordStat(g, { team: 'my', playerId: 'p1', stat: '2pt' }, 1000);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.pts, 2);
  assert.strictEqual(p.fgm, 1);
  assert.strictEqual(p.fga, 1);
  assert.strictEqual(g.score.my, 2);
  assert.strictEqual(g.log[0].type, '2pt_made');
});

test('a shot with made:false records an attempt only (a miss)', () => {
  let g = freshGame();
  g = recordStat(g, { team: 'my', playerId: 'p1', stat: '3pt', made: false }, 1000);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.tpm, 0);
  assert.strictEqual(p.tpa, 1);
  assert.strictEqual(p.pts, 0);
  assert.strictEqual(g.score.my, 0);
  assert.strictEqual(g.log[0].type, '3pt_miss');
});

test('foul increments player pf and team fouls', () => {
  let g = freshGame();
  g = recordStat(g, { team: 'my', playerId: 'p1', stat: 'foul', modifier: 'Shooting' }, 1000);
  assert.strictEqual(g.myTeam.players[0].pf, 1);
  assert.strictEqual(g.teamFouls.my, 1);
  assert.match(g.log[0].detail, /foul \(Shooting\)/);
});

test('offensive and defensive rebounds record separately', () => {
  let g = freshGame();
  g = recordStat(g, { team: 'my', playerId: 'p1', stat: 'oreb' }, 1000);
  g = recordStat(g, { team: 'my', playerId: 'p1', stat: 'dreb' }, 2000);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.oreb, 1);
  assert.strictEqual(p.dreb, 1);
});

test('opponent records the full stat set too', () => {
  let g = freshGame();
  g = recordStat(g, { team: 'opp', playerId: 'o1', stat: '3pt' }, 1000);
  assert.strictEqual(g.oppTeam.players[0].pts, 3);
  assert.strictEqual(g.score.opp, 3);
  g = recordStat(g, { team: 'opp', playerId: 'o1', stat: 'blk' }, 2000); // now allowed
  assert.strictEqual(g.oppTeam.players[0].blk, 1);
});

test('opponent shot with made:false is a miss', () => {
  let g = freshGame();
  g = recordStat(g, { team: 'opp', playerId: 'o1', stat: '2pt', made: false }, 1000);
  assert.strictEqual(g.score.opp, 0); // miss → no points
  assert.strictEqual(g.oppTeam.players[0].fga, 1); // attempt recorded
});

test('undo reverses a missed shot (attempt removed)', () => {
  let g = freshGame();
  g = recordStat(g, { team: 'my', playerId: 'p1', stat: '2pt', made: false }, 1000);
  assert.strictEqual(g.myTeam.players[0].fga, 1);
  g = undo(g);
  assert.strictEqual(g.myTeam.players[0].fga, 0);
  assert.strictEqual(g.log.length, 0);
});

const { adjustScore, adjustTeamFouls, adjustTimeouts, togglePossession, setPossession } = app;

test('adjustTeamFouls changes count, clamps at zero, logs applied delta', () => {
  let g = freshGame();
  g = adjustTeamFouls(g, 'my', 3, 1000);
  assert.strictEqual(g.teamFouls.my, 3);
  g = adjustTeamFouls(g, 'my', -5, 2000);
  assert.strictEqual(g.teamFouls.my, 0);
  const last = g.log[g.log.length - 1];
  assert.strictEqual(last.type, 'team_foul_adj');
  assert.strictEqual(last.rev.kind, 'teamfoul');
  assert.strictEqual(last.rev.delta, -3); // only -3 actually applied
});

test('undo reverses a manual team-foul adjustment', () => {
  let g = freshGame();
  g = adjustTeamFouls(g, 'opp', 2, 1000);
  assert.strictEqual(g.teamFouls.opp, 2);
  g = undo(g);
  assert.strictEqual(g.teamFouls.opp, 0);
  assert.strictEqual(g.log.length, 0);
});

test('adjustScore clamps at zero and logs applied delta', () => {
  let g = freshGame();
  g = adjustScore(g, 'my', 3, 1000);
  assert.strictEqual(g.score.my, 3);
  g = adjustScore(g, 'my', -5, 2000);
  assert.strictEqual(g.score.my, 0);
  const last = g.log[g.log.length - 1];
  assert.strictEqual(last.type, 'score_adj');
  assert.strictEqual(last.rev.score, -3); // only -3 actually applied
});

test('togglePossession flips and logs', () => {
  let g = freshGame();
  assert.strictEqual(g.possession, 'my');
  g = togglePossession(g, 1000);
  assert.strictEqual(g.possession, 'opp');
  assert.strictEqual(g.log[0].type, 'possession');
});

test('setPossession does not log', () => {
  let g = setPossession(freshGame(), 'opp');
  assert.strictEqual(g.possession, 'opp');
  assert.strictEqual(g.log.length, 0);
});

const { swapHomeAway } = app;

test('swapHomeAway flips config.myTeamSide and logs', () => {
  let g = freshGame();
  assert.strictEqual(g.config.myTeamSide, 'home');
  g = swapHomeAway(g, 1000);
  assert.strictEqual(g.config.myTeamSide, 'away');
  assert.strictEqual(g.log[0].type, 'swap_sides');
  assert.strictEqual(g.log[0].detail, 'Home/Away swapped');
  g = swapHomeAway(g, 2000);
  assert.strictEqual(g.config.myTeamSide, 'home');
  assert.strictEqual(g.log.length, 2);
});

test('undo reverses a home/away swap', () => {
  let g = swapHomeAway(freshGame(), 1000);
  assert.strictEqual(g.config.myTeamSide, 'away');
  g = undo(g);
  assert.strictEqual(g.config.myTeamSide, 'home');
  assert.strictEqual(g.log.length, 0);
});

test('sequential swap-then-swap-back both undo cleanly', () => {
  let g = swapHomeAway(freshGame(), 1000); // home -> away
  g = swapHomeAway(g, 2000); // away -> home
  assert.strictEqual(g.config.myTeamSide, 'home');
  g = undo(g); // undo second swap
  assert.strictEqual(g.config.myTeamSide, 'away');
  assert.strictEqual(g.log.length, 1);
  g = undo(g); // undo first swap
  assert.strictEqual(g.config.myTeamSide, 'home');
  assert.strictEqual(g.log.length, 0);
});

test('adjustTimeouts changes count, clamps at zero, logs applied delta', () => {
  let g = freshGame();
  g = adjustTimeouts(g, 'opp', 2, 1000);
  assert.strictEqual(g.timeouts.opp, 2);
  g = adjustTimeouts(g, 'opp', -5, 2000);
  assert.strictEqual(g.timeouts.opp, 0);
  const last = g.log[g.log.length - 1];
  assert.strictEqual(last.type, 'timeout_adj');
  assert.strictEqual(last.rev.kind, 'timeoutadj');
  assert.strictEqual(last.rev.delta, -2); // only -2 actually applied
});

test('adjustTimeouts does not touch the clock (unlike the old recordTimeout)', () => {
  let g = startClock(freshGame(), 1000);
  g = adjustTimeouts(g, 'my', 1, 2000);
  assert.strictEqual(g.clock.running, true); // no auto-stop — same as fouls/points
});

test('clamped no-op adjustments do not write a log entry', () => {
  const g0 = freshGame(); // all counts start at 0
  assert.deepStrictEqual(adjustTimeouts(g0, 'my', -1, 1000), g0); // already 0 → unchanged
  assert.deepStrictEqual(adjustTeamFouls(g0, 'my', -1, 1000), g0);
  assert.deepStrictEqual(adjustScore(g0, 'my', -1, 1000), g0);
});

test('undo reverses a timeout adjustment', () => {
  let g = freshGame();
  g = adjustTimeouts(g, 'my', 1, 1000);
  assert.strictEqual(g.timeouts.my, 1);
  g = undo(g);
  assert.strictEqual(g.timeouts.my, 0);
  assert.strictEqual(g.log.length, 0);
});

const { undo } = app;

test('undo reverses a 2pt make exactly', () => {
  let g = freshGame();
  g = recordStat(g, { team: 'my', playerId: 'p1', stat: '2pt' }, 1000);
  g = undo(g);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.pts, 0);
  assert.strictEqual(p.fgm, 0);
  assert.strictEqual(p.fga, 0);
  assert.strictEqual(g.score.my, 0);
  assert.strictEqual(g.log.length, 0);
});

test('sequential undo peels actions in reverse', () => {
  let g = freshGame();
  g = recordStat(g, { team: 'my', playerId: 'p1', stat: 'foul' }, 1000);
  g = recordStat(g, { team: 'my', playerId: 'p1', stat: '2pt' }, 2000);
  g = undo(g); // undo the 2pt
  assert.strictEqual(g.score.my, 0);
  assert.strictEqual(g.myTeam.players[0].pf, 1); // foul still there
  g = undo(g); // undo the foul
  assert.strictEqual(g.myTeam.players[0].pf, 0);
  assert.strictEqual(g.teamFouls.my, 0);
});

test('undo on empty / non-reversible log is a no-op', () => {
  let g = freshGame();
  assert.deepStrictEqual(undo(g), g);
  g = endHalf(g, 1000); // end_period entry has no rev
  assert.deepStrictEqual(undo(g), g); // no-op on a non-reversible entry
});

const { teamToSave } = app;

function gameWithSide(side) {
  return newGame({
    config: { halfLengthMin: 18, numHalves: 2, otLengthMin: 4, myTeamSide: side },
    myTeam: { id: 'mine', name: 'Mine', players: [{ id: 'p1', num: 5, name: 'Smith' }] },
    oppTeam: { name: 'Them', players: [{ id: 'o1', num: 9, name: '' }] },
  });
}

for (const side of ['home', 'away']) {
  test(`detailed stats attach to my team when myTeamSide=${side}`, () => {
    let g = gameWithSide(side);
    g = recordStat(g, { team: 'my', playerId: 'p1', stat: 'oreb' }, 1000);
    assert.strictEqual(g.myTeam.players[0].oreb, 1);
  });

  test(`both teams record the full stat set when myTeamSide=${side}`, () => {
    let g = gameWithSide(side);
    g = recordStat(g, { team: 'opp', playerId: 'o1', stat: 'blk' }, 1000);
    assert.strictEqual(g.oppTeam.players[0].blk, 1);
  });

  test(`teamToSave returns my team roster when myTeamSide=${side}`, () => {
    const g = gameWithSide(side);
    assert.deepStrictEqual(teamToSave(g), {
      id: 'mine',
      name: 'Mine',
      players: [{ id: 'p1', num: 5, name: 'Smith' }],
    });
  });
}

const { serialize, deserialize, isResumable, migrateGame } = app;

test('serialize/deserialize round-trips a game', () => {
  const g = freshGame();
  assert.deepStrictEqual(deserialize(serialize(g)), g);
});

test('deserialize returns null on garbage', () => {
  assert.strictEqual(deserialize('{not json'), null);
  assert.strictEqual(deserialize(null), null);
});

test('migrateGame hydrates legacy players (reb -> dreb, defaults, drops makeMode)', () => {
  const legacy = {
    screen: 'game',
    myTeam: { id: 't', name: 'M', players: [{ id: 'p1', num: 5, name: 'S', pts: 2, reb: 3 }] },
    oppTeam: { name: 'O', players: [{ id: 'o1', num: 9, name: '', reb: 1 }] },
    makeMode: false,
  };
  const g = migrateGame(legacy);
  assert.strictEqual(g.myTeam.players[0].oreb, 0);
  assert.strictEqual(g.myTeam.players[0].dreb, 3); // legacy reb folded into dreb
  assert.strictEqual(g.myTeam.players[0].pts, 2); // existing stats preserved
  assert.strictEqual('reb' in g.myTeam.players[0], false); // legacy field dropped
  assert.strictEqual(g.oppTeam.players[0].dreb, 1);
  assert.strictEqual('makeMode' in g, false);
});

test('migrateGame is a no-op-ish on a current game and tolerates null', () => {
  assert.strictEqual(migrateGame(null), null);
  const cur = freshGame();
  const m = migrateGame(cur);
  assert.strictEqual(m.myTeam.players[0].oreb, 0);
  assert.strictEqual('reb' in m.myTeam.players[0], false);
});

test('isResumable only for in-progress game screen', () => {
  assert.strictEqual(isResumable(freshGame()), true); // screen:'game'
  assert.strictEqual(isResumable({ screen: 'summary' }), false);
  assert.strictEqual(isResumable(null), false);
});

const { endHalf, addOvertime, endGame } = app;

test('endHalf advances period, resets clock and team fouls, snapshots score', () => {
  let g = freshGame();
  g = adjustScore(g, 'my', 30, 1000);
  g = adjustScore(g, 'opp', 25, 1000);
  g.teamFouls = { my: 5, opp: 6 };
  g = endHalf(g, 2000);
  assert.strictEqual(g.period, 2);
  assert.strictEqual(g.clock.remainingSec, 18 * 60);
  assert.deepStrictEqual(g.teamFouls, { my: 0, opp: 0 });
  assert.deepStrictEqual(g.periodScores[0], { my: 30, opp: 25 });
  assert.strictEqual(g.log[g.log.length - 1].type, 'end_period');
});

test('addOvertime sets OT clock and toggles possession', () => {
  let g = freshGame();
  g.period = 2;
  g.possession = 'my';
  g = addOvertime(g, 1000);
  assert.strictEqual(g.period, 3); // OT1
  assert.strictEqual(g.clock.remainingSec, 4 * 60);
  assert.strictEqual(g.possession, 'opp');
  assert.deepStrictEqual(g.teamFouls, { my: 0, opp: 0 });
});

test('endGame moves to summary and snapshots final period', () => {
  let g = freshGame();
  g.period = 2;
  g = adjustScore(g, 'my', 50, 1000);
  g = endGame(g, 2000);
  assert.strictEqual(g.screen, 'summary');
  assert.deepStrictEqual(g.periodScores[g.periodScores.length - 1], { my: 50, opp: 0 });
  assert.strictEqual(g.log[g.log.length - 1].type, 'end_game');
});

const { upsertHistory, removeFromHistory, reopenGame } = app;

test('upsertHistory appends a new game and replaces by id without mutating input', () => {
  const a = { id: 'g1', score: { my: 1, opp: 0 } };
  const b = { id: 'g2', score: { my: 2, opp: 0 } };
  const h0 = [];
  const h1 = upsertHistory(h0, a);
  assert.strictEqual(h0.length, 0); // input not mutated
  assert.strictEqual(h1.length, 1);
  const h2 = upsertHistory(h1, b);
  assert.strictEqual(h2.length, 2);
  const h3 = upsertHistory(h2, { id: 'g1', score: { my: 9, opp: 0 } });
  assert.strictEqual(h3.length, 2); // replaced, not appended
  assert.strictEqual(h3.find((g) => g.id === 'g1').score.my, 9);
});

test('removeFromHistory removes by id and is a no-op for unknown id', () => {
  const h = [{ id: 'g1' }, { id: 'g2' }];
  assert.deepStrictEqual(removeFromHistory(h, 'g1'), [{ id: 'g2' }]);
  assert.deepStrictEqual(removeFromHistory(h, 'nope'), h);
});

test('reopenGame flips to game screen and cleanly undoes the END GAME', () => {
  let g = freshGame();
  g = endHalf(g, 1000); // period 2, periodScores=[H1]
  g = endGame(g, 2000); // summary, periodScores=[H1,H2], trailing end_game log
  assert.strictEqual(g.screen, 'summary');
  assert.strictEqual(g.periodScores.length, 2);

  const r = reopenGame(g);
  assert.strictEqual(r.screen, 'game');
  assert.strictEqual(r.periodScores.length, 1); // last snapshot popped
  assert.strictEqual(
    r.log.some((e) => e.type === 'end_game'),
    false,
  ); // end_game log removed
  assert.strictEqual(g.periodScores.length, 2); // original not mutated

  const re = endGame(r, 3000); // re-ending resnapshots correctly, no double-count
  assert.strictEqual(re.periodScores.length, 2);
});

const { subIn, subOut, fmtMinutes } = app;

test('subIn marks a player on court and stamps inClock', () => {
  let g = startClock(freshGame(), 1000); // running, remaining 18*60
  g = subIn(g, 'my', 'p1', 1000);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.onCourt, true);
  assert.strictEqual(p.inClock, 18 * 60);
  assert.strictEqual(g.log[g.log.length - 1].type, 'sub_in');
});

test('subOut accrues court seconds = clockIn - clockOut and clears on court', () => {
  let g = startClock(freshGame(), 1000);
  g = subIn(g, 'my', 'p1', 1000); // inClock 18*60
  g = subOut(g, 'my', 'p1', 61000); // 60s later → remaining 18*60-60
  const p = g.myTeam.players[0];
  assert.strictEqual(p.courtSecs, 60);
  assert.strictEqual(p.onCourt, false);
  assert.strictEqual(p.inClock, null);
  assert.strictEqual(g.log[g.log.length - 1].type, 'sub_out');
});

test('subIn/subOut are no-ops in the wrong state', () => {
  const g0 = freshGame();
  assert.deepStrictEqual(subOut(g0, 'my', 'p1', 1000), g0); // not on court → no-op
  let g = subIn(g0, 'my', 'p1', 1000);
  assert.deepStrictEqual(subIn(g, 'my', 'p1', 2000), g); // already on court → no-op
});

test('undo reverses a sub-in', () => {
  let g = startClock(freshGame(), 1000);
  g = subIn(g, 'my', 'p1', 1000);
  g = undo(g);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.onCourt, false);
  assert.strictEqual(p.inClock, null);
  assert.strictEqual(g.log.length, 0);
});

test('undo reverses a sub-out, restoring inClock and accrued seconds', () => {
  let g = startClock(freshGame(), 1000);
  g = subIn(g, 'my', 'p1', 1000); // inClock 18*60
  g = subOut(g, 'my', 'p1', 61000); // accrues 60s
  g = undo(g);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.onCourt, true);
  assert.strictEqual(p.inClock, 18 * 60);
  assert.strictEqual(p.courtSecs, 0);
  assert.strictEqual(g.log[g.log.length - 1].type, 'sub_in');
  // a later sub-out still accounts the full stint from the original sub-in
  g = subOut(g, 'my', 'p1', 121000); // 120s after sub-in
  assert.strictEqual(g.myTeam.players[0].courtSecs, 120);
});

test('fmtMinutes formats seconds to one-decimal minutes', () => {
  assert.strictEqual(fmtMinutes(0), '0.0');
  assert.strictEqual(fmtMinutes(90), '1.5');
  assert.strictEqual(fmtMinutes(undefined), '0.0');
});

const { hasAnyStarter, isFreshPeriodStart, resetToStarters } = app;

test('newGame carries the starter flag onto game players without auto-subbing them in', () => {
  const g = newGame({
    config: { halfLengthMin: 18, numHalves: 2, otLengthMin: 4, myTeamSide: 'home' },
    myTeam: {
      id: 't1',
      name: 'Mine',
      players: [{ id: 'p1', num: 5, name: 'Smith', starter: true }],
    },
    oppTeam: { name: 'Them', players: [{ id: 'o1', num: 9, name: '', starter: false }] },
  });
  assert.strictEqual(g.myTeam.players[0].starter, true);
  assert.strictEqual(g.oppTeam.players[0].starter, false);
  assert.strictEqual(g.myTeam.players[0].onCourt, false);
});

test('hasAnyStarter detects a starter on either team', () => {
  let g = freshGame();
  assert.strictEqual(hasAnyStarter(g), false);
  g.myTeam.players[0].starter = true;
  assert.strictEqual(hasAnyStarter(g), true);
});

test('isFreshPeriodStart is true only when the clock is stopped at the full period length', () => {
  let g = freshGame(); // stopped, remaining = 18*60 (period 1)
  assert.strictEqual(isFreshPeriodStart(g), true);
  g = startClock(g, 1000);
  assert.strictEqual(isFreshPeriodStart(g), false); // running
  g = stopClock(g, 6000); // 5s elapsed, stopped
  assert.strictEqual(isFreshPeriodStart(g), false); // partial time
});

test('isFreshPeriodStart uses the OT length once past regulation periods', () => {
  let g = freshGame();
  g.period = 3; // OT (numHalves = 2)
  g.clock = { remainingSec: 4 * 60, running: false, startedAt: null };
  assert.strictEqual(isFreshPeriodStart(g), true);
  g.clock.remainingSec = 18 * 60; // wrong length for OT
  assert.strictEqual(isFreshPeriodStart(g), false);
});

test('resetToStarters subs in starters and subs out everyone else', () => {
  let g = newGame({
    config: { halfLengthMin: 18, numHalves: 2, otLengthMin: 4, myTeamSide: 'home' },
    myTeam: {
      id: 't1',
      name: 'Mine',
      players: [
        { id: 'p1', num: 1, name: 'A', starter: true },
        { id: 'p2', num: 2, name: 'B', starter: false },
      ],
    },
    oppTeam: { name: 'Them', players: [{ id: 'o1', num: 9, name: '', starter: true }] },
  });
  g = subIn(g, 'my', 'p2', 500); // non-starter mistakenly on court already
  g = resetToStarters(g, 1000);
  assert.strictEqual(g.myTeam.players[0].onCourt, true); // starter now on
  assert.strictEqual(g.myTeam.players[1].onCourt, false); // non-starter subbed back out
  assert.strictEqual(g.oppTeam.players[0].onCourt, true); // opp starter on
});

test('resetToStarters is a no-op when nobody needs to change', () => {
  let g = freshGame();
  const before = resetToStarters(g, 1000);
  assert.deepStrictEqual(before, g);
});

const { addPlayerToGame } = app;

test('addPlayerToGame appends a full-stat player to the named team', () => {
  const g0 = freshGame();
  const g = addPlayerToGame(g0, 'my', { id: 'p9', num: 23, name: 'New' });
  assert.strictEqual(g0.myTeam.players.length, 1); // input not mutated
  assert.strictEqual(g.myTeam.players.length, 2);
  const p = g.myTeam.players[1];
  assert.strictEqual(p.id, 'p9');
  assert.strictEqual(p.num, 23);
  assert.strictEqual(p.name, 'New');
  assert.strictEqual(p.pts, 0);
  assert.strictEqual(p.oreb, 0); // full zeroed stat set
  assert.strictEqual('dreb' in p, true);
  assert.strictEqual(g.oppTeam.players.length, 1); // opponent untouched
});

test('addPlayerToGame can add to the opponent', () => {
  const g = addPlayerToGame(freshGame(), 'opp', { id: 'o9', num: 7, name: '' });
  assert.strictEqual(g.oppTeam.players.length, 2);
  assert.strictEqual(g.oppTeam.players[1].num, 7);
  assert.strictEqual(g.myTeam.players.length, 1);
});

const { editPlayer } = app;

test('editPlayer updates an existing my-team player number and name', () => {
  const g0 = freshGame();
  const g = editPlayer(g0, 'my', 'p1', { num: 34, name: 'Jones' });
  assert.strictEqual(g0.myTeam.players[0].num, 5); // input not mutated
  assert.strictEqual(g.myTeam.players[0].num, 34);
  assert.strictEqual(g.myTeam.players[0].name, 'Jones');
});

test('editPlayer updates an existing opponent player', () => {
  const g = editPlayer(freshGame(), 'opp', 'o1', { num: 12, name: 'Doe' });
  assert.strictEqual(g.oppTeam.players[0].num, 12);
  assert.strictEqual(g.oppTeam.players[0].name, 'Doe');
});

test('editPlayer is a no-op for an unknown id', () => {
  const g0 = freshGame();
  const g = editPlayer(g0, 'my', 'nope', { num: 99, name: 'Ghost' });
  assert.strictEqual(g, g0); // unchanged input returned as-is
});

test('court time accrues across a half boundary', () => {
  let g = startClock(freshGame(), 1000); // P1 running, remaining 18*60
  g = subIn(g, 'my', 'p1', 1000); // inClock 18*60
  g = endHalf(g, 481000); // 480s elapsed → close at 18*60-480; reopen at P2 full
  assert.strictEqual(g.myTeam.players[0].courtSecs, 480);
  assert.strictEqual(g.period, 2);
  assert.strictEqual(g.myTeam.players[0].onCourt, true);
  assert.strictEqual(g.myTeam.players[0].inClock, 18 * 60); // reopened at new full clock
  g = startClock(g, 500000); // P2 running
  g = subOut(g, 'my', 'p1', 560000); // 60s in P2
  assert.strictEqual(g.myTeam.players[0].courtSecs, 540); // 480 + 60
});

test('endGame closes the final on-court interval', () => {
  let g = startClock(freshGame(), 1000);
  g = subIn(g, 'my', 'p1', 1000);
  g = endGame(g, 121000); // 120s elapsed
  assert.strictEqual(g.screen, 'summary');
  assert.strictEqual(g.myTeam.players[0].courtSecs, 120);
});

// ===== playerEff =====
const { playerEff } = app;

test('playerEff computes efficiency from a mixed stat line', () => {
  // reb=5; missFG=(9+3)-(4+1)=7; missFT=4-2=2; eff = 10+5+2+1+1 -7 -2 -5 = 5
  const p = {
    pts: 10,
    fgm: 4,
    fga: 9,
    tpm: 1,
    tpa: 3,
    ftm: 2,
    fta: 4,
    oreb: 2,
    dreb: 3,
    stl: 1,
    blk: 1,
    ast: 2,
    to: 5,
  };
  assert.strictEqual(playerEff(p), 5);
});

test('playerEff can be negative', () => {
  // missFG=5, missFT=2, to=3 → 0 - 5 - 2 - 3 = -10
  const p = {
    pts: 0,
    fgm: 0,
    fga: 5,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 2,
    oreb: 0,
    dreb: 0,
    stl: 0,
    blk: 0,
    ast: 0,
    to: 3,
  };
  assert.strictEqual(playerEff(p), -10);
});

// ===== buildSummaryText =====
const { buildSummaryText } = app;

function summaryFixtureGame() {
  const g = newGame({
    config: { halfLengthMin: 18, numHalves: 2, otLengthMin: 4, myTeamSide: 'home' },
    myTeam: { id: 't1', name: 'Hawks', players: [{ id: 'p1', num: 5, name: 'Smith' }] },
    oppTeam: { name: 'Eagles', players: [{ id: 'o1', num: 9, name: 'Jones' }] },
  });
  Object.assign(g.myTeam.players[0], {
    pts: 10,
    fgm: 4,
    fga: 8,
    tpm: 1,
    tpa: 2,
    ftm: 1,
    fta: 2,
    oreb: 2,
    dreb: 3,
    stl: 1,
    blk: 0,
    ast: 2,
    to: 1,
    pf: 2,
    courtSecs: 600,
  });
  Object.assign(g.oppTeam.players[0], {
    pts: 8,
    fgm: 3,
    fga: 7,
    tpm: 0,
    tpa: 1,
    ftm: 2,
    fta: 2,
    oreb: 1,
    dreb: 4,
    stl: 0,
    blk: 1,
    ast: 1,
    to: 2,
    pf: 3,
    courtSecs: 540,
  });
  g.score = { my: 10, opp: 8 };
  g.periodScores = [{ my: 10, opp: 8 }];
  g.log = [{ clockText: '5:30', period: 1, detail: 'Smith made 2PT' }];
  return g;
}

test('buildSummaryText produces the full plain-text game summary', () => {
  const g = summaryFixtureGame();
  const deltas = g.periodScores.map((ps, i) => ({
    my: i === 0 ? ps.my : ps.my - g.periodScores[i - 1].my,
    opp: i === 0 ? ps.opp : ps.opp - g.periodScores[i - 1].opp,
  }));
  const text = buildSummaryText(g, 'my', 'opp', deltas);
  const expected = [
    'Hawks vs Eagles',
    '',
    'FINAL: Hawks 10 – 8 Eagles',
    '',
    'Scoring by period',
    'P1 Total',
    'Hawks: 10 10',
    'Eagles: 8 8',
    '',
    'Hawks box score',
    '#5 Smith: 10 PTS, 5/10 FG, 1/2 3PT, 1/2 FT, 2 OREB, 3 DREB, 5 REB, 1 STL, 0 BLK, 2 AST, 1 TO, 2 FLS, 10.0 MIN, 11 EFF',
    'TOTAL: 10 PTS, 5/10 FG, 1/2 3PT, 1/2 FT, 2 OREB, 3 DREB, 5 REB, 1 STL, 0 BLK, 2 AST, 1 TO, 2 FLS, 10.0 MIN, 11 EFF',
    '',
    'Eagles box score',
    '#9 Jones: 8 PTS, 3/8 FG, 0/1 3PT, 2/2 FT, 1 OREB, 4 DREB, 5 REB, 0 STL, 1 BLK, 1 AST, 2 TO, 3 FLS, 9.0 MIN, 8 EFF',
    'TOTAL: 8 PTS, 3/8 FG, 0/1 3PT, 2/2 FT, 1 OREB, 4 DREB, 5 REB, 0 STL, 1 BLK, 1 AST, 2 TO, 3 FLS, 9.0 MIN, 8 EFF',
    '',
    'Game log',
    '5:30 P1 – Smith made 2PT',
  ].join('\n');
  assert.strictEqual(text, expected);
});

function multiPlayerSummaryFixtureGame() {
  const g = newGame({
    config: { halfLengthMin: 18, numHalves: 2, otLengthMin: 4, myTeamSide: 'home' },
    myTeam: {
      id: 't1',
      name: 'Hawks',
      players: [
        { id: 'p1', num: 7, name: 'Adams' },
        { id: 'p2', num: 3, name: 'Baker' },
      ],
    },
    oppTeam: { name: 'Eagles', players: [{ id: 'o1', num: 9, name: 'Jones' }] },
  });
  Object.assign(g.myTeam.players[0], {
    pts: 6,
    fgm: 3,
    fga: 6,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    oreb: 1,
    dreb: 2,
    stl: 0,
    blk: 0,
    ast: 1,
    to: 0,
    pf: 1,
    courtSecs: 300,
  });
  Object.assign(g.myTeam.players[1], {
    pts: 4,
    fgm: 2,
    fga: 4,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 1,
    stl: 1,
    blk: 0,
    ast: 0,
    to: 1,
    pf: 0,
    courtSecs: 300,
  });
  Object.assign(g.oppTeam.players[0], {
    pts: 8,
    fgm: 3,
    fga: 7,
    tpm: 0,
    tpa: 1,
    ftm: 2,
    fta: 2,
    oreb: 1,
    dreb: 4,
    stl: 0,
    blk: 1,
    ast: 1,
    to: 2,
    pf: 3,
    courtSecs: 540,
  });
  g.score = { my: 10, opp: 8 };
  g.periodScores = [{ my: 10, opp: 8 }];
  g.log = [{ clockText: '5:30', period: 1, detail: 'Smith made 2PT' }];
  return g;
}

test('buildSummaryText sorts players by number and sums box-score totals across multiple players', () => {
  const g = multiPlayerSummaryFixtureGame();
  const deltas = g.periodScores.map((ps, i) => ({
    my: i === 0 ? ps.my : ps.my - g.periodScores[i - 1].my,
    opp: i === 0 ? ps.opp : ps.opp - g.periodScores[i - 1].opp,
  }));
  const text = buildSummaryText(g, 'my', 'opp', deltas);
  const expected = [
    'Hawks vs Eagles',
    '',
    'FINAL: Hawks 10 – 8 Eagles',
    '',
    'Scoring by period',
    'P1 Total',
    'Hawks: 10 10',
    'Eagles: 8 8',
    '',
    'Hawks box score',
    '#3 Baker: 4 PTS, 2/4 FG, 0/0 3PT, 0/0 FT, 0 OREB, 1 DREB, 1 REB, 1 STL, 0 BLK, 0 AST, 1 TO, 0 FLS, 5.0 MIN, 3 EFF',
    '#7 Adams: 6 PTS, 3/6 FG, 0/0 3PT, 0/0 FT, 1 OREB, 2 DREB, 3 REB, 0 STL, 0 BLK, 1 AST, 0 TO, 1 FLS, 5.0 MIN, 7 EFF',
    'TOTAL: 10 PTS, 5/10 FG, 0/0 3PT, 0/0 FT, 1 OREB, 3 DREB, 4 REB, 1 STL, 0 BLK, 1 AST, 1 TO, 1 FLS, 10.0 MIN, 10 EFF',
    '',
    'Eagles box score',
    '#9 Jones: 8 PTS, 3/8 FG, 0/1 3PT, 2/2 FT, 1 OREB, 4 DREB, 5 REB, 0 STL, 1 BLK, 1 AST, 2 TO, 3 FLS, 9.0 MIN, 8 EFF',
    'TOTAL: 8 PTS, 3/8 FG, 0/1 3PT, 2/2 FT, 1 OREB, 4 DREB, 5 REB, 0 STL, 1 BLK, 1 AST, 2 TO, 3 FLS, 9.0 MIN, 8 EFF',
    '',
    'Game log',
    '5:30 P1 – Smith made 2PT',
  ].join('\n');
  assert.strictEqual(text, expected);
});

const { buildBackup } = app;

test('buildBackup wraps state with app marker, version, timestamp, and deep copies', () => {
  const st = {
    teams: [{ id: 't1', name: 'Mine', players: [{ id: 'p1', num: 5, name: 'Smith' }] }],
    history: [],
    game: null,
  };
  const b = buildBackup(st, 1750000000000);
  assert.strictEqual(b.app, 'hoopscore');
  assert.strictEqual(b.formatVersion, 1);
  assert.strictEqual(b.exportedAt, new Date(1750000000000).toISOString());
  assert.deepStrictEqual(b.teams, st.teams);
  assert.deepStrictEqual(b.history, []);
  assert.strictEqual(b.game, null);
  b.teams[0].name = 'Changed'; // must not leak back into state
  assert.strictEqual(st.teams[0].name, 'Mine');
});

test('buildBackup includes an in-progress game when present', () => {
  const g = freshGame();
  const b = buildBackup({ teams: [], history: [], game: g }, 2000);
  assert.deepStrictEqual(b.game, g);
  assert.notStrictEqual(b.game, g); // copy, not the same reference
});

const { validateBackup } = app;

test('validateBackup rejects non-backups, bad shapes, and newer versions', () => {
  for (const bad of [null, 42, 'x', {}, { app: 'other' }]) {
    const r = validateBackup(bad);
    assert.strictEqual(r.ok, false);
    assert.match(r.reason, /Not a HoopScore backup/);
  }
  const newer = validateBackup({ app: 'hoopscore', formatVersion: 2 });
  assert.strictEqual(newer.ok, false);
  assert.match(newer.reason, /newer version/);
  assert.strictEqual(validateBackup({ app: 'hoopscore', teams: 'nope' }).ok, false);
  assert.strictEqual(validateBackup({ app: 'hoopscore', history: {} }).ok, false);
});

test('validateBackup defaults missing fields and migrates legacy games', () => {
  const v = validateBackup({ app: 'hoopscore', formatVersion: 1 });
  assert.strictEqual(v.ok, true);
  assert.deepStrictEqual(v.backup.teams, []);
  assert.deepStrictEqual(v.backup.history, []);
  assert.strictEqual(v.backup.game, null);

  const legacy = clone(freshGame());
  legacy.myTeam.players[0].reb = 3; // legacy single-rebound field
  const v2 = validateBackup({
    app: 'hoopscore',
    formatVersion: 1,
    history: [legacy],
    game: clone(legacy),
  });
  assert.strictEqual(v2.ok, true);
  assert.strictEqual(v2.backup.history[0].myTeam.players[0].dreb, 3);
  assert.strictEqual('reb' in v2.backup.history[0].myTeam.players[0], false);
  assert.strictEqual(v2.backup.game.myTeam.players[0].dreb, 3);
});

const { mergeBackup } = app;

test('export/import round-trip: backup restores an empty browser exactly', () => {
  const team = { id: 't1', name: 'Mine', players: [{ id: 'p1', num: 5, name: 'Smith' }] };
  const done = endGame(startClock(freshGame(), 1000), 61000);
  const src = { teams: [team], history: [done], game: null };
  const parsed = deserialize(serialize(buildBackup(src, 99000)));
  const v = validateBackup(parsed);
  assert.strictEqual(v.ok, true);
  const { state: merged, summary } = mergeBackup({ teams: [], history: [], game: null }, v.backup);
  assert.deepStrictEqual(merged.teams, src.teams);
  assert.deepStrictEqual(merged.history, src.history);
  assert.strictEqual(merged.game, null);
  assert.deepStrictEqual(summary, {
    teamsAdded: 1,
    teamsUpdated: 0,
    gamesAdded: 1,
    gamesUpdated: 0,
    gameRestored: false,
    gameSkipped: false,
  });
});

test('mergeBackup upserts by id: file wins on conflict, nothing local deleted', () => {
  const local = {
    teams: [
      { id: 't1', name: 'Old Name', players: [] },
      { id: 't2', name: 'Local Only', players: [] },
    ],
    history: [
      { id: 'g1', tag: 'local' },
      { id: 'g2', tag: 'local-only' },
    ],
    game: null,
  };
  const backup = {
    teams: [
      { id: 't1', name: 'New Name', players: [] },
      { id: 't3', name: 'File Only', players: [] },
    ],
    history: [
      { id: 'g1', tag: 'file' },
      { id: 'g3', tag: 'file-only' },
    ],
    game: null,
  };
  const { state: merged, summary } = mergeBackup(local, backup);
  assert.strictEqual(merged.teams.length, 3);
  assert.strictEqual(merged.teams.find((t) => t.id === 't1').name, 'New Name');
  assert.strictEqual(merged.teams.find((t) => t.id === 't2').name, 'Local Only');
  assert.strictEqual(merged.history.length, 3);
  assert.strictEqual(merged.history.find((g) => g.id === 'g1').tag, 'file');
  assert.deepStrictEqual(summary, {
    teamsAdded: 1,
    teamsUpdated: 1,
    gamesAdded: 1,
    gamesUpdated: 1,
    gameRestored: false,
    gameSkipped: false,
  });
  assert.strictEqual(local.teams.length, 2); // input state not mutated
  assert.strictEqual(local.history.length, 2);
});

test('mergeBackup never clobbers a live local game, restores otherwise', () => {
  const fileGame = freshGame(); // screen: 'game' → resumable
  // no local game → restored
  let r = mergeBackup(
    { teams: [], history: [], game: null },
    { teams: [], history: [], game: fileGame },
  );
  assert.deepStrictEqual(r.state.game, fileGame);
  assert.strictEqual(r.summary.gameRestored, true);
  assert.strictEqual(r.summary.gameSkipped, false);
  // local live game → file's game skipped, local kept
  const liveLocal = freshGame();
  r = mergeBackup(
    { teams: [], history: [], game: liveLocal },
    { teams: [], history: [], game: fileGame },
  );
  assert.strictEqual(r.state.game, liveLocal);
  assert.strictEqual(r.summary.gameRestored, false);
  assert.strictEqual(r.summary.gameSkipped, true);
  // local game exists but is on the summary screen (not resumable) → file wins
  const finished = endGame(freshGame(), 1000);
  r = mergeBackup(
    { teams: [], history: [], game: finished },
    { teams: [], history: [], game: fileGame },
  );
  assert.deepStrictEqual(r.state.game, fileGame);
  assert.strictEqual(r.summary.gameRestored, true);
  // backup has no game → local untouched either way
  r = mergeBackup(
    { teams: [], history: [], game: liveLocal },
    { teams: [], history: [], game: null },
  );
  assert.strictEqual(r.state.game, liveLocal);
  assert.strictEqual(r.summary.gameSkipped, false);
});

test('validateBackup drops corrupted non-object entries and primitive game', () => {
  const v = validateBackup({
    app: 'hoopscore',
    formatVersion: 1,
    teams: [null, { id: 't1', name: 'Mine', players: [] }, 7],
    history: [null, 'junk', { id: 'g1' }],
    game: 42,
  });
  assert.strictEqual(v.ok, true);
  assert.deepStrictEqual(v.backup.teams, [{ id: 't1', name: 'Mine', players: [] }]);
  assert.strictEqual(v.backup.history.length, 1);
  assert.strictEqual(v.backup.history[0].id, 'g1');
  assert.strictEqual(v.backup.game, null);
});
