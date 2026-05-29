import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environment';
import { PagedList } from '../types/paged-list';
import { mapPriorityFrom, Priority, PriorityGroup, PriorityResponse } from '../types/priority';
import { delay, map, Observable, of, tap } from 'rxjs';
import { PriorityListDataSource } from './priority-list-datasource';
import {
  mapPriorityPayload,
  PriorityGroupData,
  priorityToMaps,
  SortDirection,
} from '@app-types/index';

// Set to false to use real API calls (make sure to configure environment.apiUrl)
const USE_MOCK = false;
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

export interface Filter {
  key: string;
  includeBlank: boolean;
  /** Priority term instead of values if term is provided */
  term: string | null;
  values: string[];
}
export interface PriorityQuery extends Query {
  sort?: string;
  sortDirection: SortDirection;
  filters?: Filter[];
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
    if (!USE_MOCK) {
      return this.httpClient
        .get<PriorityGroupData[]>(`${this.apiUrl}/api/mes/vpoPriority/groups`)
        .pipe(
          map((groups) =>
            groups.map((group) => {
              const dataSource = new PriorityListDataSource(this, group.r1, group.total);
              return new PriorityGroup(group.r1, group.total, dataSource);
            }),
          ),
        );
    }

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
    if (!USE_MOCK) {
      let params = new HttpParams();
      if (r1) {
        params = params.set('r1', String(r1));
      }
      return this.httpClient
        .post<
          PagedList<PriorityResponse>
        >(`${this.apiUrl}/api/mes/vpoPriority/prioritiesByGroup`, query, { params })
        .pipe(map((response) => ({ ...response, data: response.data.map(mapPriorityFrom) })));
    }

    // --- MOCK: simulate server delay with 10k test data ---

    // Map key to priority response keys
    query.sort = query.sort ? priorityToMaps.get(query.sort as keyof Priority) : undefined;
    query.filters = query.filters?.map((filter) => ({
      ...filter,
      key: priorityToMaps.get(filter.key as keyof Priority) ?? filter.key,
    }));

    const filtered = MOCK_DATA.slice()
      .filter((item) => item.priorityR1 === r1)
      .filter((item) => {
        if (!query.filters) return true;
        return query.filters.every((filter) => {
          const value = item[filter.key as keyof PriorityResponse];
          const isBlank = value === null || value === undefined;
          const hasTerm = !!filter.term;
          const hasValues = filter.values && filter.values.length > 0;

          // If only includeBlank is set (no term/values), filter to only blank values
          if (filter.includeBlank && !hasTerm && !hasValues) {
            return isBlank;
          }

          // If blank, include only if includeBlank is true
          if (isBlank) {
            return filter.includeBlank;
          }

          // Check term match
          if (hasTerm) {
            return String(value).toLowerCase().includes(filter.term!.toLowerCase());
          }

          // Check values match
          if (hasValues) {
            return filter.values.includes(String(value));
          }

          return true;
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
    if (!USE_MOCK) {
      const params = new HttpParams()
        .set('key', prop)
        .set('offset', String(query.offset))
        .set('limit', String(query.limit));

      if (term) {
        params.set('term', term);
      }
      return this.httpClient.post<PagedList<string>>(
        `${this.apiUrl}/api/mes/vpoPriority/options`,
        query,
        {
          params,
        },
      );
    }

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

  saveChanges(editedPriorities: Priority[]): Observable<void> {
    const payload = mapPriorityPayload(editedPriorities);
    console.log('Saving changes with payload:', payload);
    // --- MOCK: Simulate API call and response ---
    return of(undefined).pipe(
      delay(500), // Simulate network delay
      tap(() => {
        // Update the MOCK_DATA with the changes
        for (const edited of editedPriorities) {
          const index = MOCK_DATA.findIndex((item) => item.id === edited.id);
          if (index !== -1) {
            const current = MOCK_DATA[index];
            const updated: PriorityResponse = {
              ...current,
              isPriority: edited.priority,
              priorityR1: edited.r1,
              priorityR2: edited.r2,
              equipment: edited.equipment,
              vpo: edited.vpo,
              vpoForecastQuantity: edited.vpoForecastQuantity,
              testPerUnit: edited.testTimePerUnit,
              locationCode: edited.locationCode,
              vpoSource: edited.vpoSource,
              vpoDescription: edited.vpoDescription,
              stepSeq: edited.stepSequence,
              stepSeqDisplay: `S${edited.stepSequence}`,
              step: edited.step,
              engineerName: edited.engineerName,
              stepComment: edited.stepComment,
              product: edited.product,
              partType: edited.partType,
              stepState: edited.stepState,
              engId: edited.engId,
              vpoType: edited.vpoType,
              stepType: edited.stepType,
              activityType: edited.activityType,
              stepSpecialInstruction: edited.stepSpecialInstruction,
              stepTimeDuration: edited.stepTimeDuration,
              recipe: edited.recipe,
              lastChangesBy: edited.lastChangesBy,
              hri: edited.hri,
              mrv: edited.mrv,
              qdf: edited.qdf,
            };
            MOCK_DATA[index] = updated;
          }
        }
      }),
    );
  }
}
