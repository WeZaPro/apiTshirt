const express = require("express");
const axios = require("axios");
// const moment = require("moment-timezone");
const bodyParser = require("body-parser");
// const crypto = require("crypto");
// const nodemailer = require("nodemailer");
const cors = require("cors"); // 🔹 นำเข้า CORS

//sendInBlue-SendMail
// const SibApiV3Sdk = require("sib-api-v3-sdk");

//controller
const controllerLineBot = require("./controllers/controller.webhook");

const app = express();
app.use(cors()); // 🔹 เปิดใช้งาน CORS
const PORT = 3000;

// ตั้งค่า Body Parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("START SERVER");
});

//Webhook linebot
app.post("/webhook", controllerLineBot.lineBot);
app.get("/api/auth/line/login", controllerLineBot.lineLogin);
app.get("/api/auth/line/callback", controllerLineBot.callback);
app.post("/api/ave-user", controllerLineBot.saveUser);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
