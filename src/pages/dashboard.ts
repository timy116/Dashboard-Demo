import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";

import "../components/common-datepicker";
import "../components/robot-activity";
import "../components/robot-activity-card";
import "../components/subtask-analysis";
import "../components/task-analysis";

@customElement("dashboard-page")
export class DashboardPage extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div class="dashboard-container">
        ${this._renderRobotActivityTemplate()}
        ${this._renderTaskAnalysisTemplate()}
        ${this._renderSubtaskAnalysisTemplate()}
      </div>
    `;
  }

  private _renderRobotActivityTemplate() {
    return html`
      <section class="dashboard-section dashboard-section--time">
        <header class="dashboard-section__header">
          <h2 class="title">Robot Activity</h2>
        </header>

        <robot-activity></robot-activity>
      </section>
    `;
  }

  private _renderTaskAnalysisTemplate() {
    return html`
      <section class="dashboard-section dashboard-section--task">
        <header class="dashboard-section__header">
          <h2 class="title">Task Analysis</h2>
        </header>

        <task-analysis></task-analysis>
      </section>
    `;
  }

  private _renderSubtaskAnalysisTemplate() {
    return html`
      <section class="dashboard-section dashboard-section--task">
        <header class="dashboard-section__header">
          <h2 class="title">Subtask Analysis</h2>
        </header>

        <subtask-analysis></subtask-analysis>
      </section>
    `;
  }
}
