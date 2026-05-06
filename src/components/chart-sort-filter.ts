import { html, LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'

export type ChartSortKey = 'count' | 'avg_duration' | 'total_duration'

export interface ChartSortOption {
  key: ChartSortKey
  label: string
}

export const DEFAULT_SORT_OPTIONS: ChartSortOption[] = [
  { key: 'count', label: 'Count' },
  { key: 'avg_duration', label: 'Avg Duration' },
  { key: 'total_duration', label: 'Total Duration' },
]

@customElement('chart-sort-filter')
export class ChartSortFilter extends LitElement {
  protected createRenderRoot() {
    return this
  }

  @property({ type: String }) sortKey: ChartSortKey = 'count'
  @property({ type: Array }) options: ChartSortOption[] = DEFAULT_SORT_OPTIONS

  private _onSortChange(key: ChartSortKey) {
    this.sortKey = key
    this.dispatchEvent(
      new CustomEvent('sort-change', {
        detail: { sortKey: key },
        bubbles: true,
        composed: true,
      }),
    )
  }

  render() {
    return html`
      <div class="d-flex align-items-center gap-2">
        <span class="text-secondary small fw-bold">SORT BY:</span>
        <div class="btn-group btn-group-sm">
          ${this.options.map(
            option => html`
              <button
                type="button"
                class="btn btn-sm ${this.sortKey === option.key ? 'btn-secondary' : 'btn-outline-secondary'}"
                @click=${() => this._onSortChange(option.key)}
              >
                ${option.label}
              </button>
            `,
          )}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chart-sort-filter': ChartSortFilter
  }
}
