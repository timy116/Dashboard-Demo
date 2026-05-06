import dayjs from "dayjs";
import * as echarts from "echarts";

import { html, LitElement } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { TaskStats } from "../types/api";
import { ACTIVE_ROBOT_IDS, ALERT_TYPE, ROBOT_IDS } from "../types/constants";
import { formatInteger, formatNumber } from "../utils/number-format";
import { notify } from "./notify";

import { RobotService } from "../api/robot-service";
import { TaskStatsQuery } from "../types/api";
import "./chart-sort-filter";
import { ChartSortKey } from "./chart-sort-filter";
import "./common-datepicker";
import { CommonDatepicker } from "./common-datepicker";
import "./robot-multi-select";
import "./task-analysis-card";

@customElement("subtask-analysis")
export class SubtaskAnalysis extends LitElement {
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
  @state() private _subTaskAnalysisLoading = true;
  @state() private _durationChartSortKey: ChartSortKey = "count";
  @state() private _hasBeenVisible = false;

  private _robotIds = Object.values(ROBOT_IDS);
  private _taskMap: Map<number, string> = new Map();
  private _highPrioritytaskIds: number[] = [];

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
    await this.fetchTaskStats({
      botIds: Array.from(this._visibleBots),
      isSubtask: true,
    });
  }

  private async fetchTaskStats(query: TaskStatsQuery) {
    try {
      this._subTaskAnalysisLoading = true;
      const taskStats = (await RobotService.getTaskStats(query)) as TaskStats[];

      const nextAllTaskStatsData = new Map<string, TaskStats[]>(
        [...this._visibleBots, "All"].map((botId) => [botId, []]),
      );

      taskStats.forEach((stat) => {
        const items = nextAllTaskStatsData.get(stat.bot_id);
        if (!items) return;
        items.push(stat);
      });

      this._allTaskStatsData = nextAllTaskStatsData;
    } catch (error) {
      console.error("Failed to fetch task stats:", error);
    } finally {
      this._subTaskAnalysisLoading = false;
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

      this.fetchTaskStats({
        botIds: Array.from(this._visibleBots),
        taskIds: this._highPrioritytaskIds,
        startDate: start,
        endDate: end,
        isSubtask: true,
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

    const sortedData = [...(this._allTaskStatsData.get("All") ?? [])].sort(
      (a, b) => b[this._durationChartSortKey] - a[this._durationChartSortKey],
    );

    if (sortedData.length === 0) {
      this._taskDurationChartInstance.clear();
      return;
    }
    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          // Find the data for the bar series and the custom series
          const bar = params.find((p: any) => p.seriesType === "bar");
          const custom = params.find((p: any) => p.seriesType === "custom");
          if (!bar) return "";

          // Get the original object from the custom data (including min/max/count)
          const raw = sortedData[bar.dataIndex];

          return `
          <div style="font-family: var(--font-main); font-size: 12px; min-width: 180px; color: #333;">
            <div
              style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; color: #000;"
            >
              ${bar.name}
            </div>

            <!-- Part 1: Summary Metrics -->
            <div style="margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span>Total Duration:</span>
                <span style="font-family: var(--font-mono); font-weight: bold;"
                  >${formatNumber(raw.total_duration)} min</span
                >
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span>Avg Duration:</span>
                <span style="font-weight: bold; color: rgba(73, 40, 163, 0.9)">${formatNumber(raw.avg_duration * 60)} sec</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span>Count:</span>
                <span style="font-family: var(--font-mono)">${formatInteger(raw.count)}</span>
              </div>
            </div>

            <div style="border-top: 1px dashed #ccc; padding-top: 8px; margin-top: 4px;">
              <div style="font-weight: bold; color: #666; font-size: 11px; margin-bottom: 5px;">
                Performance Reliability
              </div>

              <!-- Median explained as Most Likely -->
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span>Most Likely:</span>
                <span style="font-weight: bold;">${formatNumber(raw.median_duration * 60)} sec</span>
              </div>

              <!-- Range explained as Usual Range -->
              <div style="display: flex; justify-content: space-between;">
                <span>Usual Range:</span>
                <span style="font-weight: bold; color: #2c3e50;"
                  >${formatNumber(raw.min_bound * 60)} - ${formatNumber(raw.max_bound * 60)} sec</span
                >
              </div>

              <!-- Small hint for non-tech users -->
              <div style="font-size: 0.8rem; color: #999; margin-top: 4px; line-height: 1.2;">
                * Range covers 90% of normal tasks.
              </div>
            </div>
          </div>
          `;
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
        name: "Average Duration (sec)",
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

        data: sortedData.map((item) => item.task_name),
        inverse: true,
        axisLabel: {
          color: "var(--text-secondary)",
          fontFamily: "var(--font-main)",
          interval: 0, // Force display of all labels
        },
      },
      series: [
        {
          name: "Avg Duration",
          type: "bar",
          data: sortedData.map((item) => item.avg_duration * 60), // Convert to seconds for better readability
          barWidth: "60%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgba(144, 104, 255, 0.2)" },
              { offset: 1, color: "rgba(144, 104, 255, 0.9)" },
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

    const sortedData = [...(this._allTaskStatsData.get("All") ?? [])].sort(
      (a, b) => b.count - a.count,
    );

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: "{b}: <b>{c}</b> times",
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
        data: sortedData.map((item) => item.task_name),
        inverse: true,
        axisLabel: { color: "var(--text-secondary)", interval: 0 },
      },
      series: [
        {
          name: "Task Count",
          type: "bar",
          data: sortedData.map((item) => item.count),
          barWidth: "60%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgba(0, 229, 255, 0.2)" },
              { offset: 1, color: "rgba(0, 229, 255, 0.8)" },
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
          end: 20,
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

    this._taskOverviewChartInstance.setOption(option);
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

    const sortedData = [...(this._allTaskStatsData.get("All") ?? [])].sort(
      (a, b) => b.total_duration - a.total_duration,
    );

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: "{b}: <b>{c}</b> min",
      },
      grid: { left: "3%", right: "8%", bottom: "80", containLabel: true },
      xAxis: {
        type: "value",
        name: "Total Duration (min)",
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
        data: sortedData.map((item) => item.task_name),
        inverse: true,
        axisLabel: { color: "var(--text-secondary)", interval: 0 },
      },
      series: [
        {
          name: "Total Duration",
          type: "bar",
          data: sortedData.map((item) => item.total_duration),
          barWidth: "60%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgba(0, 229, 255, 0.2)" },
              { offset: 1, color: "rgba(0, 229, 255, 0.8)" },
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
          end: 20,
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

    this._totalDurationChartInstance.setOption(option);
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

    this.fetchTaskStats({
      botIds: Array.from(this._visibleBots),
      taskIds: this._highPrioritytaskIds,
      startDate: this._dateRange
        ? dayjs(this._dateRange.from, "YYYYMMDD").toDate()
        : undefined,
      endDate: this._dateRange
        ? dayjs(this._dateRange.to, "YYYYMMDD").toDate()
        : undefined,
      isSubtask: true,
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

      this.fetchTaskStats({
        botIds: Array.from(this._visibleBots),
        taskIds: this._highPrioritytaskIds,
        isSubtask: true,
      });
    } else {
      // including today
      startDate.setDate(today.getDate() - days + 1);

      this._dateRange = this._getDateRange(startDate, today);

      // sync to flatpickr
      this.$commonDatepicker?.setDate([startDate, today]);

      this.fetchTaskStats({
        botIds: Array.from(this._visibleBots),
        taskIds: this._highPrioritytaskIds,
        startDate,
        endDate: today,
        isSubtask: true,
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
      ${this._subTaskAnalysisLoading
        ? html`<div class="text-center py-5">
            <div class="spinner-border text-info"></div>
          </div>`
        : html`<section
            class="card mb-4 border-0"
            style="background-color: var(--bg-surface); border-color: var(--border-color); position: relative; z-index: 10;"
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
                  .id=${"subtask-analysis-robot-select"}
                ></robot-multi-select>
              </div>
            </div>
          </section>`}

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
    const allData = this._allTaskStatsData.get("All") ?? [];
    const chartHeight = Math.max(360, allData.length * 44);
    const hasData = allData.length > 0 && !this._subTaskAnalysisLoading;
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
                style="width: 100%; height: 650px; opacity: ${hasData ? 1 : 0};"
              ></div>
              ${!hasData
                ? html`
                    <div
                      class="text-center py-5"
                      style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"
                    >
                      ${this._subTaskAnalysisLoading
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
