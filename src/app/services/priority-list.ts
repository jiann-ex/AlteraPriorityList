import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environment';
import { PagedList } from '../types/paged-list';
import { Priority } from '../types/priority';
import { map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PriorityListService {
  private readonly httpClient = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getPriorityList() {
    return this.httpClient
      .get<
        PagedList<Priority>
      >(`${this.apiUrl}/api/mes/vpoPriority?page=1&pageSize=-1&sort=priorityR1`)
      .pipe(map((response) => response.data));
  }
}
