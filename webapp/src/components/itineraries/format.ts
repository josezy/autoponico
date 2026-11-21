export function trimNum(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatQuantity(quantity: number | null, unit: string): string {
  if (quantity == null) return unit;
  return `${trimNum(quantity)} ${unit}`.trim();
}

export function expectedLabel(metric: {
  expectedValue: number | null;
  expectedMin: number | null;
  expectedMax: number | null;
  expectedText: string | null;
  unit: string | null;
}): string {
  const unit = metric.unit ? ` ${metric.unit}` : '';
  if (metric.expectedValue != null && metric.expectedMin == null && metric.expectedMax == null) {
    const extra = metric.expectedText ? ` (${metric.expectedText})` : '';
    return `${trimNum(metric.expectedValue)}${unit}${extra}`;
  }
  if (metric.expectedMin != null || metric.expectedMax != null) {
    const extra = metric.expectedText ? ` (${metric.expectedText})` : '';
    return `${trimNum(metric.expectedMin)}–${trimNum(metric.expectedMax)}${unit}${extra}`;
  }
  if (metric.expectedValue != null) return `${trimNum(metric.expectedValue)}${unit}`;
  return metric.expectedText || 'No target yet';
}

export function farmTotal(
  metric: { perUnit: boolean; expectedValue: number | null; expectedMin: number | null; expectedMax: number | null; unit: string | null },
  quantity: number | null,
  quantityUnit: string,
): string | null {
  if (!metric.perUnit || quantity == null) return null;
  const min = metric.expectedMin ?? metric.expectedValue;
  const max = metric.expectedMax ?? metric.expectedValue;
  if (min == null || max == null) return null;
  const unit = (metric.unit || '').replace('/árbol/año', '/año en la finca').replace('/árbol', ' en la finca');
  const amount = min === max ? trimNum(min * quantity) : `${trimNum(min * quantity)}–${trimNum(max * quantity)}`;
  return `${amount} ${unit} (${trimNum(quantity)} ${quantityUnit} × the per-tree rate)`;
}

export function latestActual(actuals: { value: number | null }[]): number | null {
  for (let index = actuals.length - 1; index >= 0; index -= 1) {
    if (actuals[index].value != null) return actuals[index].value;
  }
  return null;
}
