'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const APP_URL = process.env.APP_URL;

//new text

// Imports dependencies and set up http server
const 
  { uuid } = require('uuidv4'),
  {format} = require('util'),
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  firebase = require("firebase-admin"),
  ejs = require("ejs"),  
  fs = require('fs'),
  multer  = require('multer'),  
  app = express(); 

const uuidv4 = uuid();


app.use(body_parser.json());
app.use(body_parser.urlencoded());

const bot_questions = {
  "q1": "please enter date (yyyy-mm-dd)",
  "q2": "please enter time (hh:mm)",
  "q3": "please enter full name",
  "q4": "please enter gender",
  "q5": "please enter phone number",
  "q6": "please enter email",
  "q7": "please leave a message"
}

let current_question = '';

let user_id = ''; 

let userInputs = [];


/*
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
})*/

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits :{
    fileSize: 50 * 1024 * 1024  //no larger than 5mb
  }

});

// parse application/x-www-form-urlencoded


app.set('view engine', 'ejs');
app.set('views', __dirname+'/views');


var firebaseConfig = {
     credential: firebase.credential.cert({
    "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    "client_email": process.env.FIREBASE_CLIENT_EMAIL,
    "project_id": process.env.FIREBASE_PROJECT_ID,    
    }),
    databaseURL: process.env.FIREBASE_DB_URL,   
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  };



firebase.initializeApp(firebaseConfig);

let db = firebase.firestore(); 
let bucket = firebase.storage().bucket();

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {  

  // Parse the request body from the POST
  let body = req.body;

  

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {
    body.entry.forEach(function(entry) {

      let webhook_event = entry.messaging[0];
      let sender_psid = webhook_event.sender.id; 

      user_id = sender_psid; 

      if(!userInputs[user_id]){
        userInputs[user_id] = {};
      }    


      if (webhook_event.message) {
        if(webhook_event.message.quick_reply){
            handleQuickReply(sender_psid, webhook_event.message.quick_reply.payload);
          }else{
            handleMessage(sender_psid, webhook_event.message);                       
          }                
      } else if (webhook_event.postback) {        
        handlePostback(sender_psid, webhook_event.postback);
      }
      
    });
    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});


app.use('/uploads', express.static('uploads'));


app.get('/',function(req,res){    
    res.send('your app is up and running');
});

app.get('/test',function(req,res){    
    res.render('test.ejs');
});

app.post('/test',function(req,res){
    const sender_psid = req.body.sender_id;     
    let response = {"text": "You  click delete button"};
    callSend(sender_psid, response);
});

/*app.get('/admin/register', async function(req,res){
 
  const registerRef = db.collection('register');
  const snapshot = await registerRef.get();

  if (snapshot.empty) {
    res.send('no data');
  } 

  let data = []; 

  snapshot.forEach(doc => {
    let register = {};
    register = doc.data();
    register.doc_id = doc.id;

    data.push(register);
    
  });

  console.log('DATA:', data);

  res.render('register.ejs', {data:data});
  
});

/*app.get('/admin/updateregister/:doc_id', async function(req,res){
  let doc_id = req.params.doc_id; 
  
  const registerRef = db.collection('register').doc(doc_id);
  const doc = await registerRef.get();
  if (!doc.exists) {
    console.log('No such document!');
  } else {
    console.log('Document data:', doc.data());
    let data = doc.data();
    data.doc_id = doc.id;

    console.log('Document data:', data);
    res.render('editappointment.ejs', {data:data});
  } 

});


app.post('/admin/updateappointment', function(req,res){
  console.log('REQ:', req.body); 

  

  let data = {
    name:req.body.name,
    phone:req.body.phone,
    email:req.body.email,
    gender:req.body.gender,
    doctor:req.body.doctor,
    department:req.body.department,
    visit:req.body.visit,
    date:req.body.date,
    time:req.body.time,
    message:req.body.message,
    status:req.body.status,
    doc_id:req.body.doc_id,
    ref:req.body.ref,
    comment:req.body.comment
  }

  db.collection('appointments').doc(req.body.doc_id)
  .update(data).then(()=>{
      res.redirect('/admin/appointments');
  }).catch((err)=>console.log('ERROR:', error)); 
 
});*/

