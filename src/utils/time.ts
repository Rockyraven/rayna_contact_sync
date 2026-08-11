const DAY_MS = 24 * 60 * 60 * 1000;

export function formatRelativeTime(dateInput: string | number): string {
  const diffMs = Date.now() - new Date(dateInput).getTime();
  const days = Math.floor(diffMs / DAY_MS);
  if (days <= 0) {
    return 'today';
  }
  if (days === 1) {
    return 'yesterday';
  }
  return `${days} days ago`;
}

export function isOlderThanDays(dateInput: string | number, days: number): boolean {
  return Date.now() - new Date(dateInput).getTime() >= days * DAY_MS;
}
