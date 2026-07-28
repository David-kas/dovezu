# Dovezu — план складской системы

## Текущее состояние (до изменений)

- **Остатки:** `Product.centralStock` + `CourierStock` (прямое изменение)
- **История:** `StockMovement` (TRANSFER_TO_COURIER, ORDER_SALE, RETURN_TO_CENTRAL)
- **Роли:** ADMIN, COURIER
- **Сервисы:** `lib/orders.ts` (transfer, complete, return), `lib/audit.ts`

## Архитектурный принцип

Все изменения остатков — **только через `StockDocument` со статусом POSTED**  
→ единый `document-posting.service.ts`  
→ Prisma `$transaction`  
→ запись в `StockMovement` + обновление `WarehouseStock`  
→ синхронизация legacy-полей (`centralStock`, `CourierStock`) для обратной совместимости

## Prisma — изменяемые модели

| Модель | Изменения |
|--------|-----------|
| `User` | роли OPERATOR, PURCHASER; связи с документами, авансами |
| `Product` | brand, volume, unit, abv, minStock, avgPurchasePrice, lastSupplierId; убрать прямое редактирование centralStock из UI (поле остаётся sync) |
| `StockMovement` | +documentId, +warehouseId |
| `AuditLog` | расширить или дублировать в ActivityLog |

## Prisma — новые модели

| Модель | Назначение |
|--------|------------|
| `Warehouse` | CENTRAL / COURIER склады |
| `WarehouseStock` | остатки по складу |
| `ProductBarcode` | несколько штрихкодов на товар |
| `Supplier` | поставщики/магазины |
| `StockDocument` | складской документ |
| `StockDocumentLine` | позиции документа |
| `DocumentAttachment` | чеки (фото/PDF) |
| `DocumentChangeLog` | журнал изменений документа |
| `ReceiptProductAlias` | соответствия строк чека → товар |
| `ReceiptOcrResult` | результат OCR (черновик) |
| `PurchaserAdvance` | выдача денег закупщику |
| `ActivityLog` | полный журнал действий |

## Новые enum

- `Role`: +OPERATOR, +PURCHASER
- `WarehouseType`: CENTRAL, COURIER
- `DocumentType`: RECEIPT, TRANSFER, RETURN, WRITE_OFF, SALE, INVENTORY, ADJUSTMENT
- `DocumentStatus`: DRAFT, REVIEW, POSTED, CANCELLED
- `PaymentMethod`: CASH, CARD, TRANSFER, OTHER
- `MatchConfidence`: EXACT, PROBABLE, UNMATCHED

## Сервисы (`src/lib/services/`)

| Сервис | Ответственность |
|--------|-----------------|
| `audit.service.ts` | ActivityLog, IP, user-agent |
| `inventory.service.ts` | WarehouseStock read, min stock alerts |
| `document-posting.service.ts` | post/cancel document, единственная точка изменения остатков |
| `receipt.service.ts` | создание оприходования, OCR hook |
| `barcode.service.ts` | lookup, bind, dedupe scan |
| `costing.service.ts` | средневзвешенная себестоимость |
| `purchasing.service.ts` | авансы, отчёты закупщиков |
| `receipt-matching.service.ts` | alias, fuzzy match |
| `receipt-ocr.service.ts` | OCR API (env keys) |

## API-маршруты (новые)

```
/api/warehouses
/api/suppliers
/api/documents
/api/documents/[id]
/api/documents/[id]/post
/api/documents/[id]/cancel
/api/documents/[id]/submit-review
/api/documents/[id]/attachments
/api/barcodes/lookup
/api/barcodes/bind
/api/receipts/ocr
/api/purchaser/advances
/api/purchaser/dashboard
/api/operator/queue
```

## UI-маршруты

```
/admin/receipts          — оприходования (ADMIN/OPERATOR)
/admin/suppliers         — поставщики
/admin/purchasers        — карточки закупщиков
/admin/inventory         — инвентаризация
/purchaser               — мобильный сценарий закупки
/purchaser/scan          — сканер
/operator                — очередь проверки
```

## Этапы реализации

### Этап 1 — Фундамент ✅ (текущий)
- Backup schema, новая Prisma schema, SQL-миграция
- Роли, middleware, api-auth
- Warehouse + миграция остатков
- document-posting.service (RECEIPT, TRANSFER)
- Базовые API documents/suppliers/warehouses

### Этап 2 — Оприходование + сканер
- UI «Новое оприходование»
- BarcodeScanner (html5-qrcode)
- ProductBarcode CRUD

### Этап 3 — OCR и сопоставление
- Upload чека, receipt-ocr.service
- ReceiptProductAlias, экран проверки

### Этап 4 — Закупщик и авансы
- /purchaser mobile flow
- PurchaserAdvance, карточка закупщика

### Этап 5 — Инвентаризация, аналитика, оператор
- INVENTORY document
- Dashboard закупок
- Operator queue

### Этап 6 — Рефактор legacy
- transferToCourier → TRANSFER document
- completeOrder → SALE document
- returnFromCourier → RETURN document
