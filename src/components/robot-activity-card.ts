import dayjs from "dayjs";
import * as echarts from "echarts";
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { RobotStats } from "../types/api";

@customElement("robot-activity-card")
export class RobotActivityCard extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  @property({ type: String }) botId = "";
  @property({ type: Array }) data: RobotStats[] = [];
  @property({ type: String }) theme: "light" | "dark" = "dark";

  private _chartInstance: echarts.ECharts | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  protected firstUpdated() {
    this._initChart();
    this._setupResizeObserver();
  }

  /**
   * life cycle：when the data or theme change
   */
  protected updated(changedProperties: Map<string, any>) {
    if (changedProperties.has("data") || changedProperties.has("theme")) {
      this._updateChart();
    }
  }

  /**
   * life cycle：release resouce when the component destory
   */
  disconnectedCallback() {
    super.disconnectedCallback();
    this._chartInstance?.dispose();
    this._resizeObserver?.disconnect();
  }

  private _initChart() {
    const chartDom = this.querySelector(`#chart-${this.botId}`) as HTMLElement;
    if (!chartDom) return;

    this._chartInstance = echarts.init(chartDom, this.theme);
  }

  private _setupResizeObserver() {
    const chartContainer = this.querySelector(
      `.chart-container`,
    ) as HTMLElement;
    if (!chartContainer) return;

    this._resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (this._chartInstance) {
          this._chartInstance.resize();
        }
      });
    });
    this._resizeObserver.observe(chartContainer);
  }

  private _updateChart() {
    if (!this._chartInstance) return;

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          const item = params[0];
          return `<div style="font-family: var(--font-main); font-size: 12px;">
                    <div style="font-weight: bold; margin-bottom: 4px;">Date: ${item.name}</div>
                    <div style="color: rgb(3, 182, 202)">Duration: ${item.value} min</div>
                  </div>`;
        },
      },
      grid: {
        left: "10",
        right: "20",
        bottom: "60",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: this.data
          .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix())
          .map((item) => dayjs(item.date).format("MM/DD")),
        axisLabel: {
          color: "var(--text-secondary)",
          fontFamily: "var(--font-mono)",
        },
      },
      yAxis: {
        type: "value",
        name: "Min",
        axisLabel: { color: "var(--text-secondary)" },
        splitLine: {
          lineStyle: { color: "var(--border-color)", type: "dashed" },
        },
      },
      series: [
        {
          name: "Duration",
          type: "bar",
          data: this.data.map((item) => item.duration),
          barWidth: "60%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(0, 229, 255, 0.8)" },
              { offset: 1, color: "rgba(0, 229, 255, 0.2)" },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(0, 229, 255, 1)" },
                { offset: 0.7, color: "rgba(0, 229, 255, 0.4)" },
              ]),
            },
          },
        },
      ],
      dataZoom: [
        {
          type: "slider",
          left: "10%",
          right: "10%",
          start: 0,
          end: 100,
          height: 24,
          bottom: 15,
          borderColor: "var(--border-color)",
          textStyle: {
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          },
          handleStyle: { color: "var(--color-primary)" },
          fillerColor: "rgba(0, 229, 255, 0.1)",
        },
      ],
    };

    this._chartInstance.setOption(option, true);
  }

  render() {
    return html`
      <div
        class="card h-100 shadow-sm"
        style="background-color: var(--bg-surface); border-color: var(--border-color);"
      >
        <div
          class="card-header border-bottom d-flex justify-content-between align-items-center py-3"
          style="border-color: var(--border-color) !important;"
        >
          <h5
            class="card-title mb-0"
            style="font-size: 0.9rem; color: var(--color-primary); font-weight: 700; letter-spacing: 1px;"
          >
            ${this.botId.toUpperCase()}
          </h5>
        </div>

        <div
          class="card-body p-0 d-flex flex-column"
          style="position: relative; width: 100%;"
        >
          <div class="chart-container" style="width: 100%; padding: 10px;">
            <div
              id="chart-${this.botId}"
              style="width: 100%; height: 300px;"
            ></div>
          </div>

          <div
            class="table-responsive"
            style="max-height: 200px; border-top: 1px solid var(--border-color);"
          >
            <table
              class="table table-dark table-sm table-hover mb-0"
              style="--bs-table-bg: transparent;"
            >
              <thead
                class="sticky-top"
                style="background-color: var(--bg-surface);"
              >
                <tr
                  style="font-size: 0.75rem; color: var(--text-muted); border-bottom: 1px solid var(--border-color);"
                >
                  <th class="ps-3 py-2">DATE</th>
                  <th class="pe-3 py-2 text-end">DURATION (MIN)</th>
                </tr>
              </thead>
              <tbody style="font-family: var(--font-mono); font-size: 0.85rem;">
                ${[...this.data]
                  .sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix())
                  .map(
                    (item) => html`
                      <tr style="cursor: pointer;" class="hover-row">
                        <td class="ps-3 py-2 text-info">
                          ${dayjs(item.date).format("YYYY/MM/DD")}
                        </td>
                        <td class="pe-3 py-2 text-end text-white">
                          ${item.duration.toFixed(1)}
                        </td>
                      </tr>
                    `,
                  )}
                ${this.data.length === 0
                  ? html`<tr>
                      <td colspan="2" class="text-center py-4 text-muted">
                        No data available in selected range
                      </td>
                    </tr>`
                  : ""}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}
