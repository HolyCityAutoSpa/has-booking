const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const { createAccount, calendarQuery, calendarObject } = require("dav");
const https = require("https");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const CALDAV_URL = "https://caldav.icloud.com/";

app.post("/api/book", async (req, res) => {
  const { service, size, name, phone, email, date, time } = req.body;

  try {
    const start = new Date(`${date}T${time}:00`);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours

    // Authenticate to Apple CalDAV
    const account = await createAccount({
      server: CALDAV_URL,
      credentials: {
        username: process.env.APPLE_ID,
        password: process.env.APPLE_APP_PASSWORD,
      },
      loadCollections: true,
      loadObjects: false,
    });

    // Find the default calendar
    const calendar = account.calendars.find((c) => c.components.includes("VEVENT"));
    if (!calendar) throw new Error("No calendar found");

    // Build ICS event
    const ics = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Holy City Auto Spa//Booking System//EN
BEGIN:VEVENT
UID:${Date.now()}@holycityautospa
DTSTAMP:${start.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"}
DTSTART:${start.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"}
DTEND:${end.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"}
SUMMARY:${service} – ${name}
DESCRIPTION:Vehicle: ${size}\\nPhone: ${phone}\\nEmail: ${email}
END:VEVENT
END:VCALENDAR`;

    // Upload event to Apple Calendar
    await calendarObject.create({
      url: calendar.url + `${Date.now()}.ics`,
      data: ics,
      headers: { "Content-Type": "text/calendar" },
    });

    // Email confirmation
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Holy City Auto Spa" <Timothy@holycityautospa.com>`,
      to: email,
      subject: "Holy City Auto Spa – Appointment Confirmed",
      text: `Thanks for booking, ${name}!\n
Service: ${service}
Vehicle: ${size}
Date: ${date} at ${time}

We’ll see you soon!`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Holy City Auto Spa Booking API is Running");
});

app.listen(3000, () => console.log("Server running on port 3000"));
