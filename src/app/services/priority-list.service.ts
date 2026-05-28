import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environment';
import { PagedList } from '../types/paged-list';
import { mapPriorityFrom, Priority, PriorityGroup, PriorityResponse } from '../types/priority';
import { delay, Observable, of, tap } from 'rxjs';
import { PriorityListDataSource } from './priority-list-datasource';
import { priorityToMaps, SortDirection } from '@app-types/index';

const TOTAL_MOCK_SIZE = 10000;
const MOCK_DATA: PriorityResponse[] = Array.from({ length: TOTAL_MOCK_SIZE }, (_, i) => ({
  id: `mock-${i}`,
  isPriority: i % 3 === 0,
  priorityR1: i > 100 ? (i % 5) + 1 : null,
  priorityR2: i > 100 ? (i % 4) + 1 : null,
  equipment: `EQ-${String((i % 50) + 1).padStart(3, '0')}`,
  vpo: `VPO-${String(i).padStart(5, '0')}`,
  vpoForecastQuantity: Math.floor(Math.random() * 500) + 50,
  testPerUnit: +(Math.random() * 10 + 1).toFixed(2),
  locationCode: i % 4 === 0 ? `LOC-${(i % 10) + 1}` : null,
  vpoSource: i % 3 === 0 ? `SRC-${i % 5}` : null,
  vpoDescription: `Description for VPO ${i}`,
  stepSeq: `${(i % 10) + 1}`,
  stepSeqDisplay: `S${(i % 10) + 1}`,
  step: `STEP-${(i % 20) + 1}`,
  engineerName: i % 2 === 0 ? `Engineer ${i % 15}` : null,
  stepComment: i % 5 === 0 ? `Comment for step ${i}` : null,
  product: `PROD-${(i % 8) + 1}`,
  partType: i % 3 === 0 ? `PT-${i % 6}` : null,
  stepState: i % 2 === 0 ? 'Active' : null,
  engId: i % 2 === 0 ? `ENG-${i % 20}` : null,
  vpoType: i % 4 === 0 ? `Type-${i % 3}` : null,
  stepType: `ST-${i % 5}`,
  activityType: i % 3 === 0 ? `ACT-${i % 4}` : null,
  stepSpecialInstruction: i % 10 === 0 ? `Special instruction ${i}` : null,
  stepTimeDuration: `${(i % 60) + 1}`,
  recipe: i % 4 === 0 ? `RCP-${i % 12}` : null,
  lastChangesBy: i % 2 === 0 ? `User ${i % 10}` : null,
  hri: i % 5 === 0 ? `HRI-${i % 8}` : null,
  mrv: i % 6 === 0 ? `MRV-${i % 4}` : null,
  qdf: i % 7 === 0 ? `QDF-${i % 3}` : null,
  taskTemperature: i % 3 === 0 ? `${20 + (i % 30)}` : null,
  vpoCreatedOn: `2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
  vpoStatus: i % 4,
  platformValue: i % 3 === 0 ? `Platform ${i % 5}` : null,
  platform: i % 5,
  isCurrentWorking: i % 7 === 0,
  vpoStepStatus: i % 3,
}));

export interface PriorityQuery extends Query {
  sort?: string;
  sortDirection: SortDirection;
  filters?: {
    key: string;
    values: string[];
  }[];
}

export interface Query {
  offset: number;
  limit: number;
}

@Injectable({
  providedIn: 'root',
})
export class PriorityListService {
  private readonly httpClient = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Get priority sorted by its r1 value ascending
   * @returns
   */
  getPriorityGroups(): Observable<PriorityGroup[]> {
    // --- MOCK: simulate server delay with 10k test data ---
    const groupMap = new Map<number | null, number>();
    for (const item of MOCK_DATA) {
      const key = item.priorityR1;
      groupMap.set(key, (groupMap.get(key) ?? 0) + 1);
    }
    const data = Array.from(groupMap.entries()).map(([r1, total]) => ({ r1, total }));
    data.sort((a, b) => {
      if (a.r1 === null) return 1;
      if (b.r1 === null) return -1;
      return a.r1 - b.r1;
    });
    return of(
      data.map((group) => {
        const total = group.total || 1; // Avoid total being 0 to prevent issues in cdk viewport
        const dataSource = new PriorityListDataSource(this, group.r1, total);
        return new PriorityGroup(group.r1, total, dataSource);
      }),
    ).pipe(delay(200)); // Simulate 200ms network delay
    // --- END MOCK ---
  }

  getPriorityListByGroup(r1: number | null, query: PriorityQuery): Observable<PagedList<Priority>> {
    // --- MOCK: simulate server delay with 10k test data ---
    console.log('Fetching data for group r1=', r1, 'with query=', query);

    // Map key to priority response keys
    query.sort = query.sort ? priorityToMaps.get(query.sort as keyof Priority) : undefined;

    const filtered = MOCK_DATA.slice()
      .filter((item) => item.priorityR1 === r1)
      .filter((item) => {
        if (!query.filters) return true;
        return query.filters.every((filter) => {
          const value = item[filter.key as keyof PriorityResponse];
          return filter.values.includes(String(value));
        });
      })
      .sort((a, b) => {
        if (!query.sort) return 0;
        const aValue = a[query.sort as keyof PriorityResponse];
        const bValue = b[query.sort as keyof PriorityResponse];
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return query.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        const aStr = String(aValue);
        const bStr = String(bValue);
        return query.sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    const offset = query.offset;
    const limit = query.limit;
    const page = filtered.slice(offset, offset + limit).map(mapPriorityFrom);
    return of<PagedList<Priority>>({
      data: page,
      count: filtered.length,
      page: -1, // Not used in this context
      pageSize: query.limit,
    }).pipe(delay(200)); // Simulate 200ms network delay
    // --- END MOCK ---
  }

  getPriorityFilterOptions(
    prop: keyof PriorityResponse,
    query: Query,
    term: string | null,
  ): Observable<PagedList<string>> {
    // --- MOCK: return unique values for the requested property from the mock data ---
    const offset = query.offset;
    const limit = query.limit;
    let mappedData = MOCK_DATA.map((item) => item[prop as keyof PriorityResponse])
      .filter((value): value is string | number => value !== null && value !== undefined)
      .filter((value, index, array) => array.indexOf(value) === index)
      .map((option) => String(option));
    if (term) {
      const lowerTerm = term.toLowerCase();
      mappedData = mappedData.filter((option) => option.toLowerCase().includes(lowerTerm));
    }

    mappedData.sort((a, b) => a.localeCompare(b));
    const options = Array.from(new Set(mappedData.slice(offset, offset + limit))).filter(
      (option) => option !== null && option !== undefined,
    );

    return of<PagedList<string>>({
      data: options,
      count: mappedData.length,
      page: -1,
      pageSize: query.limit,
    }).pipe(delay(100)); // Simulate 100ms network delay
    // --- END MOCK ---
  }

  updatePriority(id: string, field: 'r1' | 'r2', value: number): Observable<Priority> {
    return this.httpClient.patch<Priority>(
      `${this.apiUrl}/api/mes/vpoPriority/${encodeURIComponent(id)}`,
      { [field]: value },
    );
  }
}
