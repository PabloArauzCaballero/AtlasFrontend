export interface PageQuery extends Record<string, string | number | boolean | undefined> {
  page?: number;
  limit?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  from?: string;
  to?: string;
}

export interface PaginatedResult<TItem extends Record<string, unknown>> {
  items?: TItem[];
  rows?: TItem[];
  total?: number;
  page?: number;
  limit?: number;
  pageSize?: number;
  [key: string]: unknown;
}

export type ResourceRow = Record<string, unknown>;
export type JsonObject = Record<string, unknown>;
