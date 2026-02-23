import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "./src/lib/prisma";
import Stripe from "stripe";
import { google } from "googleapis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "mock_key");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- AUTH ROUTES ---
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, name },
      });
      const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || "secret");
      res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (e) {
      res.status(400).json({ error: "User already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || "secret");
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  });

  // --- BOOKING ROUTES ---
  app.get("/api/services", async (req, res) => {
    const services = await prisma.service.findMany({ where: { active: true } });
    res.json(services);
  });

  app.get("/api/availability", async (req, res) => {
    const { date, serviceId } = req.query;
    if (!date || !serviceId) return res.status(400).json({ error: "Missing params" });

    const service = await prisma.service.findUnique({ where: { id: serviceId as string } });
    if (!service) return res.status(404).json({ error: "Service not found" });

    const selectedDate = new Date(date as string);
    const dayOfWeek = selectedDate.getDay();

    const workingHours = await prisma.availability.findMany({
      where: { dayOfWeek, active: true }
    });

    const bookings = await prisma.booking.findMany({
      where: {
        startTime: {
          gte: new Date(selectedDate.setHours(0, 0, 0, 0)),
          lt: new Date(selectedDate.setHours(23, 59, 59, 999)),
        },
        status: { in: ["CONFIRMED", "PENDING"] }
      }
    });

    // We'll import the logic in the client or just implement a basic version here
    // For now, return the raw data for the client to process or call a helper
    res.json({ workingHours, bookings, duration: service.duration });
  });

  app.post("/api/bookings/checkout", async (req, res) => {
    const { serviceId, startTime, userId } = req.body;
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return res.status(404).json({ error: "Service not found" });

    const endTime = new Date(new Date(startTime).getTime() + service.duration * 60000);

    // Check for double booking
    const conflict = await prisma.booking.findFirst({
      where: {
        startTime: { lt: endTime },
        endTime: { gt: new Date(startTime) },
        status: { in: ["CONFIRMED", "PENDING"] }
      }
    });

    if (conflict) return res.status(400).json({ error: "Slot already taken" });

    const booking = await prisma.booking.create({
      data: {
        startTime: new Date(startTime),
        endTime,
        userId,
        serviceId,
        status: "PENDING"
      }
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: service.name },
          unit_amount: Math.round(service.price * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${process.env.APP_URL}/booking/success?id=${booking.id}`,
      cancel_url: `${process.env.APP_URL}/booking/cancel?id=${booking.id}`,
      metadata: { bookingId: booking.id }
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeSessionId: session.id }
    });

    res.json({ url: session.url });
  });

  // --- STRIPE WEBHOOK ---
  app.post("/api/webhooks/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId;
      if (bookingId) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: "CONFIRMED", paymentStatus: "PAID" }
        });
        // Trigger Google Calendar Sync & Email here
      }
    }

    res.json({ received: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
