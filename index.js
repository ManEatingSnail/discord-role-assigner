import express from "express";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = 3000;

const ROLE_MAP = {
  group1: "1431317597147627550",
  group2: "1431317878266662912",
  group3: "1431573059017642016",
  group4: "1431573136150892645",
};

// STEP 1: User clicks a link → /claim?role=vip
app.get("/claim", (req, res) => {
  const roleKey = req.query.role;
  if (!roleKey || !ROLE_MAP[roleKey])
    return res.send("Invalid or missing role parameter.");

  // Store the role in a session-like variable (simplified)
  const redirectUri = `${process.env.DISCORD_REDIRECT_URI}?role=${roleKey}`;

  const loginUrl = `https://discord.com/oauth2/authorize?client_id=${
    process.env.DISCORD_CLIENT_ID
  }&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=identify%20guilds`;

  res.redirect(loginUrl);
});

// STEP 2: Discord redirects back to /callback
app.get("/callback", async (req, res) => {
  const { code, role } = req.query;

  if (!code || !role || !ROLE_MAP[role])
    return res.send("Invalid request or missing role.");

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.DISCORD_REDIRECT_URI}?role=${role}`,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get user info
    const userResponse = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const user = userResponse.data;

    // Assign role via bot
    const roleId = ROLE_MAP[role];
    await axios.put(
      `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${user.id}/roles/${roleId}`,
      {},
      { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
    );

    res.send(
      `<h2>✅ ${user.username} has been given the ${role.toUpperCase()} role!</h2>`
    );
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.send("❌ Something went wrong assigning the role.");
  }
});

app.listen(port, () =>
  console.log(`🚀 Server running at http://localhost:${port}`)
);
