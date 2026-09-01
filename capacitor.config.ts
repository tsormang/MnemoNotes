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
      presentationOptions: [],
    },
  },
}

export default config
