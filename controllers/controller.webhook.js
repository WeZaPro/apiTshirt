const express = require("express");
const cors = require("cors");
const line = require("@line/bot-sdk");
const mysql = require("mysql2");

require("dotenv").config();

const bodyParser = require("body-parser");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true })); // Allow handling FormData
app.use(bodyParser.json());

// แทนด้วยข้อมูลจาก LINE Developer Console
const LINE_CHANNEL_ID = "2007207985";
const LINE_CHANNEL_SECRET = "188370a3b1ecefda177877f2f87cabb0";
const REDIRECT_URI = "http://toponpage.com/LineCallback"; // ต้องตรงกับที่ตั้งไว้ใน LINE Developer Console

// ตั้งค่าการเชื่อมต่อกับ LINE
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const user_table = "lineUser";
const db = mysql.createConnection({
  connectionLimit: 10, // จำนวน connection สูงสุด
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  // database: "PETIVERSE",
  database: process.env.database,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed: ", err);
    return;
  }
  console.log("Connected to MySQL database");
});

exports.lineBot = async (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(() => res.status(200).end())
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
};

exports.saveUser = async (req, res) => {
  res.send("save data");
};
exports.lineLogin = async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    // 1. ขอ access token จาก LINE
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("Error getting token:", tokenData);
      return res
        .status(500)
        .json({ error: "Failed to get access token from LINE" });
    }

    const accessToken = tokenData.access_token;

    // 2. ดึงข้อมูลโปรไฟล์ผู้ใช้
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const profile = await profileRes.json();

    // ส่งกลับเฉพาะ userId (หรือจะส่ง displayName, pictureUrl ก็ได้)
    res.json({
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    });
  } catch (err) {
    console.error("LINE login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

async function handleEvent(event) {
  if (event.type === "message" && event.message.type === "text") {
    const userId = event.source.userId;
    const messageText = event.message.text;
    console.log(`User ID: ${userId}, Message: ${messageText}`);

    // กรณีผู้ใช้พิมพ์ "ยกเลิก" ก็ยังให้บันทึกข้อมูลเหมือน "OK"
    if (messageText === "NO") {
      try {
        const profile = await client.getProfile(userId);
        const displayName = profile.displayName;

        db.query(
          `INSERT INTO ${user_table} (user_id, display_name) VALUES (?, ?)`,
          [userId, displayName],
          (err) => {
            if (err) {
              console.error("Failed to save user data: ", err);
            } else {
              console.log("User data saved successfully");
            }
          }
        );

        return client.replyMessage(event.replyToken, {
          type: "text",
          text: "ขอบคุณครับ!",
        });
      } catch (error) {
        console.error("Failed to get user profile: ", error);
      }
    }

    // ตรวจสอบ userId ว่ามีในฐานข้อมูลหรือไม่
    db.query(
      `SELECT * FROM ${user_table} WHERE user_id = ?`,
      [userId],
      async (err, results) => {
        if (err) {
          console.error("Database query error: ", err);
          return;
        }

        if (results.length === 0) {
          return client.replyMessage(event.replyToken, {
            type: "template",
            altText: "กรุณากด OK เพื่อบันทึกข้อมูล",
            template: {
              type: "confirm",
              text: "คุณติดต่อมาครั้งแรก ใช่หรือไม่?",
              actions: [
                {
                  type: "postback",
                  label: "OK",
                  data: `action=save&userId=${userId}`,
                },
                {
                  type: "message",
                  label: "NO",
                  text: "NO",
                },
              ],
            },
          });
        }
      }
    );
  } else if (event.type === "postback") {
    const data = event.postback.data;
    const params = new URLSearchParams(data);
    const action = params.get("action");
    const userId = params.get("userId");

    if (action === "save" && userId) {
      try {
        const profile = await client.getProfile(userId);
        const displayName = profile.displayName;

        db.query(
          `INSERT INTO ${user_table} (user_id, display_name) VALUES (?, ?)`,
          [userId, displayName],
          (err) => {
            if (err) {
              console.error("Failed to save user data: ", err);
            } else {
              console.log("User data saved successfully");
            }
          }
        );

        return client.replyMessage(event.replyToken, {
          type: "text",
          text: "ขอบคุณครับ!",
        });
      } catch (error) {
        console.error("Failed to get user profile: ", error);
      }
    }
  }
}
