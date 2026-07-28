import { decimalToNumber } from "../utils";

export function calcWeightedAvgPrice(
  oldQty: number,
  oldAvg: number,
  newQty: number,
  newPrice: number
): number {
  if (oldQty + newQty === 0) return 0;
  return (oldQty * oldAvg + newQty * newPrice) / (oldQty + newQty);
}

export function calcLineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function sumDocumentLines(
  lines: { quantity: number; purchasePrice?: { toNumber?: () => number } | number | null; lineTotal?: { toNumber?: () => number } | number | null; excluded?: boolean }[]
): number {
  return lines
    .filter((l) => !l.excluded)
    .reduce((sum, l) => {
      if (l.lineTotal != null) return sum + decimalToNumber(l.lineTotal);
      const price = l.purchasePrice != null ? decimalToNumber(l.purchasePrice) : 0;
      return sum + calcLineTotal(l.quantity, price);
    }, 0);
}

export function checkReceiptDiscrepancy(
  receiptTotal: number | null,
  linesTotal: number,
  enteredTotal: number | null,
  tolerance = 1
): { hasDiscrepancy: boolean; diff: number; message?: string } {
  const refs = [receiptTotal, enteredTotal].filter((v): v is number => v != null);
  if (refs.length === 0) return { hasDiscrepancy: false, diff: 0 };

  let maxDiff = 0;
  for (const ref of refs) {
    maxDiff = Math.max(maxDiff, Math.abs(ref - linesTotal));
  }

  if (maxDiff > tolerance) {
    return {
      hasDiscrepancy: true,
      diff: maxDiff,
      message: `Расхождение суммы: ${maxDiff.toFixed(2)} ₽ (чек/ввод vs позиции)`,
    };
  }
  return { hasDiscrepancy: false, diff: maxDiff };
}
