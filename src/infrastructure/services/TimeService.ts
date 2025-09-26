export class TimeService {
  static getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  static getTimeStampMinutesAgo(minutes: number): string {
    const date = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    return date.slice(0, 19) + 'Z'; // remove milliseconds
  }

  static isBeforeNow(date: Date, minutes?: number): boolean {
    const time = new Date(Date.now() - (minutes ?? 0) * 60 * 1000);
    return date < time;
  }

  static getDateFromMinutesPast(minutes: number): Date {
    return new Date(Date.now() - minutes * 60 * 1000);
  }
}
