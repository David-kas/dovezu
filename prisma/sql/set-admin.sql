-- Создание / обновление администратора Dovezu
-- Выполните в Supabase → SQL Editor
-- Логин: 79626289777  |  Пароль: btt7prF7

-- Удалить старый демо-аккаунт
DELETE FROM "User" WHERE "login" = 'admin' AND "role" = 'ADMIN';

-- Создать или обновить админа
INSERT INTO "User" (
  "id",
  "login",
  "passwordHash",
  "role",
  "name",
  "phone",
  "courierStatus",
  "isOnline",
  "createdAt",
  "updatedAt"
) VALUES (
  'admin-main',
  '79626289777',
  '$2a$12$GYKW07vhncedeQT2uoGYhubt847H1i4gOEmxyfH5SQo0QRyrYYNSu',
  'ADMIN',
  'Администратор',
  '+79626289777',
  'ACTIVE',
  false,
  NOW(),
  NOW()
)
ON CONFLICT ("login") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "name" = EXCLUDED."name",
  "phone" = EXCLUDED."phone",
  "role" = 'ADMIN',
  "updatedAt" = NOW();
