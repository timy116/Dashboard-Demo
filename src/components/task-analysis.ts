import dayjs from "dayjs";
import * as echarts from "echarts";

import { html, LitElement } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { notify } from "../components/notify";
import { RawTaskStats, TaskStats } from "../types/api";
import { ACTIVE_ROBOT_IDS, ALERT_TYPE } from "../types/constants";
import { formatInteger, formatNumber } from "../utils/number-format";

import { RobotService } from "../api/robot-service";
import "../components/common-datepicker";
import { CommonDatepicker } from "../components/common-datepicker";
import { TaskStatsQuery } from "../types/api";
import "./chart-sort-filter";
import { ChartSortKey } from "./chart-sort-filter";
import "./robot-multi-select";
import "./task-analysis-card";

@customElement("task-analysis")
export class TaskAnalysis extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  private _taskDurationChartInstance: echarts.ECharts | null = null;
  private _taskOverviewChartInstance: echarts.ECharts | null = null;
  private _totalDurationChartInstance: echarts.ECharts | null = null;
  private _intersectionObserver: IntersectionObserver | null = null;

  @query("common-datepicker") $commonDatepicker!: CommonDatepicker;

  @state() private _visibleBots: Set<string> = new Set(
    Object.values(ACTIVE_ROBOT_IDS),
  );
  @state() private _allTaskStatsData: Map<string, TaskStats[]> = new Map(
    [...this._visibleBots, "All"].map((botId) => [botId, []]),
  );

  @state() private _activePreset: "all" | 7 | 30 | null = "all";
  @state() private _dateRange: { from: string; to: string } | null = null;
  @state() private _isLoading = true;
  @state() private _taskAnalysisLoading = true;
  @state() private _durationChartSortKey: ChartSortKey = "count";
  @state() private _hasBeenVisible = false;

  // Cleaned data
  private _highPrioritytaskIds: number[] = [];
  private _taskMap: Map<number, string> = new Map();

  // Raw data
  @state() private _allRawTaskStatsData: Map<string, TaskStats[]> = new Map(
    [...this._visibleBots, "All"].map((botId) => [botId, []]),
  );

  protected updated(changedProperties: Map<string, any>) {
    if (changedProperties.size > 0 && this._isLoading === false) {
      this._updateTaskDurationChart();
      this._updateTaskOverviewChart();
      this._updateTotalDurationChart();
    }
  }

  async firstUpdated() {
    try {
      // Fetch lightweight task list first
      const taskList = await RobotService.getTaskList();

      this._taskMap = new Map<number, string>(
        taskList.map((task) => [task.id, task.name]),
      );
      // Set up Intersection Observer for lazy loading
      this._setupIntersectionObserver();
      this._isLoading = false;
    } catch (error) {
      notify("Failed to load data. Please try again later.", {
        variant: ALERT_TYPE.DANGER,
        icon: "exclamation-triangle",
        duration: 3000,
      });
      console.error("Initialization failed:", error);
      this._isLoading = false;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._intersectionObserver?.disconnect();
    this._intersectionObserver = null;
  }

  private _setupIntersectionObserver() {
    this._intersectionObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !this._hasBeenVisible) {
          this._hasBeenVisible = true;
          this._intersectionObserver?.disconnect();
          this._loadTaskStats();
        }
      },
      { threshold: 0.1 },
    );
    this._intersectionObserver.observe(this);
  }

  private async _loadTaskStats() {
    await this._fetchAllTaskStats({
      botIds: Array.from(this._visibleBots),
      taskIds: this._highPrioritytaskIds,
    });
  }

  private async _fetchAllTaskStats(baseQuery: Omit<TaskStatsQuery, "isRaw">) {
    try {
      this._taskAnalysisLoading = true;

      // Fetch both cleaned and raw data in parallel
      const [cleanedStats, rawStats] = await Promise.all([
        RobotService.getTaskStats({ ...baseQuery, isRaw: false }),
        RobotService.getTaskStats({ ...baseQuery, isRaw: true }),
      ]);

      // Process cleaned data
      const nextCleanedData = new Map<string, TaskStats[]>(
        [...this._visibleBots, "All"].map((botId) => [botId, []]),
      );
      (cleanedStats as TaskStats[]).forEach((stat) => {
        const items = nextCleanedData.get(stat.bot_id);
        if (items) {
          items.push(stat);
        }
        const allItems = nextCleanedData.get("All");
        if (allItems) {
          allItems.push(stat);
        }
      });
      this._allTaskStatsData = nextCleanedData;

      // Process raw data
      const nextRawData = new Map<string, TaskStats[]>(
        [...this._visibleBots, "All"].map((botId) => [botId, []]),
      );
      (rawStats as RawTaskStats[]).forEach((stat) => {
        const normalizedStat: TaskStats = {
          ...stat,
          task_name:
            stat.task_name || this._taskMap.get(stat.task_id) || "Unknown Task",
        };
        const items = nextRawData.get(stat.bot_id);
        if (items) {
          items.push(normalizedStat);
        }
        const allItems = nextRawData.get("All");
        if (allItems) {
          allItems.push(normalizedStat);
        }
      });
      this._allRawTaskStatsData = nextRawData;
    } catch (error) {
      console.error("Failed to fetch task stats:", error);
    } finally {
      this._taskAnalysisLoading = false;
    }
  }

  /**
   * handle flatpickr on date change
   */
  private _onDateChange(dates: Date[]) {
    // when select start and end date
    if (dates.length === 2) {
      // cancel the 7 or 30 UI active
      this._activePreset = null;
      const [start, end] = dates;
      this._dateRange = this._getDateRange(start, end);

      this._fetchAllTaskStats({
        botIds: Array.from(this._visibleBots),
        taskIds: this._highPrioritytaskIds,
        startDate: start,
        endDate: end,
      });
    }
  }

  private _getDateRange(
    startDate: Date,
    today: Date,
  ): { from: string; to: string } | null {
    return {
      from: dayjs(startDate).format("YYYYMMDD"),
      to: dayjs(today).format("YYYYMMDD"),
    };
  }

  private _updateTaskDurationChart() {
    const chartDom = this.querySelector("#task-duration-chart") as HTMLElement;
    if (!chartDom) return;

    if (!this._taskDurationChartInstance) {
      this._taskDurationChartInstance = echarts.init(chartDom, "dark");
      window.addEventListener("resize", () =>
        this._taskDurationChartInstance?.resize(),
      );
    }

    // Cleaned and raw data for 'All'
    const cleanedData = [...(this._allTaskStatsData.get("All") ?? [])].sort(
      (a, b) => b[this._durationChartSortKey] - a[this._durationChartSortKey],
    );
    const rawData = [...(this._allRawTaskStatsData.get("All") ?? [])].sort(
      (a, b) => b[this._durationChartSortKey] - a[this._durationChartSortKey],
    );

    // Use union of all task names for yAxis
    const allTaskNames = Array.from(
      new Set([
        ...cleanedData.map((item) => item.task_name),
        ...rawData.map((item) => item.task_name),
      ]),
    );

    if (allTaskNames.length === 0) {
      this._taskDurationChartInstance.clear();
      return;
    }
    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      legend: {
        data: ["Bar1", "Bar2"],
        bottom: 10,
        textStyle: { color: "var(--text-secondary)" },
        selectedMode: "multiple",
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          // Find the data for the bar series
          const cleanedBar = params.find(
            (p: any) => p.seriesName === "Cleaned",
          );
          const rawBar = params.find((p: any) => p.seriesName === "Raw");
          let html = "";
          if (cleanedBar) {
            const raw = cleanedData.find(
              (item) => item.task_name === cleanedBar.name,
            );
            if (raw) {
              html += `<div style="font-weight:bold; color:#9068ff;">${cleanedBar.name}</div>`;
              html += `<div>Total Duration: <b>${formatNumber(raw.total_duration / 60)} hrs</b></div>`;
              html += `<div>Avg Duration: <b>${formatNumber(raw.avg_duration)} min</b></div>`;
              html += `<div>Count: <b>${formatInteger(raw.count)}</b></div>`;
              html += `<div>Most Likely: <b>${formatNumber(raw.median_duration)} min</b></div>`;
              html += `<div>Usual Range: <b>${formatNumber(raw.min_bound)} - ${formatNumber(raw.max_bound)} min</b></div>`;
              html += `<hr/>`;
            }
          }
          if (rawBar) {
            const raw = rawData.find((item) => item.task_name === rawBar.name);
            if (raw) {
              html += `<div style="font-weight:bold; color:#ff9f40;">${rawBar.name}</div>`;
              html += `<div>Total Duration: <b>${formatNumber(raw.total_duration / 60)} hrs</b></div>`;
              html += `<div>Avg Duration: <b>${formatNumber(raw.avg_duration)} min</b></div>`;
              html += `<div>Count: <b>${formatInteger(raw.count)}</b></div>`;
              html += `<div>Most Likely: <b>${formatNumber(raw.median_duration)} min</b></div>`;
              html += `<div>Usual Range: <b>${formatNumber(raw.min_bound)} - ${formatNumber(raw.max_bound)} min</b></div>`;
            }
          }
          return html;
        },
      },
      grid: {
        left: "3%",
        right: "8%",
        bottom: "80",
        containLabel: true,
      },
      xAxis: {
        type: "value",
        name: "Average Duration (min)",
        nameLocation: "middle",
        nameGap: 30,
        axisLabel: { color: "var(--text-secondary)" },
        splitLine: {
          lineStyle: { color: "var(--border-color)", type: "dashed" },
        },
      },
      yAxis: {
        type: "category",
        name: "Task Name",
        nameLocation: "start",
        data: allTaskNames,
        inverse: true,
        axisLabel: {
          color: "var(--text-secondary)",
          fontFamily: "var(--font-main)",
          interval: 0, // Force display of all labels
        },
        nameGap: 50,
      },
      series: [
        {
          name: "Bar1",
          type: "bar",
          data: allTaskNames.map((name) => {
            const found = cleanedData.find((item) => item.task_name === name);
            return found ? found.avg_duration : 0;
          }),
          barWidth: "35%",
          barCategoryGap: "40%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgba(144, 104, 255, 0.2)" },
              { offset: 1, color: "rgba(144, 104, 255, 0.9)" },
            ]),
            borderRadius: [0, 6, 6, 0],
          },
        },
        {
          name: "Bar2",
          type: "bar",
          data: allTaskNames.map((name) => {
            const found = rawData.find((item) => item.task_name === name);
            return found ? found.avg_duration : 0;
          }),
          barWidth: "35%",
          barCategoryGap: "40%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgba(255, 159, 64, 0.2)" },
              { offset: 1, color: "rgba(255, 159, 64, 0.9)" },
            ]),
            borderRadius: [0, 6, 6, 0],
          },
        },
      ],
      dataZoom: [
        {
          type: "slider",
          yAxisIndex: 0, // For horizontal charts, it is recommended to place dataZoom on the Y axis to control scrolling
          right: "20",
          start: 0,
          end: 100,
          borderColor: "var(--border-color)",
          handleStyle: { color: "var(--color-primary)" },
          fillerColor: "rgba(0, 229, 255, 0.1)",
        },
        {
          type: "inside",
          yAxisIndex: 0,
        },
      ],
    };

    this._taskDurationChartInstance.setOption(option, true);
  }

  private _updateTaskOverviewChart() {
    const chartDom = this.querySelector("#task-overview-chart") as HTMLElement;
    if (!chartDom) return;

    if (!this._taskOverviewChartInstance) {
      this._taskOverviewChartInstance = echarts.init(chartDom, "dark");
      window.addEventListener("resize", () =>
        this._taskOverviewChartInstance?.resize(),
      );
    }

    // Cleaned and raw data for 'All'
    const cleanedData = [...(this._allTaskStatsData.get("All") ?? [])].sort(
      (a, b) => b.count - a.count,
    );
    const rawData = [...(this._allRawTaskStatsData.get("All") ?? [])].sort(
      (a, b) => b.count - a.count,
    );

    // Use union of all task names for yAxis
    const allTaskNames = Array.from(
      new Set([
        ...cleanedData.map((item) => item.task_name),
        ...rawData.map((item) => item.task_name),
      ]),
    );

    if (allTaskNames.length === 0) {
      this._taskOverviewChartInstance.clear();
      return;
    }

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      legend: {
        data: ["Bar1", "Bar2"],
        bottom: 10,
        textStyle: { color: "var(--text-secondary)" },
        selectedMode: "multiple",
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          const cleanedBar = params.find((p: any) => p.seriesName === "Bar1");
          const rawBar = params.find((p: any) => p.seriesName === "Bar2");
          let html = "";
          if (cleanedBar) {
            const item = cleanedData.find(
              (d) => d.task_name === cleanedBar.name,
            );
            if (item) {
              html += `<div style="font-weight:bold; color:#00e5ff;">${cleanedBar.name}</div>`;
              html += `<div>Count: <b>${formatInteger(item.count)}</b></div>`;
              html += `<hr/>`;
            }
          }
          if (rawBar) {
            const item = rawData.find((d) => d.task_name === rawBar.name);
            if (item) {
              html += `<div style="font-weight:bold; color:#acc567;">${rawBar.name}</div>`;
              html += `<div>Count: <b>${formatInteger(item.count)}</b></div>`;
            }
          }
          return html;
        },
      },
      grid: { left: "3%", right: "8%", bottom: "80", containLabel: true },
      xAxis: {
        type: "value",
        name: "Count",
        nameLocation: "middle",
        nameGap: 40,
        axisLabel: { color: "var(--text-secondary)" },
        splitLine: {
          lineStyle: { color: "var(--border-color)", type: "dashed" },
        },
      },
      yAxis: {
        type: "category",
        name: "Task Name",
        nameLocation: "start",
        data: allTaskNames,
        inverse: true,
        axisLabel: { color: "var(--text-secondary)", interval: 0 },
      },
      series: [
        {
          name: "Bar1",
          type: "bar",
          data: allTaskNames.map((name) => {
            const found = cleanedData.find((item) => item.task_name === name);
            return found ? found.count : 0;
          }),
          barWidth: "35%",
          barCategoryGap: "40%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgba(0, 229, 255, 0.2)" },
              { offset: 1, color: "rgba(0, 229, 255, 0.8)" },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
        },
        {
          name: "Bar2",
          type: "bar",
          data: allTaskNames.map((name) => {
            const found = rawData.find((item) => item.task_name === name);
            return found ? found.count : 0;
          }),
          barWidth: "35%",
          barCategoryGap: "40%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgba(172, 197, 103, 0.2)" },
              { offset: 1, color: "rgba(172, 197, 103, 0.8)" },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
      dataZoom: [
        {
          type: "slider",
          yAxisIndex: 0,
          right: "20",
          start: 0,
          end: 100,
          borderColor: "var(--border-color)",
          handleStyle: { color: "var(--color-primary)" },
          fillerColor: "rgba(0, 229, 255, 0.1)",
        },
        {
          type: "inside",
          yAxisIndex: 0,
        },
      ],
    };

    this._taskOverviewChartInstance.setOption(option, true);
  }

  private _updateTotalDurationChart() {
    const chartDom = this.querySelector("#total-duration-chart") as HTMLElement;
    if (!chartDom) return;

    if (!this._totalDurationChartInstance) {
      this._totalDurationChartInstance = echarts.init(chartDom, "dark");
      window.addEventListener("resize", () =>
        this._totalDurationChartInstance?.resize(),
      );
    }

    // Cleaned and raw data for 'All'
    const cleanedData = [...(this._allTaskStatsData.get("All") ?? [])].sort(
      (a, b) => b.total_duration - a.total_duration,
    );
    const rawData = [...(this._allRawTaskStatsData.get("All") ?? [])].sort(
      (a, b) => b.total_duration - a.total_duration,
    );

    // Use union of all task names for yAxis
    const allTaskNames = Array.from(
      new Set([
        ...cleanedData.map((item) => item.task_name),
        ...rawData.map((item) => item.task_name),
      ]),
    );

    if (allTaskNames.length === 0) {
      this._totalDurationChartInstance.clear();
      return;
    }

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          const cleanedBar = params.find(
            (p: any) => p.seriesName === "Cleaned",
          );
          const rawBar = params.find((p: any) => p.seriesName === "Raw");
          let html = "";
          if (cleanedBar) {
            const item = cleanedData.find(
              (d) => d.task_name === cleanedBar.name,
            );
            if (item) {
              html += `<div style="font-weight:bold; color:#00e5ff;">${cleanedBar.name}</div>`;
              html += `<div>Total Duration: <b>${formatNumber(item.total_duration / 60)} hrs</b></div>`;
              html += `<hr/>`;
            }
          }
          if (rawBar) {
            const item = rawData.find((d) => d.task_name === rawBar.name);
            if (item) {
              html += `<div style="font-weight:bold; color:#acc567;">${rawBar.name}</div>`;
              html += `<div>Total Duration: <b>${formatNumber(item.total_duration / 60)} hrs</b></div>`;
            }
          }
          return html;
        },
      },
      grid: { left: "3%", right: "8%", bottom: "80", containLabel: true },
      xAxis: {
        type: "value",
        name: "Total Duration (hrs)",
        nameLocation: "middle",
        nameGap: 40,
        axisLabel: { color: "var(--text-secondary)" },
        splitLine: {
          lineStyle: { color: "var(--border-color)", type: "dashed" },
        },
      },
      yAxis: {
        type: "category",
        name: "Task Name",
        nameLocation: "start",
        data: allTaskNames,
        inverse: true,
        axisLabel: { color: "var(--text-secondary)", interval: 0 },
      },
      series: [
        {
          name: "Bar1",
          type: "bar",
          data: allTaskNames.map((name) => {
            const found = cleanedData.find((item) => item.task_name === name);
            return found ? found.total_duration / 60 : 0;
          }),
          barWidth: "35%",
          barCategoryGap: "40%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgba(0, 229, 255, 0.2)" },
              { offset: 1, color: "rgba(0, 229, 255, 0.8)" },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
        },
        {
          name: "Bar2",
          type: "bar",
          data: allTaskNames.map((name) => {
            const found = rawData.find((item) => item.task_name === name);
            return found ? found.total_duration / 60 : 0;
          }),
          barWidth: "35%",
          barCategoryGap: "40%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgba(172, 197, 103, 0.2)" },
              { offset: 1, color: "rgba(172, 197, 103, 0.8)" },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
      dataZoom: [
        {
          type: "slider",
          yAxisIndex: 0,
          right: "20",
          start: 0,
          end: 100,
          borderColor: "var(--border-color)",
          handleStyle: { color: "var(--color-primary)" },
          fillerColor: "rgba(0, 229, 255, 0.1)",
        },
        {
          type: "inside",
          yAxisIndex: 0,
        },
      ],
      legend: {
        data: ["Bar1", "Bar2"],
        bottom: 10,
        textStyle: { color: "var(--text-secondary)" },
        selectedMode: "multiple",
      },
    };

    this._totalDurationChartInstance.setOption(option, true);
  }

  private _toggleBotVisibility(botIds: string[]) {
    const selectedBotIds = new Set(botIds);

    if (
      selectedBotIds.size === this._visibleBots.size &&
      [...selectedBotIds].every((id) => this._visibleBots.has(id))
    ) {
      return;
    }
    this._visibleBots = selectedBotIds;

    this._fetchAllTaskStats({
      botIds: Array.from(this._visibleBots),
      taskIds: this._highPrioritytaskIds,
      startDate: this._dateRange
        ? dayjs(this._dateRange.from, "YYYYMMDD").toDate()
        : undefined,
      endDate: this._dateRange
        ? dayjs(this._dateRange.to, "YYYYMMDD").toDate()
        : undefined,
    });
  }

  private _setPresetRange(days: "all" | 7 | 30) {
    this._activePreset = days;
    const today = new Date();
    const startDate = new Date();

    if (days === "all") {
      this._dateRange = null;
      if (this.$commonDatepicker) {
        this.$commonDatepicker.setDate([]);
      }

      this._fetchAllTaskStats({
        botIds: Array.from(this._visibleBots),
        taskIds: this._highPrioritytaskIds,
      });
    } else {
      // including today
      startDate.setDate(today.getDate() - days + 1);

      this._dateRange = this._getDateRange(startDate, today);

      // sync to flatpickr
      this.$commonDatepicker?.setDate([startDate, today]);

      this._fetchAllTaskStats({
        botIds: Array.from(this._visibleBots),
        taskIds: this._highPrioritytaskIds,
        startDate,
        endDate: today,
      });
    }
  }

  render() {
    if (this._isLoading) {
      return html`<div class="text-center py-5">
        <div class="spinner-border text-info"></div>
      </div>`;
    }

    return html`
      ${this._taskAnalysisLoading
        ? html`<div class="text-center py-5">
            <div class="spinner-border text-info"></div>
          </div>`
        : html`<section
            class="card mb-4 border-0"
            style="background-color: var(--bg-surface); border-color: var(--border-color);  position: relative; z-index: 10;"
          >
            <div
              class="card-body d-flex flex-wrap align-items-center justify-content-between gap-4"
            >
              <div class="d-flex align-items-center gap-3">
                ${this.filterButtonsTemplate()}
              </div>

              <div class="d-flex align-items-center gap-2">
                <span class="text-secondary small fw-bold me-2"
                  >DISPLAY ROBOTS:</span
                >
                <robot-multi-select
                  @selection-change=${(e: CustomEvent) =>
                    this._toggleBotVisibility(e.detail.selected)}
                  .isLoading=${this._isLoading}
                  .id=${"task-analysis-robot-select"}
                  .storageKey=${"task-analysis-robot-select-selected"}
                ></robot-multi-select>
              </div>
            </div>
          </section>`}

      <div class="sub-section-header">
        <div class="accent-line"></div>
        <h5>Episode Count</h5>
      </div>

      ${this.taskOverviewTemplate()}

      <div class="sub-section-header">
        <div class="accent-line"></div>
        <h5>Total Duration</h5>
      </div>

      ${this.totalDurationTemplate()}

      <div class="sub-section-header">
        <div class="accent-line"></div>
        <h5>Average Duration</h5>
      </div>

      ${this.taskDurationTemplate()}
    `;
  }

  private commonDatePickerTemplate() {
    return html`
      <common-datepicker
        @date-change=${(e: CustomEvent) =>
          this._onDateChange(e.detail.selectedDates)}
        class="${this._activePreset === null ? "is-custom" : ""}"
      ></common-datepicker>
    `;
  }

  private filterButtonsTemplate() {
    return html`
      <div class="btn-group btn-group-sm">
        <button
          type="button"
          class="btn btn-sm ${this._activePreset === "all"
            ? "btn-primary"
            : "btn-outline-primary"}"
          @click=${() => this._setPresetRange("all")}
        >
          ALL
        </button>
        <button
          class="btn ${this._activePreset === 7
            ? "btn-primary"
            : "btn-outline-primary"}"
          @click=${() => this._setPresetRange(7)}
        >
          Last 7D
        </button>
        <button
          class="btn ${this._activePreset === 30
            ? "btn-primary"
            : "btn-outline-primary"}"
          @click=${() => this._setPresetRange(30)}
        >
          Last 30D
        </button>
      </div>
      ${this.commonDatePickerTemplate()}
    `;
  }

  private _onDurationChartSortChange(
    e: CustomEvent<{ sortKey: ChartSortKey }>,
  ) {
    this._durationChartSortKey = e.detail.sortKey;
    this._updateTaskDurationChart();
  }

  private taskDurationTemplate() {
    const cleanedData = this._allTaskStatsData.get("All") ?? [];
    const rawData = this._allRawTaskStatsData.get("All") ?? [];
    const maxDataLength = Math.max(cleanedData.length, rawData.length);
    const hasData = maxDataLength > 0 && !this._taskAnalysisLoading;
    return html`
      <section
        class="card mb-5 shadow-sm"
        style="background-color: var(--bg-surface); border-color: var(--border-color);"
      >
        <div class="card-body p-0 d-flex flex-column">
          <div class="d-flex justify-content-end px-4 pt-3">
            <chart-sort-filter
              .sortKey=${this._durationChartSortKey}
              @sort-change=${this._onDurationChartSortChange}
            ></chart-sort-filter>
          </div>
          <div class="py-4 px-lg-5" style="width: 100%;">
            <div
              class="summary-chart-wrapper"
              style="padding: 0 10px; width:100%; margin: 0 auto; position: relative;"
            >
              <div
                id="task-duration-chart"
                style="width: 100%; height: 700px; opacity: ${hasData ? 1 : 0};"
              ></div>
              ${!hasData
                ? html`
                    <div
                      class="text-center py-5"
                      style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"
                    >
                      ${this._taskAnalysisLoading
                        ? html`<div class="spinner-border text-info"></div>`
                        : html`<span class="text-secondary"
                            >No data to display.</span
                          >`}
                    </div>
                  `
                : null}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private totalDurationTemplate() {
    const cleanedData = this._allTaskStatsData.get("All") ?? [];
    const rawData = this._allRawTaskStatsData.get("All") ?? [];
    const maxDataLength = Math.max(cleanedData.length, rawData.length);
    const chartHeight = Math.max(700, maxDataLength * 44);
    const hasData = maxDataLength > 0 && !this._taskAnalysisLoading;

    return html`
      <section class="card mb-5 shadow-sm">
        <div class="card-body p-0">
          <div class="py-4 px-lg-5">
            <div class="summary-chart-wrapper" style="position: relative;">
              <div
                id="total-duration-chart"
                style="width: 100%; height: 700px; opacity: ${hasData ? 1 : 0};"
              ></div>
              ${!hasData
                ? html`
                    <div
                      class="text-center py-5"
                      style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"
                    >
                      ${this._taskAnalysisLoading
                        ? html`<div class="spinner-border text-info"></div>`
                        : html`<span class="text-secondary"
                            >No data to display.</span
                          >`}
                    </div>
                  `
                : null}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private taskOverviewTemplate() {
    const cleanedData = this._allTaskStatsData.get("All") ?? [];
    const rawData = this._allRawTaskStatsData.get("All") ?? [];
    const maxDataLength = Math.max(cleanedData.length, rawData.length);
    const hasData = maxDataLength > 0 && !this._taskAnalysisLoading;

    return html`
      <section class="card mb-5 shadow-sm">
        <div class="card-body p-0">
          <div class="py-4 px-lg-5">
            <div class="summary-chart-wrapper" style="position: relative;">
              <div
                id="task-overview-chart"
                style="width: 100%; height: 700px; opacity: ${hasData ? 1 : 0};"
              ></div>
              ${!hasData
                ? html`
                    <div
                      class="text-center py-5"
                      style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"
                    >
                      ${this._taskAnalysisLoading
                        ? html`<div class="spinner-border text-info"></div>`
                        : html`<span class="text-secondary"
                            >No data to display.</span
                          >`}
                    </div>
                  `
                : null}
            </div>
          </div>
        </div>
      </section>
    `;
  }
}
