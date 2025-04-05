const express = require("express");
const axios = require("axios");
const moment = require("moment-timezone");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const cors = require("cors"); // 🔹 นำเข้า CORS

//sendInBlue-SendMail
const SibApiV3Sdk = require("sib-api-v3-sdk");

//controller
const controllerLineBot = require("./controllers/controller.webhook");

const app = express();
app.use(cors()); // 🔹 เปิดใช้งาน CORS
const PORT = 5000;

// ตั้งค่า Body Parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// const TELEGRAM_BOT_TOKEN = "7456331720:AAGVd5msA7HMOA7Gb5UzfQNGnp_wkP3toQ0";
// const TELEGRAM_CHAT_ID = "-4696619141";

const pixel_id = "3857774234539413";
const fb_token =
  "EAA0K2b09n5MBO9Rx55zfXXNGYMSKhKjznqWAZB9zuN7r4KIuDGC1Kjq5F1LXOKi7kZBB1kQiulhZAv7LnZBjGOLnFLEkZBQAnVD7bYZAoVeYOulZB6uzZCZC4giFRwWZADrtrxdc8NW5AD298mQXgKq2NmQfPNfufZB4rsKQUdJYzZCwmjWHTyXhEPklD9AEnOA5T2tyNQZDZD";
const test_code = "TEST13192";
const website = "https://onlinesabuyme.co.th";

// ฟังก์ชันแฮช SHA-256
function hashSHA256(value) {
  if (!value) return null;
  return crypto
    .createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

app.get("/", (req, res) => {
  res.send("START SERVER");
});

//Webhook linebot
app.post("/webhook", controllerLineBot.lineBot);

app.post("/send-event-CompleteRegistration", async (req, res) => {
  try {
    const eventTimeUnix = Math.floor(
      moment().tz("Asia/Bangkok").valueOf() / 1000
    );

    const requestData = req.body.data[0]; // รับข้อมูลจาก request
    if (!requestData || !requestData.custom_data || !requestData.user_data) {
      return res
        .status(400)
        .json({ error: "Missing required fields in request body" });
    }

    // แฮชข้อมูล Email และ Phone
    const hashedEmail = hashSHA256(requestData.custom_data.email);
    const hashedPhone = hashSHA256(requestData.custom_data.phone);

    // สร้าง Payload สำหรับส่งไป Facebook
    const data = {
      data: [
        {
          event_name: "CompleteRegistration",
          action_source: "website",
          event_time: eventTimeUnix,
          custom_data: requestData.custom_data,
          user_data: {
            ...requestData.user_data,
            em: hashedEmail, // ใส่ Email ที่แฮชแล้ว
            ph: hashedPhone, // ใส่ Phone ที่แฮชแล้ว
          },
          event_source_url: website,
        },
      ],
      partner_agent: "stape-gtmss-2.1.1",
      test_event_code: test_code,
    };

    // console.log("Payload to Facebook API:", JSON.stringify(data, null, 2)); // ตรวจสอบ Payload ก่อนส่ง

    // ส่งข้อมูลไปยัง Facebook Conversion API
    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${pixel_id}/events`,
      data,
      {
        headers: { "Content-Type": "application/json" },
        params: { access_token: fb_token },
      }
    );

    // res.json(response.data);

    if (response.status === 200) {
      // โค้ดบันทึกข้อมูลลงฐานข้อมูล
      await saveToDatabase(requestData);
      //   await sendMail(requestData);
      res.json({ message: "Data saved successfully", data: response.data });
    } else {
      res.status(response.status).json({ message: "Failed to send data" });
    }
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/sendMail", async (req, res) => {
  await sendMail();
  //   console.log("sendMail() ", sendMail());
  res.send("SEND MAIL");
});
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const saveToDatabase = (data) => {
  console.log("saveToDatabase ", data);
};

const sendMail = () => {
  //send veryfication mail  to the student
  const genCode = "123456789";
  const getMailNam = "Taweesak.Y";
  const tokenSetMail = "tokenSetMail";
  const hostMail = "courseAdsOnline.toponpage.com";
  var mailOptions = {
    from: "admin@toponpage.com",
    //   to: user.email,
    to: "taweesak9359@gmail.com",
    subject: "Verify your login to access WasToWill",
    html: `
             <div style="max-width: 700px; margin:auto; border: 8px solid #ddd; padding: 50px 20px; font-size: 110%;">
          
             <h2 style="text-align: center; color: teal;"> Hello ${getMailNam} ! </h2>
             <h3>Please verify your account to continue to<span> <b>WasToWill </b></span> </h3>
             <p><b>Your Temporary Password : ${tokenSetMail}</b></p>
             <p>Using Temporary password update your profile with New Password</p>
              <a href="https://${hostMail}?token=${genCode}" style="background: crimson; text-decoration: none; color: white; padding: 10px 20px; margin: 10px 0; display: inline-block;">Verify Your Email</a>
           
            </div>
             `,
  };

  //sending mail
  transport.sendMail(mailOptions, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log("Verification mail sent to the student gmail account");
    }
  });
};

var transport = nodemailer.createTransport({
  host: "toponpage.com",
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: "admin@toponpage.com",
    pass: "Taweesak@5050",
  },
  tls: {
    rejectUnauthorized: false,
  },
});