/*********************************************
Gallery page
**********************************************/
app.get('/showimages/:sender_id/',function(req,res){
    const sender_id = req.params.sender_id;

    let data = [];

    db.collection("images").limit(20).get()
    .then(  function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
            let img = {};
            img.id = doc.id;
            img.url = doc.data().url;         

            data.push(img);                      

        });
        console.log("DATA", data);
        res.render('gallery.ejs',{data:data, sender_id:sender_id, 'page-title':'welcome to my page'}); 

    }
    
    )
    .catch(function(error) {
        console.log("Error getting documents: ", error);
    });    
});


app.post('/imagepick',function(req,res){
      
  const sender_id = req.body.sender_id;
  const doc_id = req.body.doc_id;

  console.log('DOC ID:', doc_id); 

  db.collection('images').doc(doc_id).get()
  .then(doc => {
    if (!doc.exists) {
      console.log('No such document!');
    } else {
      const image_url = doc.data().url;

      console.log('IMG URL:', image_url);

      let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the image you like?",
            "image_url":image_url,                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Yes!",
                  "payload": "yes",
                },
                {
                  "type": "postback",
                  "title": "No!",
                  "payload": "no",
                }
              ],
          }]
        }
      }
    }

  
    callSend(sender_id, response); 
    }
  })
  .catch(err => {
    console.log('Error getting document', err);
  });
      
});



/*********************************************
END Gallery Page
**********************************************/

//webview test
app.get('/register/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('register.ejs',{title:"Register", sender_id:sender_id});
});





app.post('/register',function(req,res){
       
      let name  = req.body.name;
      let email = req.body.email;
      let phone = req.body.phone;
      let sender = req.body.sender;  
      data.ref =generateRandom(6);
      console.log("AA");
      db.collection('register').add({
      name: name,
      email: email,
      phone: phone
    }).then(success => {   
          console.log("DATA SAVED");
    let text = "Thank you for your register"+ "\u000A";
    text += "Your register reference number is:" + data.ref;
    let response = {"text": text};
    callSend(sender_psid, response);
      }).catch(error => {
          console.log(error);
      }); 
     
           
});


app.get('/webview/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('webview.ejs',{title:"Hello!! from WebView", sender_id:sender_id});
});

app.post('/webview',upload.single('file'),function(req,res){
       
      let name  = req.body.name;
      let email = req.body.email;
      let img_url = "";
      let sender = req.body.sender;  

      console.log("REQ FILE:",req.file);



      let file = req.file;
      if (file) {
        uploadImageToStorage(file).then((img_url) => {
            db.collection('webview').add({
              name: name,
              email: email,
              image: img_url
              }).then(success => {   
                console.log("DATA SAVED")
                thankyouReply(sender, name, img_url);    
              }).catch(error => {
                console.log(error);
              }); 
        }).catch((error) => {
          console.error(error);
        });
      }



     
      
      
           
});

//Set up Get Started Button. To run one time
//eg https://fbstarter.herokuapp.com/setgsbutton
app.get('/setgsbutton',function(req,res){
    setupGetStartedButton(res);    
});

//Set up Persistent Menu. To run one time
//eg https://fbstarter.herokuapp.com/setpersistentmenu
app.get('/setpersistentmenu',function(req,res){
    setupPersistentMenu(res);    
});

//Remove Get Started and Persistent Menu. To run one time
//eg https://fbstarter.herokuapp.com/clear
app.get('/clear',function(req,res){    
    removePersistentMenu(res);
});

//whitelist domains
//eg https://fbstarter.herokuapp.com/whitelists
app.get('/whitelists',function(req,res){    
    whitelistDomains(res);
});


// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {
  

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;  

  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];  
    
  // Check token and mode
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);    
    } else {      
      res.sendStatus(403);      
    }
  }
});

/**********************************************
Function to Handle when user send quick reply message
***********************************************/

