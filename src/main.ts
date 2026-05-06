/**
 * @file main.ts
 * @description Entry point for the dashboard application
 */

import "@shoelace-style/shoelace/dist/themes/dark.css";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";
import "urlpattern-polyfill";
import "./app-root";
import "./styles/main.scss";

setBasePath(
  "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.20.1/dist/",
);

console.log("🚀 Dashboard Initialized");
