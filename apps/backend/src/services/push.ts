import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from '../db';

const expo = new Expo();

export async function sendPushNotification(userId: string, title: string, body: string, data: any = {}) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { push_token: true }
    });

    if (!user || !user.push_token) {
      console.log(`[PUSH] User ${userId} has no push token. Skipping.`);
      return;
    }

    if (!Expo.isExpoPushToken(user.push_token)) {
      console.error(`[PUSH] Token ${user.push_token} is not a valid Expo push token`);
      return;
    }

    const messages: ExpoPushMessage[] = [{
      to: user.push_token,
      sound: 'default',
      title,
      body,
      data,
    }];

    const chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
        console.log(`[PUSH] Notification sent to user ${userId}`);
      } catch (error) {
        console.error('[PUSH] Error sending chunk:', error);
      }
    }
  } catch (error) {
    console.error('[PUSH] General error:', error);
  }
}