function handleQuickReply(sender_psid, received_message) {

  console.log('QUICK REPLY', received_message);

  received_message = received_message.toLowerCase();

  if(received_message.startsWith("visit:")){
    let visit = received_message.slice(6);
    
    userInputs[user_id].visit = visit;
    
    current_question = 'q1';
    botQuestions(current_question, sender_psid);
  }else{

      switch(received_message) {  
      case "seaman":
            showtype(sender_psid);
          break;              
        case "training center":
            register(sender_psid);
          break;
          case "agent":
            register(sender_psid);
          break;
        case "off":
            showQuickReplyOff(sender_psid);
          break; 
        case "confirm-appointment":
              saveAppointment(userInputs[user_id], sender_psid);
          break;              
        default:
            defaultReply(sender_psid);
    } 

  }
  
  
 
}

/**********************************************
Function to Handle when user send text message
***********************************************/

const handleMessage = (sender_psid, received_message) => {

  console.log('TEXT REPLY', received_message);
  //let message;
  let response;

  if(received_message.attachments){
     handleAttachments(sender_psid, received_message.attachments);
  }else if(current_question == 'q1'){
     console.log('DATE ENTERED',received_message.text);
     userInputs[user_id].date = received_message.text;
     current_question = 'q2';
     botQuestions(current_question, sender_psid);
  }else if(current_question == 'q2'){
     console.log('TIME ENTERED',received_message.text);
     userInputs[user_id].time = received_message.text;
     current_question = 'q3';
     botQuestions(current_question, sender_psid);
  }else if(current_question == 'q3'){
     console.log('FULL NAME ENTERED',received_message.text);
     userInputs[user_id].name = received_message.text;
     current_question = 'q4';
     botQuestions(current_question, sender_psid);
  }else if(current_question == 'q4'){
     console.log('GENDER ENTERED',received_message.text);
     userInputs[user_id].gender = received_message.text;
     current_question = 'q5';
     botQuestions(current_question, sender_psid);
  }else if(current_question == 'q5'){
     console.log('PHONE NUMBER ENTERED',received_message.text);
     userInputs[user_id].phone = received_message.text;
     current_question = 'q6';
     botQuestions(current_question, sender_psid);
  }else if(current_question == 'q6'){
     console.log('EMAIL ENTERED',received_message.text);
     userInputs[user_id].email = received_message.text;
     current_question = 'q7';
     botQuestions(current_question, sender_psid);
  }else if(current_question == 'q7'){
     console.log('MESSAGE ENTERED',received_message.text);
     userInputs[user_id].message = received_message.text;
     current_question = '';
     
     confirmAppointment(sender_psid);
  }
  else {
      
      let user_message = received_message.text;      
     
      user_message = user_message.toLowerCase(); 

      switch(user_message) { 
      case "Get start":
          hiReply(sender_psid);
        break;
      case "choose":
        choose(sender_psid);
        break;                
      case "text":
        textReply(sender_psid);
        break;
      case "quick":
        quickReply(sender_psid);
        break;
      case "button":                  
        buttonReply(sender_psid);
        break;
      case "webview":
        webviewTest(sender_psid);
        break;       
      case "show images":
        showImages(sender_psid)
        break;               
      default:
          defaultReply(sender_psid);
      }       
          
      
    }

}

/*********************************************
Function to handle when user send attachment
**********************************************/


const handleAttachments = (sender_psid, attachments) => {
  
  console.log('ATTACHMENT', attachments);


  let response; 
  let attachment_url = attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the right picture?",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes-attachment",
              },
              {
                "type": "postback",
                "title": "No!",
                "payload": "no-attachment",
              }
            ],
          }]
        }
      }
    }
    callSend(sender_psid, response);
}


/*********************************************
Function to handle when user click button
**********************************************/
const handlePostback = (sender_psid, received_postback) => { 

  

  let payload = received_postback.payload;

  console.log('BUTTON PAYLOAD', payload);

  
  if(payload.startsWith("Doctor:")){
    let doctor_name = payload.slice(7);
    console.log('SELECTED DOCTOR IS: ', doctor_name);
    userInputs[user_id].doctor = doctor_name;
    console.log('TEST', userInputs);
    firstOrFollowUp(sender_psid);
  }else if 
    (payload.startsWith("courses:")){
    let courses_name = payload.slice(8);
    console.log('SELECTED COURSES IS: ', courses_name);
    userInputs[user_id].courses = courses_name;
    console.log('TEST', userInputs);
    firstOrFollowUp(sender_psid);
  } else{

      switch(payload) {        
      case "Type:Find courses":
          courses(sender_psid);
        break; 
      case "Lists:STCW":
          STCW(sender_psid);
        break;                      
      default:
          defaultReply(sender_psid);
    } 

  }

}
  



