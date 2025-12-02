////////////////////////////////////////////////////
//
// Variabler
//
////////////////////////////////////////////////////
let language = 'swedish'
let formdata;
let optionalfieldtext;
let objectFormfields;
let sendbutton
let kthbform = document.getElementById("kthbform")
let kthbformData;
let environment;
let formisvalid = false;
let currentelement = "";
let posturl
let formserver
let isopenurl
let openurlsuffix = ""
let openurlsource
let openurljson
let formid
let formdataurl
let filelistlength
let files
let honeypotfieldname = ""
let is_submitted_once = false
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
let dt
try {
    dt = new DataTransfer();
} catch(err) {
    //stöds inte av porteus?
}

////////////////////////////////////////////////////
//
// Hämta formulärdata(json)
//
////////////////////////////////////////////////////
let getformdata = () => {
    // Finns det en sourceparameter i url:en?
    // I så fall är det ett anrop via "openurl" från t ex Primo
    openurlsource = urlParams.get('source') || urlParams.get('rfr.id')
    if(openurlsource != null && openurlsource != "") {
        isopenurl = true;
        openurlsuffix = "openurl";
    }

    //Request till Json-fil/api
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        formdata = JSON.parse(this.responseText);
        generateForm(formdata)
        //hantera openurl
        if(openurlsource != null && openurlsource != "") {
            showhidefields()
            generateForm(formdata)
        }
    }
    //Vilket attributvärde finns på aktuellt formulär i html(polopoly eller html-fil)? Sätt ett värde lika med namnet på json-filen som ska hämtas.
    let el = document.getElementById('kthbform')
    formid = el.getAttribute('data-formid')
    formserver = el.getAttribute('data-formserver')
    environment = el.getAttribute('data-environment') || 'production'
    emailtoaddressedge = el.getAttribute('data-edgemailaddress') || 'production'
    formdataurl = formserver + '/formtools/assets/' + formid + openurlsuffix + ".json" + '?time=' + Date.now()
    xhttp.open("GET", formdataurl, true);
    xhttp.send();

}

////////////////////////////////////////////////////
//
// Generara formuläret från hämtad formulärdata(json)
//
////////////////////////////////////////////////////
let generateForm = (formdata) => {
    // Variabler
    kthbform.innerHTML = ''
    optionalfieldtext = formdata.optionalfieldtext;
    let iskiosk = formdata.iskiosk;
    let minDate;
    let validopenurl = false
    let validform = true
    
    for (let prop of Object.keys(formdata.formfields)) {
        // Lägg till ett värde för "honeypot-fält"
        if (formdata.formfields[prop].ishoneypot) {
            honeypotfieldname = prop;
        }

        //Hantera om datum fält ska ha ett defaultdatum(att angivet datum eller plus eller minus antal dagar från dagens datum)
        //Hantera minimumdatum som kan anges
        if (formdata.formfields[prop].type == "datebox" && formdata.formfields[prop].hasdefaultdate) {
            let date = new Date();
            let next_date = new Date(date.setDate(date.getDate() + formdata.formfields[prop].defaultdatedaystoaddremove));
            let datemin = new Date();
            minDate = new Date(datemin.setDate(datemin.getDate() + formdata.formfields[prop].minDatedaystoaddremove));
            formdata.formfields[prop].value = next_date.toISOString().slice(0, 10)
            formdata.formfields[prop].minDate = minDate.toISOString().slice(0, 10);
        }

        //Hantera eventuellt defaultvärde från JSON
        //Om det inte finns ett värde valt så används defaultvalue
        if (formdata.formfields[prop].type == "radio" && formdata.formfields[prop].hasdefaultvalue && formdata.formfields[prop].value == "") {
           formdata.formfields[prop].value = formdata.formfields[prop].defaultvalue
        }
    }

    //OpenURL, matcha fält i formulär mot openurlparametrar 
    if(isopenurl) {
        let openurlboxhtml = ""
        openurljson = openurlparametersToJSON(formdata, openurlsource);
        //Kolla om angiven genre från openurl finns bland genre options i formdata(formfields.genre.options[x].value)
        for (i=0;i<formdata.formfields.genre.options.length;i++) {
            if(formdata.formfields.genre.options[i].value == openurljson.genre) {
                validopenurl = true
                break;
            }
        }
        if(validopenurl) {
            //Hantera kapitel i bok/artikel(båda har nämligen atitle som titel)
            //ctitle sätts först(först i listan av formfields)
            if(openurljson['ctitle'] != '' && openurljson['genre'] == 'article') { 
            openurljson['atitle'] = openurljson['ctitle'];
            openurljson['ctitle'] = '';
            }

            //Hantera proceeding/dissertation
            if(openurljson['genre'] == 'proceeding') {
                openurljson['genre'] = 'bookitem'
            }

            if(openurljson['genre'] == 'dissertation') {
                openurljson['genre'] = 'book'
            }

            //Skapa HTML för att skriva ut "beställningen" i en ruta överst på sidan.
            openurlboxhtml = 
            `<label>${language=='swedish' ? formdata.openurlboxlabel.swedish : formdata.openurlboxlabel.english}</label>
                <div class="card">
                    <div class="card-body">`
                        for(const key in formdata.formfields) {
                            if (formdata.formfields[key].openurl) {
                                if(openurljson[formdata.formfields[key].openurlnames['standard']]) {
                                    formdata.formfields[key].value = openurljson[formdata.formfields[key].openurlnames['standard']];
                                    
                                    //formdata.formfields[key].enabled = true;
                                    
                                    openurlboxhtml += `<div>`
                                    if( formdata.formfields[key].openurl ) {
                                        openurlboxhtml += `<div>`
                                        if ( openurljson[formdata.formfields[key].openurlnames['standard']] != null && openurljson[formdata.formfields[key].openurlnames['standard']] != '' && key=='genre'  ) {
                                            openurlboxhtml += `<strong>${language=='swedish' ? formdata.formfields[key].label.swedish: formdata.formfields[key].label.english}:</strong> ${language=='swedish' ? formdata.genrenames[openurljson[formdata.formfields[key].openurlnames['standard']]].swedish : formdata.genrenames[openurljson[formdata.formfields[key].openurlnames['standard']]].english }`
                                        }
                                        if ( openurljson[formdata.formfields[key].openurlnames['standard']] != null && openurljson[formdata.formfields[key].openurlnames['standard']] != '' && key!='genre'  ) {
                                            openurlboxhtml += `<strong>${language=='swedish' ? formdata.formfields[key].label.swedish: formdata.formfields[key].label.english}:</strong> ${ openurljson[formdata.formfields[key].openurlnames['standard']] }`
                                        }
                                        openurlboxhtml += `</div>`
                                    }
                                    openurlboxhtml += `</div>`
                                }
                            }
                        }
            openurlboxhtml += `</div>`
            openurlboxhtml += `</div>`
            let el = document.getElementById('openurlbox')
            el.innerHTML = openurlboxhtml
        } else {
            //Skicka användaren till tomt formulär
            let cleanUrl = window.location.origin + window.location.pathname;
            if (window.location.search) {
                window.location.replace(cleanUrl);
            }
            openurlboxhtml = 
                `<label>${language=='swedish' ? formdata.openurlboxlabel.swedish : formdata.openurlboxlabel.english}</label>
                <div class="card">
                    <div class="card-body">
                        Invalid genre: ${openurljson.genre}
                    </div>
                </div>`
                let el = document.getElementById('openurlbox')
                el.innerHTML = openurlboxhtml
                validform = false
        }
    }

    if (validform) {
        // Skapa fälten
        for (const key in formdata.formfields) {
            if (key != 'source') {
                createformfield(formdata.formfields[key], key)
            }
        }
        let formisinit = true;
        createlisteners()
    }
}

