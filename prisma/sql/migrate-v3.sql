-- Dovezu v3: складская система (документы, склады, штрихкоды, роли)
-- Выполните в Supabase SQL Editor ПОСЛЕ migrate-all.sql
-- Скопируйте ВЕСЬ файл, не путь к файлу!

-- 1. Новые роли
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OPERATOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PURCHASER';

-- 2. Новые enum
DO $$ BEGIN CREATE TYPE "WarehouseType" AS ENUM ('CENTRAL', 'COURIER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DocumentType" AS ENUM ('RECEIPT', 'TRANSFER', 'RETURN', 'WRITE_OFF', 'SALE', 'INVENTORY', 'ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'REVIEW', 'POSTED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MatchConfidence" AS ENUM ('EXACT', 'PROBABLE', 'UNMATCHED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. MovementType extensions
DO $$ BEGIN ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'DOCUMENT_RECEIPT'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'DOCUMENT_TRANSFER'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'DOCUMENT_RETURN'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'DOCUMENT_WRITE_OFF'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'DOCUMENT_SALE'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'DOCUMENT_INVENTORY'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'DOCUMENT_ADJUSTMENT'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Product extensions
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "volume" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'шт';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "abv" DECIMAL(5,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "avgPurchasePrice" DECIMAL(12,2) DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "minStock" INTEGER DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastSupplierId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_key" ON "Product"("sku") WHERE "sku" IS NOT NULL;

-- 5. Warehouse
CREATE TABLE IF NOT EXISTS "Warehouse" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" "WarehouseType" NOT NULL,
  "courierId" TEXT UNIQUE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "WarehouseStock" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "warehouseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("warehouseId", "productId")
);

-- 6. ProductBarcode
CREATE TABLE IF NOT EXISTS "ProductBarcode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "barcode" TEXT NOT NULL UNIQUE,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Supplier
CREATE TABLE IF NOT EXISTS "Supplier" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "inn" TEXT,
  "address" TEXT,
  "phone" TEXT,
  "comment" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. StockDocument
CREATE TABLE IF NOT EXISTS "StockDocument" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "number" SERIAL NOT NULL UNIQUE,
  "type" "DocumentType" NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedAt" TIMESTAMP(3),
  "purchaseDate" TIMESTAMP(3),
  "authorId" TEXT NOT NULL,
  "postedById" TEXT,
  "purchaserId" TEXT,
  "fromWarehouseId" TEXT,
  "toWarehouseId" TEXT,
  "supplierId" TEXT,
  "comment" TEXT,
  "totalPurchaseCost" DECIMAL(12,2),
  "receiptNumber" TEXT,
  "receiptTotal" DECIMAL(12,2),
  "linesTotal" DECIMAL(12,2),
  "paymentMethod" "PaymentMethod",
  "discrepancyReason" TEXT,
  "orderId" TEXT
);

CREATE TABLE IF NOT EXISTS "StockDocumentLine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "productId" TEXT,
  "quantity" INTEGER NOT NULL,
  "purchasePrice" DECIMAL(12,2),
  "salePrice" DECIMAL(12,2),
  "lineTotal" DECIMAL(12,2),
  "excluded" BOOLEAN NOT NULL DEFAULT false,
  "receiptLineText" TEXT,
  "matchConfidence" "MatchConfidence"
);

CREATE TABLE IF NOT EXISTS "DocumentAttachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "pageNumber" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "DocumentChangeLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ReceiptOcrResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "rawJson" TEXT NOT NULL,
  "storeName" TEXT,
  "inn" TEXT,
  "receiptDate" TIMESTAMP(3),
  "receiptTime" TEXT,
  "receiptNumber" TEXT,
  "totalAmount" DECIMAL(12,2),
  "discount" DECIMAL(12,2),
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ReceiptProductAlias" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "receiptText" TEXT NOT NULL,
  "normalizedText" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "supplierId" TEXT,
  "confirmCount" INTEGER NOT NULL DEFAULT 1,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedById" TEXT
);

CREATE TABLE IF NOT EXISTS "PurchaserAdvance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "purchaserId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "comment" TEXT,
  "issuedById" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "userRole" "Role" NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "oldValue" TEXT,
  "newValue" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. StockMovement extensions
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "documentId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;

-- 10. Central warehouse seed
INSERT INTO "Warehouse" ("id", "name", "type", "isActive", "createdAt", "updatedAt")
VALUES ('warehouse-central', 'Центральный склад', 'CENTRAL', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 11. Migrate central stock to WarehouseStock
INSERT INTO "WarehouseStock" ("id", "warehouseId", "productId", "quantity", "updatedAt")
SELECT
  'ws-' || "Product"."id",
  'warehouse-central',
  "Product"."id",
  "Product"."centralStock",
  NOW()
FROM "Product"
WHERE "Product"."centralStock" > 0
ON CONFLICT ("warehouseId", "productId") DO UPDATE SET "quantity" = EXCLUDED."quantity";