const generateRandom = (length) => {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

/*********************************************
GALLERY SAMPLE
**********************************************/

const showImages = (sender_psid) => {
  let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "show images",                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "enter",
                "url":"https://fbstarter.herokuapp.com/showimages/"+sender_psid,
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }
  callSendAPI(sender_psid, response);
}


/*********************************************
END GALLERY SAMPLE
**********************************************/


function webviewTest(sender_psid){
  let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Click to open webview?",                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "webview",
                "url":APP_URL+"webview/"+sender_psid,
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }
  callSendAPI(sender_psid, response);
}

/**************
start hospital
**************/
const choose = (sender_psid) => {
   let response1 = {"text": "Welcome. Have a nice day."};
   let response2 = {
    "text": "Please select one",
    "quick_replies":[
            {
              "content_type":"text",
              "title":"Seaman",
              "payload":"seaman",              
            },{
              "content_type":"text",
              "title":"Training center",
              "payload":"training center",             
            },{
              "content_type":"text",
              "title":"Agent",
              "payload":"agent",
            }

    ]
  };

  callSend(sender_psid, response1).then(()=>{
    return callSend(sender_psid, response2);
  });
}


const showtype = (sender_psid) => {
    let response1 = {"text": "Hello, Welcome to our bot. You can choose from the following."};
    let response2 = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "You can find courses and training centers",
            "image_url":"https://cdn01.alison-static.net/courses/1703/alison_courseware_intro_1703.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Find courses and training centers",
                  "payload": "Type:Find courses",
                },               
              ],
          },{
            "title": "You can Find Jobs",
            "image_url":"https://image.winudf.com/v2/image/Y29tLnN3YXBuaWxqYW1iaGFsZTE5LkZpbmRfam9iX3NjcmVlbl83XzE1MjM1ODUyMDBfMDM4/screen-7.jpg?fakeurl=1&type=.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Find jobs",
                  "payload": "Type:Find jobs", 
                },               
              ],
          },{
            "title": "You can give review and rate",
            "image_url":"https://s3.amazonaws.com/blog4.0/blog/wp-content/uploads/Feature-image-5-positive-Review-Examples-1-1140x634.png",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Give review and rate",
                  "payload": "Type:review",
                },               
              ],
          }

          ]
        }
      }
    }
  
 callSend(sender_psid, response1).then(()=>{
    return callSend(sender_psid, response2);
  });
}


const courses = (sender_psid) => {
    let response1 = {"text": "The following are course Types."};
    let response2 = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "STCW Certificates",
            "subtitle": "STCW stands for 'Standards of Training, Certification and Watchkeeping'.",
            "image_url":"https://clydetrainingsolutions.com//wp-content/uploads/2020/06/STCW-Icon-Blue.png",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "View Lists",
                  "payload": "Lists:STCW",
                },               
              ],
          },{
            "title": "Offshore Certificates",
              "subtitle": "The Certificate in Offshore Field Development teaches the process of offshore oil and gas productiong.",
            "image_url":"https://previews.123rf.com/images/alexutemov/alexutemov1604/alexutemov160400820/54707175-sea-oil-rig-platform-symbol-and-oil-drill-rig-in-sea-flat-vector-sea-oil-rig-offshore-platform-techn.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "View Lists",
                 
                  "payload": "Lists:Offshore", 
                },               
              ],
          },

          ]
        }
      }
    }
  
 callSend(sender_psid, response1).then(()=>{
    return callSend(sender_psid, response2);
  });
}


