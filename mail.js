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
        if(option.value == request.form.iam) {
            iam =  option.label[request.language];
        }
    }

    //Hantera datum
    let dateneededby = "";
    if(request.form.dateneededby) {
        dateneededby = request.form.dateneededby
    }
    
    bodytext = bodytext.replace(/@@title/g, title);
    bodytext = bodytext.replace(/@@btitle/g, request.form.btitle);
    bodytext = bodytext.replace(/@@atitle/g, request.form.atitle);
    bodytext = bodytext.replace(/@@ctitle/g, request.form.ctitle);
    bodytext = bodytext.replace(/@@stitle/g, request.form.stitle);
    bodytext = bodytext.replace(/@@jtitle/g, request.form.jtitle);
    bodytext = bodytext.replace(/@@dbtitle/g, request.form.dbtitle);
    bodytext = bodytext.replace(/@@genre/g, genre);
    bodytext = bodytext.replace(/@@au/g, author);
    bodytext = bodytext.replace(/@@edition/g, request.form.edition);
    bodytext = bodytext.replace(/@@issue/g, request.form.issue);
    bodytext = bodytext.replace(/@@pages/g, request.form.pages);
    bodytext = bodytext.replace(/@@issn/g, request.form.issn);
    bodytext = bodytext.replace(/@@isbn/g, request.form.isbn);
    bodytext = bodytext.replace(/@@place/g, request.form.place);
    bodytext = bodytext.replace(/@@publisher/g, request.form.publisher);
    bodytext = bodytext.replace(/@@year/g, request.form.year);
    bodytext = bodytext.replace(/@@volume/g, request.form.volume);
    bodytext = bodytext.replace(/@@source/g, request.form.source);
    bodytext = bodytext.replace(/@@pickup/g, almalibraryname);
    bodytext = bodytext.replace(/@@doi/g, request.form.doi);
    bodytext = bodytext.replace(/@@coursecode/g, request.form.coursecode);
    bodytext = bodytext.replace(/@@fullname/g, fullname);
    bodytext = bodytext.replace(/@@iam/g, iam);
    bodytext = bodytext.replace(/@@username/g, request.form.username);
    bodytext = bodytext.replace(/@@emailadress/g, almapreferredemail);
    bodytext = bodytext.replace(/@@cost/g, cost);
    bodytext = bodytext.replace(/@@dateneededby/g, dateneededby);
    bodytext = bodytext.replace(/@@message/g, request.form.message);

    if (bodytext.indexOf('showcritera=\'undefined\'') > -1) {
        bodytext = bodytext.replace(/showcritera=\'undefined\'/g, 'style="mso-hide:all;display:none;max-height:0px;overflow:hidden;"');
    }
    return bodytext;
}

module.exports = {
    sendmail,
    createmailbody
};