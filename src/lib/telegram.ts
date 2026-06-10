const TELEGRAM_API = "https://api.telegram.org/bot";

export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  try {
    const response = await fetch(
      `${TELEGRAM_API}${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Telegram API error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Telegram send error:", error);
    return false;
  }
}

interface OrderNotificationData {
  orderNumber: number;
  address: string;
  clientPhone: string;
  clientName: string;
  comment?: string | null;
  totalAmount: number;
  items: Array<{
    name: string;
    quantity: number;
    salePrice: number;
  }>;
}

export function formatOrderTelegramMessage(data: OrderNotificationData): string {
  const itemsList = data.items
    .map(
      (item) =>
        `• ${item.name} — ${item.quantity} шт. × ${item.salePrice.toLocaleString("ru-RU")} ₽`
    )
    .join("\n");

  return [
    "🆕 <b>Новый заказ</b>",
    "",
    `<b>Номер:</b> #${data.orderNumber}`,
    `<b>Клиент:</b> ${data.clientName}`,
    `<b>Адрес:</b> ${data.address}`,
    `<b>Телефон:</b> ${data.clientPhone}`,
    "",
    "<b>Товары:</b>",
    itemsList,
    "",
    `<b>Сумма:</b> ${data.totalAmount.toLocaleString("ru-RU")} ₽`,
    data.comment ? `\n<b>Комментарий:</b> ${data.comment}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function notifyCourierAboutOrder(
  chatId: string | null | undefined,
  data: OrderNotificationData
): Promise<void> {
  const fallbackChatId = process.env.TELEGRAM_DEFAULT_CHAT_ID;
  const targetChatId = chatId || fallbackChatId;

  if (!targetChatId) {
    console.warn("No Telegram chat ID for courier notification");
    return;
  }

  await sendTelegramMessage(targetChatId, formatOrderTelegramMessage(data));
}
