require('dotenv').config()
const express = require('express');
const mongoose = require('mongoose');
const leaderboardRoutes = require('../routes/leaderboard');
const userRoutes = require('../routes/user');
const schedule = require('node-schedule');
const newFeaturedLeaderboard = require('../controllers/serverController');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
    origin: "*",
    credentials: true
}))
app.use(express.json());
app.use((req, res, next) => {
    console.log(req.path, req.method);
    next();
});

app.use("/api/leaderboards" , leaderboardRoutes);
app.use("/api/user", userRoutes);
app.get("/", (req, res) => res.status(200).json({ message: process.env.PORT}));

const PORT = process.env.PORT;
const URI = process.env.MONGODB_URI;

mongoose.connect(URI)
    .then(() => {
        app.listen(PORT, () => console.log(`Connected to db & Listening on port: ${PORT}`));

        const job = schedule.scheduleJob('1 * * * *', function(){
            newFeaturedLeaderboard();
            console.log("update");
        });
    })
    .catch((err) => {
        console.log('Cannot connect to db: ' + err);
    });
