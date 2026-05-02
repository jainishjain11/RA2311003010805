"use strict";

const express = require("express");
const router = express.Router();

const { Log } = require("logging_middleware");
const { fetchNotifications } = require("../services/fetchNotifications");
const { getTopN } = require("../services/priorityService");

// GET /notifications/priority?n=10
// 1. Fetches all notifications from the evaluation-service.
// 2. Computes priority score: score = typeWeight * (1 / (1 + hoursSince))
// 3. Uses a MinHeap to extract the top N efficiently.
// 4. Returns them sorted by score descending.

router.get("/notifications/priority", async (req, res) => {
  await Log("backend", "info", "route", "GET /notifications/priority – request received");

  // Parse & validate query param
  const rawN = req.query.n;
  const n = parseInt(rawN, 10);

  if (!rawN || isNaN(n) || n <= 0) {
    await Log(
      "backend", "warn", "handler",
      `GET /notifications/priority – invalid n param: "${rawN}"`
    );
    return res.status(400).json({
      success: false,
      error: "Query parameter 'n' must be a positive integer. Example: ?n=10",
    });
  }

  try {
    // Fetch raw notifications
    await Log("backend", "debug", "handler", `Fetching all notifications for top-${n} selection`);
    const notifications = await fetchNotifications();

    // Compute top N via priority heap
    await Log("backend", "info", "domain", `Running priority heap: ${notifications.length} notifications → top ${n}`);
    const topNotifications = getTopN(notifications, n);
    await Log("backend", "info", "domain", `Priority heap complete – returning ${topNotifications.length} results`);

    //Respond
    await Log("backend", "info", "route", "GET /notifications/priority – responding with top-N list");

    return res.status(200).json({
      success: true,
      data: {
        topN: n,
        notifications: topNotifications,
      },
    });
  } catch (err) {
    await Log("backend", "error", "route", `GET /notifications/priority – error: ${err.message}`);

    return res.status(502).json({
      success: false,
      error: "Failed to retrieve or rank notifications.",
      details: err.message,
    });
  }
});

module.exports = router;
