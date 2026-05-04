/**
 * ═══════════════════════════════════════════════════
 * Push Notification Service — Fuvex Manager Mobile
 * Registro de Expo Push Token + notificaciones locales
 * ═══════════════════════════════════════════════════
 */
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import type { Notification, NotificationResponse } from 'expo-notifications';
import api from '../api/client';

declare const require: (moduleName: string) => unknown;

type NotificationsModule = typeof import('expo-notifications');
type Subscription = { remove: () => void };

let notificationsModule: NotificationsModule | null = null;

function isExpoGo(): boolean {
  const constants = Constants as any;
  return constants.appOwnership === 'expo' || constants.executionEnvironment === 'storeClient';
}

function getNotificationsModule(): NotificationsModule | null {
  if (isExpoGo()) {
    return null;
  }

  if (!notificationsModule) {
    notificationsModule = require('expo-notifications') as NotificationsModule;
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  return notificationsModule;
}

function emptySubscription(): Subscription {
  return { remove: () => undefined };
}

/**
 * Registrar push token y enviarlo al backend
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const Notifications = getNotificationsModule();

  if (!Notifications) {
    console.log('Push remoto omitido en Expo Go. Usa development build para notificaciones push.');
    return null;
  }

  // Solo funciona en dispositivos físicos
  if (!Device.isDevice) {
    console.log('Push notifications solo funcionan en dispositivos físicos');
    return null;
  }

  // Verificar permisos existentes
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Solicitar permisos si no se han otorgado
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permiso de notificaciones denegado');
    return null;
  }

  // Obtener Expo Push Token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const pushToken = tokenData.data;

    // Registrar en el backend
    await api.post('/notifications/push-token', {
      push_token: pushToken,
    });

    console.log('Push token registrado:', pushToken.substring(0, 30) + '...');
    return pushToken;
  } catch (error) {
    console.error('Error al registrar push token:', error);
    return null;
  }
}

/**
 * Eliminar push token del backend (logout)
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    await api.delete('/notifications/push-token');
    console.log('Push token eliminado del backend');
  } catch (error) {
    console.error('Error al eliminar push token:', error);
  }
}

/**
 * Verificar estado del push token
 */
export async function checkPushTokenStatus(): Promise<{ has_token: boolean; token_preview: string | null }> {
  try {
    const res = await api.get('/notifications/push-token/status');
    return res.data;
  } catch (error) {
    console.error('Error al verificar push token:', error);
    return { has_token: false, token_preview: null };
  }
}

/**
 * Listener para notificaciones recibidas en foreground
 */
export function addNotificationReceivedListener(
  handler: (notification: Notification) => void
) {
  const Notifications = getNotificationsModule();
  if (!Notifications) return emptySubscription();

  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Listener para cuando el usuario toca una notificación
 */
export function addNotificationResponseListener(
  handler: (response: NotificationResponse) => void
) {
  const Notifications = getNotificationsModule();
  if (!Notifications) return emptySubscription();

  return Notifications.addNotificationResponseReceivedListener(handler);
}
