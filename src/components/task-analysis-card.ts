import * as echarts from 'echarts'
import { LitElement, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { TaskStats } from '../types/api'

@customElement('task-analysis-card')
export class TaskAnalysisCard extends LitElement {
  protected createRenderRoot() {
    return this
  }

  @property({ type: String }) botId = ''
  @property({ type: Array }) data: TaskStats[] = []
  @property({ type: String }) theme: 'light' | 'dark' = 'dark'
  @property({ type: Boolean }) isLoading = false

  private _chartInstance: echarts.ECharts | null = null
  private _resizeObserver: ResizeObserver | null = null

  protected firstUpdated() {
    this._initChart()
    this._setupResizeObserver()
  }

  /**
   * life cycle：when the data or theme change
   */
  protected updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('data') || changedProperties.has('theme') || changedProperties.has('isLoading')) {
      this._updateChart()
    }
  }

  /**
   * life cycle：release resouce when the component destory
   */
  disconnectedCallback() {
    super.disconnectedCallback()
    this._chartInstance?.dispose()
    this._resizeObserver?.disconnect()
  }

  private _initChart() {
    const chartDom = this.querySelector(`#chart-${this.botId}`) as HTMLElement
    if (!chartDom) return

    this._chartInstance = echarts.init(chartDom, this.theme)
  }

  private _setupResizeObserver() {
    const chartContainer = this.querySelector(`.chart-container`) as HTMLElement
    if (!chartContainer) return

    this._resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (this._chartInstance) {
          this._chartInstance.resize()
        }
      })
    })
    this._resizeObserver.observe(chartContainer)
  }

  private _updateChart() {
    if (!this._chartInstance) return

    const sortedData = this.data.sort((a, b) => b.avg_duration - a.avg_duration)
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          // Find the data for the bar series and the custom series
          const bar = params.find((p: any) => p.seriesType === 'bar')
          const custom = params.find((p: any) => p.seriesType === 'custom')
          if (!bar) return ''

          // Get the original object from the custom data (including min/max/count)
          const raw = sortedData[bar.dataIndex]

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
                      >${raw.total_duration.toFixed(2)} min</span
                    >
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span>Avg Duration:</span>
                    <span style="font-weight: bold; color: rgba(73, 40, 163, 0.9)">${raw.avg_duration.toFixed(2)} min</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span>Count:</span>
                    <span style="font-family: var(--font-mono)">${raw.count}</span>
                  </div>
                </div>

                <div style="border-top: 1px dashed #ccc; padding-top: 8px; margin-top: 4px;">
                  <div style="font-weight: bold; color: #666; font-size: 11px; margin-bottom: 5px;">
                    Performance Reliability
                  </div>

                  <!-- Median explained as Most Likely -->
                  <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span>Most Likely:</span>
                    <span style="font-weight: bold;">${raw.median_duration.toFixed(2)} min</span>
                  </div>

                  <!-- Range explained as Usual Range -->
                  <div style="display: flex; justify-content: space-between;">
                    <span>Usual Range:</span>
                    <span style="font-weight: bold; color: #2c3e50;"
                      >${raw.min_bound.toFixed(2)} - ${raw.max_bound.toFixed(2)} min</span
                    >
                  </div>

                  <!-- Small hint for non-tech users -->
                  <div style="font-size: 0.8rem; color: #999; margin-top: 4px; line-height: 1.2;">
                    * Range covers 90% of normal tasks.
                  </div>
                </div>
              </div>
              `
        },
      },
      grid: {
        left: '3%',
        right: '8%',
        bottom: '80',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: 'Average Duration (min)',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { color: 'var(--text-secondary)' },
        splitLine: {
          lineStyle: { color: 'var(--border-color)', type: 'dashed' },
        },
      },
      yAxis: {
        type: 'category',
        name: 'Task Name',
        nameLocation: 'start',

        data: sortedData.map(item => item.task_name),
        inverse: true,
        axisLabel: {
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-main)',
          interval: 0, // Force display of all labels
        },
      },
      series: [
        {
          name: 'Avg Duration',
          type: 'bar',
          data: sortedData.map(item => item.avg_duration),
          barWidth: '60%',
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: 'rgba(144, 104, 255, 0.2)' },
              { offset: 1, color: 'rgba(144, 104, 255, 0.9)' },
            ]),
            borderRadius: [0, 6, 6, 0],
          },
        },
      ],
      dataZoom: [
        {
          type: 'slider',
          yAxisIndex: 0, // For horizontal charts, it is recommended to place dataZoom on the Y axis to control scrolling
          right: '20',
          start: 0,
          end: 100,
          borderColor: 'var(--border-color)',
          handleStyle: { color: 'var(--color-primary)' },
          fillerColor: 'rgba(0, 229, 255, 0.1)',
        },
        {
          type: 'inside',
          yAxisIndex: 0,
        },
      ],
    }

    this._chartInstance.setOption(option, true)
  }

  render() {
    const chartHeight = Math.max(360, (this.data ?? []).length * 22)
    const hasData = this.data.length > 0 && !this.isLoading

    return html`
      <div class="card h-100 shadow-sm" style="background-color: var(--bg-surface); border-color: var(--border-color);">
        <div
          class="card-header border-bottom d-flex justify-content-between align-items-center py-3"
          style="border-color: var(--border-color) !important;"
        >
          <h5 class="card-title mb-0" style="color: var(--color-primary); font-weight: 700; letter-spacing: 1px;">
            ${this.botId.toUpperCase()}
          </h5>
        </div>

        <div class="card-body p-0 d-flex flex-column" style="position: relative; width: 100%;">
          <div class="chart-container" style="width: 100%; padding: 10px;">
            <div
              id="chart-${this.botId}"
              style="width: 100%; height: ${chartHeight}px;  opacity: ${hasData ? 1 : 0};"
            ></div>
            ${!hasData
              ? html`
                  <div
                    class="text-center py-5"
                    style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"
                  >
                    ${this.isLoading
                      ? html`<div class="spinner-border text-info"></div>`
                      : html`<span class="text-secondary">No data to display.</span>`}
                  </div>
                `
              : null}
          </div>
        </div>
      </div>
    `
  }
}
