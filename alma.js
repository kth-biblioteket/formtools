const fs = require("fs");
const path = require('path');
const axios = require('axios')

/**
 * 
 * Funktion som skapar användare i Alma
 * 
 * Genererar ett JSON-object som skickas till Almas API
 */
async function createUser(requestInput){
    const expiry_date = formatDate(addYears(new Date(), 2));
    const start_date = formatDate(addYears(new Date(), 0));
    console.log(start_date.toString())
    requestInputkey='form';
    usergroup = '30';
    if (requestInput[requestInputkey]['otherinfo']) {
        if (requestInput[requestInputkey]['otherinfo'] == 'scania') {
            $usergroup = '43';
        }
    }
    jsonuser = `
        {
            "password": "${requestInput[requestInputkey]['password'] ? requestInput[requestInputkey]['password'] : ""}",
            "status": {
                "value": "ACTIVE"
            },
            "record_type": {
                "value": "PUBLIC"
            },
            "primary_id": "${requestInput[requestInputkey]['email'] ? requestInput[requestInputkey]['email'] : ""}",
            "first_name": "${requestInput[requestInputkey]['firstname'] ? requestInput[requestInputkey]['firstname'] : ""}",
            "middle_name": "",
            "last_name": "${requestInput[requestInputkey]['lastname'] ? requestInput[requestInputkey]['lastname'] : ""}",
            "pin_number": "${requestInput[requestInputkey]['pin'] ? requestInput[requestInputkey]['pin'] : ""}",
            "job_category": {
            "value": ""
            },
            "job_description": "",
            "user_group": {
                "value": "${usergroup}"
            },
            "campus_code": {
                "value": ""
            },
            "web_site_url": "",
            "preferred_language": {
                "value": "sv"
            },
            "expiry_date": "${expiry_date}Z",
            "account_type": {
                "value": "INTERNAL"
            },
            "external_id": "",
            "force_password_change": "",
            "contact_info": {
                "address": [
                    {
                        "preferred": true,
                        "line1": "${requestInput[requestInputkey]['streetadress'] ? requestInput[requestInputkey]['streetadress'] : ""}",
                        "line2": "",
                        "city": "${requestInput[requestInputkey]['city'] ? requestInput[requestInputkey]['city'] : ""}",
                        "state_province": "",
                        "postal_code": "${requestInput[requestInputkey]['zipcode'] ? requestInput[requestInputkey]['zipcode'] : ""}",
                        "address_note": "",
                        "start_date": "${start_date}Z",
                        "address_type": [
                            {
                                "value": "home"
                            }
                        ]
                    }
                ],
                "email": [
                    {
                        "description": null,
                        "preferred": true,
                        "email_address": "${requestInput[requestInputkey]['email'] ? requestInput[requestInputkey]['email'] : ""}",
                        "email_type": [
                            {
                                "value": "personal"
                            }
                        ]
                    }
                ],
                "phone": [
                    {
                        "preferred": true,
                        "phone_number": "${requestInput[requestInputkey]['phone1'] ? requestInput[requestInputkey]['phone1'] : ""}",
                        "preferred_sms": null,
                        "phone_type": [
                            {
                                "value": "home"
                            }
                        ]
                    }`
            
            if (requestInput[requestInputkey]['phone2']) {
                if (requestInput[requestInputkey]['phone2'] != '') {
        jsonuser += `,
                    {
                        "preferred": true,
                        "phone_number": "${requestInput[requestInputkey]['phone2'] ? requestInput[requestInputkey]['phone2'] : ""}",
                        "preferred_sms": null,
                        "phone_type": [
                            {
                                "value": "home"
                            }
                        ]
                    }`;
                }
            }
             
    jsonuser +=`]
            },
            "user_role": [
                {
                    "status": {
                        "value": "INACTIVE",
                        "desc": "Inactive"
                    },
                    "scope": {
                        "value": "46KTH_INST",
                        "desc": "Royal Institute of Technology"
                    },
                    "role_type": {
                        "value": "200",
                        "desc": "Patron"
                    }
                }
            ]`
        if (requestInput[requestInputkey]['otherinfo']) {
            //Note för de som har borgensförbindelse
            if (requestInput[requestInputkey]['otherinfo'] == '16_18' || requestInput[requestInputkey]['otherinfo'] == '18_not_swedish') {
jsonuser += `,
            "user_note": [
                {
                    "segment_type": "Internal",
                    "note_type": {
                        "value": "POPUP"
                    },
                    "note_text": "Användare med borgensförbindelse",
                    "user_viewable": false,
                    "popup_note": true,
                    "created_by": "kthb_forms",
                    "created_date": "'. date('Y-m-d') . 'Z",
                    "note_owner": ""
                }
            ]`
            }
            //Block för under 18
            if (requestInput[requestInputkey]['otherinfo'] == '16_18') {
jsonuser += `,
            "user_block": [
                    {
                        "block_type": {
                            "value": "USER"
                        },
                        "block_description": {
                            "value": "UNDER18"
                        },
                        "block_status": "ACTIVE",
                        "created_by": "kthb_forms"
                    }
                ]`
            }
            //Block och födelsedatum för icke svensk
            if (requestInput[requestInputkey]['otherinfo'] == '18_not_swedish') {
                jsonuser += `,
                "birth_date": "${requestInput[requestInputkey]['birthdate'] ? requestInput[requestInputkey]['birthdate'] : ""}Z",
                "user_block": [
                    {
                        "block_type": {
                            "value": "USER"
                        },
                        "block_description": {
                            "value": "EJ_FOLKBOKFORD"
                        },
                        "block_status": "ACTIVE",
                        "created_by": "kthb_forms"
                    }
                ]`
            } else {
                //Personnummer för övriga
    jsonuser += `, 
                "user_identifier": [
                    {
                        "value": "${requestInput[requestInputkey]['personalnumber'] ? requestInput[requestInputkey]['personalnumber'] : ""}",
                        "note": "Personal Number",
                        "status": "ACTIVE",
                        "id_type": {
                            "value": "PERSONAL_NUMBER"
                        },
                        "segment_type":"Internal"
                    }
                ]`
            }
        }
jsonuser += '}';
    
    console.log(jsonuser);
    const almaresponse = await axios.post(
        process.env.ALMA_API_URL + 'users?apikey=' + process.env.ALMA_API_KEY, 
        JSON.parse(jsonuser));
    return almaresponse;
}

//Helpfunction
function addYears(date, years) {
    date.setFullYear(date.getFullYear() + years);
  
    return date;
}

function formatDate(date = new Date()) {
    const year = date.toLocaleString('default', {year: 'numeric'});
    const month = date.toLocaleString('default', {month: '2-digit'});
    const day = date.toLocaleString('default', {day: '2-digit'});
  
    return [year, month, day].join('-');
}

module.exports = {
    createUser
};