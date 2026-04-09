const MS_PER_DAY = 86_400_000;
export const PENALTY_PER_NN = 60;

export interface ResettableHabit {
  id: string;
  title: string;
  completed_today: boolean;
  streak: number;
}

export interface DailyLogSummaryItem {
  title: string;
  completed: boolean;
}

export interface ResetPlanDay {
  date: string;
  nnSummary: DailyLogSummaryItem[];
  habitSummary: DailyLogSummaryItem[];
  penalty: number;
  xpAtTime: number;
  xpAfterPenalty: number;
}

export function toDateStr(date: Date, timezone = "UTC"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone })
      .format(date)
      .slice(0, 10);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (cursor < end) {
    dates.push(toDateStr(cursor));
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }

  return dates;
}

export function getLastCheckInDay(
  lastCheckIn: string | null,
  timezone: string
): string | null {
  if (!lastCheckIn) return null;
  return toDateStr(new Date(lastCheckIn), timezone);
}

export function getUpdatedGlobalStreak(params: {
  streak: number;
  lastCheckIn: string | null;
  timezone: string;
  today: string;
  yesterday: string;
}) {
  const lastCheckInDay = getLastCheckInDay(params.lastCheckIn, params.timezone);

  if (lastCheckInDay === params.yesterday) {
    return params.streak + 1;
  }

  if (lastCheckInDay !== params.today) {
    return lastCheckInDay ? 0 : params.streak;
  }

  return params.streak;
}

export function buildResetPlan(params: {
  today: string;
  lastHabitReset: string | null;
  xp: number;
  nonNegotiables: ResettableHabit[];
  dailyHabits: ResettableHabit[];
}) {
  const fallbackStart = toDateStr(new Date(Date.now() - MS_PER_DAY));
  const lastReset = params.lastHabitReset || fallbackStart;
  const missedDays = dateRange(lastReset, params.today);
  let runningXp = params.xp;

  const days: ResetPlanDay[] = missedDays.map((day, index) => {
    const useLiveCompletion = index === 0;
    let penalty = 0;
    const xpAtTime = runningXp;

    const nnSummary = params.nonNegotiables.map((habit) => {
      const completed = useLiveCompletion ? habit.completed_today : false;
      if (!completed) penalty += PENALTY_PER_NN;
      return { title: habit.title, completed };
    });

    const habitSummary = params.dailyHabits.map((habit) => ({
      title: habit.title,
      completed: useLiveCompletion ? habit.completed_today : false,
    }));

    runningXp = Math.max(0, runningXp - penalty);

    return {
      date: day,
      nnSummary,
      habitSummary,
      penalty,
      xpAtTime,
      xpAfterPenalty: runningXp,
    };
  });

  return {
    lastReset,
    missedDays,
    days,
    finalXp: runningXp,
  };
}
