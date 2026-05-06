import dayjs from "dayjs";
import * as echarts from "echarts";

import { LitElement, html } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { RobotService } from "../api/robot-service";
import { CommonDatepicker } from "../components/common-datepicker";
import { notify } from "../components/notify";
import {
  EffectiveRobotStats,
  RobotDatasetResponse,
  RobotStats,
} from "../types/api";
import { ACTIVE_ROBOT_IDS, ALERT_TYPE, ROBOT_IDS } from "../types/constants";

import "../components/common-datepicker";
import { minToHour } from "../utils/date-format";
import "./robot-activity-card";
import "./robot-multi-select";

@customElement("robot-activity")
export class RobotActivity extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  private _collectedHoursChartInstance: echarts.ECharts | null = null;
  private _effectiveHoursChartInstance: echarts.ECharts | null = null;

  @query("common-datepicker") $commonDatepicker!: CommonDatepicker;
  @state() private _allRobotsData: Map<string, RobotDatasetResponse> =
    new Map();
  @state() private _visibleBots: Set<string> = new Set(
    Object.values(ACTIVE_ROBOT_IDS),
  );
  @state() private _allEffectiveRobotsData: Map<string, EffectiveRobotStats[]> =
    new Map([...this._visibleBots].map((botId) => [botId, []]));

  @state() private _activePreset: "all" | 7 | 30 | null = "all";
  @state() private _dateRange: { from: string; to: string } | null = null;
  @state() private _isLoading = true;
  @state() private _isEffectiveLoading = true;
  @state() private _showScrollHint = true;

  private _robotIds = Object.values(ROBOT_IDS);

  protected updated(changedProperties: Map<string, any>) {
    if (this._allRobotsData.size > 0 && !this._isLoading) {
      this._updateCollectedHoursChart();
    }

    if (this._allEffectiveRobotsData.size > 0 && !this._isLoading) {
      this._updateEffectiveHoursChart();
    }
  }

  async firstUpdated() {
    try {
      this._dateRange = null;
      await this._fetchAllData();
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

  private async _fetchAllData() {
    this._fetchDataset();
    this._fetchEffectiveDataset();
  }

  private async _fetchDataset() {
    try {
      const results = await Promise.all(
        this._robotIds.map((id) => RobotService.getBotDataset(id)),
      );
      results.forEach((res) => {
        this._allRobotsData.set(res.bot_id, res);
      });

      this.requestUpdate();
    } catch (error) {
      notify("Failed to load data. Please try again later.", {
        variant: ALERT_TYPE.DANGER,
        icon: "exclamation-triangle",
        duration: 3000,
      });
      console.error("Failed to fetch robot dataset:", error);
    }
  }

  private async _fetchEffectiveDataset() {
    this._isEffectiveLoading = true;
    try {
      const results = await RobotService.getEffectiveBotDataset();

      results.forEach((stat) => {
        const items = this._allEffectiveRobotsData.get(stat.bot_id);

        if (!items) return;

        items.push(stat);
      });

      this.requestUpdate();
    } catch (error) {
      notify("Failed to load data. Please try again later.", {
        variant: ALERT_TYPE.DANGER,
        icon: "exclamation-triangle",
        duration: 3000,
      });
      console.error("Failed to fetch effective robot dataset:", error);
    } finally {
      this._isEffectiveLoading = false;
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

  private _calculateData(
    isEffective: boolean = false,
  ): { botId: string; total: number }[] {
    return this._robotIds
      .filter((id) => this._visibleBots.has(id))
      .map((id) => {
        const filteredData = this._getFilteredData(id, true, isEffective);
        const totalDuration = filteredData.reduce(
          (acc, curr) => acc + curr.duration,
          0,
        );
        return { botId: id, total: totalDuration };
      });
  }

  private _updateCollectedHoursChart() {
    const chartDom = this.querySelector("#summary-chart") as HTMLElement;
    if (!chartDom) return;

    if (!this._collectedHoursChartInstance) {
      this._collectedHoursChartInstance = echarts.init(chartDom, "dark");
      window.addEventListener("resize", () =>
        this._collectedHoursChartInstance?.resize(),
      );
    }

    const data = this._calculateData();

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        formatter: "{b}: {c} hrs",
      },
      grid: {
        top: "30",
        left: "40",
        right: "20",
        bottom: "30",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.botId),
        axisLabel: { color: "var(--text-secondary)", fontWeight: "bold" },
      },
      yAxis: {
        type: "value",
        name: "Total Hours",
        splitLine: {
          lineStyle: { color: "var(--border-color)", type: "dashed" },
        },
      },
      series: [
        {
          data: data.map((d) => d.total.toFixed(1)),
          type: "bar",
          barWidth: "40%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(255, 193, 7, 0.8)" },
              { offset: 1, color: "rgba(255, 193, 7, 0.1)" },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };

    this._collectedHoursChartInstance.setOption(option);
  }

  private _updateEffectiveHoursChart() {
    const chartDom = this.querySelector(
      "#effective-hours-chart",
    ) as HTMLElement;
    if (!chartDom) return;

    if (!this._effectiveHoursChartInstance) {
      this._effectiveHoursChartInstance = echarts.init(chartDom, "dark");
      window.addEventListener("resize", () =>
        this._effectiveHoursChartInstance?.resize(),
      );
    }

    const data = this._calculateData(true);

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        formatter: "{b}: {c} hrs",
      },
      grid: {
        top: "30",
        left: "40",
        right: "20",
        bottom: "30",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.botId),
        axisLabel: { color: "var(--text-secondary)", fontWeight: "bold" },
      },
      yAxis: {
        type: "value",
        name: "Total Hours",
        splitLine: {
          lineStyle: { color: "var(--border-color)", type: "dashed" },
        },
      },
      series: [
        {
          data: data.map((d) => d.total.toFixed(1)),
          type: "bar",
          barWidth: "40%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(0, 255, 159, 0.8)" },
              { offset: 1, color: "rgba(0, 255, 159, 0.1)" },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };

    this._effectiveHoursChartInstance?.setOption(option);
  }

  private _toggleBotVisibility(botIds: string[]) {
    this._visibleBots = new Set(botIds);
  }

  private _getFilteredData(
    botId: string,
    isHour?: boolean,
    isEffective: boolean = false,
  ): RobotStats[] {
    const fullData = isEffective
      ? this._allEffectiveRobotsData.get(botId) || []
      : this._allRobotsData.get(botId)?.dataset || [];
    const filtered = !this._dateRange
      ? fullData
      : fullData.filter(
          (item) =>
            item.date >= this._dateRange!.from &&
            item.date <= this._dateRange!.to,
        );

    return filtered.map((item) => ({
      ...item,
      duration: isHour ? minToHour(item.duration) : item.duration,
    }));
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
    } else {
      // including today
      startDate.setDate(today.getDate() - days + 1);

      this._dateRange = this._getDateRange(startDate, today);

      // sync to flatpickr
      this.$commonDatepicker?.setDate([startDate, today]);
    }
  }

  render() {
    if (this._isLoading) {
      return html`<div class="text-center py-5">
        <div class="spinner-border text-info"></div>
      </div>`;
    }

    return html`
      <section
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
              .id=${"robot-activity-multi-select"}
              .storageKey=${"robot-activity-multi-select-selected"}
            ></robot-multi-select>
          </div>
        </div>
      </section>

      <div class="row g-4 mt-2">
        <div class="sub-section-header mt-4 mb-0">
          <div class="accent-line"></div>
          <h5>Summary</h5>
        </div>

        <div class="col-12 col-xxl-6">
          <div class="h-100">${this.CollectedHoursChartTemplate()}</div>
        </div>

        <div class="col-12 col-xxl-6">
          <div class="h-100">${this.effectiveHoursChartTemplate()}</div>
        </div>
      </div>

      <div class="sub-section-header" style="margin-top: 1rem;">
        <div class="accent-line"></div>
        <h5>Individual Data</h5>
      </div>

      <div style="position: relative;">
        <div
          class="row row-cols-1 row-cols-md-2 row-cols-xl-2 g-4"
          style="max-height: calc(1200px + 2rem); overflow-y: auto;"
          @scroll=${this._onCardsScroll}
        >
          ${this.robotCardsTemplate()}
        </div>

        ${this._visibleBots.size > 4 && this._showScrollHint
          ? html`
              <div
                class="scroll-indicator"
                style="
                  position: absolute;
                  bottom: 0;
                  left: 0;
                  right: 0;
                  height: 80px;
                  background: linear-gradient(to bottom, transparent, var(--bg-main) 80%);
                  pointer-events: none;
                  display: flex;
                  align-items: flex-end;
                  justify-content: center;
                  padding-bottom: 8px;
                "
              >
                <div
                  style="
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--text-primary);
                    font-size: 1.2rem;
                    animation: bounce 1.5s infinite;
                  "
                >
                  <sl-icon
                    name="chevron-double-down"
                    style="font-size: 1rem;"
                  ></sl-icon>
                  <span>Scroll for more data</span>
                  <sl-icon
                    name="chevron-double-down"
                    style="font-size: 1rem;"
                  ></sl-icon>
                </div>
              </div>
            `
          : ""}
      </div>

      <style>
        @keyframes bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(5px);
          }
        }
      </style>
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

  private CollectedHoursChartTemplate() {
    const data = this._calculateData();
    const grandTotal = data.reduce((acc, curr) => acc + curr.total, 0);

    return html`
      <section
        class="card mb-5 shadow-sm"
        style="background-color: var(--bg-surface); border-color: var(--border-color);"
      >
        <div
          class="card-header border-bottom d-flex justify-content-between align-items-center py-3"
          style="border-color: var(--border-color) !important;"
        >
          <h5
            class="card-title mb-0 text-uppercase"
            style="font-size: .9rem; color: #ffc107cc; font-weight: 700; letter-spacing: 1px;"
          >
            Collected Hours
          </h5>
        </div>

        <div class="card-body p-0 d-flex flex-column">
          <div class="py-4 px-lg-5">
            <div class="summary-chart-wrapper" style="padding: 0 10px;">
              <div id="summary-chart" style="width: 100%; height: 280px;"></div>
            </div>
          </div>

          <div
            class="table-responsive"
            style="border-top: 1px solid var(--border-color);"
          >
            <table
              class="table table-dark table-sm table-hover mb-0"
              style="--bs-table-bg: transparent;"
            >
              <thead>
                <tr
                  style="font-size: 0.75rem; color: var(--text-muted); border-bottom: 1px solid var(--border-color);"
                >
                  <th class="ps-4 py-2">ROBOT ID</th>
                  <th class="pe-4 py-2 text-end">PERIOD TOTAL (HRS)</th>
                </tr>
              </thead>
              <tbody style="font-family: var(--font-mono); font-size: 0.85rem;">
                ${data.map(
                  (item) => html`
                    <tr>
                      <td style="color: #ffc107cc;" class="ps-4 py-2 fw-bold">
                        ${item.botId.toUpperCase()}
                      </td>
                      <td class="pe-4 py-2 text-end text-white">
                        ${item.total.toFixed(1)}
                      </td>
                    </tr>
                  `,
                )}
              </tbody>
              <tfoot
                style="border-top: 2px solid var(--border-color); background: rgba(0, 229, 255, 0.05);"
              >
                <tr class="fw-bold">
                  <td class="ps-4 py-3">
                    <i class="bi bi-calculator me-2"></i>
                    <span style="font-size: 0.9rem;">GRAND TOTAL</span>
                  </td>
                  <td
                    style="color: #ffc107cc;"
                    class="pe-4 py-3 text-end"
                    style="font-size: 1.1rem; letter-spacing: 1px;"
                  >
                    ${grandTotal.toFixed(1)}
                    <small class="text-muted ms-1" style="font-size: 0.7rem;"
                      >hrs</small
                    >
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  private effectiveHoursChartTemplate() {
    const data = this._calculateData(true);
    const grandTotal = data.reduce((acc, curr) => acc + curr.total, 0);

    return html`
      <section
        class="card mb-5 shadow-sm"
        style="background-color: var(--bg-surface); border-color: var(--border-color);"
      >
        <div
          class="card-header border-bottom d-flex justify-content-between align-items-center py-3"
          style="border-color: var(--border-color) !important;"
        >
          <h5
            class="card-title mb-0 text-uppercase"
            style="font-size: .9rem; color: rgba(0, 255, 159, 0.8); font-weight: 700; letter-spacing: 1px;"
          >
            Effective Hours
          </h5>
        </div>

        ${this._isEffectiveLoading
          ? html`
              <div
                class="card-body d-flex justify-content-center align-items-center"
                style="min-height: 400px;"
              >
                <div class="spinner-border text-info" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
            `
          : html`<div class="card-body p-0 d-flex flex-column">
              <div class="py-4 px-lg-5">
                <div
                  class="effective-hours-chart-wrapper"
                  style="padding: 0 10px;"
                >
                  <div
                    id="effective-hours-chart"
                    style="width: 100%; height: 280px;"
                  ></div>
                </div>
              </div>

              <div
                class="table-responsive"
                style="border-top: 1px solid var(--border-color);"
              >
                <table
                  class="table table-dark table-sm table-hover mb-0"
                  style="--bs-table-bg: transparent;"
                >
                  <thead>
                    <tr
                      style="font-size: 0.75rem; color: var(--text-muted); border-bottom: 1px solid var(--border-color);"
                    >
                      <th class="ps-4 py-2">ROBOT ID</th>
                      <th class="pe-4 py-2 text-end">PERIOD TOTAL (HRS)</th>
                    </tr>
                  </thead>
                  <tbody
                    style="font-family: var(--font-mono); font-size: 0.85rem;"
                  >
                    ${data.map(
                      (item) => html`
                        <tr>
                          <td
                            style="color: rgba(0, 255, 159, 0.8);"
                            class="ps-4 py-2 fw-bold"
                          >
                            ${item.botId.toUpperCase()}
                          </td>
                          <td class="pe-4 py-2 text-end text-white">
                            ${item.total.toFixed(1)}
                          </td>
                        </tr>
                      `,
                    )}
                  </tbody>
                  <tfoot
                    style="border-top: 2px solid var(--border-color); background: rgba(0, 229, 255, 0.05);"
                  >
                    <tr class="fw-bold">
                      <td class="ps-4 py-3 text-white">
                        <i class="bi bi-calculator me-2"></i>
                        <span style="font-size: 0.9rem;">GRAND TOTAL</span>
                      </td>
                      <td
                        style="color: rgba(0, 255, 159, 0.8);"
                        class="pe-4 py-3 text-end"
                        style="font-size: 1.1rem; letter-spacing: 1px;"
                      >
                        ${grandTotal.toFixed(1)}
                        <small
                          class="text-muted ms-1"
                          style="font-size: 0.7rem;"
                          >hrs</small
                        >
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>`}
      </section>
    `;
  }

  private _onCardsScroll(e: Event) {
    const target = e.target as HTMLElement;
    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    this._showScrollHint = !isNearBottom;
  }

  private robotCardsTemplate() {
    return html`
      ${this._robotIds
        .filter((id) => this._visibleBots.has(id))
        .map(
          (id) => html`
            <div class="col animate-fade-in">
              <robot-activity-card
                .botId=${id}
                .data=${this._getFilteredData(id)}
              ></robot-activity-card>
            </div>
          `,
        )}
    `;
  }
}
