import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import type { Account } from '../online/protocol';
import { communityPackageValidators } from '../editor/package-validation';
import { CommunityPackages, CommunityPackageError, COMMUNITY_PACKAGE_MAX_BYTES } from './community-packages';
import type { CommunityPackageKind } from './community-packages';

interface CommunityHttpContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  user: Account;
  body(req: IncomingMessage, maximumBytes?: number): Promise<Record<string, unknown>>;
  respond(res: ServerResponse, status: number, value: unknown): void;
}

/** Mount after session and origin checks in the ordinary authenticated API. */
export function createCommunityHttp(db: DatabaseSync) {
  const packages = new CommunityPackages(db, communityPackageValidators);
  return async ({ req, res, url, user, body, respond }: CommunityHttpContext): Promise<boolean> => {
    const path = url.pathname;
    if (path === '/api/packages') {
      if (req.method === 'POST') {
        const value = await body(req, COMMUNITY_PACKAGE_MAX_BYTES);
        if (Object.keys(value).length !== 1 || !Object.hasOwn(value, 'package')) throw new CommunityPackageError(400, 'Expected only a package field.');
        const published = packages.publish(user, value.package);
        respond(res, published.created ? 201 : 200, published); return true;
      }
      if (req.method !== 'GET') throw new CommunityPackageError(405, 'Use GET or POST.');
      if ([...url.searchParams.keys()].some(key => !['q', 'kind', 'page', 'pageSize'].includes(key))) throw new CommunityPackageError(400, 'Unknown package search field.');
      for (const key of ['q', 'kind', 'page', 'pageSize']) if (url.searchParams.getAll(key).length > 1) throw new CommunityPackageError(400, 'Duplicate package search field.');
      const page = url.searchParams.get('page'), pageSize = url.searchParams.get('pageSize'), kind = url.searchParams.get('kind');
      const result = packages.search({ query: url.searchParams.get('q') ?? undefined, kind: kind === null || kind === '' ? undefined : kind as CommunityPackageKind, page: page === null ? undefined : Number(page), pageSize: pageSize === null ? undefined : Number(pageSize) });
      respond(res, 200, result); return true;
    }
    const download = /^\/api\/packages\/content\/([^/]+)$/.exec(path);
    const detail = /^\/api\/packages\/([^/]+)$/.exec(path);
    if (!download && !detail) return false;
    if (req.method !== 'GET') throw new CommunityPackageError(405, 'Use GET.');
    if (url.search) throw new CommunityPackageError(400, 'Package detail and download do not accept query fields.');
    if (download) respond(res, 200, { package: packages.download(download[1]) });
    else respond(res, 200, { detail: packages.detail(detail![1]) });
    return true;
  };
}
