const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");

const port = 3000;
const hostName = "pi.wifi";
const bypassHostCheck = true;
const app = express();

const users = {
    "0": {
        username: "Vinga",
        passwordHash: ""
    }
}

function getPage(filename) {
    try {
        return fs.readFileSync("pages/" + filename + ".html").toString();
    } catch (e) {
        console.error("Failed to load file:", filename, "error:", e);
        return "Failed to load page, please try again later";
    }
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

    for(let i = 0; i < Object.keys(users).length; i++) {
        const user = users[Object.keys(users)[i]];
        console.log(req.body)
        if (user.username === req.body.username) {
            success = true;
        }
    }

    res.status(success ? 200 : 400).json({
        error: !success,
        token: success ? "token" : undefined,
    })
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
})