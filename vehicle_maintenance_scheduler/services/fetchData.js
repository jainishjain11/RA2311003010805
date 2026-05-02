"use strict";

const axios = require("axios");
const { Log } = require("logging_middleware");
const { getToken } = require("../auth/authService");

const BASE_URL = process.env.BASE_URL || "http://20.207.122.201/evaluation-service";

async function buildHeaders() {
  const token = await getToken();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function fetchDepots() {
  await Log("backend", "info", "service", "Fetching depots");
  const headers = await buildHeaders();
  const response = await axios.get(`${BASE_URL}/depots`, { headers, timeout: 10000 });
  const depots = response.data.depots || response.data.data || response.data;
  if (!Array.isArray(depots)) throw new Error("Bad depots response");
  await Log("backend", "info", "service", `Got ${depots.length} depots`);
  return depots;
}

async function fetchVehicles() {
  await Log("backend", "info", "service", "Fetching vehicles");
  const headers = await buildHeaders();
  const response = await axios.get(`${BASE_URL}/vehicles`, { headers, timeout: 10000 });
  const vehicles = response.data.vehicles || response.data.data || response.data;
  if (!Array.isArray(vehicles)) throw new Error("Bad vehicles response");
  await Log("backend", "info", "service", `Got ${vehicles.length} vehicles`);
  return vehicles;
}

module.exports = { fetchDepots, fetchVehicles };