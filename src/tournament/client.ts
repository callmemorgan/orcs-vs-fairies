import type { TournamentDashboardSource } from './types';

/** Same-origin requests inherit the canonical server's authentication cookies. */
export function createTournamentDashboardSource(baseUrl = ''): TournamentDashboardSource {
  const base = baseUrl.replace(/\/$/, '');
  async function request<T>(pathname: string, payload?: unknown): Promise<T> {
    const response = await fetch(`${base}/api/tournaments${pathname}`, {
      method: payload === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      ...(payload === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(typeof value?.error === 'string' ? value.error : `Tournament request failed (${response.status}).`);
    return value as T;
  }
  return {
    choices: () => request('/configs'),
    start: configId => request('', { configId }),
    status: id => request(`/${encodeURIComponent(id)}`),
    result: id => request(`/${encodeURIComponent(id)}/result`),
    async cancel(id) { await request(`/${encodeURIComponent(id)}/cancel`, {}); },
  };
}
