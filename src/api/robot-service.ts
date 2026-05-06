/**
 * @file robotService.ts
 * @description
 */

import {
  RawTaskStatsResponse,
  RobotDatasetResponse,
  RobotTask,
  TaskStatsQuery,
  TaskStatsResponse,
  EffectiveRobotDatasetResponse,
} from "../types/api";
import apiClient from "./client";

const URI_PREFIX = "/mock-data/dataset";

export const RobotService = {
  /**
   * Fetch robot stat
   */
  async getBotDataset(botId: string): Promise<RobotDatasetResponse> {
    try {
      const { data } = await apiClient.get<RobotDatasetResponse>(
        `${URI_PREFIX}/${botId}.json`,
      );

      return data;
    } catch (error) {
      console.error(`[RobotService] getBotDataset failed for ${botId}:`, error);
      throw error;
    }
  },

  async getEffectiveBotDataset(): Promise<EffectiveRobotDatasetResponse> {
    try {
      const { data } = await apiClient.get<EffectiveRobotDatasetResponse>(
        `${URI_PREFIX}/effective-dataset.json`,
      );

      return data || [];
    } catch (error) {
      console.error(`[RobotService] getEffectiveBotDataset failed:`, error);
      throw error;
    }
  },

  /**
   * Get all available task list
   */
  async getTaskList(): Promise<RobotTask[]> {
    try {
      const { data } = await apiClient.get<RobotTask[]>(
        `${URI_PREFIX}/tasks.json`,
      );
      return data || [];
    } catch (error) {
      console.error(`[RobotService] getTaskList failed:`, error);
      return [];
    }
  },

  async getTaskStats(
    query?: TaskStatsQuery,
  ): Promise<TaskStatsResponse | RawTaskStatsResponse> {
    try {
      const url = query?.isRaw
        ? `${URI_PREFIX}/raw-task-stats.json`
        : `${URI_PREFIX}/task-stats.json`;
      const { data } = await apiClient.get<TaskStatsResponse>(url);
      return data || [];
    } catch (error) {
      console.error(`[RobotService] getTaskStats failed:`, error);
      throw error;
    }
  },
};
