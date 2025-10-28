const mail = require('./mail');
const alma = require('./alma');
const axios = require('axios')
const fs = require('fs')

const { body, query, validationResult } = require('express-validator');

// Funktion som genererar ett 
// admingränssnitt
async function generateApp(req, res, next) {
    try {
        res.render('pages/admin');
    } catch(err) {
        res.send("error: " + err.message)
    }
    
}

async function generateKthbForm(req, res, next) {
    try {
        // Hämta formulärets konfig från json-fil
        const formconfigresponse = fs.readFileSync(process.env.FORMSCONFIG_URL + req.query.formid + '.json', { encoding: 'utf8' });
        const formconfig = JSON.parse(formconfigresponse)
        let lang = req.query.lang || 'sv'
        let formtoolsconfig = {
            lang: lang,
            kiosk: req.query.kiosk || false,
            formid: req.query.formid || '',
            formconfig: formconfig,
            formserver: `${process.env.SERVERPROTOCOL}://${req.hostname}`,
            environment: req.query.environment || 'production',
            edgemailaddress: req.query.edgemailaddress || '',
            nojquery: req.query.nojquery || false,
        }
        res.render('pages/kthbform', 
        {
            formtoolsconfig: formtoolsconfig
        })

    } catch(err) {
        res.send("error: " + err.message)
    }
    
}

//Logga in via KTH LDAP
async function login(req, res) {
    try {
        const response = await axios.post(process.env.LDAPAPIPATH + '/login', req.body)
        res
        .cookie("jwt", response.data.token, {
            maxAge: 60 * 60 * 24 * 7 * 1000,
            sameSite: 'lax',
            httpOnly: true,
            secure: process.env.NODE_ENV !== "development",
        })
        .status(200)
        .json({ message: "Success" });
    } catch(err) {
        console.log(err)
        res.status(401)
        res.json({ message: "Error" });
    }
}

//Logga ut
async function logout(req, res) {
    res
    .clearCookie("jwt")
    .status(200)
    .json({ message: "Success" });
}

//Hämta alla KTH-skolor via KOPPS API
async function getkthschools(req, res) {
    try {
        const response = await axios.get('https://www.kth.se/api/kopps/v2/schools')
        res
        .status(200)
        .send(response.data);
    } catch(err) {
        console.log(err)
        res.status(400).send(err);
    }
}

/**
 * Funktion för att skapa en request i Alma eller RT/EDGE
 * 
 * Libris ska alltid generera en request i Alma oavsett genre(varför?) 
 * 
 * De enda som skickas till EDGE är "journal"(tidskrift eller databas)
 * 
 * Låntagarinfo hämtas från Alma
 * 
 * Formulärkonfig från JSON
 *      Mailadresser och texter
 *      Genrenamn
 * 
 * Vilka typer ska bli book respektive article i Alma.
 * Sätt också formatet för att kunna använda facetterna i Alma för att sortera ut rätt beställningar. 
 * 
 * Returnerar Success eller Error 
 */