const STCW = (sender_psid) => {
    let response1 = {"text": "The following are course lists."};
    let response2 = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Basic Safety Training",
            "image_url":"https://www.pinclipart.com/picdir/middle/137-1375478_machine-safety-training-health-and-safety-icons-free.png",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Course details",
                  "payload": "courses:BST",
                },               
              ],
          },{
            "title": "Survival Craft & Rescue Boat",
             
            "image_url":"https://image.shutterstock.com/image-vector/moving-rescue-boat-deep-sea-260nw-369697766.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Course details",
                 
                  "payload": "courses:SCRB", 
                },               
              ],
          },{
            "title": "Advanced Fire Fighting",
            "image_url":"https://www.pngkey.com/png/detail/200-2003225_fire-extinguisher-symbol-png-fire-extinguisher-point-sign.png",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Course details",
                 
                  "payload": "courses:AFF", 
                },               
              ],
          },{
            "title": "Medical First Aid",
             
            "image_url":"https://st3.depositphotos.com/4326917/12569/v/950/depositphotos_125690588-stock-illustration-medical-first-aid-box-sign.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Course details",
                 
                  "payload": "courses:MFA", 
                },               
              ],
          },{
            "title": "Ship Security Officer",
             
            "image_url":"https://png.pngtree.com/png-vector/20190306/ourlarge/pngtree-security-character-icon-png-image_780271.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Course details",
                 
                  "payload": "courses:SSO", 
                },               
              ],
          },{
            "title": "Security Training (STCW 2010)",
             
            "image_url":"https://sqemarine.com/wp-content/uploads/2018/06/Ship-Safety-Officer.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Course details",
                 
                  "payload": "courses:ST", 
                },               
              ],
          },{
            "title": "Security with Designated Duties",
             
            "image_url":"https://assets.iqpc.com/UploadedFiles/EventPage/28170.002/images/icon-3.png",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Course details",
                 
                  "payload": "courses:SWDD", 
                },               
              ],
          },


          ]
        }
      }
    }
  
 callSend(sender_psid, response1).then(()=>{
    return callSend(sender_psid, response2);
  });
}

const register = (sender_psid) => {
    let response1 = {"text": "Hello. Please choose one."};
    let response2 = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title":"If you have not yet registered, register.",
                  
            "buttons": [                
                  {
                "type": "web_url",
                "title": "Register",
                "url":APP_URL+"register/"+sender_psid,
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              
                },    
                {
                  "type": "postback",
                  "title": "Already registered",
                  
                  "payload": "signup",
                },           
              ],
          }

          ]
        }
      }
    }
     callSend(sender_psid, response1).then(()=>{
        return callSend(sender_psid, response2)
      });
}

/*const register = (sender_psid) => {
   let response1 = {"text": "Welcome. Have a nice day"};
    let response2 = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Rigister or Not register",                      
            "buttons": [
                {
                  "type": "web_url",
                  "title": "Register",
                  "url":APP_URL+"register/"+sender_psid,
                  "webview_height_ratio": "full",
                 "messenger_extensions": true,  
                },{
                  "type": "postback",
                  "title": "Already registerd",
                  "url":APP_URL+"register/"+sender_psid,
                  "webview_height_ratio": "full",
                 "messenger_extensions": true,  
                },                  
              ],
          }
          ]
        }
      }
    }


  callSend(sender_psid, response1).then(()=>{
    return callSend(sender_psid, response2);
  });
}*/



const firstOrFollowUp = (sender_psid) => {

  let response = {
    "text": "First Time Visit or Follow Up",
    "quick_replies":[
            {
              "content_type":"text",
              "title":"First Time",
              "payload":"visit:first time",              
            },{
              "content_type":"text",
              "title":"Follow Up",
              "payload":"visit:follow up",             
            }
    ]
  };
  callSend(sender_psid, response);

}

const botQuestions = (current_question, sender_psid) => {
  if(current_question == 'q1'){
    let response = {"text": bot_questions.q1};
    callSend(sender_psid, response);
  }else if(current_question == 'q2'){
    let response = {"text": bot_questions.q2};
    callSend(sender_psid, response);
  }else if(current_question == 'q3'){
    let response = {"text": bot_questions.q3};
    callSend(sender_psid, response);
  }else if(current_question == 'q4'){
    let response = {"text": bot_questions.q4};
    callSend(sender_psid, response);
  }else if(current_question == 'q5'){
    let response = {"text": bot_questions.q5};
    callSend(sender_psid, response);
  }else if(current_question == 'q6'){
    let response = {"text": bot_questions.q6};
    callSend(sender_psid, response);
  }else if(current_question == 'q7'){
    let response = {"text": bot_questions.q7};
    callSend(sender_psid, response);
  }
}

