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
type PriorityData = Priority | null;
