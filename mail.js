const fs = require("fs");
const path = require('path');
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars')

async function sendmail(to, from, fromname, subject, bodytext, inlineimage = '', inlingeimagecid = '', attachments = '') {
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
/*
    transporter.use('compile', hbs(handlebarOptions))

    let edgemailoptions = {}
    let template = 'edge_email_sv'
    if (req.body.lang.toUpperCase() == "EN") {
        template = 'edge_email_en'
    } else {

    }
    */
    mailoptions = {
        from: {
            name: fromname,
            address: from
        },
        to: to,
        subject: subject,
        html: bodytext, 
        //template: 'edge_email_sv',
        /*
        context:{
            email: req.body.email,
            schoolname: kthschool[0].name,
            usertype: usertype[0].name,
            action: action[0].name,
            sessionchoices: sessionchoices,
            session_user_choice: req.body.session_user_choice
        },
        */
        generateTextFromHTML: true
    };

    try {
        //logger.debug(JSON.stringify(edgemailoptions))
        console.log(mailoptions)
        let contactmemailinfo = await transporter.sendMail(mailoptions);
    } catch (err) {
        //TODO
        //logger.debug(JSON.stringify(err))
        return err
    }
    return "success"
}

/**
     * 
     * Funktion för att skapa ett mails innehåll.
     * 
     * Byt ut variabler (@@XXXX) i mailtexten som hämtats från formulärkonfig
     * mot värden från request
     * 
     * Visa inte rader/rubriker/block där information saknas.
     * JSON-exempel:  
     * "<div showcritera='@@cost'><strong>Accepterar kostnad</strong></div>",
     * "<div>@@cost</div>",
     * 
     */
async function createmailbody(formconfig, bodytext, genre, cost, fullname, almapreferredemail, almalibraryname, request) {
        
    //hantera titel
    let title = '';
    let jtitle = '';
    let stitle = '';
    
    if(request.form.genre == 'article' &&  request.form.atitle) {
        title = request.form.atitle;
    }

    if((request.form.genre == 'book' || request.form.genre == 'bookitem') &&  request.form.btitle) {
        title = request.form.btitle;
    }
    
    if((request.form.genre == 'journal' || request.form.genre == 'article') &&  request.form.jtitle) {
        jtitle = request.form.jtitle;
    }

    if((request.form.genre == 'journal' || request.form.genre == 'article') &&  request.form.stitle) {
        stitle = request.form.stitle;
    }

    //hantera författarnamn
    let author = "";
    if(request.form.genre == 'book' || request.form.genre == 'article' || request.form.genre == 'bookitem' ) {
        if (request.form.au == '') {
            author = request.form.aulast + ', ' + request.form.aufirst;
        } else  {
            author = request.form.au;
        }
    }

    //Hantera kategori
    let iam='';
    for (const option in formconfig.formfields.iam.options ) {
        if(formconfig.formfields.iam.options[option].value == request.form.iam) {
            iam =  formconfig.formfields.iam.options[option].label[request.language];
        }
    }

    //Hantera datum
    let dateneededby = "";
    if(request.form.dateneededby) {
        dateneededby = request.form.dateneededby
    }
    
    bodytext.replace('@@title', title);
    bodytext.replace('@@btitle', request.form.btitle);
    bodytext.replace('@@atitle', request.form.atitle);
    bodytext.replace('@@ctitle', request.form.ctitle);
    bodytext.replace('@@stitle', request.form.stitle);
    bodytext.replace('@@jtitle', request.form.jtitle);
    bodytext.replace('@@dbtitle', request.form.dbtitle);
    bodytext.replace('@@genre', genre);
    bodytext.replace('@@au', author);
    bodytext.replace('@@edition', request.form.edition);
    bodytext.replace('@@issue', request.form.issue);
    bodytext.replace('@@pages', request.form.pages);
    bodytext.replace('@@issn', request.form.issn);
    bodytext.replace('@@isbn', request.form.isbn);
    bodytext.replace('@@place', request.form.place);
    bodytext.replace('@@publisher', request.form.publisher);
    bodytext.replace('@@year', request.form.year);
    bodytext.replace('@@volume', request.form.volume);
    bodytext.replace('@@source', request.form.source);
    bodytext.replace('@@pickup', almalibraryname);
    bodytext.replace('@@doi', request.form.doi);
    bodytext.replace('@@coursecode', request.form.coursecode);
    bodytext.replace('@@fullname', fullname);
    bodytext.replace('@@iam', iam);
    bodytext.replace('@@username', request.form.username);
    bodytext.replace('@@emailadress', almapreferredemail);
    bodytext.replace('@@cost', cost);
    bodytext.replace('@@dateneededby', dateneededby);
    bodytext.replace('@@message', request.form.message);

    if (bodytext.indexOf('showcritera=\'\'') > -1) {
        bodytext = bodytext.replace('showcritera=\'\'', 'style="mso-hide:all;display:none;max-height:0px;overflow:hidden;"');
    }
    return bodytext;
}

module.exports = {
    sendmail,
    createmailbody
};