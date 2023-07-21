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
    limits: { fileSize: 2 * 1024 * 1024 },
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
  
//Skicka mail 
apiRoutes.post(process.env.API_PATH + "/reminder", async function (req, res) {

    const handlebarOptions = {
        viewEngine: {
            partialsDir: path.resolve('./templates/'),
            defaultLayout: false,
        },
        viewPath: path.resolve('./templates/'),
    };

    const transporter = nodemailer.createTransport({
        port: 25,
        host: process.env.SMTP_HOST,
        tls: {
            rejectUnauthorized: false
        }
        //requireTLS: true
        //secure: true
    });

    transporter.use('compile', hbs(handlebarOptions))

    let kthschool;
    let usertype;
    let action;
    let sessionchoices = []
    try {
        kthschool = await eventController.getkthschool(req.body.session_user_choice.school)
    } catch(err) {
        console.log(err)
    }

    try {
        usertype = await eventController.getusertype(req.body.session_user_choice.usertype)
    } catch(err) {
        console.log(err)
    }

    try {
        action = await eventController.getAction(req.body.session_user_choice.action_id)
    } catch(err) {
        console.log(err)
    }

    try {
        let useractionchoices = await eventController.readsessionuseractionchoices(req.body.session_user_choice.uuid)
        let message = 0;
        for(let i=0 ; i<useractionchoices.length ; i++) {
            let usermessage = await eventController.readsessionuseractionmessage(req.body.session_user_choice.uuid, useractionchoices[i].actionchoice_id)
            if (usermessage.length > 0) {
                message = usermessage[0].message
            }
            sessionchoices.push({"name": useractionchoices[i].name, "message": message})
        }
        
    } catch(err) {
        console.log(err)
    }
    
    

    const uuid = req.body.session_user_choice.uuid
    if (req.body.contactme) {
        let edgemailoptions = {}
        let template = 'edge_email_sv'
        if (req.body.lang.toUpperCase() == "EN") {
            template = 'edge_email_en'
        } else {

        }
        edgemailoptions = {
            from: {
                //name: req.body.name,
                address: process.env.MAILFROM_ADDRESS
            },
            to: process.env.EDGE_MAIL_ADDRESS,
            subject: "KTH Biblioteket matchmaking",
            template: 'edge_email_sv',
            context:{
                email: req.body.email,
                schoolname: kthschool[0].name,
                usertype: usertype[0].name,
                action: action[0].name,
                sessionchoices: sessionchoices,
                session_user_choice: req.body.session_user_choice
            },
            generateTextFromHTML: true
        };

        try {
            logger.debug(JSON.stringify(edgemailoptions))
            let contactmemailinfo = await transporter.sendMail(edgemailoptions);
        } catch (err) {
            //TODO
            logger.debug(JSON.stringify(err))
        }
        res.send("Success")
    }

});

// Initiera routes
app.use(process.env.APP_PATH, apiRoutes);

// Skapa server
const server = app.listen(process.env.PORT || 3002, function () {
    const port = server.address().port;
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

