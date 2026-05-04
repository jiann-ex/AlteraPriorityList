export interface PagedList<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}
