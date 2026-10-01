// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createCampaignProfile } from '/home/morgana/Projects/orcs-vs-Fairies/src/core/campaign.ts';
import { CAMPAIGNS } from '/home/morgana/Projects/orcs-vs-Fairies/src/scenarios/campaigns.ts';
import { ScenarioCampaignHost } from '/home/morgana/Projects/orcs-vs-Fairies/src/ui/ScenarioCampaignHost.ts';

describe('campaign profile import ownership', () => {
  it('does not reclaim ownership after the host is cleared during an async file read', async () => {
    document.body.innerHTML = '<main><button class="begin-match">Start</button><nav></nav></main>';
    const root = document.querySelector('main')!;
    const toolbar = root.querySelector('nav')! as HTMLElement;
    const launches: unknown[] = [];
    const host = new ScenarioCampaignHost(root, toolbar, {
      state: () => null,
      launch: session => launches.push(session),
      menu: () => undefined,
      select: () => undefined,
      center: () => undefined,
      notice: () => undefined,
      visibility: () => undefined,
      inspection: () => null,
    }, localStorage);
    const profile = createCampaignProfile(Object.keys(CAMPAIGNS)[0], crypto.randomUUID());
    let finish!: (value: string) => void;
    const text = new Promise<string>(resolve => { finish = resolve; });
    const file = new File(['placeholder'], 'profile.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => text });
    const input = root.querySelector<HTMLInputElement>('input[aria-label="Import campaign profile"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    host.clear();
    finish(JSON.stringify(profile));
    await Promise.resolve(); await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0));
    expect(launches).toEqual([]);
    expect(localStorage.getItem('ovf.campaign.v1')).toBeNull();
  });
});