const confirmAppointment = (sender_psid) => {
  console.log('APPOINTMENT INFO', userInputs);
  let summery = "department:" + userInputs[user_id].department + "\u000A";
  summery += "doctor:" + userInputs[user_id].doctor + "\u000A";
  summery += "visit:" + userInputs[user_id].visit + "\u000A";
  summery += "date:" + userInputs[user_id].date + "\u000A";
  summery += "time:" + userInputs[user_id].time + "\u000A";
  summery += "name:" + userInputs[user_id].name + "\u000A";
  summery += "gender:" + userInputs[user_id].gender + "\u000A";
  summery += "phone:" + userInputs[user_id].phone + "\u000A";
  summery += "email:" + userInputs[user_id].email + "\u000A";
  summery += "message:" + userInputs[user_id].message + "\u000A";

  let response1 = {"text": summery};

  let response2 = {
    "text": "Select your reply",
    "quick_replies":[
            {
              "content_type":"text",
              "title":"Confirm",
              "payload":"confirm-appointment",              
            },{
              "content_type":"text",
              "title":"Cancel",
              "payload":"off",             
            }
    ]
  };
  
  callSend(sender_psid, response1).then(()=>{
    return callSend(sender_psid, response2);
  });
}

const saveAppointment = (arg, sender_psid) => {
  let data = arg;
  data.ref = generateRandom(6);
  data.status = "pending";
  db.collection('appointments').add(data).then((success)=>{
    console.log('SAVED', success);
    let text = "Thank you. We have received your appointment."+ "\u000A";
    text += " We wil call you to confirm soon"+ "\u000A";
    text += "Your booking reference number is:" + data.ref;
    let response = {"text": text};
    callSend(sender_psid, response);
  }).catch((err)=>{
     console.log('Error', err);
  });
}

/**************
end hospital
**************/




/*const hiReply =(sender_psid) => {
  let response = {"text":"Hi. Please write choose"};
  callSend(sender_psid, response);
}


const greetInMyanmar =(sender_psid) => {
  let response = {"text": "Mingalarbar. How may I help"};
  callSend(sender_psid, response);
}

const textReply =(sender_psid) => {
  let response = {"text": "You sent text message"};
  callSend(sender_psid, response);
}


const quickReply =(sender_psid) => {
  let response = {
    "text": "Select your reply",
    "quick_replies":[
            {
              "content_type":"text",
              "title":"On",
              "payload":"on",              
            },{
              "content_type":"text",
              "title":"Off",
              "payload":"off",             
            }
    ]
  };
  callSend(sender_psid, response);
}

const showQuickReplyOn =(sender_psid) => {
  let response = { "text": "You sent quick reply ON" };
  callSend(sender_psid, response);
}

const showQuickReplyOff =(sender_psid) => {
  let response = { "text": "You sent quick reply OFF" };
  callSend(sender_psid, response);
}

const buttonReply =(sender_psid) => {

  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Are you OK?",
            "image_url":"https://www.mindrops.com/images/nodejs-image.png",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Yes!",
                  "payload": "yes",
                },
                {
                  "type": "postback",
                  "title": "No!",
                  "payload": "no",
                }
              ],
          }]
        }
      }
    }

  
  callSend(sender_psid, response);
}

const showButtonReplyYes =(sender_psid) => {
  let response = { "text": "You clicked YES" };
  callSend(sender_psid, response);
}

const showButtonReplyNo =(sender_psid) => {
  let response = { "text": "You clicked NO" };
  callSend(sender_psid, response);
}

const thankyouReply =(sender_psid, name, img_url) => {
  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Thank you! " + name,
            "image_url":img_url,                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Yes!",
                  "payload": "yes",
                },
                {
                  "type": "postback",
                  "title": "No!",
                  "payload": "no",
                }
              ],
          }]
        }
      }
    }
  callSend(sender_psid, response);
}

function testDelete(sender_psid){
  let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Delete Button Test",                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "enter",
                "url":"https://fbstarter.herokuapp.com/test/",
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }
  callSendAPI(sender_psid, response);
}*/

