"use strict";

require("dotenv").config();
const axios   = require("axios");
const { getToken } = require("../auth/authService");
const { Log }      = require("logging_middleware");

const BASE_URL = process.env.BASE_URL || "http://20.207.122.201/evaluation-service";

/**
 * Fetches the full notification list from the evaluation-service.
 * Returns an array of { ID, Type, Message, Timestamp } objects.
 *
 * @returns {Promise<Array>}
 */
async function fetchNotifications() {
  await Log("backend", "info", "service", "Fetching notifications from evaluation service");

  try {
    const token = await getToken();
    const response = await axios.get(`${BASE_URL}/notifications`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    // Handle common response shapes: { data: [...] } or plain array
    const notifications = response.data?.data || response.data;

    if (!Array.isArray(notifications)) {
      throw new Error(
        `Unexpected notifications response shape: ${JSON.stringify(response.data)}`
      );
    }

    await Log(
      "backend",
      "info",
      "service",
      `Fetched ${notifications.length} notifications from upstream`
    );

    return notifications;
  } catch (err) {
    await Log("backend", "error", "service", `fetchNotifications error: ${err.message}`);
    throw err;
  }
}

module.exports = { fetchNotifications };
