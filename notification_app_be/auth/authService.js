"use strict";

require("dotenv").config();
const axios = require("axios");

const BASE_URL = process.env.BASE_URL || "http://20.207.122.201/evaluation-service";

let _token = null;
let _tokenExpiresAt = 0;

/**
 * Authenticates with the evaluation service and caches the Bearer token.
 */
async function authenticate() {
  const credentials = {
    email: process.env.EMAIL,
    name: process.env.NAME,
    rollNo: process.env.ROLL_NO,
    accessCode: process.env.ACCESS_CODE,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  };

  const response = await axios.post(`${BASE_URL}/auth`, credentials, {
    headers: { "Content-Type": "application/json" },
    timeout: 10000,
  });

  const data = response.data;
  const token =
    data.token ||
    data.access_token ||
    data.accessToken ||
    data.data?.token ||
    data.data?.access_token;

  if (!token) {
    throw new Error(
      `Auth response missing token. Got: ${JSON.stringify(data)}`
    );
  }

  _token = token;
  const expiresIn = data.expires_in || data.expiresIn || 3300;
  _tokenExpiresAt = Date.now() + expiresIn * 1000;

  return _token;
}

/**
 * Returns a valid Bearer token; re-authenticates if expired or missing.
 */
async function getToken() {
  if (_token && Date.now() < _tokenExpiresAt) {
    return _token;
  }
  return authenticate();
}

module.exports = { getToken, authenticate };
