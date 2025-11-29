// -----------------------------------------------
// IMPORTS & SETUP
// -----------------------------------------------
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

require("dotenv").config();

const app = express();
app.use(express.json());

// -----------------------------------------------
// CORS — ALLOW GODADDY WEBSITE
// -----------------------------------------------
const allowedOrigins = [
  "https://holycityautospa.com",
  "https://www.holycityautospa.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ BLOCKED CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
  })
);

// -----------------------------------------------
// GOOGLE SERVICE ACCOUNT AUTH
// -----------------------------------------------
const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/calendar"]
);

const calendar = google.calendar({ version: "v3", auth });

// -----------------------------------------------
// CREATE CALENDAR EVENT
// -----------------------------------------------
async function createCalendarEvent(booking) {
  return calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary: `${booking.service} – ${booking.make} ${booking.model}`,
      description: `
Customer: ${booking.name}
Phone: ${booking.phone}
Email: ${booking.email}
Address: ${booking.address}
Vehicle: ${booking.year} ${booking.make} ${booking.model}
Service: ${booking.service}
      `,
      start: { dateTime: booking.start },
      end: { dateTime: booking.end }
    }
  });
}

// -----------------------------------------------
// EMAIL SETUP
// -----------------------------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// -----------------------------------------------
// API — CREATE BOOKING
// -----------------------------------------------
app.post("/book", async (req, res) => {
  try {
    const booking = req.body;

    // Convert date + time into ISO format
    const start = new Date(`${booking.date}T${booking.time}:00`);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // Default: 2 hrs

    booking.start = start.toISOString();
    booking.end = end.toISOString();

    // CREATE CALENDAR EVENT
    await createCalendarEvent(booking);

    // SEND CUSTOMER EMAIL
    await transporter.sendMail({
      to: booking.email,
      from: process.env.EMAIL_USER,
      subject: "Holy City Auto Spa – Booking Received",
      html: `
      <h2>Your Booking Has Been Received</h2>
      <p>Thanks ${booking.name}! We will confirm the details shortly.</p>
      <p><strong>Service:</strong> ${booking.service}</p>
      <p><strong>Vehicle:</strong> ${booking.year} ${booking.make} ${booking.model}</p>
      <p><strong>Date:</strong> ${booking.date} @ ${booking.time}</p>
      `
    });

    // SEND YOUR EMAIL
    await transporter.sendMail({
      to: process.env.EMAIL_USER,
      from: process.env.EMAIL_USER,
      subject: "New Booking — Holy City Auto Spa",
      html: `
      <h2>New Booking Submitted</h2>
      <p><strong>Name:</strong> ${booking.name}</p>
      <p><strong>Service:</strong> ${booking.service}</p>
      <p><strong>Vehicle:</strong> ${booking.year} ${booking.make} ${booking.model}</p>
      <p><strong>Date:</strong> ${booking.date} @ ${booking.time}</p>
      <p><strong>Phone:</strong> ${booking.phone}</p>
      <p><strong>Address:</strong> ${booking.address}</p>
      `
    });

    res.json({ success: true });
  } catch (err) {
    console.error("🚨 Booking Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------
app.get("/", (req, res) => {
  res.send("Holy City Auto Spa Booking API is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
