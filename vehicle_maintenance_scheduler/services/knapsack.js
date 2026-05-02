"use strict";

function knapsack(tasks, capacity) {
  const n = tasks.length;
  if (n === 0 || capacity <= 0) return { selectedTasks: [], totalImpact: 0, totalDuration: 0 };

  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = tasks[i - 1];
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w];
      if (Duration <= w) {
        const with_ = dp[i - 1][w - Duration] + Impact;
        if (with_ > dp[i][w]) dp[i][w] = with_;
      }
    }
  }

  const selectedTasks = [];
  let w = capacity;
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selectedTasks.push(tasks[i - 1]);
      w -= tasks[i - 1].Duration;
    }
  }

  const totalDuration = selectedTasks.reduce((s, t) => s + t.Duration, 0);
  const totalImpact   = selectedTasks.reduce((s, t) => s + t.Impact, 0);
  return { selectedTasks, totalImpact, totalDuration };
}

module.exports = { knapsack };