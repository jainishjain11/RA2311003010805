"use strict";

//Priority scoring constants

const TYPE_WEIGHTS = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

const MS_PER_HOUR = 1000 * 60 * 60;

/**
 * Computes the priority score for a single notification.
 *
 * score = typeWeight * recencyScore
 * recencyScore = 1 / (1 + hoursSinceNotification)
 *
 * Higher score → higher priority.
 *
 * @param {{ Type: string, Timestamp: string }} notification
 * @returns {number}
 */
function computeScore(notification) {
  const weight = TYPE_WEIGHTS[notification.Type] || 1;
  const ts = new Date(notification.Timestamp).getTime();
  const hoursSince = (Date.now() - ts) / MS_PER_HOUR;
  const recency = 1 / (1 + hoursSince);
  return weight * recency;
}

// Min-Heap (keyed on priorityScore)
// Used to keep only the top-N highest-scored notifications efficiently.
// Time: O(n log N)  Space: O(N)

class MinHeap {
  constructor() {
    this._heap = [];
  }

  get size() {
    return this._heap.length;
  }

  /**
   * Returns the element with the lowest score (heap root) without removing it.
   */
  peek() {
    return this._heap[0] || null;
  }

  /**
   * Inserts a new element and restores heap property.
   * @param {{ priorityScore: number }} item
   */
  push(item) {
    this._heap.push(item);
    this._bubbleUp(this._heap.length - 1);
  }

  /**
   * Removes and returns the element with the lowest score.
   */
  pop() {
    if (this._heap.length === 0) return null;

    const top = this._heap[0];
    const last = this._heap.pop();

    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._siftDown(0);
    }

    return top;
  }

  //Internal helpers

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._heap[parent].priorityScore <= this._heap[i].priorityScore) break;
      [this._heap[parent], this._heap[i]] = [this._heap[i], this._heap[parent]];
      i = parent;
    }
  }

  _siftDown(i) {
    const n = this._heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;

      if (l < n && this._heap[l].priorityScore < this._heap[smallest].priorityScore)
        smallest = l;
      if (r < n && this._heap[r].priorityScore < this._heap[smallest].priorityScore)
        smallest = r;

      if (smallest === i) break;

      [this._heap[smallest], this._heap[i]] = [this._heap[i], this._heap[smallest]];
      i = smallest;
    }
  }
}

// Main export: getTopN

/**
 * Given a raw list of notifications, returns the top-N by priority score.
 *
 * Algorithm:
 *   1. For each notification, compute its priorityScore.
 *   2. Maintain a Min-Heap of size N.
 *      - If heap.size < N  → push unconditionally.
 *      - Else if score > heap.peek().score → pop min, push new item.
 *   3. Extract all items from heap and sort descending by score.
 *
 * @param {Array}  notifications  - Raw notification objects from API
 * @param {number} n              - Number of top results to return
 * @returns {Array}               - Top-N notifications with priorityScore attached, sorted desc
 */
function getTopN(notifications, n) {
  if (!Array.isArray(notifications) || n <= 0) return [];

  const heap = new MinHeap();

  for (const notif of notifications) {
    const score = computeScore(notif);
    const scored = { ...notif, priorityScore: parseFloat(score.toFixed(6)) };

    if (heap.size < n) {
      heap.push(scored);
    } else if (heap.peek() && score > heap.peek().priorityScore) {
      heap.pop();
      heap.push(scored);
    }
  }

  // Extract and sort descending
  const result = [];
  while (heap.size > 0) {
    result.push(heap.pop());
  }

  return result.sort((a, b) => b.priorityScore - a.priorityScore);
}

module.exports = { getTopN, computeScore };
