const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// ------------------------------------------------------
// GOOGLE AUTH SETUP (Service Account)
// ------------------------------------------------------
const serviceAccount = {
  type: "service_account",
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
};

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const auth = new google.auth.JWT(
  serviceAccount.client_email,
  null,
  serviceAccount.private_key,
  SCOPES
);

const calendar = google.calendar({ version: "v3", auth });

// ------------------------------------------------------
// RULES
// ------------------------------------------------------
const WORK_START = 8; // 8 AM
const WORK_END = 18;  // 6 PM
const CLOSED_DAYS = [0, 1]; // Sunday (0), Monday (1)

// VEHICLE SIZES (index 0–4)
const DURATIONS = {
  rejuvenation: [4.5, 5, 5.5, 6, 6],
  rejuvenationInterior: [3, 3, 4, 4.5, 5],
  rejuvenationExterior: [2, 2, 2.25, 2.5, 3],
  spa: [8, 8.75, 9.5, 12, 14],
  spaInterior: [4, 4, 5, 6.5, 7.5],
  spaExterior: [3, 3, 3.5, 3.75, 4.25],
  correction1: [7, 7.5, 8.5, 10.5, 10.5],
  correction2: [9, 10, 11, 12.5, 15],
  ceramic: 24 // 3 business days (8 hr days)
};

// ------------------------------------------------------
// CHECK AVAILABILITY AGAINST GOOGLE CALENDAR
// ------------------------------------------------------
async function isAvailable(start, end) {
  const events = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return events.data.items.length === 0;
}

// ------------------------------------------------------
// CREATE EVENT
// ------------------------------------------------------
async function createEvent(booking) {
  return calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary: `${booking.serviceName} • ${booking.make} ${booking.model} (${booking.size})`,
      description: `
Customer: ${booking.name}
Phone: ${booking.phone}
Email: ${booking.email}
Address: ${booking.address}
Type: ${booking.dropoff ? "Drop-Off" : "Mobile"}
      `,
      start: { dateTime: booking.start },
      end: { dateTime: booking.end },
    },
  });
}

// ------------------------------------------------------
// EMAILS → Customer + You
// ------------------------------------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

// ------------------------------------------------------
// API ROUTES
// ------------------------------------------------------

// GET AVAILABLE TIMES
app.post("/api/availability", async (req, res) => {
  try {
    const { date, hours } = req.body;

    const day = new Date(date);
    const dow = day.getDay();

    if (CLOSED_DAYS.includes(dow))
      return res.json({ times: [] });

    const available = [];

    for (let hour = WORK_START; hour <= WORK_END - hours; hour++) {
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);

      const end = new Date(start);
      end.setHours(start.getHours() + hours);

      const free = await isAvailable(start, end);

      if (free) available.push({ start, end });
    }

    res.json({ times: available });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BOOKING
app.post("/api/book", async (req, res) => {
  try {
    const booking = req.body;

    // Create event on calendar
    await createEvent(booking);

    // Send confirmation to customer
    transporter.sendMail({
      to: booking.email,
      from: process.env.EMAIL_USER,
      subject: "Holy City Auto Spa — Booking Confirmed",
      html: `
      <h2>You're Booked!</h2>
      <p>Thanks ${booking.name}, your appointment is confirmed.</p>
      <p><strong>${booking.serviceName}</strong></p>
      <p>${booking.make} ${booking.model} (${booking.size})</p>
      <p>${booking.start} → ${booking.end}</p>
      <p>Address: ${booking.address}</p>
      `,
    });

    // Send notification to you
    transporter.sendMail({
      to: process.env.EMAIL_USER,
      from: process.env.EMAIL_USER,
      subject: "New Booking — Holy City Auto Spa",
      html: `
      <h2>New Booking Received</h2>
      <p>${booking.name} booked ${booking.serviceName}</p>
      <p>${booking.make} ${booking.model} (${booking.size})</p>
      <p>${booking.start}</p>
      <p>${booking.address}</p>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
});

// ROOT — Status
app.get("/", (req, res) => {
  res.send("Holy City Auto Spa Booking API is Running");
});

// ------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
