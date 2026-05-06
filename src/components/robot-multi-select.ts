import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";
import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/select/select.js";
import "@shoelace-style/shoelace/dist/components/tag/tag.js";
import "@shoelace-style/shoelace/dist/components/tooltip/tooltip.js";
import "@shoelace-style/shoelace/dist/components/option/option.js";

import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.js";
import { ACTIVE_ROBOT_IDS, ROBOT_IDS } from "../types/constants";

@customElement("robot-multi-select")
export class RobotMultiSelect extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  private _robotIds = Object.values(ROBOT_IDS);
  private _defaultSelected: any = Object.values(ACTIVE_ROBOT_IDS);

  @property({ type: String }) id = "";
  @property({ type: Boolean }) isLoading = true;
  @property({ type: String }) storageKey = "";
  @state() private _selected = [...this._defaultSelected];

  connectedCallback() {
    super.connectedCallback();
    const stored = localStorage.getItem(this.storageKey);

    if (stored) {
      this._selected = stored.split(" ");
    }
  }

  firstUpdated() {
    this.dispatchEvent(
      new CustomEvent("selection-change", {
        detail: { selected: this._selected },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onSelectionChange(e: CustomEvent) {
    let target = e.target as SlSelect;
    let selectedValues = target.value;

    if (typeof selectedValues === "string") {
      selectedValues = selectedValues.split(" ");
    }

    this._setLocalStorage(selectedValues);

    console.log("[RobotMultiSelect] Selection changed:", selectedValues);

    if (!target.open && target.value.length > 0) {
      this.dispatchEvent(
        new CustomEvent("selection-change", {
          detail: { selected: target.value },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _onRestClick(e: CustomEvent) {
    const el = document.getElementById(this.id) as SlSelect;
    if (el) {
      el.value = this._defaultSelected.join(" ");
      localStorage.removeItem(this.storageKey);
    }

    this.dispatchEvent(
      new CustomEvent("selection-change", {
        detail: { selected: el.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _setLocalStorage(value: string[]) {
    if (this.storageKey) {
      localStorage.setItem(this.storageKey, value.join(" "));
    }
  }

  render() {
    return html`
      <div class="d-flex align-items-center gap-2">
        <sl-select
          id="${this.id}"
          style="z-index: 999; width:400px;"
          value="${this._selected.join(" ")}"
          multiple
          clearable
          ?disabled=${this.isLoading}
          @sl-change="${this._onSelectionChange}"
          @sl-after-hide="${this._onSelectionChange}"
        >
          ${this._robotIds.map(
            (id) => html`<sl-option value="${id}">${id}</sl-option>`,
          )}
        </sl-select>
        <sl-tooltip placement="top" hoist>
          <span slot="content">Reset to default selection</span>
          <sl-button
            size="small"
            variant="primary"
            @click="${this._onRestClick}"
          >
            Reset
          </sl-button>
        </sl-tooltip>
      </div>
    `;
  }
}
