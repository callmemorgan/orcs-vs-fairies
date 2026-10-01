import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

// Native browser driver for the canonical packaged server proof. All account, lobby,
// equipment, and match entry actions use the actual main UI. Main has no surrender
// control: the five losses below use one direct canonical command each, sent over
// the guest page's captured native WebSocket. No callbacks or game state are set.
export async function verifyBrowser({ browser, base, output, protocolVersion, checks, request }) {
  assert(browser && typeof request === 'function');
  assert(Number.isSafeInteger(protocolVersion) && protocolVersion > 0);
  assert(Array.isArray(checks));
  const directory = path.join(output, 'native-browser');
  await mkdir(directory, { recursive: true });
  const contexts = [], pages = [], errors = [], ownChecks = [];
  const summary = { checks: ownChecks, accounts: {}, rankedMatches: [], wireActions: [], thresholds: [], browser: {}, profiles: {} };
  const password = 'native-competition-proof-password';
  const names = { host: `NativeHost_${randomUUID().slice(0, 8)}`, guest: `NativeGuest_${randomUUID().slice(0, 8)}` };
  const equipment = { banner: 'orcs-victory-banner', decoration: 'orcs-honor-seal', portrait: 'orcs-commander' };
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const record = text => { ownChecks.push(text); checks.push(text); console.log(`PASS ${text}`); };
  async function bounded(promise, milliseconds, label) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${milliseconds}ms`)), milliseconds); })]); }
    finally { clearTimeout(timer); }
  }
  async function poll(read, description, timeout = 20000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) { const found = await read(); if (found) return found; await sleep(40); }
    throw new Error(`Timed out waiting for ${description}.`);
  }
  async function enabled(locator) {
    await locator.waitFor({ state: 'visible' });
    await poll(async () => !(await locator.isDisabled()), 'native UI control to be enabled');
  }
  async function uiResponse(page, method, route, action) {
    const pending = page.waitForResponse(response => new URL(response.url()).pathname === route && response.request().method() === method);
    await action();
    const response = await pending;
    return { status: response.status(), data: await response.json() };
  }
  async function get(context, route) {
    const result = await request(context, route);
    assert.equal(result.status, 200, `${route}: ${JSON.stringify(result.data)}`);
    return result.data;
  }
  async function makePage(label) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    contexts.push(context);
    await context.addInitScript(() => {
      const NativeWebSocket = window.WebSocket;
      const proof = { connections: [] };
      window.__nativeCompetitionWire = proof;
      window.WebSocket = class extends NativeWebSocket {
        constructor(url, protocols) {
          if (protocols === undefined) super(url); else super(url, protocols);
          const entry = { socket: this, hello: null, acks: [], errors: [], commands: [] };
          proof.connections.push(entry);
          this.addEventListener('message', event => {
            if (typeof event.data !== 'string') return;
            let value; try { value = JSON.parse(event.data); } catch { return; }
            if (value.kind === 'hello') entry.hello = value;
            if (value.kind === 'commandAck') entry.acks.push(value);
            if (value.kind === 'error') entry.errors.push(value);
          });
          this.__nativeProofEntry = entry;
        }
        send(value) {
          if (typeof value === 'string') {
            let message; try { message = JSON.parse(value); } catch { /* Non-JSON frames pass through unchanged. */ }
            if (message?.kind === 'command') this.__nativeProofEntry.commands.push(message);
          }
          return super.send(value);
        }
      };
    });
    const page = await context.newPage(); pages.push({ label, page });
    page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('.begin-match').waitFor({ state: 'visible' });
    return { context, page };
  }
  async function authenticate(page, label, mode = 'register') {
    await enabled(page.locator('.online-open')); await page.locator('.online-open').click();
    const dialog = page.getByRole('dialog', { name: 'Online play', exact: true });
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByLabel('Online username', { exact: true }).fill(names[label]);
    await dialog.getByLabel('Online password', { exact: true }).fill(password);
    const button = mode === 'register' ? dialog.locator('[data-online="register"]') : dialog.getByRole('button', { name: 'Sign in', exact: true });
    await enabled(button);
    const result = await uiResponse(page, 'POST', `/api/auth/${mode}`, () => button.click());
    assert.equal(result.status, 200);
    assert.equal(result.data.account.username, names[label]);
    await page.waitForFunction(username => document.querySelector('.online-username')?.textContent === username, names[label]);
    await enabled(dialog.getByRole('button', { name: 'Close online play', exact: true }));
    await dialog.getByRole('button', { name: 'Close online play', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    return result.data.account;
  }
  async function openCompetition(page) {
    await enabled(page.locator('.competition-open')); await page.locator('.competition-open').focus(); await page.locator('.competition-open').click();
    const dialog = page.getByRole('dialog', { name: 'Competitions', exact: true });
    await dialog.waitFor({ state: 'visible' });
    await enabled(dialog.getByLabel('Ranked host faction', { exact: true }));
    assert.match(await dialog.locator('.competition-account').innerText(), /Signed in as /);
    return dialog;
  }
  async function refreshCompetition(page) {
    const dialog = page.getByRole('dialog', { name: 'Competitions', exact: true });
    const refresh = dialog.locator('[data-competition="refresh"]');
    await enabled(refresh); await refresh.click(); await enabled(dialog.getByLabel('Ranked host faction', { exact: true }));
    return dialog;
  }
  async function lobbyMutation(page, lobbyId, action) {
    // Readiness revisions change on the other page. Refresh through the native
    // control before every mutation, and retry only the documented 409 path.
    for (let attempt = 0; attempt < 3; attempt++) {
      const dialog = await refreshCompetition(page), button = dialog.locator(`[data-current="${action}"]`);
      await enabled(button);
      const response = await uiResponse(page, 'POST', `/api/lobbies/${lobbyId}/${action}`, () => button.click());
      if (response.status === 409) { await enabled(dialog.getByLabel('Ranked host faction', { exact: true })); continue; }
      assert.equal(response.status, 200, JSON.stringify(response.data));
      return response.data.lobby;
    }
    throw new Error(`Native ${action} did not settle after refreshed lobby revisions.`);
  }
  async function waitMatch(page, matchId, side) {
    await page.waitForFunction(expected => {
      const r = window.rts, wire = window.__nativeCompetitionWire;
      return r?.mode === 'online' && r.online?.status === 'connected' && r.online.side === expected.side &&
        r.viewSide === expected.side && !r.simulationEnabled && r.art.loaded && r.fps > 0 &&
        wire.connections.some(entry => entry.socket.readyState === WebSocket.OPEN && entry.hello?.matchId === expected.matchId && entry.hello.side === expected.side);
    }, { matchId, side }, { timeout: 60000 });
    await page.locator('.competition-overlay').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#game-canvas > canvas').count(), 1);
    return page.evaluate(matchId => {
      const row = [...window.__nativeCompetitionWire.connections].reverse().find(entry => entry.hello?.matchId === matchId && entry.socket.readyState === WebSocket.OPEN);
      return { hello: row.hello, mode: window.rts.mode, side: window.rts.viewSide, factions: window.rts.state.players.map(player => player.faction) };
    }, matchId);
  }
  async function createRanked(hostPage, guestPage) {
    const hostDialog = await openCompetition(hostPage);
    await hostDialog.getByLabel('Ranked host faction', { exact: true }).selectOption('orcs');
    await hostDialog.getByLabel('Ranked opponent faction', { exact: true }).selectOption('orcs');
    const create = hostDialog.getByRole('button', { name: 'Create ranked lobby', exact: true }); await enabled(create);
    const response = await uiResponse(hostPage, 'POST', '/api/lobbies', () => create.click());
    assert.equal(response.status, 201); const lobby = response.data.lobby;
    assert(lobby.ranked); assert.deepEqual(lobby.settings.factions, ['orcs', 'orcs']); assert.equal(lobby.settings.startingAge, 1);
    const guestDialog = await openCompetition(guestPage); await refreshCompetition(guestPage);
    const join = guestDialog.locator(`[data-lobby="${lobby.id}"]`); await enabled(join);
    const joined = await uiResponse(guestPage, 'POST', `/api/lobbies/${lobby.id}/join`, () => join.click()); assert.equal(joined.status, 200);
    await lobbyMutation(hostPage, lobby.id, 'ready'); await lobbyMutation(guestPage, lobby.id, 'ready');
    const started = await lobbyMutation(hostPage, lobby.id, 'start'); assert(started.matchId);
    const hostRuntime = await waitMatch(hostPage, started.matchId, 0);
    await refreshCompetition(guestPage);
    const enter = guestDialog.locator('[data-current="play"]'); await enabled(enter); await enter.click();
    const guestRuntime = await waitMatch(guestPage, started.matchId, 1);
    assert.deepEqual(hostRuntime.factions, ['orcs', 'orcs']); assert.deepEqual(guestRuntime.factions, ['orcs', 'orcs']);
    return { lobbyId: lobby.id, matchId: started.matchId, host: hostRuntime, guest: guestRuntime };
  }
  async function surrender(page, matchId) {
    const envelope = await page.evaluate(({ matchId, protocolVersion }) => {
      const entry = [...window.__nativeCompetitionWire.connections].reverse().find(row => row.socket.readyState === WebSocket.OPEN && row.hello?.matchId === matchId);
      if (!entry || entry.hello.role !== 'player' || entry.hello.side !== 1 || entry.hello.protocolVersion !== protocolVersion) throw new Error('Guest has no canonical player connection.');
      if (entry.commands.length) throw new Error('Sequence proof requires no earlier game commands on this connection.');
      const message = { kind: 'command', protocolVersion, clientSeq: entry.hello.lastClientSeq + 1, observedTick: window.rts.state.tick, command: { type: 'surrender' } };
      if (!Number.isSafeInteger(message.observedTick)) throw new Error('The real displayed server tick is unavailable.');
      entry.socket.send(JSON.stringify(message));
      return message;
    }, { matchId, protocolVersion });
    await page.waitForFunction(({ matchId, clientSeq }) => window.__nativeCompetitionWire.connections.some(entry => entry.hello?.matchId === matchId && entry.acks.some(ack => ack.clientSeq === clientSeq)), { matchId, clientSeq: envelope.clientSeq });
    const ack = await page.evaluate(({ matchId, clientSeq }) => window.__nativeCompetitionWire.connections.flatMap(entry => entry.hello?.matchId === matchId ? entry.acks : []).find(row => row.clientSeq === clientSeq), { matchId, clientSeq: envelope.clientSeq });
    assert.equal(ack.accepted, true, JSON.stringify(ack));
    summary.wireActions.push({ matchId, envelope, ack });
  }
  async function inventory(context, accountId) {
    const data = await get(context, '/api/cosmetics'); assert.equal(data.account.id, accountId); return data;
  }
  async function openCosmetics(page) {
    await enabled(page.locator('.cosmetic-open')); await page.locator('.cosmetic-open').focus(); await page.locator('.cosmetic-open').click();
    const dialog = page.getByRole('dialog', { name: 'Cosmetic unlocks', exact: true }); await dialog.waitFor({ state: 'visible' });
    await enabled(dialog.getByRole('button', { name: 'Apply cosmetic choices', exact: true }));
    assert.equal(await dialog.getByLabel('Cosmetic faction', { exact: true }).inputValue(), 'orcs');
    return dialog;
  }
  async function closeCosmetics(page) {
    await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Cosmetic unlocks', exact: true }).waitFor({ state: 'hidden' });
  }
  const readLocal = page => page.evaluate(() => ({ tick: window.rts.state.tick, paused: window.rts.paused, camera: window.rts.camera, selected: window.rts.selected, mode: window.rts.mode }));
  async function restartMatch(page) {
    const overlay = page.locator('.game-overlay');
    await (await overlay.isVisible() ? page.locator('#overlay-restart') : page.locator('#restart-button')).click();
    await page.locator('.begin-match').waitFor({ state: 'visible' });
  }
  async function exportPausedSave(page, label) {
    assert.equal((await readLocal(page)).paused, true);
    await enabled(page.locator('[data-session-tool="saves"]')); await page.locator('[data-session-tool="saves"]').click();
    const dialog = page.getByRole('dialog', { name: 'Session tools', exact: true }); await dialog.waitFor({ state: 'visible' });
    const download = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Export save', exact: true }).click();
    const target = path.join(directory, `${label}.json`); await (await download).saveAs(target);
    const saved = JSON.parse(await readFile(target, 'utf8'));
    await dialog.getByRole('button', { name: 'Close session tools', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    assert.equal((await readLocal(page)).paused, true); return saved;
  }
  async function captureCanvasPhoto(page, label) {
    // Element screenshots include DOM pause cards and their blur. The native
    // Download photo action uses Phaser.renderer.snapshot, so these PNGs contain
    // the real renderer pixels and cannot differ because of a HUD repaint.
    assert.equal((await readLocal(page)).paused, true);
    await enabled(page.locator('[data-session-tool="photo"]')); await page.locator('[data-session-tool="photo"]').click();
    await page.locator('#app.photo-mode').waitFor({ state: 'visible' });
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download photo', exact: true }).click();
    const target = path.join(directory, `${label}.png`); await (await download).saveAs(target);
    await page.getByRole('button', { name: 'Exit photo mode', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#app').classList.contains('photo-mode') && window.rts.paused);
    return readFile(target);
  }
  async function diagnostics(page) {
    return page.evaluate(() => {
      const r = window.rts;
      return { mode: r.mode, side: r.viewSide, players: r.state.players.map((player, side) => ({ side, faction: player.faction })), cosmetics: r.cosmetics,
        decorated: r.cosmetics.buildings.map(id => { const entity = r.state.entities.find(row => row.id === id); return entity ? { id, side: entity.side, kind: entity.kind, hp: entity.hp, progress: entity.progress, faction: r.state.players[entity.side].faction } : { id, missing: true }; }) };
    });
  }
  function checkOwnedSide(value, side, expectBuildings = false) {
    const own = value.cosmetics.players.find(row => row.side === side); assert(own);
    for (const [slot, id] of Object.entries(equipment)) assert.equal(own[slot], id);
    for (const row of value.cosmetics.players) if (row.side !== side) for (const slot of Object.keys(equipment)) assert.equal(row[slot], undefined);
    assert.equal(value.players.find(row => row.side === side).faction, 'orcs');
    if (expectBuildings) assert(value.decorated.length > 0, 'The owner must have a rendered finished building.');
    for (const building of value.decorated) { assert(!building.missing); assert.equal(building.side, side); assert.equal(building.faction, 'orcs'); assert.equal(building.kind, 'building'); assert(building.hp > 0 && building.progress >= 1); }
  }

  async function holdNextRealGet(page, pattern, label) {
    let resolveCaptured, rejectCaptured, resolveGate, rejectFinished, resolveFinished;
    let claimed = false, released = false, nativeRequest;
    const captured = new Promise((resolve, reject) => { resolveCaptured = resolve; rejectCaptured = reject; });
    const gate = new Promise(resolve => { resolveGate = resolve; });
    const finished = new Promise((resolve, reject) => { resolveFinished = resolve; rejectFinished = reject; });
    // A handler error must be visible even if the caller has not awaited release yet.
    finished.catch(() => {});
    const handler = async route => {
      if (claimed || route.request().method() !== 'GET') return route.continue();
      claimed = true; nativeRequest = route.request();
      let response;
      try {
        const requestedAt = Date.now();
        response = await route.fetch({ timeout: 7000 });
        const body = await response.body();
        const data = JSON.parse(body.toString('utf8'));
        resolveCaptured({ label, path: new URL(route.request().url()).pathname, status: response.status(), data, requestedAt, capturedAt: Date.now() });
        const mode = await gate;
        if (mode === 'failed') await route.abort('failed');
        else await route.fulfill({ response });
        resolveFinished({ mode, releasedAt: Date.now() });
      } catch (error) { rejectCaptured(error); rejectFinished(error); }
      finally { await response?.dispose(); }
    };
    await page.route(pattern, handler);
    const capturedDeadline = bounded(captured, 10000, `${label} capture`);
    capturedDeadline.catch(() => {});
    return {
      captured: capturedDeadline,
      async release(mode = 'response') {
        assert(['response', 'failed'].includes(mode));
        const prior = await captured;
        assert(Date.now() - prior.requestedAt < 9000, `${label} exceeded the canonical client's 10-second deadline.`);
        // Fulfillment alone does not prove the page received a delayed response. A
        // timed-out fetch must fail this proof instead of passing as a stale reply.
        const delivered = mode === 'response'
          ? page.waitForResponse(response => response.request() === nativeRequest)
          : page.waitForEvent('requestfailed', { predicate: request => request === nativeRequest });
        released = true; resolveGate(mode);
        const result = await bounded(finished, 10000, `${label} release`);
        const observed = await delivered;
        if (mode === 'response') { assert.equal(observed.status(), prior.status); assert.equal(await observed.finished(), null); }
        await page.unroute(pattern, handler);
        return result;
      },
      async dispose() {
        // Context closure also aborts held requests, but unblock first on assertion
        // failure so the original proof error is preserved rather than timing out.
        if (claimed && !released) { released = true; resolveGate('failed'); await finished.catch(() => {}); }
        await page.unroute(pattern, handler).catch(() => {});
      }
    };
  }

  function hasEquipment(value, equipment) {
    const owner = value.cosmetics.players.find(row => row.side === 0);
    return !!owner && Object.entries(equipment).every(([slot, id]) => owner[slot] === id);
  }
  function isDefault(value) {
    return value.cosmetics.players.every(row => ['banner', 'decoration', 'portrait'].every(slot => row[slot] === undefined));
  }

  // Delay real launch responses while newer native reads and saved choices finish.
  // Finish the guest read before the host clears its public equipment.
  async function verifyHostedRequestOrdering({ host, guest, equipment, createRanked, openCosmetics, closeCosmetics, enabled, uiResponse, diagnostics, sleep, summary, record }) {
    const pattern = /\/api\/matches\/[^/]+\/cosmetics$/;
    const hostGate = await holdNextRealGet(host.page, pattern, 'old hosted success');
    const guestGate = await holdNextRealGet(guest.page, pattern, 'old hosted failure');
    try {
      const sixth = await createRanked(host.page, guest.page);
      const [oldHost, oldGuest] = await Promise.all([hostGate.captured, guestGate.captured]);
      const route = `/api/matches/${sixth.matchId}/cosmetics`;
      for (const captured of [oldHost, oldGuest]) {
        assert.equal(captured.status, 200); assert.equal(captured.path, route);
        assert.deepEqual(captured.data.players.find(row => row.side === 0).loadout, equipment);
      }
      let guestVerifiedResolve;
      const guestVerified = new Promise(resolve => { guestVerifiedResolve = resolve; });
      const [success, failure] = await Promise.all([
        (async () => {
          const dialog = await openCosmetics(host.page); // A newer hosted read completes.
          await guestVerified; // Guest must read equipped server data before defaults.
          for (const slot of Object.keys(equipment)) await dialog.getByLabel(`Cosmetic ${slot}`, { exact: true }).selectOption('');
          const newerRead = host.page.waitForResponse(response => new URL(response.url()).pathname === route && response.request().method() === 'GET');
          const saved = await uiResponse(host.page, 'POST', '/api/cosmetics/equip', () => dialog.getByRole('button', { name: 'Apply cosmetic choices', exact: true }).click());
          assert.equal(saved.status, 200);
          const response = await newerRead, newer = await response.json();
          assert.equal(response.status(), 200);
          assert.deepEqual(newer.players.find(row => row.side === 0).loadout, { banner: null, decoration: null, portrait: null });
          await enabled(dialog.getByRole('button', { name: 'Apply cosmetic choices', exact: true }));
          const beforeRelease = await diagnostics(host.page); assert(isDefault(beforeRelease));
          const released = await hostGate.release('response'); await sleep(300);
          const afterRelease = await diagnostics(host.page); assert(isDefault(afterRelease), 'An older same-connection success restored retired equipment.');
          // Restore through the same native server-receipted equipment UI.
          for (const [slot, id] of Object.entries(equipment)) await dialog.getByLabel(`Cosmetic ${slot}`, { exact: true }).selectOption(id);
          const restored = await uiResponse(host.page, 'POST', '/api/cosmetics/equip', () => dialog.getByRole('button', { name: 'Apply cosmetic choices', exact: true }).click());
          assert.equal(restored.status, 200); assert.deepEqual(restored.data.profile.equipment.orcs.loadout, equipment);
          await enabled(dialog.getByRole('button', { name: 'Apply cosmetic choices', exact: true }));
          assert(hasEquipment(await diagnostics(host.page), equipment)); await closeCosmetics(host.page);
          return { old: oldHost, newer, released, beforeRelease, afterRelease };
        })(),
        (async () => {
          const newerRead = guest.page.waitForResponse(response => new URL(response.url()).pathname === route && response.request().method() === 'GET');
          const dialog = await openCosmetics(guest.page); // A newer hosted read completes.
          const response = await newerRead, newer = await response.json();
          assert.equal(response.status(), 200);
          assert.deepEqual(newer.players.find(row => row.side === 0).loadout, equipment);
          const beforeRelease = await diagnostics(guest.page); assert(hasEquipment(beforeRelease, equipment));
          const released = await guestGate.release('failed'); await sleep(300);
          const afterRelease = await diagnostics(guest.page);
          assert(hasEquipment(afterRelease, equipment), 'An older same-connection failure cleared newer owner equipment.');
          guestVerifiedResolve();
          await closeCosmetics(guest.page);
          return { old: oldGuest, newer, released, beforeRelease, afterRelease };
        })()
      ]);
      summary.browser.hostedRequestOrdering = { success, failure };
      record('older same-match hosted cosmetics success and transport failure cannot overwrite or clear later server-receipted equipment');
      return sixth;
    } finally { await Promise.all([hostGate.dispose(), guestGate.dispose()]); }
  }

  // The next background poll is captured while signed out. Native login finishes
  // before the old anonymous response reaches the application.
  async function verifyStaleSessionAfterLogin({ host, equipment, authenticate, diagnostics, sleep, summary, record }) {
    const gate = await holdNextRealGet(host.page, /\/api\/session$/, 'old anonymous session poll');
    try {
      const old = await gate.captured;
      assert.equal(old.status, 200); assert.equal(old.data.account, null);
      const account = await authenticate(host.page, 'host', 'login');
      await host.page.waitForFunction(expected => {
        const owner = window.rts?.cosmetics.players.find(row => row.side === 0);
        return owner && Object.entries(expected).every(([slot, id]) => owner[slot] === id);
      }, equipment);
      const beforeRelease = await diagnostics(host.page); assert(hasEquipment(beforeRelease, equipment));
      const released = await gate.release('response'); await sleep(500);
      const afterRelease = await diagnostics(host.page);
      assert(hasEquipment(afterRelease, equipment), 'A pre-login session poll cleared the newer authenticated account equipment.');
      assert.equal(await host.page.locator('.cosmetic-banner').getAttribute('data-cosmetic'), equipment.banner);
      assert.equal(await host.page.locator('#banner-portrait').getAttribute('alt'), 'Ironclad commander portrait');
      summary.browser.staleSession = { old, account, released, beforeRelease, afterRelease };
      record('a real anonymous session response delayed until after native login cannot replace the current identity or local equipment');
      return account;
    } finally { await gate.dispose(); }
  }


  let retainedCookies;
  try {
    const host = await makePage('host'), guest = await makePage('guest');
    summary.accounts.host = await authenticate(host.page, 'host'); summary.accounts.guest = await authenticate(guest.page, 'guest');
    for (const actor of [host, guest]) {
      assert(await actor.page.evaluate(() => {
        const launchers = ['.online-open', '.competition-open', '.cosmetic-open'].map(selector => document.querySelector(selector));
        return launchers.every(node => node?.parentElement === document.querySelector('.session-toolbar'));
      }));
    }
    assert.equal((await inventory(host.context, summary.accounts.host.id)).profile.wins.orcs ?? 0, 0);
    assert.equal((await inventory(guest.context, summary.accounts.guest.id)).profile.wins.orcs ?? 0, 0);
    record('two accounts register through actual Online UI and all native launchers share the session toolbar');

    await host.page.locator('.begin-match').click(); await host.page.waitForFunction(() => window.rts?.mode === 'local' && window.rts.state.tick > 0 && window.rts.art.loaded);
    for (const kind of ['competition', 'cosmetic']) {
      const dialog = kind === 'competition' ? await openCompetition(host.page) : await openCosmetics(host.page);
      assert(await dialog.evaluate(node => node === document.activeElement)); assert.equal(await host.page.locator(`.${kind}-open`).getAttribute('aria-expanded'), 'true');
      const frozen = await readLocal(host.page); assert(frozen.paused);
      await host.page.keyboard.press('Shift+Tab'); assert(await dialog.getByRole('button', { name: kind === 'competition' ? 'Start or resume daily challenge' : 'Apply cosmetic choices', exact: true }).evaluate(node => node === document.activeElement));
      await host.page.keyboard.press('Tab'); assert(await dialog.locator(`.${kind}-close`).evaluate(node => node === document.activeElement));
      await host.page.keyboard.down('ArrowRight'); await sleep(200); await host.page.keyboard.up('ArrowRight'); await host.page.keyboard.press('p'); assert.deepEqual(await readLocal(host.page), frozen);
      await host.page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); assert(await host.page.locator(`.${kind}-open`).evaluate(node => node === document.activeElement));
      await host.page.waitForFunction(tick => !window.rts.paused && window.rts.state.tick > tick, frozen.tick);
      await host.page.locator('#pause-button').click(); await host.page.waitForFunction(() => window.rts.paused);
      if (kind === 'competition') await openCompetition(host.page); else await openCosmetics(host.page);
      const paused = await readLocal(host.page); await host.page.keyboard.press('Escape'); await sleep(150); assert.deepEqual(await readLocal(host.page), paused);
      await host.page.locator('#resume-button').click(); await host.page.waitForFunction(() => !window.rts.paused);
    }
    await host.page.locator('[data-session-tool="saves"]').click(); await host.page.waitForFunction(() => document.querySelector('.competition-open').disabled && document.querySelector('.cosmetic-open').disabled);
    await host.page.getByRole('button', { name: 'Close session tools', exact: true }).click(); await enabled(host.page.locator('.competition-open'));
    await host.page.locator('[data-session-tool="photo"]').click(); await host.page.locator('.competition-open').waitFor({ state: 'hidden' }); await host.page.locator('.cosmetic-open').waitFor({ state: 'hidden' }); await host.page.locator('.online-open').waitFor({ state: 'hidden' });
    await host.page.keyboard.press('Escape'); await host.page.locator('.competition-open').waitFor({ state: 'visible' }); await host.page.locator('.cosmetic-open').waitFor({ state: 'visible' });
    record('competition and cosmetics modal focus, Escape, blocked input, both local pause states, shared modal blocking, and photo visibility work in main');

    for (let wins = 1; wins <= 5; wins++) {
      const match = await createRanked(host.page, guest.page); summary.rankedMatches.push(match);
      await surrender(guest.page, match.matchId);
      const result = await poll(async () => {
        const value = await get(host.context, `/api/competitions/results/${match.matchId}`); return value.finished ? value : null;
      }, `ranked match ${wins} durable finish`);
      assert.equal(result.failed, false); assert.equal(result.result.winner, summary.accounts.host.id);
      const hostInventory = await inventory(host.context, summary.accounts.host.id), guestInventory = await inventory(guest.context, summary.accounts.guest.id);
      assert.equal(hostInventory.profile.wins.orcs, wins); assert.equal(guestInventory.profile.wins.orcs ?? 0, 0);
      const earned = hostInventory.catalog.filter(item => item.factionId === 'orcs' && item.requiresWins <= wins).map(item => item.id).sort();
      assert.deepEqual([...hostInventory.profile.owned].sort(), earned); assert.deepEqual(guestInventory.profile.owned, []);
      const hostDialog = await openCosmetics(host.page); assert.match(await hostDialog.locator('.cosmetic-wins').innerText(), new RegExp(`: ${wins} faction victor`));
      assert.equal(await hostDialog.locator('.cosmetic-card:not(.cosmetic-locked)').count(), earned.length);
      const optionEvidence = await hostDialog.locator('.cosmetic-slots').evaluate(root => Array.from(root.querySelectorAll('option')).map(node => ({ value: node.value, disabled: node.disabled, matchesDisabled: node.matches(':disabled'), attribute: node.getAttribute('disabled'), html: node.outerHTML })));
      summary.optionEvidence ??= []; summary.optionEvidence.push({ wins, options: optionEvidence });
      for (const item of hostInventory.catalog.filter(item => item.factionId === 'orcs')) {
        const select = hostDialog.getByLabel(`Cosmetic ${item.slot}`, { exact: true });
        const option = select.locator(`option[value="${item.id}"]`), locked = item.requiresWins > wins;
        // Playwright isDisabled retargets an option inside a label to the label's
        // enabled select. Inspect Chromium's option state and exercise selection.
        assert.equal(await option.evaluate(node => node.disabled), locked, `Locked ${item.id} after ${wins} wins: ${JSON.stringify(optionEvidence)}`);
        assert.equal(await option.evaluate(node => node.matches(':disabled')), locked, `Browser disabled state for ${item.id} after ${wins} wins`);
        await select.focus(); await host.page.keyboard.press('Home'); await host.page.keyboard.press('End');
        assert.equal(await select.inputValue(), locked ? '' : item.id, `Native keyboard selection for ${item.id} after ${wins} wins`);
        await host.page.keyboard.press('Home'); assert.equal(await select.inputValue(), '');
      }
      if ([1, 3, 5].includes(wins)) await host.page.screenshot({ path: path.join(directory, `native-unlocks-${wins}.png`) });
      await closeCosmetics(host.page);
      const guestDialog = await openCosmetics(guest.page); assert.equal(await guestDialog.locator('.cosmetic-card:not(.cosmetic-locked)').count(), 0); await closeCosmetics(guest.page);
      summary.thresholds.push({ wins, earned, guestWins: guestInventory.profile.wins.orcs ?? 0, result: result.result });
    }
    record('five native same-faction ranked matches finish through accepted guest surrender commands and unlock host cosmetics at 1, 3, and 5 wins; guest earns none');

    await restartMatch(host.page);
    await host.page.locator('.begin-match').click(); await host.page.waitForFunction(() => window.rts?.mode === 'local' && window.rts.art.loaded && window.rts.state.tick > 0);
    await host.page.locator('#pause-button').click(); await host.page.waitForFunction(() => window.rts.paused);
    const beforeSave = await exportPausedSave(host.page, 'native-local-before-equipment');
    assert(await host.page.evaluate(() => { const descriptor = Object.getOwnPropertyDescriptor(window, 'rts'); return typeof descriptor?.get === 'function' && descriptor.set === undefined; }));
    const beforeDiagnostics = await diagnostics(host.page); assert.equal(beforeDiagnostics.cosmetics.buildings.length, 0);
    const before = await captureCanvasPhoto(host.page, 'native-canvas-before-equipment');
    const cosmeticDialog = await openCosmetics(host.page);
    for (const [slot, id] of Object.entries(equipment)) await cosmeticDialog.getByLabel(`Cosmetic ${slot}`, { exact: true }).selectOption(id);
    const applied = await uiResponse(host.page, 'POST', '/api/cosmetics/equip', () => cosmeticDialog.getByRole('button', { name: 'Apply cosmetic choices', exact: true }).click());
    assert.equal(applied.status, 200); assert.deepEqual(applied.data.profile.equipment.orcs.loadout, equipment);
    await host.page.waitForFunction(() => document.querySelector('.cosmetic-message')?.textContent === 'Cosmetic choices saved and applied.'); await closeCosmetics(host.page);
    await host.page.waitForFunction(expected => {
      const rows = window.rts?.cosmetics.players ?? [], own = rows.find(row => row.side === 0);
      return own && Object.entries(expected).every(([slot, id]) => own[slot] === id) && window.rts.cosmetics.buildings.length > 0;
    }, equipment);
    await sleep(250); // Cross at least two normal 100 ms HUD refreshes.
    const portrait = host.page.locator('#banner-portrait'); assert.equal(await portrait.getAttribute('alt'), 'Ironclad commander portrait'); assert.match(await portrait.getAttribute('src'), /^data:image\/svg\+xml/);
    assert.equal(await host.page.locator('.cosmetic-banner').getAttribute('data-cosmetic'), equipment.banner);
    const after = await captureCanvasPhoto(host.page, 'native-canvas-after-equipment');
    const afterSave = await exportPausedSave(host.page, 'native-local-after-equipment'); assert.deepEqual(afterSave.game, beforeSave.game, 'Equipment must leave full saved state and private simulation runtime unchanged.');
    const appliedDiagnostics = await diagnostics(host.page); checkOwnedSide(appliedDiagnostics, 0, true);
    const changed = await host.page.evaluate(async ({ before, after }) => {
      async function decode(encoded) {
        const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0)), bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
        return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
      }
      const left = await decode(before), right = await decode(after); if (left.width !== right.width || left.height !== right.height) throw new Error('Canvas dimensions changed during equipment proof.');
      let pixels = 0; for (let at = 0; at < left.data.length; at += 4) if ([0, 1, 2, 3].some(offset => left.data[at + offset] !== right.data[at + offset])) pixels++;
      return { width: left.width, height: left.height, pixels };
    }, { before: before.toString('base64'), after: after.toString('base64') });
    assert(changed.pixels > 0); assert.notEqual(hash(before), hash(after));
    summary.browser.equipment = { beforePngSha256: hash(before), afterPngSha256: hash(after), changedPixels: changed, beforeGameSha256: hash(JSON.stringify(beforeSave.game)), afterGameSha256: hash(JSON.stringify(afterSave.game)), diagnostics: appliedDiagnostics, portraitAlt: await portrait.getAttribute('alt') };
    await host.page.locator('#resume-button').click(); await host.page.waitForFunction(() => !window.rts.paused);
    await host.page.screenshot({ path: path.join(directory, 'native-main-cosmetics-applied.png') });
    record('native equipment changes actual Phaser canvas pixels and persistent HUD portrait while full paused save state and private runtime remain unchanged');

    const sixth = await verifyHostedRequestOrdering({ host, guest, equipment, createRanked, openCosmetics, closeCosmetics, enabled, uiResponse, diagnostics, sleep, summary, record }); summary.sixthMatchId = sixth.matchId;
    for (const actor of [host, guest]) await actor.page.waitForFunction(expected => {
      const owner = window.rts?.cosmetics.players.find(row => row.side === 0), other = window.rts?.cosmetics.players.find(row => row.side === 1);
      return owner && Object.entries(expected).every(([slot, id]) => owner[slot] === id) && other && ['banner', 'decoration', 'portrait'].every(slot => other[slot] === undefined);
    }, equipment);
    const hostHosted = await diagnostics(host.page), guestHosted = await diagnostics(guest.page); checkOwnedSide(hostHosted, 0, true); checkOwnedSide(guestHosted, 0);
    assert.equal(hostHosted.side, 0); assert.equal(guestHosted.side, 1); assert.deepEqual(hostHosted.players.map(row => row.faction), ['orcs', 'orcs']);
    const serverLoadouts = await get(host.context, `/api/matches/${sixth.matchId}/cosmetics`);
    assert.deepEqual(serverLoadouts.players.find(row => row.side === 0).loadout, equipment);
    assert.deepEqual(serverLoadouts.players.find(row => row.side === 1).loadout, { banner: null, decoration: null, portrait: null });
    summary.browser.hostedCosmetics = { host: hostHosted, guest: guestHosted, server: serverLoadouts };
    await host.page.screenshot({ path: path.join(directory, 'native-ranked-host-side-0.png') }); await guest.page.screenshot({ path: path.join(directory, 'native-ranked-guest-side-1.png') });
    for (const [actor, side] of [[host, 0], [guest, 1]]) {
      await actor.page.reload({ waitUntil: 'networkidle' }); await actor.page.locator('.begin-match').waitFor({ state: 'visible' });
      const dialog = await openCompetition(actor.page), rejoin = dialog.locator(`[data-rejoin="${sixth.matchId}"]`); await enabled(rejoin); await rejoin.click();
      await waitMatch(actor.page, sixth.matchId, side);
      await actor.page.waitForFunction(id => window.rts?.cosmetics.players.find(row => row.side === 0)?.portrait === id, equipment.portrait);
      checkOwnedSide(await diagnostics(actor.page), 0, side === 0);
    }
    record('sixth live same-faction ranked match maps host equipment only to owner side 0 on both views and both accounts rejoin the same server match after reload');

    const challenge = await get(host.context, '/api/challenges/daily'); const dailyDialog = await openCompetition(host.page);
    const daily = await uiResponse(host.page, 'POST', '/api/challenges/daily/start', () => dailyDialog.getByRole('button', { name: 'Start or resume daily challenge', exact: true }).click()); assert.equal(daily.status, 201);
    assert.deepEqual(daily.data.challenge, challenge.challenge); assert(daily.data.lobby.matchId); assert.equal(daily.data.lobby.dailyDate, challenge.challenge.date);
    await waitMatch(host.page, daily.data.lobby.matchId, 0);
    await host.page.reload({ waitUntil: 'networkidle' }); await host.page.locator('.begin-match').waitFor({ state: 'visible' });
    const resumedDialog = await openCompetition(host.page), resumed = await uiResponse(host.page, 'POST', '/api/challenges/daily/start', () => resumedDialog.getByRole('button', { name: 'Start or resume daily challenge', exact: true }).click()); assert.equal(resumed.status, 200);
    assert.equal(resumed.data.lobby.matchId, daily.data.lobby.matchId); assert.deepEqual(resumed.data.challenge, challenge.challenge);
    await waitMatch(host.page, daily.data.lobby.matchId, 0); summary.daily = { matchId: daily.data.lobby.matchId, challenge: challenge.challenge, resumedMatchId: resumed.data.lobby.matchId };
    await host.page.screenshot({ path: path.join(directory, 'native-daily-rejoined.png') });
    record('native daily entry and reload resume the same authoritative seeded run');

    await restartMatch(host.page); await host.page.locator('.begin-match').click();
    await host.page.waitForFunction(id => window.rts?.mode === 'local' && window.rts.cosmetics.players.find(row => row.side === 0)?.portrait === id, equipment.portrait);
    await host.page.locator('#pause-button').click(); await host.page.waitForFunction(() => window.rts.paused);
    await enabled(host.page.locator('.online-open')); await host.page.locator('.online-open').click();
    const online = host.page.getByRole('dialog', { name: 'Online play', exact: true }), logout = online.locator('[data-online="logout"]'); await enabled(logout);
    const signedOut = await uiResponse(host.page, 'POST', '/api/auth/logout', () => logout.click()); assert.equal(signedOut.status, 200);
    await host.page.waitForFunction(() => window.rts.cosmetics.players.every(row => ['banner', 'decoration', 'portrait'].every(slot => row[slot] === undefined)) && window.rts.cosmetics.buildings.length === 0);
    await online.getByRole('button', { name: 'Close online play', exact: true }).click(); await sleep(250);
    assert.equal(await host.page.locator('#banner-portrait').getAttribute('alt'), ''); assert.match(await host.page.locator('#banner-portrait').getAttribute('src'), /\/assets\/portrait-orcs\.png$/);
    assert.equal(await host.page.locator('.cosmetic-banner').getAttribute('data-cosmetic'), ''); summary.browser.signedOut = await diagnostics(host.page);
    await host.page.screenshot({ path: path.join(directory, 'native-account-logout-clears-cosmetics.png') });
    record('native account logout clears local cosmetic players, building decorations, banner, and HUD portrait');
    // Restore a native signed-in session for the harness's separate restart reads.
    // Cookies are returned in memory only and never written to evidence below.
    await verifyStaleSessionAfterLogin({ host, equipment, authenticate, diagnostics, sleep, summary, record });
    summary.profiles.host = (await inventory(host.context, summary.accounts.host.id)).profile;
    summary.profiles.guest = (await inventory(guest.context, summary.accounts.guest.id)).profile;
    assert.equal(summary.profiles.host.wins.orcs, 5); assert.equal(summary.profiles.guest.wins.orcs ?? 0, 0);
    assert.deepEqual(summary.profiles.host.equipment.orcs.loadout, equipment); assert.deepEqual(summary.profiles.guest.owned, []);
    retainedCookies = { host: await host.context.cookies(), guest: await guest.context.cookies() };
    assert.deepEqual(errors, []);
    summary.passed = true;
    await writeFile(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    await writeFile(path.join(directory, 'ranked-wire-evidence.json.gz'), gzipSync(JSON.stringify(summary.wireActions)));
    return { ...summary, restartCookies: retainedCookies };
  } catch (error) {
    summary.passed = false; summary.errors = [...errors, error.stack ?? String(error)];
    for (const { label, page } of pages) if (!page.isClosed()) await page.screenshot({ path: path.join(directory, `failure-${label}.png`), fullPage: true }).catch(() => {});
    await writeFile(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    throw error;
  } finally {
    const failures = [];
    for (const context of contexts) try { await context.close(); } catch (error) { failures.push(error); }
    if (failures.length) {
      summary.passed = false; summary.errors = [...(summary.errors ?? []), ...failures.map(error => error.stack ?? String(error))];
      await writeFile(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
      throw new AggregateError(failures, 'Native competition contexts did not close.');
    }
  }
}
