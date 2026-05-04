import { TestBed } from '@angular/core/testing';

import { PriorityList } from './priority-list';

describe('PriorityList', () => {
  let service: PriorityList;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PriorityList);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
