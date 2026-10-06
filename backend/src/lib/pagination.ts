import type { Request } from "express";

/**
 * The paginated envelope DentalOS uses (Laravel's shape):
 * `{ data, links: { first, last, prev, next }, meta: { current_page, last_page, total, … } }`.
 */
export interface PageRequest {
  page: number;
  perPage: number;
}

/** 20 by default, 100 at most, and nonsense clamps rather than erroring. */
export function readPageRequest(query: Record<string, unknown>, defaultPerPage = 20): PageRequest {
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const raw = Number.parseInt(String(query.per_page ?? defaultPerPage), 10);
  const perPage = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : defaultPerPage;
  return { page, perPage };
}

export function paginate<T>(rows: T[], total: number, { page, perPage }: PageRequest, req: Request) {
  const path = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const url = (p: number) => `${path}?page=${p}`;

  return {
    data: rows,
    links: {
      first: url(1),
      last: url(lastPage),
      prev: page > 1 ? url(page - 1) : null,
      next: page < lastPage ? url(page + 1) : null,
    },
    meta: {
      current_page: page,
      from: total === 0 ? null : (page - 1) * perPage + 1,
      last_page: lastPage,
      path,
      per_page: perPage,
      to: total === 0 ? null : Math.min(page * perPage, total),
      total,
    },
  };
}
