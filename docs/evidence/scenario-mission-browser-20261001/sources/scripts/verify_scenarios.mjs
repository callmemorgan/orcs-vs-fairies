import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');

const origin = process.argv[2] ?? 'http://127.0.0.1:5276';
const destination = process.argv[3] ?? 'work/scenarios/browser-proof';
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage(), errors = [], actions = [], checks = {};
page.on('pageerror', error => errors.push(error.message));
const snapshot = () => page.evaluate(() => window.scenarioDiagnostics);
const action = async (description, operation) => { actions.push({ at: new Date().toISOString(), description }); await operation(); };
const actor = (checkpoint, label) => checkpoint.game.state.entities.find(entity => entity.id === checkpoint.runtime.labels[label]);
const screenshot = name => page.screenshot({ path: `${destination}/${name}.png` });
const button = name => page.getByRole('button', { name, exact: true });
const mapClick = async (x, y, mouseButton = 'right') => {
  const { camera } = await snapshot();
  // The demo uses the regular GameScene's one-pixel canvas and default zoom.
  assert.equal(camera.zoom, 1);
  await page.mouse.click(1600 + (x - y) * 32 - camera.x, 80 + (x + y) * 16 - camera.y, { button: mouseButton });
};
const selectArmyUnit = async id => {
  await page.keyboard.press('F2');
  const roster = page.locator(`#selection-roster [data-id="${id}"]`);
  if (await roster.count()) await roster.click();
  else {
    const d = await snapshot(), label = Object.entries(d.checkpoint.runtime.labels).find(([, value]) => value === id)?.[0], point = d.actorScreens[label];
    assert(point); await page.mouse.click(point.x, point.y - 15);
  }
  await page.waitForTimeout(35);
};
async function playDefense() {
  const initial = await snapshot(), original = initial.checkpoint.definition.army.filter(entity => entity.side === 0 && entity.kind === 'unit' && entity.role !== 'worker');
  const center = original.reduce((point, entity) => ({ x: point.x + entity.x / original.length, y: point.y + entity.y / original.length }), { x: 0, y: 0 });
  for (let decision = 0; decision < 180; decision++) {
    let d = await snapshot(); const checkpoint = d.checkpoint, state = checkpoint.game.state;
    if (checkpoint.runtime.outcome !== 'playing') return;
    const visible = new Set(state.visible[0]), troops = state.entities.filter(entity => entity.side === 0 && entity.hp > 0 && entity.kind === 'unit' && entity.role !== 'worker');
    const enemies = state.entities.filter(entity => entity.side === 1 && entity.hp > 0 && visible.has(Math.floor(entity.y) * state.width + Math.floor(entity.x))).sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y));
    const target = enemies[0], fortress = actor(checkpoint, 'fortress');
    if (target) for (const troop of troops) {
      d = await snapshot(); if (d.checkpoint.runtime.outcome !== 'playing') return;
      const current = d.checkpoint.game.state.entities.find(entity => entity.id === troop.id);
      if (!current || current.hp <= 0) continue;
      if (troop.id === checkpoint.runtime.labels.commander && current.hp < current.maxHp * .6) {
        const x = fortress.x + 3, y = fortress.y + 2;
        if (Math.hypot(current.x - x, current.y - y) > .7 && (current.order.type !== 'move' || Math.hypot(current.order.x - x, current.order.y - y) > .65)) {
          await selectArmyUnit(troop.id); await mapClick(x, y);
        }
        continue;
      }
      const range = current.role === 'special' ? 6 + (current.entrenchedAt !== undefined ? 3 : 0) : current.role === 'ranged' ? 6.5 : 1.4;
      if (Math.hypot(current.x - target.x, current.y - target.y) <= range) {
        if (current.entrenchedAt === undefined) { await selectArmyUnit(troop.id); await page.keyboard.press('Q'); }
        continue;
      }
      if (current.order.type !== 'attack' || current.order.target !== target.id) {
        await selectArmyUnit(troop.id); d = await snapshot();
        const label = Object.entries(d.checkpoint.runtime.labels).find(([, id]) => id === target.id)?.[0], point = d.actorScreens[label];
        if (point) await page.mouse.click(point.x, point.y - 15, { button: 'right' });
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error('The defense did not finish within the UI proof duration.');
}

try {
  await page.goto(`${origin}/scenario-demo.html`);
  const options = await page.getByLabel('Practice mission', { exact: true }).locator('option').evaluateAll(nodes => nodes.map(node => ({ id: node.value, text: node.textContent })));
  assert.equal(options.length, 30); assert.equal(new Set(options.map(option => option.id.split('-')[0])).size, 6);
  assert.equal(await button('Start campaign').count(), 6);
  checks.authoredContent = { practiceMissions: 30, factions: 6, campaignCards: 6, ids: options.map(option => option.id) };
  await action('Launch the authored fixed-army dwarf puzzle through the practice picker.', async () => {
    await page.getByLabel('Practice mission', { exact: true }).selectOption('dwarves-1'); await button('Launch practice mission').click();
    await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.id === 'dwarves-1');
  });
  const initial = await snapshot();
  assert.equal(initial.paused, true); assert.equal(initial.checkpoint.game.state.tick, 0); assert.equal(initial.checkpoint.game.state.seed, 7301);
  assert.equal(initial.checkpoint.definition.rules.fixedArmy, true); assert.equal(initial.checkpoint.runtime.reinforcementRemaining, 0);
  assert.deepEqual(initial.checkpoint.definition.rules.resources, { wood: 0, ore: 0, crystal: 0 });
  assert.equal(initial.checkpoint.game.state.entities.filter(entity => entity.side === 0).length, 5);
  assert.equal(initial.checkpoint.game.state.entities.filter(entity => entity.side === 0 && entity.kind === 'building').length, 0);
  assert.equal(initial.art.loaded, true);
  assert.match(await page.locator('.scenario-mechanics').innerText(), /Fixed army; recruitment, construction and research are unavailable/);
  checks.fixedPuzzleStart = { id: initial.id, seed: 7301, tick: 0, resources: initial.checkpoint.definition.rules.resources, army: initial.checkpoint.runtime.labels };
  await screenshot('01-fixed-puzzle-briefing');
  await action('Select the supplied army through Mission controls.', () => button('Select mission army').click());
  assert.deepEqual((await snapshot()).selected, [1, 2, 3, 4, 5]);
  await action('Resume the shared simulation and activate emplacement through the ordinary HUD button.', async () => {
    await button('Return to battle').click(); await button('Emplace / Pack up').click();
  });
  await page.waitForFunction(() => window.scenarioDiagnostics.checkpoint.runtime.commandCounts.ability === 5);
  assert((await snapshot()).commands.some(entry => entry.accepted && entry.command.type === 'ability'));
  await action('Assign and recall a real control group with keyboard input.', async () => {
    await page.keyboard.press('Control+1'); await page.keyboard.press('1');
  });
  assert.equal(await page.getByRole('button', { name: 'Recall group 1', exact: true }).count(), 1);
  assert.deepEqual((await snapshot()).selected, [1, 2, 3, 4, 5]);
  checks.armyAbilityAndControls = true;
  await action('Select the cannon through its HUD roster button, then right-click the firing shelf on the native canvas.', async () => {
    await page.locator('#selection-roster [data-id="2"]').click(); await button('Hide missions').click(); await mapClick(19.5, 18.5);
  });
  const movement = await snapshot(), move = movement.commands.find(entry => entry.accepted && entry.command.type === 'move');
  assert(move); assert.deepEqual(move.command.ids, [2]); assert(Math.hypot(move.command.x - 19.5, move.command.y - 18.5) < .03);
  assert.equal(actor(movement.checkpoint, 'cannon').entrenchedAt, undefined);
  await page.waitForFunction(() => {
    const d = window.scenarioDiagnostics, cannon = d.checkpoint.game.state.entities.find(entity => entity.id === d.checkpoint.runtime.labels.cannon);
    return cannon?.order.type === 'idle';
  }, null, { timeout: 30000 });
  const arrived = await snapshot(); assert(Math.hypot(actor(arrived.checkpoint, 'cannon').x - 19.5, actor(arrived.checkpoint, 'cannon').y - 18.5) < .55);
  assert(actor(arrived.checkpoint, 'cannon').x > actor(initial.checkpoint, 'cannon').x + 12);
  await action('Emplace the cannon at the firing shelf and wait for damage from its real weapon.', () => button('Emplace / Pack up').click());
  await page.waitForFunction(() => {
    const d = window.scenarioDiagnostics, tower = d.checkpoint.game.state.entities.find(entity => entity.id === d.checkpoint.runtime.labels['target-tower']);
    return tower?.hp < tower?.maxHp;
  }, null, { timeout: 25000 });
  await screenshot('02-cannon-firing-shelf');
  await action('Pause with the HUD, open Mission controls, and download a mission checkpoint.', async () => {
    await page.locator('#pause-button').click(); await button('Show missions').click();
  });
  const paused = await snapshot(); assert.equal(paused.paused, true); assert.equal(paused.checkpoint.runtime.outcome, 'playing');
  assert.equal(paused.checkpoint.runtime.commandCounts.ability, 6); assert.equal(paused.checkpoint.runtime.commandCounts.move, 1);
  const downloadPromise = page.waitForEvent('download'); await button('Save mission').click(); const download = await downloadPromise;
  const checkpointPath = `${destination}/mission-checkpoint.json`; await download.saveAs(checkpointPath);
  const saved = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.deepEqual(saved, paused.checkpoint);
  await writeFile(`${destination}/initial-checkpoint.json`, JSON.stringify(initial.checkpoint, null, 2));
  checks.physicalMovementAndWeaponDamage = { initialCannon: actor(initial.checkpoint, 'cannon'), savedCannon: actor(saved, 'cannon'), savedTowerHp: actor(saved, 'target-tower').hp, time: saved.game.state.time };
  await action('Reset the puzzle and compare the complete new checkpoint with the original launch.', async () => {
    await button('Reset mission').click(); await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.launches.length === 2);
  });
  const reset = await snapshot(); assert.equal(reset.paused, true); assert.deepEqual(reset.checkpoint, initial.checkpoint); assert.deepEqual(reset.selected, []);
  checks.exactReset = true;
  await action('Load the downloaded checkpoint through the normal file input.', async () => {
    await page.getByLabel('Import mission checkpoint', { exact: true }).setInputFiles(checkpointPath);
    await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.launches.length === 3);
  });
  const restored = await snapshot(); assert.equal(restored.paused, true); assert.deepEqual(restored.checkpoint, saved);
  checks.exactCheckpointRestore = { tick: saved.game.state.tick, time: saved.game.state.time, variables: saved.runtime.variables, commandCounts: saved.runtime.commandCounts };
  await action('Resume the restored cannon order until the authored objective completes.', async () => { await button('Return to battle').click(); await button('Hide missions').click(); });
  await page.waitForFunction(() => window.scenarioDiagnostics.checkpoint.runtime.outcome !== 'playing', null, { timeout: 60000 });
  const won = await snapshot(); assert.equal(won.checkpoint.runtime.outcome, 'won'); assert.equal(won.checkpoint.game.state.winner, 0);
  assert.deepEqual(won.checkpoint.runtime.completed, ['solution', 'commander']); assert.equal(actor(won.checkpoint, 'target-tower').hp, 0);
  assert(actor(won.checkpoint, 'cannon').hp > 0); assert(actor(won.checkpoint, 'commander').hp > 0); assert(won.checkpoint.game.state.tick > saved.game.state.tick);
  assert.equal(await page.locator('#overlay-title').innerText(), 'Mission complete');
  await writeFile(`${destination}/completed-checkpoint.json`, JSON.stringify(won.checkpoint, null, 2)); await screenshot('03-puzzle-complete');
  checks.restoredObjectiveCompletion = { outcome: 'won', tick: won.checkpoint.game.state.tick, time: won.checkpoint.game.state.time, completed: won.checkpoint.runtime.completed };

  await action('Choose the authored dwarf finale and move the supplied army into the boss sight.', async () => {
    await button('Show missions').click(); await page.locator('.scenario-tools summary').click();
    await page.getByLabel('Practice mission', { exact: true }).selectOption('dwarves-4'); await button('Launch practice mission').click();
    await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.id === 'dwarves-4');
    await button('Select mission army').click(); await button('Return to battle').click(); await button('Hide missions').click(); await mapClick(21, 18);
  });
  await page.waitForFunction(() => window.scenarioDiagnostics.checkpoint.runtime.boss.telegraph !== null, null, { timeout: 30000 });
  await action('Center the army using its visible selection control so the active warning can be inspected.', async () => {
    await button('Show missions').click(); await button('Select mission army').click();
  });
  assert.match(await page.locator('.scenario-mechanics').innerText(), /Warning: move outside the marked circle/);
  await screenshot('04-boss-warning-and-description'); await button('Hide missions').click(); await page.waitForTimeout(80);
  const pixels = await page.evaluate(() => {
    const diagnostics = window.scenarioDiagnostics, warning = diagnostics.warningScreen, canvas = document.querySelector('#game-canvas canvas');
    if (!warning || !canvas) return null;
    const context = canvas.getContext('2d'), red = pixel => pixel[0] > 215 && pixel[1] > 65 && pixel[1] < 155 && pixel[2] > 40 && pixel[2] < 130 && pixel[3] > 240;
    const count = (x, y) => {
      const data = context.getImageData(Math.round(x) - 5, Math.round(y) - 5, 11, 11).data;
      let hits = 0; for (let i = 0; i < data.length; i += 4) if (red(data.slice(i, i + 4))) hits++;
      return hits;
    };
    return { warning: diagnostics.checkpoint.runtime.boss.telegraph, time: diagnostics.checkpoint.game.state.time, screen: warning,
      counts: { left: count(warning.x - warning.width / 2, warning.y), right: count(warning.x + warning.width / 2, warning.y), top: count(warning.x, warning.y - warning.height / 2), bottom: count(warning.x, warning.y + warning.height / 2) } };
  });
  assert(pixels); assert.equal(pixels.warning.interrupted, false); assert(pixels.warning.resolveAt > pixels.time);
  for (const [sector, count] of Object.entries(pixels.counts)) assert(count >= 8, `Active red warning rim missing at ${sector}: ${count} pixels.`);
  checks.activeBossWarningPixels = pixels; await screenshot('05-boss-warning-circle');

  await action('Start the dwarf campaign through its campaign card.', async () => {
    await button('Show missions').click(); await page.locator('.scenario-tools summary').click();
    await page.locator('[data-campaign="campaign-dwarves"]').click();
    await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.campaign?.campaignId === 'campaign-dwarves');
  });
  const campaignInitial = await snapshot(); assert.equal(campaignInitial.id, 'dwarves-1'); assert.equal(campaignInitial.campaign.progress.chapter, 0);
  await action('Solve the campaign first chapter with the same visible army, roster, ability and pointer controls.', async () => {
    await button('Select mission army').click(); await button('Return to battle').click(); await button('Emplace / Pack up').click();
    await page.locator('#selection-roster [data-id="2"]').click(); await button('Hide missions').click(); await mapClick(19.5, 18.5);
  });
  await page.waitForFunction(() => {
    const d = window.scenarioDiagnostics, cannon = d.checkpoint.game.state.entities.find(entity => entity.id === d.checkpoint.runtime.labels.cannon);
    return cannon?.order.type === 'idle';
  }, null, { timeout: 30000 });
  await button('Emplace / Pack up').click();
  await page.waitForFunction(() => window.scenarioDiagnostics.campaign?.progress.chapter === 1, null, { timeout: 60000 });
  const firstChapter = await snapshot(); assert.equal(firstChapter.checkpoint.runtime.outcome, 'won'); assert.equal(firstChapter.campaign.active, null);
  assert.deepEqual(firstChapter.campaign.history[0].survivorIds, [1, 2, 3, 4, 5]);
  await action('Export the verified campaign profile, reload the page, and resume its stored completed chapter.', async () => {
    await button('Show missions').click();
    const event = page.waitForEvent('download'); await button('Save campaign profile').click(); await (await event).saveAs(`${destination}/campaign-chapter-one.json`);
    await page.reload(); await button('Resume saved campaign').click();
    await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.campaign?.progress.chapter === 1);
  });
  const resumedCampaign = await snapshot(); assert.equal(resumedCampaign.campaign.id, campaignInitial.campaign.id); assert.equal(resumedCampaign.id, 'dwarves-1');
  await page.waitForTimeout(250); assert.equal(await button('Continue campaign').isVisible(), true);
  const campaignOne = JSON.parse(await readFile(`${destination}/campaign-chapter-one.json`, 'utf8'));
  assert.equal(campaignOne.history.length, 1); assert.equal(campaignOne.history[0].recording.commands.length, 3);
  assert.equal(campaignOne.history[0].recording.finalTick, firstChapter.checkpoint.game.state.tick);
  checks.verifiedCampaignChapterAndBrowserResume = { profileId: campaignOne.id, missionId: campaignOne.history[0].missionId, commandCount: 3, survived: firstChapter.campaign.history[0].survivorIds };
  await action('Continue to the second chapter and prepare the inherited detachment with the normal ability button.', async () => {
    await button('Continue campaign').click(); await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.id === 'dwarves-2');
    await button('Select mission army').click(); await button('Return to battle').click(); await button('Emplace / Pack up').click(); await button('Hide missions').click();
  });
  const secondChapter = await snapshot(); assert.deepEqual([...secondChapter.campaign.active.deployedIds].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  assert.equal(actor(secondChapter.checkpoint, 'commander').id, 1); assert.equal(actor(secondChapter.checkpoint, 'cannon').id, 2);
  await action('Focus visible waves through roster selection and native attack clicks; move the wounded commander behind the fortress.', playDefense);
  assert.equal((await snapshot()).checkpoint.runtime.outcome, 'won');
  await page.waitForFunction(() => window.scenarioDiagnostics.campaign?.progress.chapter === 2, null, { timeout: 10000 });
  const defense = await snapshot(); assert.equal(defense.checkpoint.runtime.outcome, 'won'); assert(actor(defense.checkpoint, 'fortress').hp > 0); assert(actor(defense.checkpoint, 'commander').hp > 0);
  await action('Read both campaign route choices and choose the northern works through its button.', async () => {
    await button('Show missions').click();
    assert.equal(await page.locator('.scenario-branches [data-choice]').count(), 2);
    await screenshot('06-campaign-route-choices'); await page.locator('[data-choice="works"]').click();
  });
  assert.equal((await snapshot()).campaign.choiceId, 'works');
  const branchDownload = page.waitForEvent('download'); await button('Save campaign profile').click(); await (await branchDownload).saveAs(`${destination}/campaign-branch.json`);
  await action('Import the exported profile through the native file input and continue into its chosen route.', async () => {
    const count = (await snapshot()).launches.length;
    await page.getByLabel('Import campaign profile', { exact: true }).setInputFiles(`${destination}/campaign-branch.json`);
    await page.waitForFunction(count => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.launches.length > count, count);
    await button('Continue campaign').click(); await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.id === 'dwarves-3-alt');
  });
  const route = await snapshot(); assert.equal(route.campaign.progress.chapter, 2); assert.equal(route.campaign.choiceId, 'works'); assert.equal(route.campaign.active.missionId, 'dwarves-3-alt');
  assert.equal(actor(route.checkpoint, 'commander').id, 1);
  assert(defense.commands.some(entry => entry.accepted && entry.command.type === 'attack'));
  assert(defense.commands.some(entry => entry.accepted && entry.command.type === 'move' && entry.command.ids.includes(1)));
  checks.realCampaignDefenseAndBranch = { completed: defense.campaign.progress.completed, defenseTime: defense.checkpoint.game.state.time, fortressHp: actor(defense.checkpoint, 'fortress').hp, commanderHp: actor(defense.checkpoint, 'commander').hp, choice: 'works', nextMission: route.id, inheritedCommanderId: 1, inheritedDetachment: secondChapter.campaign.active.deployedIds, commands: defense.commands };
  await screenshot('07-campaign-chosen-route');
  assert.deepEqual(errors, []);
  const sources = {};
  for (const path of ['src/scenarios/demo.ts', 'src/scenarios/campaigns.ts', 'src/core/campaign.ts', 'src/core/scenario-recordings.ts', 'src/core/scenarios.ts', 'src/ui/ScenarioTools.ts', 'src/game/ScenarioOverlay.ts', 'src/game/GameScene.ts', 'src/ui/Hud.ts', 'scripts/verify_scenarios.mjs']) sources[path] = createHash('sha256').update(await readFile(path)).digest('hex');
  const provenance = { at: new Date().toISOString(), origin, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sources,
    viewport: { width: 1600, height: 1100 }, renderer: 'Phaser canvas', inputPolicy: 'Only visible buttons, file input, keyboard and native canvas pointer input. scenarioDiagnostics is read as copied evidence.', actions, checks, errors };
  await writeFile(`${destination}/proof.json`, JSON.stringify(provenance, null, 2));
  console.log(JSON.stringify({ checks: Object.keys(checks), outcome: checks.restoredObjectiveCompletion, pixels: pixels.counts, errors }, null, 2));
} catch (error) {
  await screenshot('failure').catch(() => {});
  await writeFile(`${destination}/failure.json`, JSON.stringify({ at: new Date().toISOString(), message: error.message, stack: error.stack, actions, errors, snapshot: await snapshot().catch(() => null) }, null, 2));
  throw error;
} finally {
  await context.tracing.stop({ path: `${destination}/ui-trace.zip` });
  await browser.close();
}
