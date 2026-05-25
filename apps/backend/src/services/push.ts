import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from '../db';

const expo = new Expo();

export async function sendPushNotification(userId: string, title: string, body: string, data: any = {}) {
  return sendPushNotifications([userId], title, body, data);
}

export async function sendPushNotifications(userIds: string[], title: string, body: string, data: any = {}) {
  try {
    const targetIds = [...new Set(userIds.filter(Boolean))];
    if (targetIds.length === 0) return;

    const users = await prisma.user.findMany({
      where: { id: { in: targetIds }, activo: true },
      select: { push_token: true }
    });

    const messages: ExpoPushMessage[] = users
      .map((user) => user.push_token)
      .filter((token): token is string => Boolean(token))
      .filter((token) => {
        const valid = Expo.isExpoPushToken(token);
        if (!valid) console.error(`[PUSH] Token ${token} is not a valid Expo push token`);
        return valid;
      })
      .map((token) => ({
        to: token,
        sound: 'default',
        channelId: 'default',
        title,
        body,
        data,
      }));

    if (messages.length === 0) {
      console.log(`[PUSH] No valid push tokens for users ${targetIds.join(', ')}. Skipping.`);
      return;
    }

    const chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
        console.log(`[PUSH] Notification chunk sent to ${chunk.length} device(s)`);
      } catch (error) {
        console.error('[PUSH] Error sending chunk:', error);
      }
    }
  } catch (error) {
    console.error('[PUSH] General error:', error);
  }
}
