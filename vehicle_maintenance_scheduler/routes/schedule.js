"use strict";

const express = require("express");
const router  = express.Router();
const { Log } = require("logging_middleware");
const { fetchDepots, fetchVehicles } = require("../services/fetchData");
const { knapsack } = require("../services/knapsack");

function getId(d)    { return String(d.ID || d.id || d.depotId || ""); }
function getHours(d) { return Number(d.MechanicHours || d.mechanicHours || 0); }
function normaliseTasks(raw) {
  return raw.map((v) => ({
    TaskID:   v.TaskID || v.taskId || v.id,
    Duration: Number(v.Duration || v.duration || 0),
    Impact:   Number(v.Impact   || v.impact   || 0),
  }));
}

router.get("/depots", async (req, res) => {
  try {
    const depots = await fetchDepots();
    return res.status(200).json({ success: true, data: depots });
  } catch (err) {
    await Log("backend", "error", "handler", `GET /depots: ${err.message}`.slice(0, 48));
    return res.status(502).json({ success: false, error: err.message });
  }
});

router.get("/schedule/all", async (req, res) => {
  await Log("backend", "info", "route", "GET /schedule/all");
  try {
    const [depots, rawVehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);
    const tasks = normaliseTasks(rawVehicles);

    const schedule = depots.map((depot) => {
      const depotId = getId(depot);
      const budget  = getHours(depot);
      const { selectedTasks, totalImpact, totalDuration } = knapsack(tasks, budget);
      return { depotId, budget, totalImpact, totalDuration, selectedTasks };
    });

    await Log("backend", "info", "route", "Schedule built ok");
    return res.status(200).json({ success: true, totalDepots: depots.length, schedule });
  } catch (err) {
    await Log("backend", "error", "handler", `schedule/all: ${err.message}`.slice(0, 48));
    return res.status(502).json({ success: false, error: err.message });
  }
});

router.post("/schedule/:depotId", async (req, res) => {
  const { depotId } = req.params;
  try {
    const [depots, rawVehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);
    const depot = depots.find((d) => getId(d) === String(depotId));
    if (!depot) return res.status(404).json({ success: false, error: "Depot not found" });

    const tasks = normaliseTasks(rawVehicles);
    const budget = getHours(depot);
    const { selectedTasks, totalImpact, totalDuration } = knapsack(tasks, budget);

    await Log("backend", "info", "route", `Depot ${depotId} scheduled`);
    return res.status(200).json({ success: true, data: { depotId, budget, totalImpact, totalDuration, selectedTasks } });
  } catch (err) {
    await Log("backend", "error", "handler", `schedule err: ${err.message}`.slice(0, 48));
    return res.status(502).json({ success: false, error: err.message });
  }
});

module.exports = router;