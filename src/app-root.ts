import { Router } from "@lit-labs/router";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";

import "./components/app-header";
import "./pages/dashboard";

@customElement("app-root")
export class AppRoot extends LitElement {
  protected createRenderRoot() {
    return this;
  }

  @state() private _theme: "light" | "dark" = "dark";

  private _router = new Router(this, [
    {
      path: "/",
      render: () => {
        return html`<dashboard-page class="fade-in"></dashboard-page>`;
      },
    },
  ]);

  connectedCallback() {
    super.connectedCallback();

    const loading = document.getElementById("app-loading");
    if (loading) loading.remove();

    this._applyTheme();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  private _toggleTheme() {
    this._theme = this._theme === "dark" ? "light" : "dark";
    this._applyTheme();
  }

  private _applyTheme() {
    const themeClass =
      this._theme === "dark" ? "sl-theme-dark" : "sl-theme-light";
    document.documentElement.setAttribute("data-theme", this._theme);
    document.documentElement.setAttribute("data-bs-theme", this._theme);
    document.documentElement.className = themeClass;
  }

  render() {
    const currentPath = window.location.pathname;

    return html`
      <div class="app-wrapper">
        <app-header
          .theme=${this._theme}
          @toggle-theme=${this._toggleTheme}
          .currentPath=${currentPath}
        ></app-header>

        <main class="app-main">
          <div class="container-fluid py-4">${this._router.outlet()}</div>
        </main>
      </div>
    `;
  }
}
