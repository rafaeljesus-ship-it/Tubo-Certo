// Ponte entre o jogo (JS puro, sem bundler) e os plugins nativos do Capacitor.
// Este arquivo é empacotado em js/native-bridge.js e só é carregado quando o jogo roda dentro do app.
import { Capacitor } from '@capacitor/core';
import { store, ProductType, Platform, ErrorCode, LogLevel } from 'capacitor-plugin-cdv-purchase';
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from '@capacitor-community/admob';

window.TuboNative = { Capacitor, store, ProductType, Platform, ErrorCode, LogLevel, AdMob, AdmobConsentStatus, RewardAdPluginEvents };
