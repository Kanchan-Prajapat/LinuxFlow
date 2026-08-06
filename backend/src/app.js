const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const systemRoutes = require("./routes/systemRoutes");

app.use(cors());
app.use(express.json());
app.use("/api/system", systemRoutes);

const PORT = process.env.PORT || 5000;

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "LinuxFlow API is running",
        service: "LinuxFlow API",
        version: "0.1.0"
    });
});

app.listen(PORT, () => {
    console.log(`LinuxFlow API running on port ${PORT}`);
});