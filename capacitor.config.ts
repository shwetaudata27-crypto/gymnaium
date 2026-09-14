import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.usgymnasium.app',
  appName: 'US Gymnasium',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    CapacitorSQLite: {
      database: 'us_gym_db',
    },
  },
};

export default config;
