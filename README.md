# Dovezu

Внутреннее веб-приложение для учёта товаров, курьеров и заказов.

**Продакшен:** https://dovezu.vercel.app

## Стек

Next.js 15 · TypeScript · Tailwind · Shadcn UI · Prisma · PostgreSQL (Supabase) · NextAuth · Telegram Bot

## Быстрый старт (локально)

```bash
npm install
cp .env.example .env   # заполните переменные
npx prisma db push
npm run db:seed
npm run dev
```

Откройте http://localhost:3000

## Деплой на Vercel

Полная инструкция: **[DEPLOY.md](./DEPLOY.md)**

## Возможности

### Администратор (`/admin`)
- Дашборд, товары, курьеры, передача товаров, заказы
- История движений, аналитика, карта курьеров
- QR-код для быстрого входа курьера
- Экспорт Excel

### Курьер (`/courier`)
- Мой склад, активные заказы, история
- Геолокация, push-уведомления
- Вход по телефону / Telegram / QR

### Безопасность
- JWT + bcrypt, middleware по ролям
- Полная блокировка индексации (robots.txt + meta noindex)

## Структура

```
src/app/          — страницы и API
src/components/   — UI компоненты
src/lib/          — auth, prisma, telegram, analytics
prisma/           — схема БД и seed
vercel.json       — конфиг Vercel
```

## Переменные окружения

См. `.env.example`

## Тестовые аккаунты (после seed)

| Роль | Логин | Пароль |
|------|-------|--------|
| Админ | `admin` | `admin123` |
| Курьер | `courier1` / `+79001234567` | `courier123` |
