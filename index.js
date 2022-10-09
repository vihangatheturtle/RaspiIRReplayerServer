const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const fs = require("fs");
const fetch = require("node-fetch");

const port = 3000;
const hostName = "pi.wifi";
const bypassHostCheck = true;
const app = express();

const tokens = {};

var device = null;

var users = {
    "0": {
        username: "Vinga",
        level: "admin",
        authHash: "2f90863de9bce92fe031f503fb49a19b2c9a5bf9da2b5176bf15333560b5103d03198a35494f9899ecff1dd788a4ca5e32b282396ba4fca3bb32e686e0dc7707"
    }
}

async function replayIR(data) {
    console.log("Sending IR signal...")
    var req = await fetch("http://localhost:8000/replay-ir", {
        method: "POST",
        body: data
    })
    var res = await req.json()
    if (!Object.keys(res).includes("error")) {
        return true
    }
    return false
}

async function learnIR() {
    console.log("Learning IR signals...")
    var req = await fetch("http://localhost:8000/learn-ir")
    var res = await req.json()
    if (!Object.keys(res).includes("error")) {
        return res.data
    }
    return undefined
}

async function discoverDevices() {
    console.log("Discovering Broadlink devices...")
    while (true) {
        try {
            var req = await fetch("http://localhost:8000/discover")
            var res = await req.json()
            if (!Object.keys(res).includes("error")) {
                device = res
                return device
            }
        } catch { }
    }
}

discoverDevices()
.then(async dev => {
    console.log("DEVICE", dev)
    const signal = await learnIR();
    console.log(signal)
    async function pp() {
        console.log(await replayIR(signal) ? "Replayed signal" : "Failed to replay signal")
        setTimeout(pp, 250);
    }
    pp()
})

function getUserFromToken(token) {
    for (let i = 0; i < Object.keys(users).length; i++) {
        if (Object.keys(users[Object.keys(users)[i]]).includes("token")) return users[Object.keys(users)[i]];
    }
    return undefined;
}

function getPage(filename) {
    try {
        return fs.readFileSync("pages/" + filename + ".html").toString();
    } catch (e) {
        console.error("Failed to load file:", filename, "error:", e);
        return "Failed to load page, please try again later";
    }
}

function SHA512(text) {
    const hasher = crypto.createHash("sha512");
    hasher.update(text)
    return hasher.digest("hex");
}

function generateNewToken() {
    const seed = Math.round(Math.random() * 99999999).toString() + Math.random().toString();
    return SHA512(seed);
}

app.use(bodyParser.json());
app.use((req, res, next) => {
    if (req.get("host") !== hostName && !bypassHostCheck) {
        return res.redirect(`http://${hostName}`);
    }
    next();
});

app.get("/", (req, res) => {
    res.send(getPage("index"));
});

app.get("/auth", (req, res) => {
    res.send(getPage("auth"));
});

app.post("/auth", (req, res) => {
    var success = false;
    
    const hash = SHA512("PIIR" + req.body.password + "Auth-details");
    var token = undefined;
    var userId = undefined;

    for(let i = 0; i < Object.keys(users).length; i++) {
        const user = users[Object.keys(users)[i]];
        if (user.username === req.body.username && user.authHash === hash) {
            console.log("Successfully verified user", user.username);
            success = true;
            userId = Object.keys(users)[i];
            break
        }
    }

    if (success) token = generateNewToken()

    if (token !== undefined) {
        users[userId].token = token
    }

    res.status(success ? 200 : 400).json({
        error: !success,
        message: !success ? "Invalid username or password" : undefined,
        userId: userId,
        token: success ? token : undefined,
        account: !success ? undefined : {
            username: users[userId].username,
            level: users[userId].level
        }
    });
});

app.get("/me", (req, res) => {

    const cookiesList = req.get("cookie").split("; ");
    var cookies = {};

    for (let i = 0; i < cookiesList.length; i++) {
        const c = cookiesList[i];

        if (c === "") continue
        if (!c.includes("=")) continue

        const objects = c.split("=");

        if (objects.length < 2) continue

        cookies[objects[0]] = objects[1];
    }

    if (Object.keys(cookies).includes("auth") && cookies.auth.length === 128 && getUserFromToken(cookies.auth) !== undefined) {
        var tdata = JSON.parse(JSON.stringify(getUserFromToken(cookies.auth)));
        tdata.authHash = undefined;
        tdata.token = undefined;
        return res.status(200).json({
            error: false,
            account: tdata
        });
    }

    res.status(401).json({
        error: true,
        message: "You are not authorised to use this endpoint"
    })
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
})