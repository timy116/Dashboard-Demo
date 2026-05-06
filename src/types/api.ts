export interface RobotBaseInfo {
  bot_id: string;
}

export interface RobotStats {
  date: string;
  duration: number;
}

export interface RobotDatasetResponse extends RobotBaseInfo {
  dataset: RobotStats[];
}

export interface EffectiveRobotStats extends RobotBaseInfo, RobotStats {}

export type EffectiveRobotDatasetResponse = EffectiveRobotStats[];

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

/**
 * Task option type (Task Definition)
 */
export interface RobotTask {
  id: number;
  name: string;
}

export interface BaseTaskStats {
  bot_id: string;
  task_id: number;
  total_duration: number;
  avg_duration: number;
  count: number;
  median_duration: number;
  min_bound: number;
  max_bound: number;
}
export interface TaskStats extends BaseTaskStats {
  task_name: string;
}

export interface RawTaskStats extends BaseTaskStats {
  task_name?: string;
}

export type TaskStatsResponse = TaskStats[];

export type RawTaskStatsResponse = RawTaskStats[];

/**
 * Query params for task stats
 */
export interface TaskStatsQuery {
  taskIds?: number[];
  botIds: string[];
  startDate?: Date;
  endDate?: Date;
  isRaw?: boolean;
  isSubtask?: boolean;
}
