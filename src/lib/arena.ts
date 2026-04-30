export interface DailyDisciplinePoint {
  date: string;
  score: number;
}

export interface ArenaLog {
  date: string;
  nnSummary: { title: string; completed: boolean }[];
  habitSummary: { title: string; completed: boolean }[];
  totalXpAtTime: number;
  penalty: number;
}

export interface ConsistencyMetrics {
  hasEnoughData: boolean;
  score: number | null;
  nnCompliance: number | null;
  habitCompletion: number | null;
  streakFactor: number | null;
  dailyPoints: DailyDisciplinePoint[];
}

export interface ArenaLeaderboardEntry {
  userId: string;
  username: string;
  xp: number;
  streak: number;
  score: number | null;
  hasEnoughData: boolean;
}

function sortLogsByDateDesc(logs: ArenaLog[]) {
  return [...logs].sort((a, b) => b.date.localeCompare(a.date));
}

function getRecentCompletedLogs(logs: ArenaLog[], count = 7): ArenaLog[] {
  return sortLogsByDateDesc(logs).slice(0, count);
}

function roundPercent(value: number) {
  return Math.round(value * 100);
}

function getCompletionRate(items: { completed: boolean }[]) {
  if (items.length === 0) return null;
  const completed = items.filter((item) => item.completed).length;
  return completed / items.length;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getDailyDisciplineScore(log: ArenaLog) {
  const nnRate = getCompletionRate(log.nnSummary);
  const habitRate = getCompletionRate(log.habitSummary);
  const weightedParts: { value: number; weight: number }[] = [];

  if (nnRate !== null) weightedParts.push({ value: nnRate, weight: 0.7 });
  if (habitRate !== null) weightedParts.push({ value: habitRate, weight: 0.3 });
  if (weightedParts.length === 0) return 0;

  const totalWeight = weightedParts.reduce((sum, part) => sum + part.weight, 0);
  const weightedValue =
    weightedParts.reduce((sum, part) => sum + part.value * part.weight, 0) /
    totalWeight;

  return Math.round(weightedValue * 100);
}

export function calculateConsistencyMetrics(
  logs: ArenaLog[],
  streak: number
): ConsistencyMetrics {
  const selectedLogs = getRecentCompletedLogs(logs, 7).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const dailyPoints = selectedLogs.map((log) => ({
    date: log.date,
    score: getDailyDisciplineScore(log),
  }));

  if (selectedLogs.length < 7) {
    return {
      hasEnoughData: false,
      score: null,
      nnCompliance: null,
      habitCompletion: null,
      streakFactor: null,
      dailyPoints,
    };
  }

  const nnAverage = average(
    selectedLogs
      .map((log) => getCompletionRate(log.nnSummary))
      .filter((value): value is number => value !== null)
  );
  const habitAverage = average(
    selectedLogs
      .map((log) => getCompletionRate(log.habitSummary))
      .filter((value): value is number => value !== null)
  );
  const streakFactor = Math.min(Math.max(streak, 0), 7) / 7;
  const weightedParts: { value: number; weight: number }[] = [
    { value: streakFactor, weight: 0.2 },
  ];

  if (nnAverage !== null) weightedParts.push({ value: nnAverage, weight: 0.5 });
  if (habitAverage !== null) weightedParts.push({ value: habitAverage, weight: 0.3 });

  const totalWeight = weightedParts.reduce((sum, part) => sum + part.weight, 0);
  const weightedScore =
    weightedParts.reduce((sum, part) => sum + part.value * part.weight, 0) /
    totalWeight;

  return {
    hasEnoughData: true,
    score: Math.round(weightedScore * 100),
    nnCompliance: nnAverage === null ? null : roundPercent(nnAverage),
    habitCompletion: habitAverage === null ? null : roundPercent(habitAverage),
    streakFactor: roundPercent(streakFactor),
    dailyPoints,
  };
}

export function buildArenaLeaderboard(
  users: { userId: string; username: string; xp: number; streak: number }[],
  logsByUserId: Map<string, ArenaLog[]>
): ArenaLeaderboardEntry[] {
  return users
    .map((user) => {
      const metrics = calculateConsistencyMetrics(
        logsByUserId.get(user.userId) ?? [],
        user.streak
      );
      return {
        userId: user.userId,
        username: user.username,
        xp: user.xp,
        streak: user.streak,
        score: metrics.score,
        hasEnoughData: metrics.hasEnoughData,
      };
    })
    .sort((a, b) => {
      const aScore = a.score ?? -1;
      const bScore = b.score ?? -1;
      if (bScore !== aScore) return bScore - aScore;
      if (b.xp !== a.xp) return b.xp - a.xp;
      return a.username.localeCompare(b.username);
    });
}
