import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.soccerpositionmanagement.app',
  appName: 'SPM',
  webDir: 'out',
  server: {
    url: 'https://www.soccerpositionmanagement.com',
    cleartext: false,
    allowNavigation: [
      'kauth.kakao.com',
      'accounts.kakao.com',
      'www.soccerpositionmanagement.com',
    ],
  },
};

export default config;