////////////////////////////////////////////////////
//
// Skapa html för fält
//
////////////////////////////////////////////////////
let createformfield = (field, fieldkey) => {
    let formhtml = `<div id="parent_${fieldkey}" class="${field.enabled ? 'fieldenabled' : 'fielddisabled'} ${field.hidden ? 'hideelement' : ''} ${field.type == 'grouplabel' ? 'nomarginbottom' : 'marginbottom15'}">`
    //Label för varje fält, inte fet stil om fält ingår i gruppering, visa inte för checkbox och informationboxalert och htmltext och button och file
    if (field.type != 'checkbox' && field.type != 'files' && field.type != 'informationboxalert' && field.type != 'informationbox' && field.type != 'htmltext' && field.type != 'button' && field.type != 'file') {
        formhtml += `<label class="${field.ishoneypot ? 'nallepuh' : ''} ${field.isgrouped ? 'isgrouped' : ''} ${!field.isgrouped ? 'isnotgrouped' : ''}" for="${fieldkey}">
                        ${language == 'swedish' ? field.label.swedish : field.label.english}`
        if (field.type != 'files') {
            let validatefield = checkifrequired(fieldkey);
            formhtml += `
                            <!-- Fält valfritt? Visa inte för fillista-->
                            <span class="requiredtext">
                                ${!validatefield && language == 'swedish' ? '(' + optionalfieldtext.swedish + ')' : ''}
                                ${!validatefield && language == 'english' ? '(' + optionalfieldtext.english + ')' : ''}
                            </span>`
        }
        formhtml += `</label>`
    }

    // Label för val av filer
    if (field.type == "files" && filelistlength > 0) {
        formhtml += `<label class="${field.isgrouped ? 'isgrouped' : ''} ${!field.isgrouped ? 'isnotgrouped' : ''}" for="${fieldkey}">
                        ${language == 'swedish' ? field.label.swedish : field.label.english}
                    </label>`
    }

    //Felmeddelanden vid ogiltigt/inte ifyllt
    formhtml += 
    `<div class="error hideelement" id="invalid_${fieldkey}">
    </div>`

    // Om placement=before
    // Eventuell extra information/beskrivning
    if (field.description && field.description.placement=='before') {
        formhtml += 
        `<div>
            ${language == 'swedish' ? field.description.swedish : field.description.english}
        </div>`
    }

    // Eventuell länk
    if (field.link && field.link.placement=='before') {
        if(field.link.type == 'relative') {
            linkprefix = formserver + '/';
        } else {
            linkprefix = '';
        }
        formhtml += 
        `<div class="extrainfobeforelink">
            <a target="_new" href="${linkprefix}${language == 'swedish' ? field.link.swedish.url : field.link.english.url}">
                ${language == 'swedish' ? field.link.swedish.text : field.link.english.text}
            </a>
            
        </div>`
    }

    // ---------- Fälten ------------
    if (field.type == "checkbox") {
        formhtml +=
            `<div>
                <label class="checkboxlabel">
                    <input type="hidden" name="${fieldkey}" id="hidden_${fieldkey}" value="no" ${field.checked ? 'disabled' : ''}>
                    <input name="${fieldkey}" 
                        id="${fieldkey}" 
                        type="${field.type}" 
                        value="${field.value}"
                        ${field.checked ? 'checked' : ''}> ${language == 'swedish' ? field.label.swedish : field.label.english}
                </label>
                <!-- Fält valfritt? -->
                <span class="requiredtext">
                    ${!field.validation.required.value && language=='swedish' ? '(' + optionalfieldtext.swedish + ')': ''} ${!field.validation.required.value && language=='english' ? '(' + optionalfieldtext.english + ')' : ''}
                </span>
            </div>`
    }

    if (field.type == "radio") {
        for (const key in field.options) {
            if (field.options[key].enabled && !field.options[key].hidden ) {
                formhtml += `<div><label class="radiolabel" class="disabled">`
                if (field.options[key].link) {
                    formhtml += `<input type="radio" 
                        value="${field.options[key].value}"> ${language == 'swedish' ? field.options[key].label.swedish : field.options[key].label.english}`
                } else {
                    const radiovalue = field.options[key].value
                    const checked = field.options[key].value == field.value ? 'checked' : ''
                    formhtml += `
                        <input type="radio"
                            name="${fieldkey}"
                            id="${fieldkey + key}"
                            formControlName="${field.options[key].key}"
                            value="${radiovalue}"
                            ${checked}> ${language == 'swedish' ? field.options[key].label.swedish : field.options[key].label.english}`
                }
                formhtml += `</label></div>`
            }
        }

    }

    if (field.type == "select") {
        formhtml += `<div>
                        <select formControlName="${fieldkey}">`
        for (const key in field.options) {
            formhtml +=
                            `<option [value]="${field.options[key].value}">
                                ${language == 'swedish' ? field.options[key].label.swedish : field.options[key].label.english}
                            </option>`
        }
        formhtml += `
                        </select>
                    </div>`
    }

    if (field.type == "text") {
        formhtml +=
            `<div>
                <input  ${field.enabled ? '' : 'disabled'}
                        class="textinput ${field.ishoneypot ? 'nallepuh' : ''} form-control medium" 
                        name="${fieldkey}" 
                        id="${fieldkey}" 
                        type="${field.type}" 
                        autocomplete="${field.ishoneypot ? 'false' : 'on'}"
                        value="${field.value}"
                        ${field.validation.required.value ? 'required' : ''}>
            </div>`
    }

    if (field.type == "password") {
        formhtml +=
            `<div>
                <input ${field.enabled ? '' : 'disabled'}
                        class="passwordinput form-control medium" 
                        name="${fieldkey}" 
                        id="${fieldkey}" 
                        type="${field.type}" 
                        autocomplete="${field.ishoneypot ? 'false' : 'on'}"
                        value="${field.value}"
                        ${field.validation.required.value ? 'required' : ''}>
            </div>`
    }

    if (field.type == "textarea") {
        formhtml +=
            `<div *ngSwitchCase="'textarea'">
                <textarea ${field.enabled ? '' : 'disabled'}
                        class="form-control medium textareaheight"
                        name="${fieldkey}" 
                        id="${fieldkey}" 
                        maxlength="${field.maxlength}">${field.value}</textarea>
            </div>`
    }

    if (field.type == "datebox") {
       
        formhtml +=  `<div><label for="${fieldkey}">Date</label>
        <input 
            ${field.enabled ? '' : 'disabled'}
            1readonly="readonly" 
            type="date" 
            class="1datepicker"
            min="${field.minDate}"
            id="${fieldkey}"
            name="${fieldkey}"
            value="${field.value}"></div>`
    }

    // File upload
    if (field.type == "file") {
   
        formhtml +=  `<div class="fileupload">
                        <div class="col-mdss-12 tssext-center" >
                        <label for="${fieldkey}">
		                    <a class="filechoosebtn" role="button" aria-disabled="false">${language == 'swedish' ? field.label.swedish : field.label.english}</a>
                        </label>
                        <input 
                            id="${fieldkey}"
                            type="${field.type}"
                            name="${fieldkey}"
                            #files 
                            multiple
                            class="fileinput" />
                        </div>
                    </div>`
    }

    // Lista valda filer
    if (field.type == "files") {
        
        formhtml +=  `<div class="filelist"></div>`
        //Skapa knappar med delete för varje tillagd fil'
        if (dt.files.length > 0) { 
            for(var i = 0; i < dt.files.length; i++) {
                formhtml +=  
                `<div>
                    <button type="button" class="fileremovebtn btn btn-labeled btn-success"">
                        <span id="file${i}" class="btn-label">X</span><span class="fileremovebtnname">${dt.files.item(i).name}</span>
                    </button>
                </div>`
            };
        }
    }

    // ---------- Slut Fälten ------------

    // Om placement=after

    //Eventuell mini-information under fältet
    if (field.miniinfo && field.miniinfo.placement=='after') {
        formhtml += 
            `<div>
                ${language == 'swedish' ? field.miniinfo.swedish : field.miniinfo.english}
            </div>`
    }

    // Eventuell extra information/beskrivning med länk under
    if (field.description && field.description.placement=='after') {
        formhtml +=  `<div class="alert alert-info ${field.type=='informationboxalert' ? 'relativeposition' : ''} ${field.type=='informationbox' ? 'informationbox' : ''}">`
        
        formhtml += 
        `<div>
            ${language == 'swedish' ? field.description.swedish : field.description.english}
        </div>`
        // Eventuell länk
        if (field.link && field.link.placement=='after') {
            if(field.link.type == 'relative') {
                linkprefix = formserver;
            } else {
                linkprefix = '';
            }
            formhtml += 
            `<div class="extrainfoafterlink">
                <a target="_new" href="${linkprefix}${language == 'swedish' ? field.link.swedish.url : field.link.english.url}">
                    ${language == 'swedish' ? field.link.swedish.text : field.link.english.text}
                </a>
            </div>`
        }
        formhtml += `</div>`
    } else {
        // Eventuell länk
        if (field.link && field.link.placement=='after') {
            if(field.link.type == 'relative') {
                linkprefix = formserver;
            } else {
                linkprefix = '';
            }
            formhtml += 
            `<div class="extrainfoafterlink">
                <a target="_new" href="${linkprefix}${language == 'swedish' ? field.link.swedish.url : field.link.english.url}">
                    ${language == 'swedish' ? field.link.swedish.text : field.link.english.text}
                </a>
            </div>`
        }
    }

    //Skicka-knapp
    if (field.type == "button") {
        formhtml +=
            `<div class="sendbutton">
                <input
                    id="${fieldkey}"
                    class="form-control btn-success"
                    type="button" 
                    value="${language == 'swedish' ? field.label.swedish : field.label.english}"
                    ${!formisvalid ? 'dfdisabled' : ''}>
            </div>`
    }

    formhtml += `</div>`
    kthbform.innerHTML += formhtml
    try { 
        if (dt.files.length > 0) { 
            const elgroup = document.querySelectorAll(".btn-label");
            elgroup.forEach(el => {
                el.addEventListener('click',function(e){
                    let name = e.target.nextElementSibling.innerText;
                    e.target.parentNode.remove();
                    for(let i = 0; i < dt.items.length; i++) {
                        if(name === dt.items[i].getAsFile().name) {
                            dt.items.remove(i);
                            continue;
                        }
                    }
                    document.querySelector('.fileupload input').files = dt.files;
                });
            });
            //document.querySelector('.fileupload input').files = dt.files;
        }
    } catch (err) {
        console.log(err)
    }
}

