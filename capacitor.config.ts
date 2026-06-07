import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.spm.soccerposition',
  appName: 'SPM',
  webDir: 'out',
  server: {
    url: 'https://www.soccerpositionmanagement.com',
    cleartext: false,
  },
};

export default config;
