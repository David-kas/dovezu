# Деплой Dovezu на Vercel

Домен: **https://dovezu.vercel.app**

## 1. Подготовка GitHub

1. Удалите все файлы из репозитория `David-kas/dovezu` (или создайте новый)
2. Загрузите **всю папку проекта**, кроме:
   - `node_modules/`
   - `.next/`
   - `.env` (секреты!)
   - `.vercel/`

3. Обязательно должны быть в репозитории:
   - `vercel.json`
   - `package.json`
   - `src/`
   - `prisma/`
   - `public/`
   - `next.config.ts`
   - `tsconfig.json`
   - `tailwind.config.ts`

## 2. Supabase — создать таблицы

В **Supabase → SQL Editor** выполните содержимое файла:
`prisma/sql/init-from-schema.sql`

## 3. Vercel — создать проект

1. [vercel.com/new](https://vercel.com/new) → Import `David-kas/dovezu`
2. **Framework Preset:** Next.js (определится автоматически)
3. **Root Directory:** оставить пустым
4. **Build Command:** `prisma generate && next build`
5. **Output Directory:** оставить пустым

## 4. Environment Variables (Production)

Добавьте в **Settings → Environment Variables**:

| Переменная | Значение |
|------------|----------|
| `DATABASE_URL` | `postgresql://postgres.yqjadevhvdtlhfmjkhvn:ВАШ_ПАРОЛЬ@aws-1-eu-central-1.pooler.supabase.com:5432/postgres` |
| `NEXTAUTH_URL` | `https://dovezu.vercel.app` |
| `NEXTAUTH_SECRET` | случайная строка 32+ символов |
| `TELEGRAM_BOT_TOKEN` | токен бота |
| `TELEGRAM_DEFAULT_CHAT_ID` | chat id курьера |

## 5. Домен

В **Settings → Domains** добавьте: `dovezu.vercel.app`

## 6. Deploy

Нажмите **Deploy**. В логах сборки должно быть:

```
✓ Compiled successfully
Route (app) ... /login ... /admin ... /api/health
```

## 7. Seed (тестовые данные)

После деплоя локально с production DATABASE_URL:

```bash
npm run db:seed
```

Или создайте админа вручную через Supabase.

### Тестовые аккаунты (после seed)

| Роль | Логин | Пароль |
|------|-------|--------|
| Админ | `admin` | `admin123` |
| Курьер | `courier1` | `courier123` |

## 8. Проверка

- https://dovezu.vercel.app/api/health → `{"status":"ok"}`
- https://dovezu.vercel.app/login → страница входа
- https://dovezu.vercel.app/robots.txt → `Disallow: /`

## Частые ошибки

| Проблема | Решение |
|----------|---------|
| 404 на всех страницах | Framework = Next.js, Output Directory пустой, есть `vercel.json` |
| Build failed prisma | `prisma` в dependencies (уже есть) |
| Auth не работает | `NEXTAUTH_URL=https://dovezu.vercel.app` без слэша |
| DB ошибка | Проверьте `DATABASE_URL`, таблицы созданы в Supabase |