const defaultReply = (sender_psid) => {
  let response = choose(sender_psid);
 callSend(sender_psid, response)
}

const callSendAPI = (sender_psid, response) => {   
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }
  
  return new Promise(resolve => {
    request({
      "uri": "https://graph.facebook.com/v6.0/me/messages",
      "qs": { "access_token": PAGE_ACCESS_TOKEN },
      "method": "POST",
      "json": request_body
    }, (err, res, body) => {
      if (!err) {
        //console.log('RES', res);
        console.log('BODY', body);
        resolve('message sent!')
      } else {
        console.error("Unable to send message:" + err);
      }
    }); 
  });
}

async function callSend(sender_psid, response){
  let send = await callSendAPI(sender_psid, response);
  return 1;
}


const uploadImageToStorage = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject('No image file');
    }
    let newFileName = `${Date.now()}_${file.originalname}`;

    let fileUpload = bucket.file(newFileName);

    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
         metadata: {
            firebaseStorageDownloadTokens: uuidv4
          }
      }
    });

    blobStream.on('error', (error) => {
      console.log('BLOB:', error);
      reject('Something is wrong! Unable to upload at the moment.');
    });

    blobStream.on('finish', () => {
      // The public URL can be used to directly access the file via HTTP.
      //const url = format(`https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`);
      const url = format(`https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${fileUpload.name}?alt=media&token=${uuidv4}`);
      console.log("image url:", url);
      resolve(url);
    });

    blobStream.end(file.buffer);
  });
}




/*************************************
FUNCTION TO SET UP GET STARTED BUTTON
**************************************/

const setupGetStartedButton = (res) => {
  let messageData = {"get_started":{"payload":"get_started"}};

  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token='+ PAGE_ACCESS_TOKEN,
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      form: messageData
    },
    function (error, response, body) {
      if (!error && response.statusCode == 200) {        
        res.send(body);
      } else { 
        // TODO: Handle errors
        res.send(body);
      }
  });
} 

/**********************************
FUNCTION TO SET UP PERSISTENT MENU
***********************************/



const setupPersistentMenu = (res) => {
  var messageData = { 
      "persistent_menu":[
          {
            "locale":"default",
            "composer_input_disabled":false,
            "call_to_actions":[
                {
                  "type":"postback",
                  "title":"View My Tasks",
                  "payload":"view-tasks"
                },
                {
                  "type":"postback",
                  "title":"Add New Task",
                  "payload":"add-task"
                },
                {
                  "type":"postback",
                  "title":"Cancel",
                  "payload":"cancel"
                }
          ]
      },
      {
        "locale":"default",
        "composer_input_disabled":false
      }
    ]          
  };
        
  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token='+ PAGE_ACCESS_TOKEN,
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      form: messageData
  },
  function (error, response, body) {
      if (!error && response.statusCode == 200) {
          res.send(body);
      } else { 
          res.send(body);
      }
  });
} 

/***********************
FUNCTION TO REMOVE MENU
************************/

const removePersistentMenu = (res) => {
  var messageData = {
          "fields": [
             "persistent_menu" ,
             "get_started"                 
          ]               
  };  
  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token='+ PAGE_ACCESS_TOKEN,
      method: 'DELETE',
      headers: {'Content-Type': 'application/json'},
      form: messageData
  },
  function (error, response, body) {
      if (!error && response.statusCode == 200) {          
          res.send(body);
      } else {           
          res.send(body);
      }
  });
} 


/***********************************
FUNCTION TO ADD WHITELIST DOMAIN
************************************/

const whitelistDomains = (res) => {
  var messageData = {
          "whitelisted_domains": [
             APP_URL , 
             "https://herokuapp.com" ,                                   
          ]               
  };  
  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token='+ PAGE_ACCESS_TOKEN,
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      form: messageData
  },
  function (error, response, body) {
      if (!error && response.statusCode == 200) {          
          res.send(body);
      } else {           
          res.send(body);
      }
  });
} 