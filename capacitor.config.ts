/// <reference types="@capacitor/push-notifications" />
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mnemonotes.app',
  appName: 'MnemoNotes',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      // Android shows a system tray notification while the app is open.
      // An empty array suppressed that, and the APK already skips in-app toasts.
      presentationOptions: ['alert', 'sound'],
    },
  },
}

export default config
