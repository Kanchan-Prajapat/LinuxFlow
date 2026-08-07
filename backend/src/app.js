const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const systemRoutes = require("./routes/systemRoutes");
const processRoutes = require("./routes/processRoutes");
const serviceRoutes =require("./routes/serviceRoutes");
const userRoutes = require("./routes/userRoutes");
const groupRoutes = require("./routes/groupRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const aclRoutes =require("./routes/aclRoutes");
const backupRoutes = require("./routes/backupRoutes");
const firewallRoutes = require("./routes/firewallRoutes");
const lvmRoutes = require("./routes/lvmRoutes");
const swapRoutes = require("./routes/swapRoutes");
const sshRoutes = require("./routes/sshRoutes");
const cronRoutes = require("./routes/cronRoutes");
const monitoringRoutes =require("./routes/monitoringRoutes");


app.use(cors());
app.use(express.json());
app.use("/api/system", systemRoutes);
app.use("/api/processes", processRoutes);
app.use( "/api/services", serviceRoutes);
app.use("/api/users",userRoutes);
app.use( "/api/groups", groupRoutes);
app.use( "/api/permissions", permissionRoutes);
app.use( "/api/acl", aclRoutes);
app.use( "/api/backups", backupRoutes);
app.use("/api/firewall",firewallRoutes );
app.use( "/api/lvm", lvmRoutes);
app.use( "/api/swap", swapRoutes);
app.use( "/api/ssh", sshRoutes);
app.use( "/api/cron", cronRoutes);
app.use(  "/api/monitoring", monitoringRoutes);


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