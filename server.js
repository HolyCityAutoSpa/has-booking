const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const calDav = require("node-caldav");
const nodemailer = require("nodemailer");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Apple CalDAV server
const CALDAV_URL = "https://caldav.icloud.com/";

app.post("/api/book", async (req, res) => {
  const { service, size, name, phone, email, date, time } = req.body;

  try {
    // Build start and end time
    const startDate = new Date(`${date}T${time}:00`);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours default

    // Add event to Apple Calendar using CalDAV
    await calDav.createEvent({
      url: CALDAV_URL,
      username: process.env.APPLE_ID,
      password: process.env.APPLE_APP_PASSWORD,
      event: {
        start: startDate,
        end: endDate,
        summary: `${service} – ${name}`,
        description: `Vehicle: ${size}\nPhone: ${phone}\nEmail: ${email}\nService: ${service}`,
      },
    });

    // Email transporter using Gmail App Password
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,       // your gmail user
        pass: process.env.EMAIL_PASS        // gmail app password
      },
    });

    // Send confirmation email to client
    await transporter.sendMail({
      from: `"Holy City Auto Spa" <Timot
