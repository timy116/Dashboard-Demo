import "@shoelace-style/shoelace/dist/components/avatar/avatar.js";
import "@shoelace-style/shoelace/dist/components/dropdown/dropdown.js";
import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/menu-item/menu-item.js";
import "@shoelace-style/shoelace/dist/components/menu/menu.js";

import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { AppRoute } from "../types/constants";

@customElement("app-header")
export class AppHeader extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  @property({ type: String }) theme: "light" | "dark" = "dark";
  @property({ type: String }) currentPath = window.location.pathname;

  private _onThemeToggle() {
    this.dispatchEvent(
      new CustomEvent("toggle-theme", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <nav
        class="navbar navbar-expand-lg border-bottom shadow-sm py-3"
        style="background-color: var(--bg-surface); border-color: var(--border-color) !important;"
      >
        <div class="container-fluid px-4">
          <a
            class="navbar-brand d-flex align-items-center"
            href="/"
            style="color: var(--color-primary); font-weight: 700; letter-spacing: 1px;"
          >
            <span class="me-2">🤖</span> DATA VIZ
          </a>

          <button
            class="navbar-toggler ms-auto me-2 d-lg-none"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
            style="border-color: var(--border-color); color: var(--text-primary);"
          >
            <span class="navbar-toggler-icon" style="filter: invert(1);"></span>
          </button>

          <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ms-4 custom-nav">
              <li class="nav-item">
                <a
                  class="nav-link px-3 ${this.currentPath === AppRoute.DASHBOARD
                    ? "active"
                    : ""}"
                  href="${AppRoute.DASHBOARD}"
                >
                  DASHBOARD
                </a>
              </li>
            </ul>
          </div>

          <div class="d-flex align-items-center gap-3">
            <button
              class="btn btn-outline-custom d-flex align-items-center gap-2"
            >
              ${this.theme === "dark"
                ? html`<span>🌙 DARK</span>`
                : html`<span>☀️ LIGHT</span>`}
            </button>
          </div>
        </div>
      </nav>
    `;
  }
}
