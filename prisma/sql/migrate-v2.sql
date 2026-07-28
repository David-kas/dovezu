-- Миграция Dovezu v2: новые поля товаров, возврат на склад, журнал
-- Выполните в Supabase → SQL Editor (безопасно повторять)

-- 1. Новый тип движения
DO $$ BEGIN
  ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'RETURN_TO_CENTRAL';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Product: article, sku, barcode
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "article" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "barcode" TEXT;

CREATE INDEX IF NOT EXISTS "Product_sku_idx" ON "Product"("sku");
CREATE INDEX IF NOT EXISTS "Product_article_idx" ON "Product"("article");
CREATE INDEX IF NOT EXISTS "Product_barcode_idx" ON "Product"("barcode");

-- 3. StockMovement: createdById, deletedAt
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "StockMovement_deletedAt_idx" ON "StockMovement"("deletedAt");

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id"        TEXT NOT NULL,
    "action"    TEXT NOT NULL,
    "adminId"   TEXT NOT NULL,
    "courierId" TEXT,
    "productId" TEXT,
    "quantity"  INTEGER,
    "details"   TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_adminId_idx" ON "AuditLog"("adminId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");

DO $$ BEGIN
  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_courierId_fkey"
    FOREIGN KEY ("courierId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
