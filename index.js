import dotenv from "dotenv";
dotenv.config();

import express from "express";
import axios from "axios";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();
const port = 3000;

// Create a simple in-memory store for roles during OAuth flow
const roleSessions = new Map();

// Create and log in Discord client (makes bot show online)
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "Assisting TMN", type: 0 }], // "Assigning Roles"
    status: "online",
  });
});

client.login(process.env.DISCORD_BOT_TOKEN);

// Map of short role names to their Discord role IDs
const ROLE_MAP = {
group1: "1431317597147627550",
group2: "1431317878266662912",
group3: "1431573059017642016",
group4: "1431573136150892645",
};

// Route: /claim?role=groupx
app.get("/claim", (req, res) => {
  const roleKey = req.query.role;
  if (!roleKey || !ROLE_MAP[roleKey]) {
    return res.redirect("https://www.tmn2010.net/authenticated/news.aspx");
  }

  // Create a temporary session ID to store role choice
  const sessionId = Math.random().toString(36).substring(2, 15);
  roleSessions.set(sessionId, roleKey);

  // Build the Discord OAuth2 URL
  const loginUrl = `https://discord.com/oauth2/authorize?client_id=${
    process.env.DISCORD_CLIENT_ID
  }&redirect_uri=${encodeURIComponent(
    process.env.DISCORD_REDIRECT_URI
  )}&response_type=code&scope=identify%20guilds&state=${sessionId}`;

  res.redirect(loginUrl);
});

// Route: /callback (after Discord login)
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  const role = roleSessions.get(state);
  roleSessions.delete(state);

  if (!code || !role || !ROLE_MAP[role]) {
    return res.redirect("https://www.tmn2010.net/authenticated/news.aspx");
  }

  try {
    // Exchange the code for an access token
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get user info
    const userResponse = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const user = userResponse.data;

    // Assign the role
    const roleId = ROLE_MAP[role];
    await axios.put(
      `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${user.id}/roles/${roleId}`,
      {},
      { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
    );

    // ✅ Redirect back to your main site with role info
    return res.redirect(
      `https://www.tmn2010.net/authenticated/news.aspx`
    );
  } catch (err) {
    console.error(err.response?.data || err.message);
    // ❌ Redirect to error page
    return res.redirect("https://www.tmn2010.net/authenticated/news.aspx");
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});