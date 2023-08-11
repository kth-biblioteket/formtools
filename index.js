'use strict';

//require('dotenv').config()
require('dotenv').config({path:'formtools.env'})
const bunyan = require('bunyan');
const jwt = require("jsonwebtoken");
const VerifyToken = require('./VerifyToken');
const VerifyAdmin = require('./VerifyAdmin');
const express = require("express");
const bodyParser = require("body-parser");
const cors = require('cors')
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars')
const fs = require("fs");
const path = require('path');
const formController = require('./formControllers');
const fileUpload = require('express-fileupload');
const { randomUUID } = require('crypto');
const cookieParser = require("cookie-parser");
const axios = require('axios');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(fileUpload({
    limits: { fileSize: parseInt(process.env.FILE_SIZE_LIMIT_MB) * 1024 * 1024 },
    abortOnLimit: true
}));

app.use(cookieParser());

const socketIo = require("socket.io");

app.set("view engine", "ejs");

const whitelist = ['http://localhost', 'https://apps.lib.kth.se', 'https://apps-ref.lib.kth.se', 'https://www.kth.se']
  
app.use(cors({origin: whitelist}));

app.use(process.env.APP_PATH, express.static(path.join(__dirname, "public")));

const apiRoutes = express.Router();

const logger = bunyan.createLogger({
    name: "formtools",
    streams: [{
        type: 'rotating-file',
        path: 'formtools.log',
        period: '1d',
        count: 3,
        level: process.env.LOG_LEVEL || 'info',
    }]
});

/////////////
//
// Applikation
//
/////////////

//Main
apiRoutes.get("/admin", VerifyToken, formController.generateApp)


/////////////
// 
// API
// 
/////////////

apiRoutes.post(process.env.API_PATH + "/login", formController.login)

apiRoutes.post(process.env.API_PATH + "/logout", formController.logout)

// Hämta KTH-skolor
apiRoutes.get(process.env.API_PATH + "/kthschoolsapi",formController.getkthschools)

/*
//Hämta alla formulär
apiRoutes.get(process.env.API_PATH + "/forms",formController.readAllEvents)

//Hämta ett formulär
apiRoutes.get(process.env.API_PATH + "/forms/:id",formController.readEvent)
*/

// Skapa en request
apiRoutes.post(process.env.API_PATH + "/requestmaterial", formController.requestMaterial)

// Skapa ett bibliotekskonto
apiRoutes.post(process.env.API_PATH + "/libraryaccount", formController.createLibraryaccount)

// Skicka kontaktinfo till edge
apiRoutes.post(process.env.API_PATH + "/contact", formController.sendContactMail)

// Skicka teachingactivity till edge
apiRoutes.post(process.env.API_PATH + "/teachingactivity", formController.sendTeachingactivityMail)

// Skicka literature search till edge
apiRoutes.post(process.env.API_PATH + "/literaturesearch", formController.sendLiteraturesearchMail)

// Root
apiRoutes.get(process.env.API_PATH + "/", async function (req, res) {
    res.json("Welcome to KTH Library forms API")
});

// Skapa/Ladda upp bilder till bildbank
apiRoutes.post(process.env.API_PATH + "/uploadfile", async function (req, res) {
    try {
        let targetFile = req.files.imgFile;
        let imagename = req.body.imagename

        var allowedMimes = ['image/jpeg', 'image/png'];
        if (allowedMimes.includes(targetFile.mimetype)) {
        } else {
            return res.status(400).send('File type not allowed');
        }

        let imagePath = path.join(__dirname, 'imagebank/' + randomUUID() + path.extname(targetFile.name))
        targetFile.mv(imagePath, async (err) => {
            if (err)
                return res.status(500).send(err);
            let create = await eventController.createImage(imagePath, imagename, targetFile.size, targetFile.mimetype)
            return res.send({ status: "Success", path: imagePath });
        });
    } catch(err) {
        res.send(err.message)
    }
});

// Initiera routes
app.use(process.env.APP_PATH, apiRoutes);

// Skapa server
const server = app.listen(process.env.PORT || 3002, function () {
    const port = server.address().port;
    console.log(new Date().toLocaleString());
    console.log("App now running on port", port);
});

// Initiera socketserver
const io = socketIo(server, {path: process.env.APP_PATH + "/socket.io"})

const sockets = {}

io.on("connection", (socket) => {
    socket.on("connectInit", (sessionId) => {
        sockets[sessionId] = socket.id
        app.set("sockets", sockets)
    })
})

app.set("io", io)

