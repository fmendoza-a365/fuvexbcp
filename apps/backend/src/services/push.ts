import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from '../db';

const expo = new Expo();

export interface PushDeliveryResult {
  requested: number;
  registered: number;
  sent: number;
  invalid_tokens: number;
}

export async function sendPushNotification(userId: string, title: string, body: string, data: any = {}) {
  return sendPushNotifications([userId], title, body, data);
}

export async function sendPushNotifications(
  userIds: string[],
  title: string,
  body: string,
  data: any = {}
): Promise<PushDeliveryResult> {
  try {
    const targetIds = [...new Set(userIds.filter(Boolean))];
    if (targetIds.length === 0) {
      return { requested: 0, registered: 0, sent: 0, invalid_tokens: 0 };
    }

    const users = await prisma.user.findMany({
      where: { id: { in: targetIds }, activo: true },
      select: { id: true, push_token: true }
    });

    const invalidUserIds: string[] = [];
    const validTokens = users
      .filter((user) => Boolean(user.push_token))
      .map((user) => ({ id: user.id, token: user.push_token as string }))
      .filter((user) => {
        const valid = Expo.isExpoPushToken(user.token);
        if (!valid) {
          invalidUserIds.push(user.id);
          console.error(`[PUSH] Token ${user.token} is not a valid Expo push token`);
        }
        return valid;
      });

    if (invalidUserIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: invalidUserIds } },
        data: { push_token: null }
      });
    }

    const messages: ExpoPushMessage[] = validTokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      channelId: 'default',
      title,
      body,
      data,
    }));

    if (messages.length === 0) {
      console.log(`[PUSH] No valid push tokens for users ${targetIds.join(', ')}. Skipping.`);
      return {
        requested: targetIds.length,
        registered: users.filter((user) => Boolean(user.push_token)).length,
        sent: 0,
        invalid_tokens: invalidUserIds.length
      };
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

    return {
      requested: targetIds.length,
      registered: validTokens.length,
      sent: messages.length,
      invalid_tokens: invalidUserIds.length
    };
  } catch (error) {
    console.error('[PUSH] General error:', error);
    return { requested: userIds.length, registered: 0, sent: 0, invalid_tokens: 0 };
  }
}
