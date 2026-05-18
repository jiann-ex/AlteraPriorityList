import { PriorityListDataSource } from '../services/priority-list-datasource';
import { PagedList } from './paged-list';

export interface Priority {
  id: string;
  priority: boolean;
  r1: number | null;
  r2: number | null;
  vpo: string;
  equipment: string;
  stepSequence: string;
  vpoForecastQuantity: number;
  testTimePerUnit: number;
}

/** Map from API response to Priority */
export const mapPriorityFrom = (data: any): Priority =>
  ({
    id: data.id,
    priority: data.isPriority,
    r1: data.priorityR1,
    r2: data.priorityR2,
    vpo: data.vpo,
    equipment: data.equipment,
    stepSequence: data.stepSeq,
    vpoForecastQuantity: data.vpoForecastQuantity,
    testTimePerUnit: data.testPerUnit,
  }) as Priority;
/** Map from Priority to API request */
export const mapPriorityTo = (priority: Priority): any =>
  ({
    id: priority.id,
  }) as any;
/**
 * null should display placeholder wait for it to be loaded
 */
export type PriorityData = Priority | null;

/** Group data receive from the backend */
export interface PriorityGroupData {
  r1: number | null;
  total: number;
}
/** Class that has been initialized in the priority list service */
export class PriorityGroup {
  r1: number | null = null;
  total: number = 0;
  dataSource: PriorityListDataSource;
  /** Unique key for the group, derived from r1. Use to handle expand state or other stuff in priority list */
  get key() {
    return String(this.r1 ?? 'null');
  }

  constructor(r1: number | null, total: number, dataSource: PriorityListDataSource) {
    this.r1 = r1;
    this.total = total;
    this.dataSource = dataSource;
  }
}