async function requestMaterial(req, res) {
    try {
        if (!req.is('json')) {
            res
            .status(201)
            .send(
            {
                "status" : "Error",
                "message": "Please provide JSON"
            });
            return
        }

        //Validera obligatoriska fält
        await Promise.all(validateRequest.map((validator) => validator.run(req)));
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        // Hämta användaren från Alma (catch error om användaren inte existerar)
        const almauser = await axios.get(process.env.ALMA_API_URL + 'users/' + req.body.form.username + '?apikey=' + process.env.ALMA_API_KEY);
        const almauserobject = almauser.data
        let kthuser = false;
        // Kontrollera om beställaren är KTH-Ansluten(student, personal och other(member etc)). Alma User groups: 10, 20 och 40
        if (req.body.form.iam == 'student' || req.body.form.iam == 'employee') {
            const allowedUserGroups = process.env.ALLOWED_USER_GROUPS ? process.env.ALLOWED_USER_GROUPS.split(", ") : [];
            if (allowedUserGroups.length > 0) {
                if (allowedUserGroups.includes(almauserobject.user_group.value)) {
                    kthuser = true;
                }
            }
            if (!kthuser) {
                if (req.query.language == 'swedish') {
                    return res.status(400).send({'message': 'Användarnamnet "' + req.body.form.username + '" är inte registrerat som student eller personal på KTH.'});
                } else {
                    return res.status(400).send({'message': 'Username "' + req.body.form.username + '" is not registered as a student or staff at KTH '});
                }
            }
        }

        let almafullname = almauserobject.full_name;
        let almapreferredemail ='';
        almauserobject.contact_info.email.forEach(email => {
            if (email.preferred) {
                almapreferredemail = email.email_address;
            }
        });
        
        // Hämta hämtbibliotek från Alma (catch error om bibliotek inte existerar)
        let almalibraryname = "undefined";
        if(req.body.form.pickup) {
            const library = await axios.get(process.env.ALMA_API_URL + 'conf/libraries/' + req.body.form.pickup + '?apikey=' + process.env.ALMA_API_KEY);
            const almalibraryobject = library.data;
            if (almalibraryobject.status) {
                if (almalibraryobject.status == 'Error') {
                    return res.status(400).send(almalibraryobject);
                }
            }
            almalibraryname = almalibraryobject.description;
        }
        // Hämta formulärets konfig från json-fil
        const formconfigresponse = fs.readFileSync(process.env.FORMSCONFIG_URL + 'requestmaterial.json', { encoding: 'utf8' });
        const formconfig = JSON.parse(formconfigresponse)
        let emailtoaddressedge = req.query.emailtoaddressedge || process.env.EDGE_MAIL_ADDRESS;
        let emailfromaddresslibrary = formconfig.emailfromaddresslibrary.emailaddress;
        let emailfromnamelibrary = formconfig.emailfromaddresslibrary.name[req.body.language];
        let emailtobodyedge = "";
        let emailtobodyuser = "";
        let emailtosubjectedge = "";
        let emailtosubjectuser = "";
        emailtosubjectedge = formconfig.emailtosubjectedge[req.query.language]
        emailtosubjectuser = formconfig.emailtosubjectuser[req.query.language]
        formconfig.emailtobodyedge[req.query.language].forEach(row => {
            emailtobodyedge += row;
        })
        formconfig.emailtobodyuser[req.query.language].forEach(row => {
            emailtobodyuser += row;
        })
        let genre = formconfig.genrenames[req.body.form.genre][req.query.language];

        //hantera kostnader som behöver accepteras/avböjas (TODO ändra till generell costs?)
        //Vad som ska stå i mailsvaret
        let cost='undefined';
        let willingtocopyright='undefined';
        for (const key in req.body.form) {
            if(req.body.form[key] == 'acceptcost' || req.body.form[key] == 'contact' || req.body.form[key] == 'decline') {
                formconfig.formfields[key].options.forEach((option) => {
                    if (option.value == req.body.form[key]) {
                        cost = option.label[req.query.language];
                    }
                })
            }

            if(req.body.form[key] == 'yes') {
                willingtocopyright = formconfig.formfields[key].label[req.query.language]    
            }
        }

        //hantera materialtyper
        //Vad requestobjektet ska innehålla
        let citation_type = ''
        let format	= '';
        if (req.body.form.genre == 'bookitem' 
            || req.body.form.genre == 'book' 
            || req.body.form.genre == 'unknown' 
            || req.body.form.genre == '' 
            || req.body.form.genre == 'BK') {

            citation_type = 'BK' ;
            if(req.body.form.genre == 'bookitem') {
                format	= "PHYSICAL_NON_RETURNABLE";
            } else {
                format	= "PHYSICAL";
            }
        } else if (  req.body.form.genre == 'journal' 
                    || req.body.form.genre == 'article' 
                    || req.body.form.genre == 'CR' 
                    || req.body.form.genre == 'proceeding') {

            citation_type = 'CR' ;
            format	= "PHYSICAL_NON_RETURNABLE";
        } else {
            citation_type = 'BK' ;
            format	= "PHYSICAL";
        }

        // Skapa mailinnehåll till edge och beställaren
        let request = req.body
        emailtobodyedge = await mail.createmailbody(formconfig, emailtobodyedge, genre, cost, willingtocopyright, almafullname, almapreferredemail, almalibraryname, request, req.query.language);
        emailtobodyuser = await mail.createmailbody(formconfig, emailtobodyuser, genre, cost, willingtocopyright, almafullname, almapreferredemail, almalibraryname, request, req.query.language);
        // Skicka beställing och/eller mail beroende på källa och materialtyp
        let create_request = false
        let send_edge_mail = false
        let send_user_mail = false
        switch(req.body.form.source) {
            // Beställning från libris(openurl)
            case 'info:sid/libris.kb.se:libris':
                create_request = true
                send_edge_mail = false
                send_user_mail = true
                break;
            case 'LeanLibrary':
            // Beställning från Primo(openurl)    
            case 'primo':
                if (request.form.genre == 'journal' || request.form.genre == 'database') {
                    create_request = false
                    send_edge_mail = true
                    send_user_mail = false
                } 
                else {
                    //Företag får inte utnyttja RapidILL, skickas till Edge istället
                    if (req.body.form.iam == 'business') {
                        create_request = false
                        send_edge_mail = true
                        send_user_mail = false
                    } else {
                        create_request = true
                        send_edge_mail = false
                        send_user_mail = true
                    }
                }
                break;
            // Beställning från Formulär(polopoly)
            case 'kthbforms':
                if (request.form.genre == 'journal' || request.form.genre == 'database') {
                    create_request = false
                    send_edge_mail = true
                    send_user_mail = false
                } else {
                    //Företag får inte utnyttja RapidILL, skickas till Edge istället
                    if (req.body.form.iam == 'business') {
                        create_request = false
                        send_edge_mail = true
                        send_user_mail = false
                    } else {
                        create_request = true
                        send_edge_mail = false
                        send_user_mail = true
                    }
                }
                break;
            default:
                break;
        }
        if (create_request) {
            let almarequest =  await createUserResourceSharingRequests(formconfig, req.query.language, request, request, citation_type, format, request.form.username, 'true');
            if (almarequest != 'Success') {
                if(JSON.stringify(almarequest).indexOf('Patron has duplicate') > -1) {
                    if (req.query.language == 'swedish') {
                        return res.status(400).send({'message': 'Du har redan gjort en beställning av detta material.'});
                    } else {
                        return res.status(400).send({'message': 'You already have an active request for this material.'});
                    } 
                } else {
                    return res.status(400).send({'message': JSON.stringify(almarequest)});
                }
            }
        }
        if (send_edge_mail) {
            mailresponse = await mail.sendmail(emailtoaddressedge, almapreferredemail, almafullname, emailtosubjectedge, emailtobodyedge);
            if (mailresponse != 'Success'){
                responseobject = {
                    "status"  : "Error",
                    "message" : JSON.stringify(mailresponse)
                };
                return res.status(400).send(responseobject);
            }
        }
        if (send_user_mail) {
            mailresponse = await mail.sendmail(almapreferredemail, emailfromaddresslibrary, emailfromnamelibrary, emailtosubjectuser, emailtobodyuser);
            if (mailresponse != 'Success'){
                responseobject = {
                    "status"  : "Error",
                    "message" : JSON.stringify(mailresponse)
                };
                return res.status(202).send(responseobject);
            }
        }
        
        responseobject = {
            "status" : "Success",
            "message" : "Request created"
        }
        return res.status(201).send(responseobject);
        //return response()->json($responseobject, 201,[],JSON_UNESCAPED_UNICODE);
    } catch (err) {
        console.log(err)
        if(typeof err.response.data == 'string') {
            if(err.response.data.indexOf('SERVICE_NOT_FOUND') > -1) {
                res.status(400).send('SERVICE_NOT_FOUND');
            }
        } else {
            if(JSON.stringify(err.response.data).indexOf('User with identifier') > -1) {
                if (req.query.language == 'swedish') {
                    res.status(400).send({'message': 'Användarnamnet "' + req.body.form.username + '" är inte registrerat som låntagare hos oss.'});
                } else {
                    res.status(400).send({'message': 'Username "' + req.body.form.username + '" is not registered as a patron at the library '});
                }
            }
            else {
                res.status(400).send(err.response.data)
            }
        }
    }
}

 /**
 * 
 * Function som skapar en request i Alma
 * 
 * Genererar ett JSON-object som skickas till Almas API
 * 
 * Titel på material enligt vissa kriterier
 * 
 * Bibnote enligt format: 
 * Volume(issue) year pp 23-47
 * 
 * Note enligt format
 * Message
 * Kategori: student etc
 * Skola: kthaffilation
 * 
 * Override = true gör att en user request skapas även om alma rapporterar att materialet redan finns
 * 
 * TODO byt till request i st f requestInput
 */
