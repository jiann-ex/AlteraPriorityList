import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environment';
import { PagedList } from '../types/paged-list';
import { Priority } from '../types/priority';
import { Observable } from 'rxjs';

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

  getPriorityList(query: PriorityQuery): Observable<PagedList<Priority>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);

    if (query.sort) {
      const direction = query.sortDirection === 'desc' ? '-' : '';
      params = params.set('sort', `${direction}${query.sort}`);
    }

    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        if (value) {
          params = params.set(key, value);
        }
      }
    }

    return this.httpClient.get<PagedList<Priority>>(`${this.apiUrl}/api/mes/vpoPriority`, {
      params,
    });
  }
}
