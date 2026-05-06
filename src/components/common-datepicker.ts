import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import "flatpickr/dist/themes/dark.css";
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { EVENTS } from "../types/custom-events";

@customElement("common-datepicker")
export class CommonDatepicker extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  @property({ type: Array }) defaultDate: Date[] = [];

  private _fpInstance?: flatpickr.Instance;

  protected firstUpdated() {
    const input = this.querySelector("input");
    if (input) {
      this._fpInstance = flatpickr(input, {
        mode: "range",
        dateFormat: "Y/m/d",
        defaultDate: this.defaultDate,
        onClose: (selectedDates: Date[]) => {
          if (selectedDates.length === 2) {
            this.dispatchEvent(
              new CustomEvent(EVENTS.DATE_CHANGE, {
                detail: { selectedDates },
                bubbles: true,
                composed: true,
              }),
            );
          }
        },
      });
    }
  }

  public setDate(dates: Date[]) {
    this._fpInstance?.setDate(dates);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._fpInstance?.destroy();
  }

  render() {
    return html`
      <div class="datepicker-container" style="min-width: 220px;">
        <input
          class="form-control form-control-sm bg-dark text-white border-secondary"
          placeholder="Select Date Range"
        />
      </div>
    `;
  }
}
