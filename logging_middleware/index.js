"use strict";

const axios = require("axios");

let _token = null;
let _tokenExpiresAt = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiresAt) return _token;

  const BASE_URL = process.env.BASE_URL || "http://20.207.122.201/evaluation-service";

  const response = await axios.post(`${BASE_URL}/auth`, {
    email:        process.env.EMAIL,
    name:         process.env.NAME,
    rollNo:       process.env.ROLL_NO,
    accessCode:   process.env.ACCESS_CODE,
    clientID:     process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  }, {
    headers: { "Content-Type": "application/json" },
    timeout: 10000,
  });

  const data = response.data;
  _token = data.access_token || data.token || data.accessToken;

  if (!_token) {
    throw new Error(`No token in response: ${JSON.stringify(data)}`);
  }

  _tokenExpiresAt = Date.now() + (55 * 60 * 1000);
  return _token;
}

const VALID_LEVELS = ["debug", "info", "warn", "error", "fatal"];
const VALID_PACKAGES = [
  "cache", "controller", "cron_job", "db", "domain", "handler",
  "repository", "route", "service", "auth", "config", "middleware", "utils",
  "api", "component", "hook", "page", "state", "style"
];

async function Log(stack, level, pkg, message) {
  try {
    const safeStack = (stack === "frontend" || stack === "backend") ? stack : "backend";
    const safeLevel = VALID_LEVELS.includes(level) ? level : "info";
    const safePkg   = VALID_PACKAGES.includes(pkg) ? pkg : "utils";
    const rawMsg    = typeof message === "string" ? message : JSON.stringify(message);
    const safeMsg   = rawMsg.slice(0, 48); // API max is 48 characters

    const BASE_URL = process.env.BASE_URL || "http://20.207.122.201/evaluation-service";
    const token    = await getToken();

    await axios.post(`${BASE_URL}/logs`, {
      stack:   safeStack,
      level:   safeLevel,
      package: safePkg,
      message: safeMsg,
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 5000,
    });
  } catch (err) {
    process.stderr.write(`[LOGGER ERROR] ${JSON.stringify(err?.response?.data || err.message)}\n`);
  }
}

module.exports = { Log };