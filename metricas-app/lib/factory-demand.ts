export type DemandPoint = {
  day: string;
  branch: string;
  flavor: string;
  series: 'requested' | 'opened' | 'shipped';
  count: number;
};

const calendar = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function argentinaDay(timestamp: string | Date) {
  return calendar.format(new Date(timestamp));
}

export function periodKey(day: string, period: 'week' | 'month') {
  if (period === 'month') return day.slice(0, 7);
  const date = new Date(day + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

export function demandSeries(points: DemandPoint[], period: 'week' | 'month', branch: string, flavor: string) {
  const rows = new Map<string, { period: string; requested: number; opened: number; shipped: number }>();
  for (const point of points) {
    if ((branch && point.branch !== branch) || (flavor && point.flavor !== flavor)) continue;
    const key = periodKey(point.day, period);
    const row = rows.get(key) ?? { period: key, requested: 0, opened: 0, shipped: 0 };
    row[point.series] += point.count;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.period.localeCompare(b.period))
    .map(row => ({ ...row, demand: row.requested + row.opened }));
}
