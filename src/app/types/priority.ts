export interface Priority {
  id: string;
  priority: boolean;
  r1: number;
  r2: number;
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
