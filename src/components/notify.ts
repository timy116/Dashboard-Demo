import '@shoelace-style/shoelace/dist/components/alert/alert.js'
import '@shoelace-style/shoelace/dist/components/icon/icon.js'
import { html, render } from 'lit'
import { ALERT_TYPE } from '../types/constants'

export interface NotifyOptions {
  variant?: ALERT_TYPE
  icon?: string
  duration?: number
  closable?: boolean
}

export const notify = (message: string, options: NotifyOptions = {}) => {
  const { variant = ALERT_TYPE.PRIMARY, icon = 'info-circle', duration = 3000, closable = true } = options
  const alertContainer = document.createElement('div')

  render(
    html`
      <sl-alert variant="${variant}" duration="${duration}" ?closable="${closable}" class="custom-toast">
        <sl-icon slot="icon" name="${icon}"></sl-icon>
        ${message}
      </sl-alert>
    `,
    alertContainer,
  )
  const alert = alertContainer.firstElementChild as any

  document.body.append(alert)
  return alert.toast()
}