async function createUserResourceSharingRequests(formconfig, language, request, requestInput, citation_type, format, user_id, override) {
    let title = "";
    let journaltitle = "";
    let abbrjournaltitle ="";
    let requestInputkey='form';

    try {
        if (request.form.genre) {
            if(request.form.genre == 'article' &&  request.form.atitle) {
                title = request.form.atitle;
            }

            if((request.form.genre == 'book' || request.form.genre == 'bookitem') &&  request.form.btitle) {
                title = request.form.btitle;
            }

            if((request.form.genre == 'proceeding') 
            &&  request.form.ctitle) {
                title = request.form.ctitle;
            }

            if((request.form.genre == 'journal' 
            || request.form.genre == 'article' 
            || request.form.genre == 'proceeding') 
            &&  (request.form.jtitle)) {
                journaltitle = request.form.jtitle;
            }

            if((request.form.genre == 'journal' 
            || request.form.genre == 'article') 
            &&  (request.form.stitle)) {
                abbrjournaltitle = request.form.stitle;
            }
        }

        //hantera författarnamn
        let author = "";
        if(request.form.genre == 'book' 
        || request.form.genre == 'article' 
        || request.form.genre == 'bookitem' ) {
            if (!request.form.au) {
                author = request.form.aulast + ', ' + request.form.aufirst;
            } else {
                author = request.form.au;
            }
        }

        //Hantera publisher (kan vara både pub och publisher som openurl)

        let bib_note = (request.form.volume) ? request.form.volume : "";
        (request.form.issue) ? bib_note += "(" + request.form.issue + ")" : "";        
        (request.form.year) ? bib_note += " " + request.form.year : "";
        (request.form.pages) ? bib_note += " pp " + request.form.pages : "";

        //Hantera kostnader
        let willing_to_pay = false
        if (request.form.costs == 'acceptcost') {
            willing_to_pay = true;
        }

        // Hantera copyright
        // Alma verkar inte ta emot värde "false" för agree_to_copyright_terms så skicka alltid true
        // "errorMessage": "Invalid field value. Field: agree_to_copyright_terms, Value: false.",
        let willing_to_copyright = true;
        let willing_to_copyright_note = 'Nej';
        if (request.form.willingtocopyright == 'yes') {
            willing_to_copyright = true;
            willing_to_copyright_note = 'Ja';
        }

        //Hantera kategori
        let iam='';
        for (const option in formconfig.formfields.iam.options ) {
            if(formconfig.formfields.iam.options[option].value == request.form.iam) {
                iam =  formconfig.formfields.iam.options[option].label[language];
            }
        }

        //Hantera information som ska läggas i Note
        let note = (request.form.message) ? request.form.message : "";
        note += (iam) ? '\n' + 'Kategori: ' + iam : "";
        note += (request.form.kthaffiliation) ? '\n' + 'Skola: ' + request.form.kthaffiliation : "";
        note += (request.form.coursecode) ? '\n' +  'Kurskod KTH: ' + request.form.coursecode : "";
        
        //Hantera datum som har UTC-format
        let dateneededby = "";
        if(request.form.dateneededby) {
            dateneededby = request.form.dateneededby
        }
        
        let last_interest_date = '"last_interest_date": null,';
        if (dateneededby != "") {
            last_interest_date  = '"last_interest_date": "' +  dateneededby + '",';
        }

        let rsrobject = `{
            "format": {
                "value": "${format}",
                "desc": "${format}"
            },
            "title": "${escapeString(title)}",
            "journal_title": "${escapeString(journaltitle)}",
            "issn": "${request.form.issn ? request.form.issn : ""}",
            "isbn": "${request.form.isbn ? request.form.isbn : ""}",
            "author": "${author ? author : ""}",
            "year": "${request.form.year ? request.form.year : ""}",
            "oclc_number": null,
            "publisher": "${request.form.publisher ? request.form.publisher : ""}",
            "place_of_publication": "${request.form.place ? request.form.place : ""}",
            "edition": "${request.form.edition ? request.form.edition : ""}",
            "volume": "${request.form.volume ? request.form.volume : ""}",
            "issue": "${request.form.issue ? request.form.issue : ""}",
            "chapter_title": "${request.form.ctitle ? request.form.ctitle : ""}",
            "pages": "${request.form.pages ? request.form.pages : ""}",
            "part": null,
            "source": "${request.form.source ? request.form.source : ""}",
            "doi": "${request.form.doi ? request.form.doi : ""}",
            "pmid": null,
            "call_number": null,
            "note": "${escapeString(note)}",
            "bib_note": "${bib_note}",
            "request_id": null,
            "willing_to_pay": ${willing_to_pay ? "true" : "false"},
            "allow_other_formats": true,
            "preferred_send_method": {
                "value": "MAIL",
                "desc": "Mail"
            },
            "pickup_location": {
                "value": "${request.form.pickup ? request.form.pickup : ""}",
                "desc": "${request.form.pickup ? request.form.pickup : ""}"
            },
            ${last_interest_date}
            "use_alternative_address": false,			
            "citation_type": {
                "value": "${citation_type}",
                "desc": "${citation_type}"
            },
            "mms_id": null,
            "agree_to_copyright_terms": true
        }`;

        const almaresponse = await axios.post(
            process.env.ALMA_API_URL + 'users/' + user_id + `/resource_sharing_requests?override_blocks=${override}&apikey=` + process.env.ALMA_API_KEY
            , JSON.parse(rsrobject));
        return "Success";
    } catch(err) {
        return err.response.data
    }
    //return  "test"
}

