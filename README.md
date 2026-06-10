# Dovezu

Внутреннее веб-приложение для учёта товаров, курьеров и заказов (аналог МойСклад для доставки).

## Стек

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS** + **Shadcn UI**
- **PostgreSQL** (Supabase)
- **Prisma ORM**
- **NextAuth** (JWT + bcrypt)
- **Telegram Bot API**
- **Leaflet** (карта курьеров)
- **Excel export** (xlsx)

## Возможности

### Администратор
- Дашборд с KPI (остатки, курьеры, заказы, продажи, прибыль)
- CRUD товаров с поиском и фильтрами
- CRUD курьеров, блокировка, QR-код для быстрого входа
- Передача товаров со склада курьерам
- Управление заказами и назначение курьеров
- История всех движений товаров
- Аналитика (выручка, прибыль, продажи по курьерам/товарам)
- Карта с геолокацией курьеров в реальном времени
- Экспорт в Excel

### Курьер
- Мой склад (без закупочных цен)
- Активные заказы с кнопками «Принять», «В пути», «Выполнено»
- История завершённых заказов
- Автоматическая отправка геолокации
- Push-уведомления в браузере
- Вход по телефону/Telegram/QR-код

### Telegram
- Автоматическое уведомление курьеру при назначении заказа

### SEO / Индексация
- **Полностью отключена** индексация поисковыми системами
- `robots.txt` с `Disallow: /`
- Meta `noindex, nofollow` на всех страницах
- Sitemap не генерируется

## Быстрый старт

### 1. Установка

```bash
npm install
```

### 2. Настройка окружения

```bash
cp .env.example .env
```

Заполните переменные в `.env` (см. разделы ниже).

### 3. База данных

```bash
npx prisma db push
npm run db:seed
```

### 4. Запуск

```bash
# Разработка
npm run dev

# Продакшен
npm run build
npm run start
```

### Тестовые аккаунты (после seed)

| Роль | Логин | Пароль |
|------|-------|--------|
| Админ | `admin` | `admin123` |
| Курьер | `courier1` / `+79001234567` / `@ivan_courier` | `courier123` |

---

## Подключение Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Перейдите в **Project Settings → Database**
3. Скопируйте **Connection string** (URI)
4. Вставьте в `.env`:

```env
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
```

5. Для миграций используйте **Direct connection** (порт 5432):

```env
# Опционально для prisma db push
DIRECT_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
```

6. Примените схему:

```bash
npx prisma db push
npm run db:seed
```

SQL-структура также доступна в `prisma/sql/schema.sql`.

---

## Telegram Bot

1. Создайте бота через [@BotFather](https://t.me/BotFather): `/newbot`
2. Скопируйте токен в `.env`:

```env
TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
```

3. Узнайте Chat ID курьера:
   - Попросите курьера написать боту `/start`
   - Откройте `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Найдите `"chat":{"id":...}`

4. Укажите Chat ID:
   - В `.env` как `TELEGRAM_DEFAULT_CHAT_ID` (fallback)
   - Или в профиле курьера в админке (поле «Telegram Chat ID»)

5. При назначении заказа курьер получит сообщение:

```
🆕 Новый заказ
Номер: #123
Адрес: ...
Телефон: ...
Товары: ...
Сумма: ...
```

---

## Деплой на Vercel

1. Загрузите проект в GitHub
2. Импортируйте репозиторий на [vercel.com](https://vercel.com)
3. Добавьте **Environment Variables**:

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | Случайная строка 32+ символов |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram бота |
| `TELEGRAM_DEFAULT_CHAT_ID` | Chat ID по умолчанию |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key |
| `VAPID_PRIVATE_KEY` | VAPID private key |

4. **Build Command:** `npm run build` (по умолчанию)
5. После деплоя выполните миграцию:

```bash
npx prisma db push
npm run db:seed
```

(через Vercel CLI или локально с production DATABASE_URL)

6. Обновите `NEXTAUTH_URL` на финальный домен Vercel

### Push-уведомления (VAPID)

```bash
npx web-push generate-vapid-keys
```

Скопируйте ключи в `.env` и Vercel.

---

## Структура проекта

```
src/
├── app/
│   ├── admin/          # Админ-панель
│   ├── courier/        # Кабинет курьера
│   ├── api/            # REST API
│   ├── login/          # Авторизация
│   └── qr/             # QR-вход
├── components/
│   ├── admin/
│   ├── courier/
│   ├── layout/
│   └── ui/             # Shadcn UI
├── lib/                # Auth, Prisma, Telegram, Analytics
└── middleware.ts       # Защита маршрутов по ролям
prisma/
├── schema.prisma
├── seed.ts
└── sql/schema.sql
```

---

## API Endpoints

| Method | Path | Роль | Описание |
|--------|------|------|----------|
| GET/POST | `/api/products` | Admin | Товары |
| GET/PUT/DELETE | `/api/products/[id]` | Admin | Товар |
| GET/POST | `/api/couriers` | Admin | Курьеры |
| GET/PUT/DELETE/PATCH | `/api/couriers/[id]` | Admin | Курьер |
| GET/POST | `/api/transfers` | Admin | Передача товаров |
| GET/POST | `/api/orders` | Admin/Courier | Заказы |
| PATCH | `/api/orders/[id]` | Admin/Courier | Статус/назначение |
| GET | `/api/dashboard` | Admin | Дашборд |
| GET | `/api/analytics` | Admin | Аналитика |
| GET | `/api/movements` | Admin | Движения |
| GET | `/api/courier-stock` | Courier | Склад курьера |
| GET/POST | `/api/location` | Admin/Courier | Геолокация |
| GET/POST | `/api/push` | All | Push-подписки |
| GET | `/api/export?type=` | Admin | Excel экспорт |

---

## Безопасность

- JWT-сессии через NextAuth
- bcrypt хеширование паролей (12 rounds)
- Middleware защита маршрутов
- Разграничение доступа по ролям (ADMIN / COURIER)
- Серверная валидация (Zod)
- Курьер видит только свои данные
- Сайт закрыт от индексации

---

## Лицензия

Private — внутреннее использование.
