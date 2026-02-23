import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("feedback.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    subject TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
  );
`);

// Seed admin user if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE email = ?").get("admin@school.edu");
if (!adminExists) {
  db.prepare("INSERT INTO users (email, password, role) VALUES (?, ?, ?)").run(
    "admin@school.edu",
    "admin123",
    "admin"
  );
}

// Seed a student user
const studentExists = db.prepare("SELECT * FROM users WHERE email = ?").get("student@school.edu");
if (!studentExists) {
  db.prepare("INSERT INTO users (email, password, role) VALUES (?, ?, ?)").run(
    "student@school.edu",
    "student123",
    "student"
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password);
    
    if (user) {
      res.json({ 
        success: true, 
        user: { email: user.email, role: user.role } 
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  app.post("/api/feedback", (req, res) => {
    const { name, department, subject, rating, comments } = req.body;
    try {
      db.prepare(
        "INSERT INTO feedback (name, department, subject, rating, comments) VALUES (?, ?, ?, ?, ?)"
      ).run(name, department, subject, rating, comments);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to submit feedback" });
    }
  });

  app.get("/api/feedback", (req, res) => {
    const feedback = db.prepare("SELECT * FROM feedback ORDER BY created_at DESC").all();
    res.json(feedback);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
