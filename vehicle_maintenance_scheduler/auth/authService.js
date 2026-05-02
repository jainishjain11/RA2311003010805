"use strict";

const axios = require("axios");
const { Log } = require("logging_middleware");

const BASE_URL = process.env.BASE_URL || "http://20.207.122.201/evaluation-service";

let _token = null;
let _tokenExpiresAt = 0;

async function authenticate() {
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

  if (!_token) throw new Error("No token in auth response");

  _tokenExpiresAt = Date.now() + (55 * 60 * 1000);
  await Log("backend", "info", "auth", "Token acquired");
  return _token;
}

async function getToken() {
  if (_token && Date.now() < _tokenExpiresAt) return _token;
  return authenticate();
}

module.exports = { authenticate, getToken };