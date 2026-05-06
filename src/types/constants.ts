// Set to true to enable login system
export const ENABLE_LOGIN_SYSTEM = true;

export enum AppRoute {
  DASHBOARD = "/",
}

export enum ALERT_TYPE {
  PRIMARY = "primary",
  NEUTRAL = "neutral",
  SUCCESS = "success",
  WARNING = "warning",
  DANGER = "danger",
}

export const ROBOT_IDS = {
  BOT_1: "bot-1",
  BOT_2: "bot-2",
  BOT_3: "bot-3",
} as const;

export const ACTIVE_ROBOT_IDS = {
  BOT_1: "bot-1",
  BOT_2: "bot-2",
  BOT_3: "bot-3",
} as const;
