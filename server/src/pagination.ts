import { Request } from 'express';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function parsePagination(req: Request): { page: number; pageSize: number; limit: number; offset: number } {
  const rawPage = Number((req.query.page as string) ?? '1');
  const rawPageSize = Number((req.query.pageSize as string) ?? String(DEFAULT_PAGE_SIZE));
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.min(Math.floor(rawPageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

export function parseSearch(req: Request): string | null {
  const raw = (req.query.search as string) ?? '';
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
