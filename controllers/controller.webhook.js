const express = require("express");
const cors = require("cors");
const line = require("@line/bot-sdk");
const mysql = require("mysql2");
const axios = require("axios");

require("dotenv").config();

const bodyParser = require("body-parser");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true })); // Allow handling FormData
app.use(bodyParser.json());

// แทนด้วยข้อมูลจาก LINE Developer Console
const LINE_CLIENT_ID = "2007207985"; //process.env.LINE_CLIENT_ID;
const LINE_CLIENT_SECRET = "188370a3b1ecefda177877f2f87cabb0"; //process.env.LINE_CLIENT_SECRET;
const REDIRECT_URI = "https://api.toponpage.com/api/auth/line/callback"; //process.env.LINE_REDIRECT_URI;
// ตั้งค่าการเชื่อมต่อกับ LINE
const config = {
  channelAccessToken:
    "+LhzvgPuLx2kLVSiuBL7urbD4dq4LYruwMH5uo9udb4qZQajCNI3aAXyXv7/Yt8dI99W4WwAUU2WMCZX0o28CW9E2+22lkS9PtuiO5lFDpIK2z3YkIrJGD/pLXzpWAsOU0/1Asx/YPHuNzxbuaKURwdB04t89/1O/w1cDnyilFU=", //process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: "fccc9748409dc9de291332018c57f42b", //process.env.LINE_CHANNEL_SECRET,
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

exports.callback = async (req, res) => {
  const code = req.query.code;
  try {
    const tokenRes = await axios.post(
      "https://api.line.me/oauth2/v2.1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: LINE_CLIENT_ID,
        client_secret: LINE_CLIENT_SECRET,
      }).toString(), // <-- สำคัญมาก
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    const profileRes = await axios.get("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userProfile = profileRes.data;

    // ส่งไปที่ frontend
    res.redirect(
      `${process.env.LINE_FRONTEND_URI}/line-success?displayName=${userProfile.displayName}&pictureUrl=${userProfile.pictureUrl}`
    );
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Login Failed");
  }
};

exports.saveUser = async (req, res) => {
  const { fbclid, fbads, lineUserId, displayName } = req.body;

  // ตรวจสอบให้แน่ใจว่า fbclid และ fbads ไม่มีค่า null หรือ undefined
  const fbclidValue = fbclid || "None";
  const fbadsValue = fbads || "None";

  if (!lineUserId) {
    return res.status(400).json({ error: "Missing lineUserId" });
  }

  const query =
    "INSERT INTO user_profiles (lineUserId, displayName, fbclid, fbads) VALUES (?, ?, ?, ?)";
  db.query(
    query,
    [lineUserId, displayName, fbclidValue, fbadsValue],
    (err, result) => {
      if (err) {
        console.error("Error inserting data into database:", err);
        return res.status(500).json({ error: "Failed to save data" });
      }
      console.log("Data saved to database");
      res.status(200).json({ message: "Data saved successfully" });
    }
  );
};

exports.lineLogin = async (req, res) => {
  const state = "random123"; // ใส่ state แบบ random
  const scope = "profile openid email";
  const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${state}&scope=${scope}`;
  res.redirect(lineAuthUrl);
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
