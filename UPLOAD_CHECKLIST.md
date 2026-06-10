# Чеклист загрузки в GitHub

## Загрузить ВСЁ из этой папки, КРОМЕ:

- `node_modules/` — не загружать
- `.next/` — не загружать
- `.env` — не загружать (секреты!)
- `.vercel/` — не загружать

## Обязательно должны быть:

- [x] `vercel.json`
- [x] `package.json` + `package-lock.json`
- [x] `next.config.ts`
- [x] `tsconfig.json`
- [x] `tailwind.config.ts`
- [x] `postcss.config.mjs`
- [x] `eslint.config.mjs`
- [x] `next-env.d.ts`
- [x] `src/` (вся папка)
- [x] `prisma/` (вся папка)
- [x] `public/` (вся папка)
- [x] `.env.example`
- [x] `.gitignore`
- [x] `README.md`
- [x] `DEPLOY.md`

## После загрузки на GitHub

1. Vercel → Import проект
2. Добавить Environment Variables (см. DEPLOY.md)
3. Deploy
4. Проверить: https://dovezu.vercel.app/api/health
