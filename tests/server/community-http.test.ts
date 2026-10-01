import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalContent, CONTENT_ENGINE_VERSION, contentHash, decodeContentPackage } from '../../src/core/content-registry';
import { createHash } from 'node:crypto';
import { canonicalMapHash, canonicalPackageHash, createEditorMap, decodeMapPackage, makeMapPackage } from '../../src/editor/map-package';
import type { MapPackage } from '../../src/editor/map-package';
import { createScenarioDraft, decodeScenarioPackage, makeScenarioPackage } from '../../src/editor/scenario-package';
import type { Account } from '../../src/online/protocol';
import { COMMUNITY_PACKAGE_MAX_BYTES } from '../../src/server/community-packages';
import type { CommunityPackageDetail, CommunityPackageSummary } from '../../src/server/community-packages';
import { createRtsServer } from '../../src/server/server';

type RunningServer = Awaited<ReturnType<typeof createRtsServer>>;
interface RequestOptions { body?: unknown; raw?: string; method?: string; origin?: string; contentType?: string }
interface Publication { created: boolean; detail: CommunityPackageDetail }
interface Search { items: CommunityPackageSummary[]; total: number; page: number; pageSize: number }
class BrowserClient {
  cookie = '';
  constructor(public url: string) {}
  async request<T = { error: string }>(path: string, options: RequestOptions = {}) {
    const raw = options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
    const response = await fetch(this.url + path, {
      method: options.method ?? (raw === undefined ? 'GET' : 'POST'),
      headers: {
        Origin: options.origin ?? this.url,
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(raw === undefined ? {} : { 'Content-Type': options.contentType ?? 'application/json' }),
      },
      ...(raw === undefined ? {} : { body: raw }),
      signal: AbortSignal.timeout(5000),
    });
    const cookie = response.headers.get('set-cookie'); if (cookie) this.cookie = cookie.split(';')[0];
    expect(response.headers.get('content-type')).toBe('application/json');
    return { status: response.status, headers: response.headers, data: await response.json() as T };
  }
  async register(username: string): Promise<Account> {
    const response = await this.request<{ account: Account }>('/api/auth/register', { body: { username, password: 'correct-horse-battery' } });
    expect(response.status).toBe(200); expect(this.cookie).toMatch(/^ovf_session=[a-f0-9]{64}$/);
    return response.data.account;
  }
  publish(pkg: unknown) { return this.request<Publication>('/api/packages', { body: { package: pkg } }); }
  search(query = '') { return this.request<Search>('/api/packages' + query); }
}
const servers: RunningServer[] = [], directories: string[] = [];
afterEach(async () => {
  for (const server of servers.splice(0).reverse()) await server.close();
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
});
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'ovf-community-http-')); directories.push(directory);
  const server = await createRtsServer({ dataDir: directory, port: 0 }); servers.push(server);
  const alice = new BrowserClient(server.url), bob = new BrowserClient(server.url);
  const [aliceAccount, bobAccount] = await Promise.all([alice.register('publisher_alice'), bob.register('publisher_bob')]);
  expect(aliceAccount.id).not.toBe(bobAccount.id); expect(alice.cookie).not.toBe(bob.cookie);
  return { server, directory, alice, bob, aliceAccount, bobAccount };
}
function mapPackage(revision = 1, title = 'River %_ crossing', size: 'small' | 'huge' = 'small'): MapPackage {
  return makeMapPackage({ id: 'river-crossing', title, author: 'Declared map author', revision }, createEditorMap(4127, size));
}