////////////////////////////////////////////////////
//
// Skapa lyssnare för events(click, change etc)
//
////////////////////////////////////////////////////
let createlisteners = () => {
    
    if (document.querySelector("input[type=checkbox]")) {
        const elgroup = document.querySelectorAll("input[type=checkbox]");
        elgroup.forEach(el => {
            el.addEventListener('change',function(e){checkboxchange(e, '${fieldkey}')});
        });
    }
    if (document.querySelector("input[type=radio]")) {
        const elgroup = document.querySelectorAll("input[type=radio]");
        elgroup.forEach(el => {
            el.addEventListener('change',function(e){onchangeformobject(this,'${fieldkey}',e)});
        });
    }
    if (document.querySelector("input[type=date]")) {
        const elgroup = document.querySelectorAll("input[type=date]");
        elgroup.forEach(el => {
            el.addEventListener('change',function(e){onInputKeyUp(e, '${fieldkey}')});
        });
    }
    if (document.querySelector("input[type=text]")) {
        const elgroup = document.querySelectorAll("input[type=text]");
        elgroup.forEach(el => {
            el.addEventListener('keyup',function(e){
                onInputKeyUp(e, '${fieldkey}')
            });
            el.addEventListener('input', function(e) {
                onInputKeyUp(e, '${fieldkey}');
            });
        });
    }
    if (document.querySelector("textarea")) {
        const elgroup = document.querySelectorAll("textarea");
        elgroup.forEach(el => {
            el.addEventListener('keyup',function(e){
                onInputKeyUp(e, '${fieldkey}')
            });
            el.addEventListener('input', function(e) {
                onInputKeyUp(e, '${fieldkey}');
            });
        });
    }
    if (document.querySelector("input[type=password]")) {
        const elgroup = document.querySelectorAll("input[type=password]");
        elgroup.forEach(el => {
            el.addEventListener('keyup',function(e){
                onInputKeyUp(e, '${fieldkey}')
            });
            el.addEventListener('input', function(e) {
                onInputKeyUp(e, '${fieldkey}');
            });
        });
    }

    if (document.getElementById("sendbutton")) {
        const elbutton = document.getElementById("sendbutton");
        elbutton.addEventListener('click',function(e){submitform(e)});
    }

    if (document.querySelector(".fileupload input")) {
        const elgroup = document.querySelectorAll(".fileupload input");
        elgroup.forEach(el => {
            el.addEventListener('change',function(e){onFileChange(e, '${fieldkey}')});
        });
    }

    document.addEventListener("click", (e) => {

        const primoModal = document.getElementById("primoModal");
        const primoModalClose = document.getElementById("primoModalClose");

        if (e.target === primoModalClose || e.target === primoModal) {
            closePrimoModal();
            return;
        }

        const isbnInput = document.getElementById("isbn");
        const suggestionBox = document.getElementById("suggestionBox");

        if (!suggestionBox) return;

        // Om klicket INTE var på input eller i boxen → rensa den
        if (
            e.target !== isbnInput &&
            !suggestionBox.contains(e.target)
        ) {
            suggestionBox.innerHTML = "";
        }
    });

    if (document.getElementById("isbn")) {
        const isbnInput = document.getElementById("isbn");
        let lastValue = "";

        isbnInput.addEventListener("input", () => {
            const value = isbnInput.value.trim();
            if (value === lastValue) return;
            lastValue = value;
            const cleanISBN = isValidISBN(value);
            if (cleanISBN) {
                onValidISBN(cleanISBN);
                findInPrimo(cleanISBN);
            } else {
                const isbnInput = document.getElementById("isbn");
                let suggestionBox = document.getElementById("suggestionBox");
                
                if (!suggestionBox) {
                    suggestionBox = document.createElement("div");
                    suggestionBox.id = "suggestionBox";
                    suggestionBox.className = "suggestions";
                    isbnInput.insertAdjacentElement("afterend", suggestionBox);
                }
                suggestionBox.innerHTML = "";
                // Gör inget om fältet är tomt
                if (isbnInput.value.trim() === "") {
                    return;
                }

                const noResultDiv = document.createElement("div");
                noResultDiv.className = "suggestion-item";
                noResultDiv.innerText = language == 'swedish' ? "Ogiltigt isbn" : "Invalid isbn"
                noResultDiv.style.fontStyle = "italic";
                suggestionBox.appendChild(noResultDiv);
                noResultDiv.addEventListener("click", () => {
                    suggestionBox.innerHTML = "";
                });
            }
        });
    }

    if (document.getElementById("doi")) {
        const doiInput = document.getElementById("doi");
        let lastValue = "";
        doiInput.addEventListener("input", () => {
            const value = doiInput.value.trim();
            if (value === lastValue) return;
            lastValue = value;
            if(isValidDOI(value)) {
                onValidDOI(value);
            } else {
                const doiInput = document.getElementById("doi");
                let suggestionBox = document.getElementById("suggestionBox");
                  
                if (!suggestionBox) {
                    suggestionBox = document.createElement("div");
                    suggestionBox.id = "suggestionBox";
                    suggestionBox.className = "suggestions";
                    doiInput.insertAdjacentElement("afterend", suggestionBox);
                }
                suggestionBox.innerHTML = "";
                if (doiInput.value.trim() === "") {
                    return;
                }
                const noResultDiv = document.createElement("div");
                noResultDiv.className = "suggestion-item";
                noResultDiv.innerText = language == 'swedish' ? "Ogiltig doi" : "Invalid doi"
                noResultDiv.style.fontStyle = "italic";
                suggestionBox.appendChild(noResultDiv);
                noResultDiv.addEventListener("click", () => {
                    suggestionBox.innerHTML = "";
                });
            }        
        });
    }

}

