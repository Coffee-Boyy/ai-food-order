export const MODEL_STATUS_MESSAGES: Record<string, { title: string; detail: string }> = {
  deviceNotEligible: {
    title: 'Device not eligible for Apple Intelligence',
    detail: 'An Apple Silicon Mac running macOS 26 or later is required.'
  },
  appleIntelligenceNotEnabled: {
    title: 'Apple Intelligence is not enabled',
    detail: 'Go to System Settings → Apple Intelligence & Siri and turn it on, then try again.'
  },
  modelNotReady: {
    title: 'On-device model is not ready yet',
    detail: 'The model may still be downloading. Please wait a few minutes and try again.'
  },
  modelUnavailable: {
    title: 'On-device model is unavailable',
    detail: 'Apple Intelligence is not available on this device.'
  },
  helperNotFound: {
    title: 'Native helper not found',
    detail: 'Run `pnpm build:native` from the project root to compile the Foundation Models helper.'
  }
}