describe('community package HTTP API', () => {
  it('requires authenticated sessions and rejects cross-origin writes before publication', async () => {
    const { server, alice, aliceAccount } = await setup(), map = mapPackage(), anonymous = new BrowserClient(server.url);
    for (const path of ['/api/packages', `/api/packages/${'0'.repeat(64)}`, `/api/packages/content/${'0'.repeat(64)}`]) {
      const response = await anonymous.request(path); expect(response.status).toBe(401); expect(response.data).toEqual({ error: 'Sign in first.' });
    }
    expect((await anonymous.publish(map)).status).toBe(401);
    anonymous.cookie = `ovf_session=${'f'.repeat(64)}`; expect((await anonymous.publish(map)).status).toBe(401);
    const rejected = await alice.request('/api/packages', { body: { package: map }, origin: 'https://unrelated.example' });
    expect(rejected.status).toBe(403); expect(rejected.data).toEqual({ error: 'Origin is not allowed.' });
    expect((await alice.search()).data.total).toBe(0);
    const published = await alice.publish(map); expect(published.status).toBe(201); expect(published.data.detail.publisher).toEqual(aliceAccount);
    expect(published.data.detail.publisher.username).not.toBe(map.author);
  });

  it('accepts playable packages above 64 KiB only through publication and retains the normal body limit', async () => {
    const { alice } = await setup(), map = mapPackage(1, 'Large playable map', 'huge'), raw = JSON.stringify({ package: map });
    expect(Buffer.byteLength(raw)).toBeGreaterThan(64 * 1024); expect(Buffer.byteLength(raw)).toBeLessThan(COMMUNITY_PACKAGE_MAX_BYTES);
    const response = await alice.request<Publication>('/api/packages', { raw }); expect(response.status).toBe(201);
    const download = await alice.request<{ package: MapPackage }>(`/api/packages/content/${response.data.detail.hash}`);
    expect(download.status).toBe(200); expect(download.data).toEqual({ package: map }); expect(decodeMapPackage(download.data.package)).toEqual(map);
    for (const path of ['/api/lobbies', '/api/auth/login']) {
      const rejected = await alice.request(path, { raw }); expect(rejected.status).toBe(413); expect(rejected.data).toEqual({ error: 'Request too large.' });
    }
    const seedBody = JSON.stringify({ seed: 42 }), boundary = seedBody + ' '.repeat(64 * 1024 - Buffer.byteLength(seedBody));
    expect(Buffer.byteLength(boundary)).toBe(64 * 1024);
    expect((await alice.request('/api/lobbies', { raw: boundary })).status).toBe(201);
    expect((await alice.request('/api/lobbies', { raw: boundary + ' ' })).status).toBe(413);
    expect((await alice.search()).data.total).toBe(1);
  });

  it('returns search, detail and immutable content envelopes through a second authenticated profile', async () => {
    const { alice, bob, aliceAccount } = await setup(), map = mapPackage(), published = await alice.publish(map), detail = published.data.detail;
    expect(published.data).toEqual({ created: true, detail });
    const search = await bob.search('?q=%25_&kind=map&page=1&pageSize=1');
    expect(search.status).toBe(200); expect(Object.keys(search.data).sort()).toEqual(['items', 'page', 'pageSize', 'total']);
    expect(search.data).toMatchObject({ total: 1, page: 1, pageSize: 1, items: [{ id: detail.id, publisher: aliceAccount, kind: 'map', localId: map.id, version: '1', packageHash: map.hash, hash: detail.hash }] });
    expect(search.data.items[0].preview.type).toBe('map');
    const inspected = await bob.request<{ detail: CommunityPackageDetail }>(`/api/packages/${detail.id}`);
    expect(inspected.status).toBe(200); expect(inspected.data).toEqual({ detail });
    const downloaded = await bob.request<{ package: MapPackage }>(`/api/packages/content/${detail.hash}`);
    expect(downloaded.status).toBe(200); expect(downloaded.data).toEqual({ package: map });
    expect(createHash('sha256').update(canonicalContent(downloaded.data.package)).digest('hex')).toBe(detail.hash);
    expect(downloaded.headers.get('cache-control')).toBe('no-store'); expect(downloaded.headers.get('x-content-type-options')).toBe('nosniff');
    for (const query of ['?kind=asset', '?page=0', '?pageSize=51', '?q=a&q=b', '?kind=map&kind=scenario', '?unknown=1']) expect((await bob.search(query)).status).toBe(400);
    expect((await bob.search('?q=%27%20OR%201%3D1%20--')).data.total).toBe(0);
    expect((await bob.request(`/api/packages/${detail.id}?q=ignored`)).status).toBe(400);
    expect((await bob.request(`/api/packages/content/${detail.hash}?revision=1`)).status).toBe(400);
    expect((await bob.request(`/api/packages/${detail.id}`, { method: 'POST', body: {} })).status).toBe(405);
    expect((await bob.request(`/api/packages/content/${detail.hash}`, { method: 'POST', body: {} })).status).toBe(405);
    expect((await bob.request(`/api/packages/${'0'.repeat(64)}`)).status).toBe(404);
    expect((await bob.request(`/api/packages/content/${'0'.repeat(64)}`)).status).toBe(404);
    expect((await bob.request('/api/packages/not-a-hash')).status).toBe(400);
  });

  it('preserves immutable revisions, profile ownership, sessions and old download hashes through an actual server restart', async () => {
    const { server, directory, alice, bob, aliceAccount, bobAccount } = await setup(), original = mapPackage(), updated = mapPackage(2, 'Revised river crossing');
    const first = await alice.publish(original); expect(first.status).toBe(201);
    const again = await alice.publish(Object.fromEntries(Object.entries(original).reverse())); expect(again.status).toBe(200); expect(again.data).toEqual({ created: false, detail: first.data.detail });
    const second = await alice.publish(updated); expect(second.status).toBe(201); expect(second.data.detail.id).toBe(first.data.detail.id);
    expect(second.data.detail.revisions.map(revision => revision.version)).toEqual(['2', '1']);
    expect((await alice.publish(mapPackage(1, 'Attempted rewrite'))).status).toBe(409);
    const bobCopy = await bob.publish(original); expect(bobCopy.status).toBe(201); expect(bobCopy.data.detail.id).not.toBe(first.data.detail.id); expect(bobCopy.data.detail.hash).toBe(first.data.detail.hash); expect(bobCopy.data.detail.publisher).toEqual(bobAccount);
    await server.close();
    const restarted = await createRtsServer({ dataDir: directory, port: 0 }); servers.push(restarted); alice.url = bob.url = restarted.url;
    expect((await alice.request<{ account: Account }>('/api/session')).data.account).toEqual(aliceAccount);
    expect((await bob.request<{ account: Account }>('/api/session')).data.account).toEqual(bobAccount);
    const detail = await bob.request<{ detail: CommunityPackageDetail }>(`/api/packages/${first.data.detail.id}`); expect(detail.status).toBe(200); expect(detail.data.detail).toEqual(second.data.detail);
    expect((await bob.request<{ package: MapPackage }>(`/api/packages/content/${first.data.detail.hash}`)).data.package).toEqual(original);
    expect((await alice.request<{ package: MapPackage }>(`/api/packages/content/${second.data.detail.hash}`)).data.package).toEqual(updated);
    expect((await alice.publish(mapPackage(2, 'Rewrite after restart'))).status).toBe(409);
    expect((await alice.search('?kind=map')).data.total).toBe(2);
    expect((await bob.publish(original)).data).toEqual({ created: false, detail: bobCopy.data.detail });
  });

  it('rejects malformed and tampered publication bodies without inserting a partial revision', async () => {
    const { alice } = await setup(), map = mapPackage(), badTerrain = structuredClone(map);
    const home = badTerrain.map.starts[0]; badTerrain.map.levels[0].terrain[Math.floor(home.y) * badTerrain.map.width + Math.floor(home.x)] = 'rock';
    badTerrain.contentHash = canonicalMapHash(badTerrain.map); const { hash: _old, ...body } = badTerrain; badTerrain.hash = canonicalPackageHash(body);
    const bodies = [
      { package: { ...map, title: 'Changed without checksum' } }, { package: { ...map, simulationVersion: 999 } },
      { package: { ...map, hash: '0'.repeat(16) } }, { package: { ...map, unknown: true } },
      { package: badTerrain }, { package: { kind: 'map' } }, { package: null },
      { package: map, publisher: 'someone-else' }, {},
    ];
    for (const body of bodies) { const response = await alice.request('/api/packages', { body }); expect(response.status).toBe(400); expect(typeof response.data.error).toBe('string'); }
    expect((await alice.request('/api/packages', { raw: '{' })).status).toBe(400);
    expect((await alice.request('/api/packages', { raw: '[]' })).status).toBe(400);
    expect((await alice.request('/api/packages', { body: { package: map }, contentType: 'text/plain' })).status).toBe(415);
    expect((await alice.request('/api/packages', { method: 'DELETE' })).status).toBe(405);
    expect((await alice.search()).data).toMatchObject({ total: 0, items: [] });
    expect((await alice.publish(map)).status).toBe(201);
    expect((await alice.search()).data.total).toBe(1);
  });

  it('admits a scenario and serves its exact embedded map dependency as a separate content envelope', async () => {
    const { alice, bob } = await setup(), map = mapPackage(), scenario = makeScenarioPackage({ author: 'Scenario author', revision: 1 }, createScenarioDraft(), map);
    const publication = await alice.publish(scenario); expect(publication.status).toBe(201);
    const detail = publication.data.detail; expect(detail.kind).toBe('scenario'); expect(detail.preview).toMatchObject({ type: 'scenario', actors: 1, objectives: 1, events: 0 });
    expect(detail.revisions[0].dependencies).toHaveLength(1);
    const dependency = detail.revisions[0].dependencies[0]; expect(dependency).toMatchObject({ kind: 'map', localId: map.id, version: '1', packageHash: map.hash });
    expect((await bob.request<{ package: MapPackage }>(`/api/packages/content/${dependency.hash}`)).data).toEqual({ package: map });
    const content = await bob.request<{ package: unknown }>(`/api/packages/content/${detail.hash}`); expect(content.status).toBe(200); expect(decodeScenarioPackage(content.data.package)).toEqual(scenario);
    expect((await bob.search('?kind=map')).data.total).toBe(0); expect((await bob.search('?kind=scenario')).data.total).toBe(1);
  });

  it('uses the real mod decoder and dependency closure during publication and downloads', async () => {
    const { alice, bob } = await setup();
    const body = { format: 'orcs-vs-fairies-mod' as const, schemaVersion: 1 as const, engineVersion: CONTENT_ENGINE_VERSION, id: 'forest-people', version: '1.0.0', name: 'Forest people', dependencies: [], factions: [{ id: 'forest-people:folk', baseFaction: 'fairies', name: 'Forest folk', subtitle: 'Inherited roster', description: 'A community faction.', color: 0x124678, accent: '#124678', units: [], buildings: [], research: [] }], art: {} };
    const mod = decodeContentPackage({ ...body, hash: contentHash(body) });
    const published = await alice.publish(mod); expect(published.status).toBe(201); expect(published.data.detail).toMatchObject({ kind: 'mod', localId: mod.id, version: '1.0.0', packageHash: mod.hash });
    const downloaded = await bob.request<{ package: unknown }>(`/api/packages/content/${published.data.detail.hash}`); expect(downloaded.status).toBe(200); expect(decodeContentPackage(downloaded.data.package)).toEqual(mod);
    const missingBody = { ...body, id: 'missing-dependency', factions: body.factions.map(faction => ({ ...faction, id: 'missing-dependency:folk' })), dependencies: [{ id: 'absent-mod', version: '1.0.0', hash: '0'.repeat(64) }] };
    const missing = decodeContentPackage({ ...missingBody, hash: contentHash(missingBody) }); expect((await bob.publish(missing)).status).toBe(409);
    expect((await bob.search('?kind=mod')).data.total).toBe(1);
  });
});