////////////////////////////////////////////////////
//
// Skapa modals för atta visa info
//
////////////////////////////////////////////////////
let createModals = () => {
    const primomodalHTML = `
        <div id="primoModal" class="custom-modal" role="dialog" aria-modal="true" hidden>
            <div class="custom-modal-content">
                <div class="custom-modal-header">
                <h5 class="custom-modal-title" id="primoModalTitle"></h5>
                <button id="primoModalClose" aria-label="Close">&times;</button>
                </div>
                <div class="custom-modal-body" id="primoModalBody"></div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", primomodalHTML);
    const primoModalClose = document.getElementById("primoModalClose");
    primoModalClose.addEventListener("click", closePrimoModal);
}

let escapeHtml = (text) => {
    var map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

let htmlEncode = (str) => {
    return String(str).replace(/[^\w. ]/gi, function(c){
        return '&#'+c.charCodeAt(0)+';';
    });
}

////////////////////////////////////////////////////
//
//Funktion för att skicka vidare till extern URL
//
////////////////////////////////////////////////////
let changelocation = (url) => {
    window.location.href = url + '?language=' + this.language;
}

////////////////////////////////////////////////////
//
// Hantera ändring av textfält etc
//
////////////////////////////////////////////////////
let onInputKeyUp = (event, propkey = '') => {
    formdata.formfields[event.target.name].value = escapeHtml(event.target.value)
    
    // Validera formulär(endast efter ett första försök att skicka)
    if (is_submitted_once) {
        validateform()
    }
}

////////////////////////////////////////////////////
//
// Hantera klick på checkbox
//
////////////////////////////////////////////////////
let checkboxchange = (event, propkey = '') => {
    if(document.getElementById(event.target.name).checked) {
        document.getElementById("hidden_" + event.target.name).disabled = true;
        document.getElementById(event.target.name).value = "yes";
    } else {
        document.getElementById("hidden_" + event.target.name).disabled = false;
        document.getElementById(event.target.name).value = "no";
    }

    //Spara värdet till formdata
    formdata.formfields[event.target.name].checked = event.target.checked
    if(event.target.checked) {
        formdata.formfields[event.target.name].value = "yes"    
    } else {
        formdata.formfields[event.target.name].value = "no"
    }

    // Validera formulär(endast efter ett första försök att skicka)
    if (is_submitted_once) {
        validatefield(event.target.name)
    }
}

////////////////////////////////////////////////////
//
// Hantera klick på radioval
//
////////////////////////////////////////////////////
let onchangeformobject = (domobj, key, _event) => {
    kthbformData = new FormData(kthbform);
    var validfield;
    var show;
    var optionvalidchoice;
    var enableoption;
    
    if (typeof domobj.name !== 'undefined' && domobj.name != '') {
        //Spara värdet till formdata
        formdata.formfields[domobj.name].value = domobj.value;
        //Vid klick på mainoption-fält så ska övriga optionfält rensas
        if (formdata.formfields[domobj.name].mainoption) {
            //Gå igenom och rensa alla övriga radiofält(gäller ej openurl-formulär)
            for (let key of Object.keys(formdata.formfields)) {
                if (formdata.formfields[key].type == 'radio' && !formdata.formfields[key].mainoption && !isopenurl) {
                    formdata.formfields[key].value = '';
                }
            }
        }
    }

    showhidefields()

    generateForm(formdata)

    // Validera formulär(endast efter ett första försök att skicka)
    if (is_submitted_once) {
        validateform()
    }
    
}

let showhidefields = () => {
    //Gå igenom alla formfields, visa/dölj beroende på showcriterias 
    for (let prop of Object.keys(formdata.formfields)) {
        show = false;
        if (formdata.formfields[prop].showcriteria) {
            for (let index1 of Object.keys(formdata.formfields[prop].showcriteria)) {
                let validfield = false;
                //Gå igenom alla showcritera values
                for (let index2 of Object.keys(formdata.formfields[prop].showcriteria[index1].values)) {
                    //om värdet på aktuellt fälts showcritera-fält(showcriteria.field) i formuläret finns i godkända values för aktuellt fält så ska det visas
                    if (formdata.formfields[formdata.formfields[prop].showcriteria[index1].field].value == formdata.formfields[prop].showcriteria[index1].values[index2] || formdata.formfields[prop].showcriteria[index1].values[index2] == "any") {
                        validfield = true;
                        break;
                    } else {
                        validfield = false;
                    }
                }

                //om det är ett radiofält så behöver varje alternativ kollas om det ska visas
                if (validfield) {
                    show = true;
                    if (formdata.formfields[prop].type == "radio") {
                        if (formdata.formfields[prop].options) {
                            for (let index3 of Object.keys(formdata.formfields[prop].options)) {
                                optionvalidchoice = false
                                if (formdata.formfields[prop].options[index3].showcriteria) {
                                    for (let index4 of Object.keys(formdata.formfields[prop].options[index3].showcriteria)) {
                                        enableoption = false;
                                        for (let index5 of Object.keys(formdata.formfields[prop].options[index3].showcriteria[index4].values)) {
                                            
                                            if (formdata.formfields[formdata.formfields[prop].options[index3].showcriteria[index4].field].value == formdata.formfields[prop].options[index3].showcriteria[index4].values[index5] || formdata.formfields[prop].options[index3].showcriteria[index4].values[index5] == "any") {
                                                optionvalidchoice = true;
                                                break;
                                            } else {
                                                optionvalidchoice = false;
                                            }
                                        }
                                        if (optionvalidchoice) {
                                            enableoption = true;
                                        } else {
                                            enableoption = false;
                                            break;
                                        }
                                    }
                                    if (enableoption) {
                                        formdata.formfields[prop].options[index3].enabled = true;
                                    } else {
                                        formdata.formfields[prop].options[index3].enabled = false;
                                    }
                                }
                            }
                        }
                    }
                } else {
                    show = false;
                    break;
                }
            }
            
            // Aktivera/Inaktivera och/eller visa/dölj fälten 
            let el
            if (show) {
                el = document.getElementById('parent_' + prop)
                el.classList.remove("fielddisabled")
                el.classList.add("fieldenabled")
                formdata.formfields[prop].enabled = true;
            } else {
                el = document.getElementById('parent_' + prop)
                el.classList.remove("fieldenabled")
                el.classList.add("fielddisabled")
                formdata.formfields[prop].enabled = false;

            }

            //endast fält som är "openurlenabled" ska vara synligt för användaren vid openurl-anrop
            if (isopenurl && !formdata.formfields[prop].openurlenabled) {
                formdata.formfields[prop].hidden = true;
            }

            //ett openurl-fält ska inte valideras och inte heller vara synligt för användaren
            if (isopenurl && formdata.formfields[prop].openurl) {
                if ( formdata.formfields[prop].validation ) {
                    formdata.formfields[prop].validation.required.value = false
                }
                formdata.formfields[prop].hidden = true;                
            }
            
        }
    }
}

////////////////////////////////////////////////////
//
// Hantera file inputs
//
////////////////////////////////////////////////////
let onFileChange = (event, propkey = '') => {

    //Skapa knappar med delete för varje tillagd fil
    for(var i = 0; i < event.target.files.length; i++) {
        filelist = 
        `<div>
            <button type="button" class="fileremovebtn btn btn-labeled btn-success"">
                <span id="file${i}" class="btn-label">X</span><span class="fileremovebtnname">${event.target.files.item(i).name}</span>
            </button>
        </div>`

		document.querySelector(".filelist").innerHTML += filelist;
	};

    //Lägg till fil i DT objekt
	for (let file of event.target.files) {
		dt.items.add(file);
	}

    //event.target.files = dt.files;

    const elgroup = document.querySelectorAll(".btn-label");
    elgroup.forEach(el => {
        el.addEventListener('click',function(e){
            let name = e.target.nextElementSibling.innerText;
            e.target.parentNode.remove();
            for(let i = 0; i < dt.items.length; i++) {
                if(name === dt.items[i].getAsFile().name) {
                    dt.items.remove(i);
                    continue;
                }
            }
            //document.querySelector('.fileupload input').files = dt.files;
        });
    });
}

////////////////////////////////////////////////////
//
// Validera formuläret
//
////////////////////////////////////////////////////
let validateform = () => {
    formisvalid = true;
    let fieldissvalid = false;
    //gå igenom alla fält och validera
    for (let key of Object.keys(formdata.formfields)) {
        if(formdata.formfields[key].enabled && formdata.formfields[key].validation) {
            //endast fält som är "required" ska valideras
            if(formdata.formfields[key].enabled && formdata.formfields[key].validation.required.value) {
            fieldissvalid = validatefield(key)
                if (formisvalid && !fieldissvalid) {
                    formisvalid = false;
                }
            }
        }  
    }

    //Hantera visning av felmeddelande
    let el = document.getElementById('backendresponse')
    if(formisvalid) {
        el.classList.add("fielddisabled")
    } else {
        el.classList.remove("fielddisabled")
    }

    return formisvalid;
}

////////////////////////////////////////////////////
//
// Validera fält
//
////////////////////////////////////////////////////
let validatefield = (field_id) => {
    let validfield = true
    if(formdata.formfields[field_id].ishoneypot) {
        return validfield;
    }

    //Hämta element för att visa om ett fält är felaktigt
    let el = document.getElementById('invalid_' + field_id)
    // Om fältet är required utför validering(validera även övriga fält?)
    
    let validatefield = checkifrequired(field_id);

    //if(formdata.formfields[field_id].validation.required.value) {
    if(validatefield) {
        //Fältet måste ha ett ifyllt värde
        if(formdata.formfields[field_id].value == '') {
            el.innerHTML = formdata.formfields[field_id].label[language] + ' ' + formdata.formfields[field_id].validation.required.errormessage[language]
            el.classList.remove("hideelement")
            validfield = false
        } else {
            //Värdet måste matcha ett visst mönster(exvis email, personnummer etc)
            if (formdata.formfields[field_id].validation.pattern) { 
                if (!formdata.formfields[field_id].value.match(formdata.formfields[field_id].validation.pattern.value)) {
                    el.innerHTML = formdata.formfields[field_id].validation.pattern.errormessage[language]
                    el.classList.remove("hideelement")
                    validfield = false
                }
            }
        }

    }

    //En datebox kan ha ett min- och eller maxvärde. Kontrollera om värdet är inom gränserna
    if(formdata.formfields[field_id].type == "datebox") {
        let datebox = document.getElementById(field_id)
        if (datebox.getAttribute("min") != "" && formdata.formfields[field_id].value < datebox.getAttribute("min")) {
            el.innerHTML = formdata.formfields[field_id].validation.mindate.errormessage.swedish
            el.classList.remove("hideelement")
            validfield = false
        }
        if (datebox.getAttribute("max") != "" && formdata.formfields[field_id].value > datebox.getAttribute("max")) {
            el.innerHTML = formdata.formfields[field_id].validation.maxdate.errormessage.swedish
            el.classList.remove("hideelement")
            validfield = false
        }
    }

    //Se till att dölja elementet som visar info om eventuellt felaktigt fält
    if(validfield == true) {
        el.classList.add("hideelement")
    }

    //Visa värden för debug/development
    if (environment=="development") {
        kthbformData = new FormData(kthbform)
        let html = ''
        html += `formisvalid: ${formisvalid}\n`
        for (const [key, value] of kthbformData) {
            html += `${key}: ${value}\n`;
        }
        let debugelement = document.getElementById("debuginfo")
        debugelement.classList.remove("hideelement")
        debugelement.innerHTML = `<span><pre>${html}</pre></span>`
        html = ''
        for (let key of Object.keys(formdata.formfields)) { 
            html += `${key}: ${formdata.formfields[key].value}\n`;
        }
        debugelement.innerHTML += `<span><pre>${html}</pre></span>`
    }

    return validfield;
}

let checkifrequired = (field_id) => {
    //Fältet ska bara valideras om det uppfyller criterias(fields + value ) för validation
    let validatefield = false;
    //Fältet ska alltid valideras om required = true
    if (formdata.formfields[field_id].validation.required.value) {
        validatefield = true;
    } else {
        if (formdata?.formfields?.[field_id]?.validation?.required.criteria) {
            for (let index1 of formdata.formfields[field_id].validation.required.criteria) {
                //Gå igenom alla critera values och kolla om 
                for (let index2 of index1.values) {
                    // om värdet på aktuellt fälts critera-fält(criteria.field) i formuläret finns i godkända values för aktuellt fält så är det required
                    // tex om det aktuella värdet för formulärets genre-fält är "article" och "article" är ett av värdena i critera.values så är det required
                    if (formdata.formfields[index1.field].value == index2 || index2 == "any") {
                        validatefield = true;
                        break;
                    } else {
                        validatefield = false;
                    }
                }
            }
        }
    }

    return validatefield
}

////////////////////////////////////////////////////
//
// Funktion för att skapa JSON av operurlparametrar
//
////////////////////////////////////////////////////
let openurlparametersToJSON = (formdata, openurlsource) => {	
    //Dela upp parametrar    		
    var pairs = location.search.slice(1).split('&');
    var result = {};
    pairs.forEach(function(pair) {
      pair = pair.split('=');
      // Översätt openurlparametrar som eventuellt har andra namn än standard(primo och libris)
      // så att standardnamnet alltid kan användas på övriga ställen
      for (const key in formdata.formfields) {
        if(typeof formdata.formfields[key].openurlnames !== "undefined") {
          if(formdata.formfields[key].openurlnames[openurlsource]==[pair[0]].toString()){
            pair[0] = formdata.formfields[key].openurlnames['standard'];
            break;
          }
        }
      }
      result[pair[0]] = decodeURIComponent(pair[1] || '').replace(/\+/g, ' ');
    });
    return result;
}

let submitform =  (event) => {

    event.preventDefault();

    let loaderelement = document.getElementById("loading-screen")
    loaderelement.classList.remove("hideelement")
    loaderelement.innerHTML = 
    `<div class="loading">
        <img class="loading-image" src="${formserver + formdata.loaderurl}" 
            alt="${language == 'swedish' ? formdata.loaderinfo.swedish : formdata.loaderinfo.english}" />
        <div>${language == 'swedish' ? formdata.loaderinfo.swedish : formdata.loaderinfo.english}</div>
    </div>`
    window.scroll(0,0)
    is_submitted_once = true
    //Validera alla fälten
    let isvalidform = validateform()
    if (isvalidform) {
        
        kthbformData = new FormData(kthbform);
        //Sätt källa till formuläret eller till eventuell openurl(primo, libris..)
        if(formdata.formfields['source'] && !isopenurl) {
            kthbformData.append("source", formdata.formfields['source'].value)
        } else {
            kthbformData.append("source", openurlsource)
        }

        let kthbformDataObject = {}
        
        for (let [key, value] of kthbformData) {
            kthbformDataObject[key] = value;
        }
        
        var postform = {
            "form" : {}
        };
        postform.form = kthbformDataObject;

        //Är det ett json-form eller ett upload-form?
        if(formdata.type == 'upload') {
            const mData = JSON.stringify(kthbformDataObject)
            const formData = new FormData();
            formData.append('item', mData);
            //lägg till filer som ska skickas med.
            //Validering? (storlek, antal, extension)
            for(let i = 0; i < dt.items.length; i++) {
                formData.append('localImage' + i, dt.items[i].getAsFile(), dt.items[i].getAsFile().name);
            }

            postform = formData;
        }
        //Spam check om det finns ett aktivt honeypotfält
        if(honeypotfieldname != "") {
            if (postform.form[honeypotfieldname]!= "") {
                backendresponse = true;
                backendresult = false;
                backendresulterror = "Oooops something went wrong!";
                loading = false;
                window.scroll(0,0);
                return;
            }
        }


        const xhr = new XMLHttpRequest()

        //Hantera svaret från backend
        xhr.onload = () => {
            //Konto skapat
            if (xhr.status == 200 || xhr.status == 201) {
                backendresponse = true;
                backendresult = true;
                loading = false;
                formsubmitted = false;
                let resultelement = document.getElementById("backendresponse")
                resultelement.classList.remove('alert-danger')
                resultelement.classList.remove('alert-info')
                resultelement.classList.add('alert-success')
                resultelement.classList.remove('fielddisabled')
                resultelement.innerHTML = 
                `<div class="">
                    <h4>
                        ${language == 'swedish' ? formdata.postresponseinfo.header.swedish : formdata.postresponseinfo.header.english}
                    </h4>
                    <div>
                        ${language == 'swedish' ? formdata.postresponseinfo.text.swedish : formdata.postresponseinfo.text.english}
                    </div>
                </div>`
                window.scroll(0,0);
                kthbform.reset();
                is_submitted_once = false
                const errorelements = document.querySelectorAll(".error");
                errorelements.forEach(el => {
                    el.classList.add("hideelement");
                });
                try {
                    for(let i = 0; i < dt.items.length; i++) {
                        dt.items.remove(i);
                    }
                    dt.clearData()
                } catch (err) {
                    throw err;
                }
                getformdata();
            }

            //Konto skapat men mail gick inte att skicka
            if(xhr.status == 202) {
                backendresponse = true;
                backendresult = true;
                warning = true;
                rejectedemail = JSON.parse(xhr.responseText).message;
                loading = false;
                formsubmitted = false;
                let resultelement = document.getElementById("backendresponse")
                resultelement.classList.add('alert-info')
                resultelement.classList.remove('alert-danger')
                resultelement.classList.remove('alert-success')
                resultelement.classList.remove('fielddisabled')
                resultelement.innerHTML = 
                `<div class="">
                    <h4>
                        ${language == 'swedish' ? formdata.postresponseinfo.header.swedish : formdata.postresponseinfo.header.english}
                    </h4>
                    <div>
                        ${language == 'swedish' ? formdata.postresponseinfo.text.swedish : formdata.postresponseinfo.text.english}
                    </div>
                    <h4>
                        Obs!
                    </h4>
                    <div>
                        ${language == 'swedish' ? 'Det gick inte att skicka ett bekräftelsemail' : 'It was not possible to send a confirmation email' + rejectedemail}
                    </div>
                </div>`
                window.scroll(0,0);
                kthbform.reset();
                is_submitted_once = false
                const errorelements = document.querySelectorAll(".error");
                errorelements.forEach(el => {
                    el.classList.add("hideelement");
                });
                getformdata();
            }

            //Hantera fel, fält saknas, inte json etc...
            if(xhr.status == 422 || xhr.status == 400) {
                backendresponse = true;
                backendresult = false;
                backendresulterror = JSON.parse(xhr.responseText).message;
                loading = false;
                let resultelement = document.getElementById("backendresponse")
                resultelement.classList.add('alert-danger')
                resultelement.classList.remove('alert-success')
                resultelement.classList.remove('alert-info')
                resultelement.classList.remove('fielddisabled')
                resultelement.innerHTML = 
                `<div class="">
                    <h4>
                        ${language == 'swedish' ? formdata.posterrorresponseinfo.header.swedish : formdata.posterrorresponseinfo.header.english}
                    </h4>
                    <div>
                        ${language == 'swedish' ? formdata.posterrorresponseinfo.text.swedish : formdata.posterrorresponseinfo.text.english}
                    </div>
                    ${backendresulterror}
                </div>`
                window.scroll(0,0);
            }

            if(xhr.status == 413) {
                backendresponse = true;
                backendresult = false;
                backendresulterror = JSON.parse(xhr.responseText).error;
                loading = false;
                let resultelement = document.getElementById("backendresponse")
                resultelement.classList.add('alert-danger')
                resultelement.classList.remove('alert-success')
                resultelement.classList.remove('alert-info')
                resultelement.classList.remove('fielddisabled')
                resultelement.innerHTML = 
                `<div class="">
                    <h4>
                        ${language == 'swedish' ? 'Fel' : 'Error'}
                    </h4>
                    <div>
                        ${backendresulterror}
                    </div>
                    
                </div>`
                window.scroll(0,0);
            }

            let loaderelement = document.getElementById("loading-screen")
            loaderelement.classList.add("hideelement")
            loaderelement.innerHTML = ""
        }

        //Hantera fel(backend inte tillgänglig etc)
        xhr.onerror = function() {
            let loaderelement = document.getElementById("loading-screen")
            loaderelement.classList.add("hideelement")
            loaderelement.innerHTML = ""
        };
        xhr.open('POST', formserver + formdata.posturl + "?language=" + language + '&emailtoaddressedge=' + emailtoaddressedge)
        
        if(formdata.type == 'upload') {
            //xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xhr.send(postform)
        } else {
            xhr.setRequestHeader('Content-Type', 'application/json')
            xhr.send(JSON.stringify(postform))
        }
    } else {
        let loaderelement = document.getElementById("loading-screen")
        loaderelement.classList.add("hideelement")
        loaderelement.innerHTML = ""
        let resultelement = document.getElementById("backendresponse")
        resultelement.classList.add('alert-danger')
        resultelement.classList.remove('alert-success')
        resultelement.classList.remove('alert-info')
        resultelement.classList.remove('fielddisabled')
        resultelement.innerHTML = 
        `<div class="">
            <h4>
                ${language == 'swedish' ? formdata.invalidforminfo.header.swedish : formdata.invalidforminfo.header.english}
            </h4>
            <div>
                ${language == 'swedish' ? formdata.invalidforminfo.text.swedish : formdata.invalidforminfo.text.english}
            </div>
        </div>`
        window.scroll(0,0)
    }
    return false;
}

////////////////////////////////////////////////////
//
// Funktion för att validera ISBN (format)
//
////////////////////////////////////////////////////
function isValidISBN(isbn) {
  const cleaned = isbn.replace(/[\s-]/g, '');

  // ISBN-10: 9 siffror + 1 siffra eller X
  if (/^\d{9}[\dX]$/i.test(cleaned)) return cleaned;

  // ISBN-13: 13 siffror
  if (/^\d{13}$/.test(cleaned)) return cleaned;

  return false;
}

////////////////////////////////////////////////////
//
// Funktion för att validera DOI (format)
//
////////////////////////////////////////////////////
function isValidDOI(doi) {
  const cleaned = doi.replace(/\s+/g, '');

  if (/^10.[1-9]\d{3}\d*(\.\d+)*\/.?/.test(cleaned)) return cleaned;

  return false;
}

////////////////////////////////////////////////////
//
// Funktion som triggas när ett giltigt DOI fyllts i
//
////////////////////////////////////////////////////
function onValidDOI(doi) {
  const doiInput = document.getElementById("doi");
  let suggestionBox = document.getElementById("suggestionBox");

  if (!suggestionBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.id = "suggestionBox";
    suggestionBox.className = "suggestions";
    doiInput.insertAdjacentElement("afterend", suggestionBox);
  }

  suggestionBox.innerHTML = "";
  
  //fetch(`${formserver}/formtools/api/v1/searchdoi/${doi}`)
  fetch(`${formserver}/formtools/api/v1/searchdoi?doi=${doi}`)
    .then(async res => {
      if (!res.ok) {
        const errorText = await res.text();
        const error = new Error(errorText || language == 'swedish' ? "Artikel hittades inte" : "Article not found");
        error.status = res.status;
        return null;
      }
      return res.json();
    })
    .then(data => {

        if (data.status === "ok") {
            const results = Array.isArray(data.results) ? data.results : [data];
            results.forEach(item => {
                const div = document.createElement("div");
                div.className = "suggestion-item";
                div.innerText = `${item.articletitle ?? (language == 'swedish' ? "Okänd titel" : "Unknown title")}`;

                div.addEventListener("click", () => {
                populateArticleFields(item);
                suggestionBox.innerHTML = "";
                });
                suggestionBox.appendChild(div);
            });
        } else {
            const results = Array.isArray(data.results) ? data.results : [data];
            if (!results.length) {
                suggestionBox.innerHTML = "<div class='suggestion-item'>" + language == 'swedish' ? "Inga träffar" : "No result" + "</div>";
                return;
            }

            if (results.length) {
                const noResultDiv = document.createElement("div");
                noResultDiv.className = "suggestion-item";
                noResultDiv.innerText = language == 'swedish' ? "Ingen artikel hittades för: " + doi : "No article found for: " + doi;
                noResultDiv.style.fontStyle = "italic";
                suggestionBox.appendChild(noResultDiv);
                noResultDiv.addEventListener("click", () => {
                    setValueAndTrigger(document.getElementById("atitle"), "");
                    setValueAndTrigger(document.getElementById("jtitle"), "");
                    setValueAndTrigger(document.getElementById("au"), "");
                    setValueAndTrigger(document.getElementById("year"), "");
                    setValueAndTrigger(document.getElementById("pages"), "");
                    setValueAndTrigger(document.getElementById("issn"), "");
                    setValueAndTrigger(document.getElementById("volume"), "");
                    setValueAndTrigger(document.getElementById("issue"), "");
                    suggestionBox.innerHTML = "";
                });
                return;
            }
        }
    })
    .catch(err => {
        suggestionBox.innerHTML = "";
        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.style.fontStyle = "italic";

        div.innerText = language == 'swedish' ? "Fel vid hämtning " : "Error fetching data: ";
        console.warn("Fel vid hämtning:", err.message);
        suggestionBox.appendChild(div);
    });
}

////////////////////////////////////////////////////
//
// Hjälpfunktion för att fylla i formuläret
//
////////////////////////////////////////////////////
function populateArticleFields(data) {
    const atitle = data?.articletitle || "";
    const jtitle = data?.journaltitle || "";
    const authors = Array.isArray(data?.authors)
        ? data.authors
            .map(a => [a.given, a.family].filter(Boolean).join(" "))
            .join("; ")
        : (typeof data?.authors === "string" ? data.authors : "");
    let year = "";
    const publishedDate = data?.publishedDate;
    if (publishedDate?.length > 0) {
        const dateParts = publishedDate[0]; // ta första arrayen
        const y = dateParts[0];
        const m = dateParts[1] ?? 1;       // default till januari
        const d = dateParts[2] ?? 1;       // default till dag 1

        const month = String(m).padStart(2, "0");
        const day = String(d).padStart(2, "0");

        year = `${y}`;
    }

    const pages = data?.pages || "";
    const issn = data?.issn || "";
    const volume = data?.volume || "";
    const issue = data?.issue || "";

    setValueAndTrigger(document.getElementById("atitle"), atitle);
    setValueAndTrigger(document.getElementById("jtitle"), jtitle);
    setValueAndTrigger(document.getElementById("au"), authors);
    setValueAndTrigger(document.getElementById("year"), year);
    setValueAndTrigger(document.getElementById("pages"), pages);
    setValueAndTrigger(document.getElementById("issn"), issn);
    setValueAndTrigger(document.getElementById("volume"), volume);
    setValueAndTrigger(document.getElementById("issue"), issue);
}

////////////////////////////////////////////////////
//
// Funktion som triggas när ett giltigt ISBN fyllts i
//
////////////////////////////////////////////////////
function onValidISBN(isbn) {
  const isbnInput = document.getElementById("isbn");
  let suggestionBox = document.getElementById("suggestionBox");

  if (!suggestionBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.id = "suggestionBox";
    suggestionBox.className = "suggestions";
    isbnInput.insertAdjacentElement("afterend", suggestionBox);
  }

  suggestionBox.innerHTML = "";
  
  fetch(`${formserver}/formtools/api/v1/searchisbn/${isbn}`)
    .then(async res => {
      if (!res.ok) {
        const errorText = await res.text();
        const error = new Error(errorText || language == 'swedish' ? "Bok hittades inte" : "Book not found");
        error.status = res.status;
        return null
      }
      return res.json();
    })
    .then(data => {
        if (data.status === "ok") {
            const results = Array.isArray(data.results) ? data.results : [data];

            results.forEach(item => {
                const div = document.createElement("div");
                div.className = "suggestion-item";
                div.innerText = `${item.title ?? (language == 'swedish' ? "Okänd titel" : "Unknown title")} – ${Array.isArray(item.authors) ? item.authors.join(", ") : (item.authors ?? "okänd författare")}`;

                div.addEventListener("click", () => {
                populateBookFields(item);
                suggestionBox.innerHTML = "";
                });
                suggestionBox.appendChild(div);
            });
        } else {
            const results = Array.isArray(data.results) ? data.results : [data];
            if (!results.length) {
                suggestionBox.innerHTML = "<div class='suggestion-item'>" + language == 'swedish' ? "Inga träffar" : "No result" + "</div>";
                return;
            }

            if (results.length) {
                const noResultDiv = document.createElement("div");
                noResultDiv.className = "suggestion-item";
                noResultDiv.innerText = language == 'swedish' ? "Ingen bok hittades för: " + isbn : "No book found for: " + isbn;
                noResultDiv.style.fontStyle = "italic";
                suggestionBox.appendChild(noResultDiv);
                noResultDiv.addEventListener("click", () => {
                    setValueAndTrigger(document.getElementById("btitle"), "");
                    setValueAndTrigger(document.getElementById("au"), "");
                    setValueAndTrigger(document.getElementById("publisher"), "");
                    setValueAndTrigger(document.getElementById("year"), "");
                    suggestionBox.innerHTML = "";
                });
                return;
            }
        }
            
    })
    .catch(err => {
        suggestionBox.innerHTML = "";
        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.style.fontStyle = "italic";
        div.innerText = language == 'swedish' ? "Fel vid hämtning " : "Error fetching data: ";
        console.warn("Fel vid hämtning:", err.message);
        suggestionBox.appendChild(div);
    });
}

////////////////////////////////////////////////////
//
// Hjälpfunktion för att fylla i formuläret
//
////////////////////////////////////////////////////
function populateBookFields(data) {
    const title = data?.title || "";
    const authors = Array.isArray(data?.authors)
        ? data.authors.join(", ")
        : (typeof data?.authors === "string" ? data.authors : "");
    const publisher = data?.publisher || "";
    const publishedDate = data?.publishedDate;
    let year = "";

    if (publishedDate) {
        const text = Array.isArray(publishedDate)
            ? publishedDate.join(",")
            : String(publishedDate);

        const match = text.match(/\d{4}/); // första årtal
        year = match ? match[0] : "";
    }

    setValueAndTrigger(document.getElementById("btitle"), title);
    setValueAndTrigger(document.getElementById("au"), authors);
    setValueAndTrigger(document.getElementById("publisher"), publisher);
    setValueAndTrigger(document.getElementById("year"), year);
}

////////////////////////////////////////////////////
//
// Funktion som triggas när ett giltigt ISBN fyllts i
//
////////////////////////////////////////////////////
function findInPrimo(isbn, title, author) {
  const isbnInput = document.getElementById("isbn");
  let suggestionBox = document.getElementById("suggestionBox");

  if (!suggestionBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.id = "suggestionBox";
    suggestionBox.className = "suggestions";
    isbnInput.insertAdjacentElement("afterend", suggestionBox);
  }

  suggestionBox.innerHTML = "";
  
  fetch(`${formserver}/formtools/api/v1/searchprimo/${isbn}`)
    .then(async res => {
      if (!res.ok) {
        const errorText = await res.text();
        const error = new Error(errorText || language == 'swedish' ? "Bok hittades inte" : "Book not found");
        error.status = res.status;
        return null;
      }
      return res.json();
    })
    .then(data => {
        if (data.status === "ok") {
            const results = Array.isArray(data.results) ? data.results : [data];
            const item = results[0];
        
            const title = item.title ?? (language == 'swedish' ? "Okänd titel" : "Unknown title");

            const titleText =
            language === 'swedish'
                ? "Vi hittade den här boken i bibliotekets söktjänst (Primo)"
                : "We found this title in the library search tool (Primo)";

            showPrimoModal(titleText, item.title, item.primourl);
        } else {
            if (!results.length) {
                return;
            }
        }
    })
    .catch(err => {
    });
}

function showPrimoModal(titleText, linkText, linkUrl) {
    const primoModal = document.getElementById("primoModal");
    const primoModalTitle = document.getElementById("primoModalTitle");
    const primoModalBody = document.getElementById("primoModalBody");
    primoModalTitle.textContent = titleText;
    primoModalBody.innerHTML = `<a href="${linkUrl}" class="break-link" target="_blank">${linkText}</a>`;
    primoModal.removeAttribute("hidden");
    primoModal.focus();
}

function closePrimoModal() {
    const primoModal = document.getElementById("primoModal");
    primoModal.setAttribute("hidden", "");
}

function setValueAndTrigger(el, value) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

////////////////////////////////////////////////////
//
// Main
//
////////////////////////////////////////////////////
language = urlParams.get('language')  || "english"

//Polopoly language
const langAttr = document.documentElement.getAttribute('lang');

if (langAttr?.includes('en')) {
  language = 'english';
} else if (langAttr) {
  language = 'swedish';
}


createModals()
getformdata()

