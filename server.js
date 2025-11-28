const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const calDav = require("node-caldav");
const nodemailer = require("nodemailer");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const CALDAV_URL = "https://caldav.icloud.com/";

app.post("/api/book", async (req, res) => {
  const { service, size, name, phone, email, date, time } = req.body;

  try {
    const startDate = new Date(`${date}T${time}:00`);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    await calDav.createEvent({
      url: CALDAV_URL,
      username: process.env.APPLE_ID,
      password: process.env.APPLE_APP_PASSWORD,
      event: {
        start: startDate,
        end: endDate,
        summary: `${service} – ${name}`,
        description: `Vehicle: ${size}\nPhone: ${phone}\nEmail: ${email}`,
      },
    });

    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      to: email,
      subject: "Holy City Auto Spa – Appointment Confirmed",
      text: `Thanks for booking, ${name}!\n\nService: ${service}\nVehicle: ${size}\nDate: ${date} at ${time}\n\nWe’ll see you soon!`,
    });

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Holy City Auto Spa Booking API is Running");
});

app.listen(3000, () => console.log("Server running on port 3000"));