/**
 * 
 * Funktion som skapar låntagare i Alma och skickar ett
 * bekräftelsemail till användaren
 * 
 * Formulärkonfig från JSON
 *      Mailadresser och texter
 * 
 * Byt ut variabler (@@XXXX) i mailtexten som hämtats från formulärkonfig
 * mot värden från request
 */
async function createLibraryaccount(req, res)
{
    if (!req.is('json')) {
        res
        .status(201)
        .send(
        {
            "status" : "Error",
            "message": "Please provide JSON"
        });
        return
    }

    language = req.query.language ? req.query.language : "english"
    
    //Validera obligatoriska fält
    let validateAccountRequest = [
        query('language').notEmpty().withMessage('Language is required'),
        body('form.firstname').notEmpty().withMessage('First name is required'),
        body('form.lastname').notEmpty().withMessage('Last name is required'),
        body('form.phone1').notEmpty().withMessage('Phone is required'),
        body('form.email').notEmpty().withMessage('Email is required'),
        body('form.password').notEmpty().withMessage('Password is required'),
        body('form.pin').notEmpty().withMessage('Pin is required'),
        body('form.streetadress').notEmpty().withMessage('Street adress is required'),
        body('form.zipcode').notEmpty().withMessage('Zip code is required'),
        body('form.city').notEmpty().withMessage('City is required'),
        body('form.accept').notEmpty().withMessage('Accept is required'),
        //body('email').isEmail().withMessage('Invalid email'),
        //body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    ]
    await Promise.all(validateAccountRequest.map((validator) => validator.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // Hämta formulärets konfig från json-fil
    const formconfigresponse = fs.readFileSync(process.env.FORMSCONFIG_URL + 'libraryaccount.json', { encoding: 'utf8' });
    const formconfig = JSON.parse(formconfigresponse)
    let emailfromaddresslibrary = formconfig.emailfromaddresslibrary.emailaddress;
    let emailfromnamelibrary = formconfig.emailfromaddresslibrary.name[language];

    try {
        bodytext = "";
        emailtosubjectuser = formconfig.emailtosubjectuser[language];
        formconfig.emailtobodyuser[language].forEach(row => {
            bodytext += row;
        })
    } catch(err) {
        responseobject = {
            "status" : "Error",
            "message" : err
        };
        return res.status(400).send(responseobject);
    }

    bodytext = bodytext.replace('@@email', req.body.form.email);
    
    try {
        almauser = await alma.createUser(req.body);
        almauserobject = almauser.data;
        if (almauser.status == 'Error') {
            return res.status(400).send(almauserobject);
        }
        mailresponse = await mail.sendmail(req.body.form.email, emailfromaddresslibrary, emailfromnamelibrary, emailtosubjectuser, bodytext);
        if (mailresponse != 'Success'){
            responseobject = {
                "status"  : "Error",
                "message" : mailresponse
            };
            return res.status(202).send(responseobject);
        }

        responseobject = {
            "status" : "Success",
            "message" : "Account created"
        };
        return res.status(201).send(responseobject);
    } catch(err) {
        responseobject = {
            "status" : "Error",
            "message" : err.response.data.errorList.error[0].errorMessage
        };
        
        return res.status(400).send(responseobject);
    }
}

/**
     * 
     * Funktion som skickar Kontakta oss-mail
     * till RT/EDGE funktionsmail
     * 
     * Formulärkonfig från JSON
     *      Mailadresser och texter
     * 
     * Byt ut variabler (@@XXXX) i mailtexten som hämtats från formulärkonfig
     * mot värden från request
     * 
     */
async function sendContactMail(req, res) {
    if (!req.is('json')) {
        res
        .status(201)
        .send(
        {
            "status" : "Error",
            "message": "Please provide JSON"
        });
        return
    }

    language = req.query.language ? req.query.language : "english"
    
    // Hämta formulärets konfig från json-fil
    const formconfigresponse = fs.readFileSync(process.env.FORMSCONFIG_URL + 'contact.json', { encoding: 'utf8' });
    const formconfig = JSON.parse(formconfigresponse)

    //Validera obligatoriska fält
    let validateAccountRequest = [
        query('language').notEmpty().withMessage('Language is required'),
        body('form.name').notEmpty().withMessage('Name is required'),//Min 2
        body('form.email').notEmpty().withMessage('Email is required'),//Min 5
        body('form.subject').notEmpty().withMessage('Subject is required'),//Min3
        body('form.question').notEmpty().withMessage('Question is required'),//Min5
        //body('email').isEmail().withMessage('Invalid email'),
        //body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    ]
    await Promise.all(validateAccountRequest.map((validator) => validator.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    let emailtoaddressedge = req.query.emailtoaddressedge || process.env.EDGE_MAIL_ADDRESS;
    emailfromaddressuser = req.body.form.email;
    emailfromnameuser = req.body.form.name;                                   

    //Nalle puh
    if(req.body.form.phone != "") {
        responseobject = {
            "status" : "Error",
            "message" : "Nalle Puh"
        }
        return res.status(400).send(responseobject);
    }

    try {
        bodytext = "";
        emailtosubjectedge = req.body.form.subject;
        formconfig.emailtobodyedge[language].forEach(row => {
            bodytext += row;
        })
    } catch(err) {
        responseobject = {
            "status" : "Error",
            "message" : err
        };
        return res.status(400).send(responseobject);
    }
    
    //Gå igenom alla fält
    for (const field in formconfig.formfields ) {
        const regex = new RegExp(`@@${field}`, 'g');
        bodytext = bodytext.replace(regex, req.body.form[field]);
    }

    try {
        mailresponse = await mail.sendmail(emailtoaddressedge, emailfromaddressuser, emailfromnameuser, emailtosubjectedge, bodytext);
        if (mailresponse != 'Success'){
            responseobject = {
                "status"  : "Error",
                "message" : JSON.stringify(mailresponse)
            };
            return res.status(400).send(responseobject);
        }

        responseobject = {
            "status" : "Success",
            "message" : "OK"
        };
        return res.status(200).send(responseobject);
    } catch(err) {
        responseobject = {
            "status" : "Error",
            "message" : JSON.stringify(err)
        };
        
        return res.status(400).send(responseobject);
    }
}

/**
     * 
     * Funktion som skickar ett Undervisnings-mail till
     * RT/EDGE/Funktionsadress/emailadress
     * 
     * Formulärkonfig från JSON
     *      Mailadresser och texter
     * 
     * Byt ut variabler (@@XXXX) i mailtexten som hämtats från formulärkonfig
     * mot värden från request
     */
async function sendTeachingactivityMail(req, res) {
    if (!req.is('json')) {
        res
        .status(201)
        .send(
        {
            "status" : "Error",
            "message": "Please provide JSON"
        });
        return
    }

    let language = req.query.language ? req.query.language : "english"

    //Validera obligatoriska fält
    let validateAccountRequest = [
        query('language').notEmpty().withMessage('Language is required'),
        body('form.program').notEmpty().withMessage('Name is required'),
        body('form.semester').notEmpty().withMessage('Email is required'),
        body('form.coursename').notEmpty().withMessage('Subject is required'),
        body('form.coursecode').notEmpty().withMessage('Question is required'),
        body('form.courseedition').notEmpty().withMessage('Question is required'),
        body('form.numberofstudents').notEmpty().withMessage('Question is required'),
        body('form.email').notEmpty().withMessage('Question is required'),
        body('form.task').notEmpty().withMessage('Question is required'),
        body('form.courseplan').notEmpty().withMessage('Question is required'),
        body('form.goal').notEmpty().withMessage('Question is required'),
        body('form.preferreddatesquestion').notEmpty().withMessage('Question is required'),
        body('form.otherteaching').notEmpty().withMessage('Question is required'),
        body('form.ownfacilityquestion').notEmpty().withMessage('Question is required'),

        //body('email').isEmail().withMessage('Invalid email'),
        //body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    ]

    if (req.body.preferreddatesquestion=='yes') {
        validateAccountRequest.push(body('form.preferreddates').notEmpty().withMessage('Preferred dates is required'))
    }

    if (req.body.ownfacilityquestion=='own') {
        validateAccountRequest.push(body('form.facility').notEmpty().withMessage('Facility is required'))
    }

    
    await Promise.all(validateAccountRequest.map((validator) => validator.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    // Hämta formulärets konfig från json-fil
    const formconfigresponse = fs.readFileSync(process.env.FORMSCONFIG_URL + 'teachingactivity.json', { encoding: 'utf8' });
    const formconfig = JSON.parse(formconfigresponse)

    let emailtoaddressedge = req.query.emailtoaddressedge || process.env.EDGE_MAIL_ADDRESS;
    let emailfromaddressuser = req.body.form.email;
    let emailfromnameuser = req.body.form.name;                                 

    try {
        bodytext = "";
        emailtosubjectedge = formconfig.emailtosubjectedge[language]
        formconfig.emailtobodyedge[language].forEach(row => {
            bodytext += row;
        })
    } catch(err) {
        responseobject = {
            "status" : "Error",
            "message" : err
        };
        return res.status(400).send(responseobject);
    }

    //Gå igenom alla fält
    for (const field in formconfig.formfields ) {
        const regex = new RegExp(`@@${field}`, 'g');
        bodytext = bodytext.replace(regex, req.body.form[field]);
    }
    //Visa inte rader/rubriker/block där information saknas.
    if (bodytext.indexOf('showcritera=\'undefined\'') > -1) {
        bodytext = bodytext.replace(/showcritera=\'undefined\'/g, 'style="mso-hide:all;display:none;max-height:0px;overflow:hidden;"');
    }
    
    try {
        mailresponse = await mail.sendmail(emailtoaddressedge, emailfromaddressuser, emailfromnameuser, emailtosubjectedge, bodytext);
        if (mailresponse != 'Success'){
            responseobject = {
                "status"  : "Error",
                "message" : JSON.stringify(mailresponse)
            };
            return res.status(400).send(responseobject);
        }

        responseobject = {
            "status" : "Success",
            "message" : "OK"
        };
        return res.status(200).send(responseobject);
    } catch(err) {
        responseobject = {
            "status" : "Error",
            "message" : JSON.stringify(err)
        };
        
        return res.status(400).send(responseobject);
    }
}

/**
 * 
 * Funktion som skickar ett mail till
 * RT/EDGE/Funktionsadress
 * 
 * Formulärkonfig från JSON
 *      Mailadresser och texter
 * 
 * Byt ut variabler (@@XXXX) i mailtexten som hämtats från formulärkonfig
 * mot värden från request
 */
async function sendLiteraturesearchMail(req, res) {

    let language = req.query.language ? req.query.language : "english"

    if (req.files) {
        const fileSizeLimit = process.env.FILE_SIZE_LIMIT_MB * 1024 * 1024;
        for (const key in req.files) {
            if (req.files[key].size > fileSizeLimit) {
                if (language != 'english') {
                    return res.status(413).json({ error: 'Filen ' + req.files[key].name + ' är för stor'});
                } else {
                    return res.status(413).json({ error: 'File size limit exceeded for ' + req.files[key].name });
                }
            }
        }
    }

    // Hämta formulärets konfig från json-fillet emailtoaddressedge
    const formconfigresponse = fs.readFileSync(process.env.FORMSCONFIG_URL + 'literaturesearch.json', { encoding: 'utf8' });
    const formconfig = JSON.parse(formconfigresponse)

    //Validera obligatoriska fält
    let validateLiteraturesearch = [
        body('form.email').notEmpty().withMessage('Email is required'),
    ]

    let form  = JSON.parse(req.body.item);

    let emailtoaddressedge = req.query.emailtoaddressedge || process.env.EDGE_MAIL_ADDRESS;
    emailfromaddressuser = form.email;
    emailfromnameuser = form.name;                                 

    try {
        bodytext = "";
        emailtosubjectedge = formconfig.emailtosubjectedge[language]
        formconfig.emailtobodyedge[language].forEach(row => {
            bodytext += row;
        })
    } catch(err) {
        responseobject = {
            "status" : "Error",
            "message" : err
        };
        return res.status(400).send(responseobject);
    }

    //Gå igenom alla fält
    for (const field in formconfig.formfields ) {
        //Hantera inte files här!
        if (field.indexOf('file') > -1) {
            // Do nothing!
        } else {
            const regex = new RegExp(`@@${field}`, 'g');
            bodytext = bodytext.replace(regex, form[field]);
        }
    }

    //Visa inte rader/rubriker/block där information saknas.
    //Lägg in showcritera='@@otherdelivery' i en div runt det som ska eventuellt döljas.
    //"otherdelivery" ska motsvara nod under [formfields] i json för aktuellt formulär:

    const regex = /<div[^>]*showcritera=[''][^>]*>.*?<\/div>/g;

    bodytext = bodytext.replace(regex, '');
    
    mailresponse = await mail.sendmail(emailtoaddressedge, emailfromaddressuser, emailfromnameuser, emailtosubjectedge, bodytext, '','', req);
    if (mailresponse != 'Success'){
        responseobject = {
            "status"  : "Error",
            "message" : JSON.stringify(mailresponse)
        };
        return res.status(400).send(responseobject);
    }

    responseobject = {
        "status" : "Success",
        "message" : "OK"
    };
    return res.status(200).send(responseobject);
}

// Hjälpfunktioner
function escapeString(str) {
    return str
    .replace(/[\\]/g, '\\\\')
    .replace(/[\"]/g, '\\\"')
    .replace(/[\/]/g, '\\/')
    .replace(/[\b]/g, '\\b')
    .replace(/[\f]/g, '\\f')
    .replace(/[\n]/g, '\\n')
    .replace(/[\r]/g, '\\r')
    .replace(/[\t]/g, '\\t');
}

function substrInBetween(whole_str, str1, str2) {
    if (whole_str.indexOf(str1) === -1 || whole_str.indexOf(str2) === -1) {
        return undefined;
    }
    return whole_str.substring(
        whole_str.indexOf(str1) + str1.length,
        whole_str.indexOf(str2)
    );
}

function truncate(str, max, suffix) {
    return str.length < max ? str : `${str.substr(0, str.substr(0, max - suffix.length).lastIndexOf(' '))}${suffix}`;
}

const validateRequest = [
    query('language').notEmpty().withMessage('Language is required'),
    body('form.iam').notEmpty().withMessage('Iam is required'),
    body('form.username').notEmpty().withMessage('Username is required'),
    body('form.genre').notEmpty().withMessage('Genre is required'),
    body('form.source').notEmpty().withMessage('Source is required'),
    //body('email').isEmail().withMessage('Invalid email'),
    //body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
];

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    next();
};

async function searchISNB(req, res, next) {
  const { isbn } = req.params;

  const librisUrl = `https://libris.kb.se/xsearch?query=isbn:${isbn}&format=json`;
  const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;

  try {
    // === 1️⃣ Försök hämta från Libris först ===
    const librisRes = await axios.get(librisUrl, { timeout: 5000 });
    const librisList = librisRes.data?.xsearch?.list || [];
    const librisItem = librisList.length > 0 ? librisList[0] : null;

    if (librisItem) {
      return res.json({
        source: "libris",
        isbn,
        title: librisItem.title || null,
        authors: librisItem.creator || [],
        publisher: librisItem.publisher || null,
        publishedDate: librisItem.date || null,
        language: librisItem.language || null,
        cover: librisItem.cover || null,
        status: "ok"
      });
    }

    // === 2️⃣ Om Libris inte hittar något → försök Google Books ===
    const googleRes = await axios.get(googleUrl, { timeout: 5000 });
    const googleItem = googleRes.data.items?.[0]?.volumeInfo;

    if (googleItem) {
      return res.json({
        source: "google",
        isbn,
        title: googleItem.title || null,
        authors: googleItem.authors || [],
        publisher: googleItem.publisher || null,
        publishedDate: googleItem.publishedDate || null,
        language: googleItem.language || null,
        description: googleItem.description || null,
        cover: googleItem.imageLinks?.thumbnail || null,
        status: "ok"
      });
    }

    // === 3️⃣ Om varken Libris eller Google hittar något ===
    return res.status(404).json({
      status: "not_found",
      message: "Ingen bokinformation hittades i Libris eller Google Books.",
      isbn
    });

  } catch (err) {
    console.error("Fel vid hämtning:", err.message);
    res.status(500).json({
      status: "error",
      message: "Ett fel uppstod vid hämtning av bokdata.",
      isbn
    });
  }
};


module.exports = {
    generateApp,
    generateKthbForm,
    login,
    logout,
    getkthschools,
    requestMaterial,
    createLibraryaccount,
    sendContactMail,
    sendTeachingactivityMail,
    sendLiteraturesearchMail,
    substrInBetween,
    truncate,
    searchISNB
};
