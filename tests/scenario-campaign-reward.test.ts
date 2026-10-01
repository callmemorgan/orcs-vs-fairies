// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScenarioCampaignHost } from '../src/ui/ScenarioCampaignHost';
import { createCampaignProfile } from '../src/core/campaign';
import { captureScenario, createScenario } from '../src/core/scenarios';
import { ScenarioRecorder } from '../src/core/scenario-recordings';
import { CAMPAIGNS, SCENARIOS } from '../src/scenarios/campaigns';
import type { CampaignProfile } from '../src/core/campaign';

afterEach(() => { document.body.replaceChildren(); localStorage.clear(); });
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

// These synthetic entries test the UI callback boundary only. The server verifier
// must still replay an uploaded canonical campaign before granting a reward.
function completedUiProfile(): CampaignProfile {
  const profile = createCampaignProfile('campaign-orcs', 'reward-ui');
  profile.history = CAMPAIGNS['campaign-orcs'].chapters.map(missionId => {
    const session = createScenario(SCENARIOS[missionId]), recorder = new ScenarioRecorder(session);
    const recording = recorder.archive(); recorder.destroy();
    return { missionId, checkpoint: captureScenario(session), recording, deployedIds: [], resultId: `ui-${missionId}` };
  });
  return profile;
}
function setup(claim = vi.fn<(missionId: string, profile: CampaignProfile) => Promise<void>>().mockResolvedValue(undefined)) {
  const root = document.createElement('div'); root.innerHTML = '<button class="begin-match">Begin</button><div class="session-toolbar"></div>'; document.body.append(root);
  const session = createScenario(SCENARIOS['orcs-4']), notice = vi.fn();
  const host = new ScenarioCampaignHost(root, root.querySelector('.session-toolbar')!, {
    state: () => session.state, launch: vi.fn(), menu: vi.fn(), select: vi.fn(), center: vi.fn(), notice, visibility: vi.fn(), inspection: () => null, claimCampaignVictory: claim,
  });
  const reward = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent === 'Claim campaign cosmetic reward')!;
  return { host, notice, claim, button: () => reward, install: (profile: CampaignProfile) => host.install({ kind: 'campaign', profile }, session.state) };
}

describe('campaign finale cosmetic claim', () => {
  it('offers a finished current campaign and submits its full cloned profile and canonical finale', async () => {
    const ui = setup(), profile = completedUiProfile(), before = structuredClone(profile); ui.install(profile);
    expect(ui.button().hidden).toBe(false); expect(ui.button().disabled).toBe(false); ui.button().click(); await settle();
    expect(ui.claim).toHaveBeenCalledExactlyOnceWith('orcs-4', before);
    expect(ui.claim.mock.calls[0][1]).not.toBe(profile); expect(profile).toEqual(before);
    expect(ui.button().textContent).toBe('Campaign reward claimed'); expect(ui.button().disabled).toBe(true);
    expect(ui.notice).toHaveBeenLastCalledWith('Campaign victory verified. Open Cosmetics to choose earned items.');
  });

  it('does not submit unfinished or historical campaign progress', async () => {
    const ui = setup(); ui.install(createCampaignProfile('campaign-orcs', 'unfinished'));
    expect(ui.button().hidden).toBe(true); ui.button().click();
    const old = completedUiProfile(); old.simulationRevision = '3.2.0'; ui.install(old);
    expect(ui.button().hidden).toBe(false); expect(ui.button().disabled).toBe(true); ui.button().click(); await settle();
    expect(ui.claim).not.toHaveBeenCalled();
  });

  it.each([undefined, '3.2.0', '4.0.0'])('disables reward claims when a completed checkpoint has rules %s', async revision => {
    const ui = setup(), profile = completedUiProfile();
    if (revision === undefined) delete profile.history[0].checkpoint.simulationRevision;
    else profile.history[0].checkpoint.simulationRevision = revision;
    ui.install(profile);
    expect(ui.button().hidden).toBe(false); expect(ui.button().disabled).toBe(true);
    ui.button().click(); await settle(); expect(ui.claim).not.toHaveBeenCalled();
  });

  it('submits once while pending and permits retry after a verifier failure', async () => {
    let reject!: (error: Error) => void;
    const claim = vi.fn<(missionId: string, profile: CampaignProfile) => Promise<void>>().mockImplementationOnce(() => new Promise((_, no) => { reject = no; })).mockResolvedValue(undefined);
    const ui = setup(claim); ui.install(completedUiProfile()); ui.button().click(); ui.button().click();
    expect(claim).toHaveBeenCalledTimes(1); expect(ui.button().disabled).toBe(true);
    reject(new Error('Campaign verification is busy. Retry shortly.')); await settle();
    expect(ui.notice).toHaveBeenLastCalledWith('Campaign verification is busy. Retry shortly.'); expect(ui.button().disabled).toBe(false);
    ui.button().click(); await settle(); expect(claim).toHaveBeenCalledTimes(2); expect(ui.button().textContent).toBe('Campaign reward claimed');
  });

  it('discards an old response after a different match replaces the campaign', async () => {
    let resolve!: () => void;
    const claim = vi.fn<(missionId: string, profile: CampaignProfile) => Promise<void>>().mockImplementation(() => new Promise(yes => { resolve = yes; }));
    const ui = setup(claim); ui.install(completedUiProfile()); ui.button().click(); ui.host.clear(); ui.host.update(); resolve(); await settle();
    expect(ui.notice).not.toHaveBeenCalled(); expect(ui.host.snapshot()).toBeUndefined(); expect(ui.button().hidden).toBe(true);
    ui.install(completedUiProfile()); expect(ui.button().disabled).toBe(false);
  });

  it('permits a different account to claim without clearing completed campaign progress', async () => {
    let account = 'A'; const accounts: string[] = [];
    const claim = vi.fn<(missionId: string, profile: CampaignProfile) => Promise<void>>().mockImplementation(async () => { accounts.push(account); });
    const ui = setup(claim), profile = completedUiProfile(); ui.install(profile); ui.button().click(); await settle();
    expect(ui.button().disabled).toBe(true); account = 'B'; ui.host.resetCampaignReward();
    expect(ui.host.snapshot()?.profile).toEqual(profile); expect(ui.button().disabled).toBe(false);
    ui.button().click(); await settle(); expect(accounts).toEqual(['A', 'B']);
  });

  it('discards a pending previous-account response without marking the new account claimed', async () => {
    let resolve!: () => void;
    const claim = vi.fn<(missionId: string, profile: CampaignProfile) => Promise<void>>().mockImplementation(() => new Promise(yes => { resolve = yes; }));
    const ui = setup(claim), profile = completedUiProfile(); ui.install(profile); ui.button().click(); ui.host.resetCampaignReward(); resolve(); await settle();
    expect(ui.notice).not.toHaveBeenCalled(); expect(ui.button().disabled).toBe(false); expect(ui.button().textContent).toBe('Claim campaign cosmetic reward');
    expect(ui.host.snapshot()?.profile).toEqual(profile);
  });
});
