const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const classRoutes = require("./routes/classRoutes");
const authRoutes = require("./routes/authRoutes");
const admissionRoutes = require("./routes/admissionRoutes");
const errorHandler = require("./middleware/errorHandler");
const attendanceRoutes = require("./routes/attendanceRoutes");
const homeworkRoutes = require("./routes/homeworkRoutes");
const noticeRoutes = require("./routes/noticeRoutes");
const examRoutes = require("./routes/examRoutes");
const resultRoutes = require("./routes/resultRoutes");
const peopleRoutes = require("./routes/peopleRoutes");
const panelRoutes = require("./routes/panelRoutes");
const timetableRoutes = require("./routes/timetableRoutes");
const feesRoutes = require("./routes/feesRoutes");

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/version", (req, res) => res.json({ build: "debug-1" }));
app.use("/api/auth", authRoutes);
app.use("/api/admissions", admissionRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/homework", homeworkRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/people", peopleRoutes);
app.use("/api/panel", panelRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/fees", feesRoutes);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use(errorHandler);

module.exports = app;
