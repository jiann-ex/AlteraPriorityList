import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environment';
import { PagedList } from '../types/paged-list';
import { mapPriorityFrom, Priority, PriorityGroup } from '../types/priority';
import { delay, map, Observable, of, tap } from 'rxjs';

const TOTAL_MOCK_SIZE = 10000;
const MOCK_DATA: Priority[] = Array.from({ length: TOTAL_MOCK_SIZE }, (_, i) => ({
  id: `mock-${i}`,
  priority: i % 3 === 0,
  r1: i > 100 ? (i % 5) + 1 : null,
  r2: i > 100 ? (i % 4) + 1 : null,
  vpo: `VPO-${String(i).padStart(5, '0')}`,
  equipment: `EQ-${String((i % 50) + 1).padStart(3, '0')}`,
  stepSequence: `S${(i % 10) + 1}`,
  vpoForecastQuantity: Math.floor(Math.random() * 500) + 50,
  testTimePerUnit: +(Math.random() * 10 + 1).toFixed(2),
}));

export interface PriorityQuery {
  page: number;
  pageSize: number;
  sort?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: Record<string, string>;
}

@Injectable({
  providedIn: 'root',
})
export class PriorityListService {
  private readonly httpClient = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getPriorityGroups(): Observable<PriorityGroup> {
    // --- MOCK: simulate server delay with 10k test data ---
    const groupMap = new Map<number | null, number>();
    for (const item of MOCK_DATA) {
      const key = item.r1;
      groupMap.set(key, (groupMap.get(key) ?? 0) + 1);
    }
    const data = Array.from(groupMap.entries()).map(([r1, total]) => ({ r1, total }));
    return of({ data, total: MOCK_DATA.length }).pipe(delay(200)); // Simulate 200ms network delay
    // --- END MOCK ---
  }

  getPriorityList(query: PriorityQuery): Observable<PagedList<Priority>> {
    // --- MOCK: simulate server delay with 10k test data ---
    const offset = (query.page - 1) * query.pageSize;
    const page = MOCK_DATA;
    return of<PagedList<Priority>>({
      data: page,
      count: TOTAL_MOCK_SIZE,
      page: query.page,
      pageSize: query.pageSize,
    }).pipe(
      delay(200),
      tap((data) => console.log('Mock data fetched:', data)),
    ); // Simulate 200ms network delay
    // --- END MOCK ---

    // let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    //
    // if (query.sort) {
    //   const direction = query.sortDirection === 'desc' ? '-' : '';
    //   params = params.set('sort', `${direction}${query.sort}`);
    // }
    //
    // if (query.filters) {
    //   for (const [key, value] of Object.entries(query.filters)) {
    //     if (value) {
    //       params = params.set(key, value);
    //     }
    //   }
    // }
    //
    // return this.httpClient
    //   .get<PagedList<Priority>>(`${this.apiUrl}/api/mes/vpoPriority`, {
    //     params,
    //   })
    //   .pipe(
    //     map((response) => ({
    //       ...response,
    //       data: response.data.map(mapPriorityFrom),
    //     })),
    //   );
  }

  updatePriority(id: string, field: 'r1' | 'r2', value: number): Observable<Priority> {
    return this.httpClient.patch<Priority>(
      `${this.apiUrl}/api/mes/vpoPriority/${encodeURIComponent(id)}`,
      { [field]: value },
    );
  }
}
