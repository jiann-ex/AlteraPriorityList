import { PriorityListDataSource } from '../services/priority-list-datasource';
import { NullableNumber, NullableString } from './nullable';

/** Raw backend data structure for priority, before mapping to frontend model */
export interface PriorityResponse {
  id: string;
  isPriority: boolean;
  priorityR1: NullableNumber;
  priorityR2: NullableNumber;
  equipment: NullableString;
  vpo: string;
  vpoForecastQuantity: number;
  testPerUnit: NullableNumber;
  locationCode: NullableString;
  vpoSource: NullableString;
  vpoDescription: NullableString;
  stepSeq: NullableString;
  stepSeqDisplay: NullableString;
  step: string;
  engineerName: NullableString;
  stepComment: NullableString;
  product: NullableString;
  partType: NullableString;
  stepState: NullableString;
  engId: NullableString;
  vpoType: NullableString;
  stepType: NullableString;
  activityType: NullableString;
  stepSpecialInstruction: NullableString;
  stepTimeDuration: NullableString;
  recipe: NullableString;
  lastChangesBy: NullableString;
  hri: NullableString;
  mrv: NullableString;
  qdf: NullableString;
  taskTemperature: NullableString;
  vpoCreatedOn: NullableString;
  vpoStatus: number;
  platformValue: NullableString;
  platform: number;
  isCurrentWorking: boolean;
  vpoStepStatus: number;
}
export interface PriorityPayload {}

export interface Priority {
  id: string;
  priority: boolean;
  r1: NullableNumber;
  r2: NullableNumber;
  equipment: NullableNumber;
  vpo: string;
  vpoForecastQuantity: number;
  testTimePerUnit: NullableNumber;
  locationCode: NullableString;
  vpoSource: NullableString;
  vpoDescription: NullableString;
  stepSequence: string;
  step: string;
  engineerName: NullableString;
  stepComment: NullableString;
  product: NullableString;
  partType: NullableString;
  stepState: NullableString;
  engId: NullableString;
  vpoType: NullableString;
  stepType: NullableString;
  activityType: NullableString;
  stepSpecialInstruction: NullableString;
  stepTimeDuration: NullableString;
  recipe: NullableString;
  lastChangesBy: NullableString;
  hri: NullableString;
  mrv: NullableString;
  qdf: NullableString;
}

/** Map from API response to Priority */
export const mapPriorityFrom = (data: PriorityResponse): Priority =>
  ({
    id: data.id,
    priority: data.isPriority,
    r1: data.priorityR1,
    r2: data.priorityR2,
    equipment: data.equipment,
    vpo: data.vpo,
    vpoForecastQuantity: data.vpoForecastQuantity,
    testTimePerUnit: data.testPerUnit,
    locationCode: data.locationCode,
    vpoSource: data.vpoSource,
    vpoDescription: data.vpoDescription,
    stepSequence: data.stepSeqDisplay,
    step: data.step,
    engineerName: data.engineerName,
    stepComment: data.stepComment,
    product: data.product,
    partType: data.partType,
    stepState: data.stepState,
    engId: data.engId,
    vpoType: data.vpoType,
    stepType: data.stepType,
    activityType: data.activityType,
    stepSpecialInstruction: data.stepSpecialInstruction,
    stepTimeDuration: data.stepTimeDuration,
    recipe: data.recipe,
    lastChangesBy: data.lastChangesBy,
    hri: data.hri,
    mrv: data.mrv,
    qdf: data.qdf,
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
