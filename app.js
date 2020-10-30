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
  "q7": "please leave a message",
  "q8": "please enter your Training center reference number",
  "q9": "please enter your Agent reference number",
  "q10": "please enter your reference id"  
}

let current_question = '';

let user_id = ''; 

let userInputs = [];
let customer = [];
let training_center_id ='';

let agent_id ='';
let seaman_id ='';
let seaman_ref ='';
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
        customer[user_id] = {};
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

app.get('/admin/register', async function(req,res){
 
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

app.get('/admin/updateregister/:doc_id', async function(req,res){
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
 
});

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
      
      let ref = generateRandom(8);
    
      let name  = req.body.name;
      let email = req.body.email;
      let phone = req.body.phone;
      let sender = req.body.sender; 
     

      console.log("AA");
      
      db.collection('register').doc(ref).set({
      name: name,
      email: email,
      phone: phone
      
    }).then(success => {   
          console.log("DATA SAVED")
    let text = "Thank you for your register.Please click already registered." + "\u000A";
    text += "Your reference id is " + ref
    ;
    let response = {
      "text": text
    };
    callSend(sender,response);
    return register(sender_psid);
    }).catch(error => {
          console.log(error);
      }); 
     
         
});










app.get('/course_registration/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('course_registration.ejs',{title:"Add courses", sender_id:sender_id});
});

app.post('/course_registration',function(req,res){
      
      
      let ref = generateRandom(8);
      let name  = req.body.name;
      let email    = req.body.email;
      let phone  = req.body.phone;
      let dob = req.body.dob;
      let item_id = req.body.item_id;
      let item_courses = req.body.item_courses;
      let item_name = req.body.item_name;
      let item_tc_id = req.body.item_tc_id;
      let item_duration = req.body.item_duration;
      let item_price = req.body.item_price;

      
      
     
      let today = new Date();
      let created_on = today;

    
      
      db.collection('course_registration').doc(ref).set({
      name: name,
      email:email,
      phone: phone,
      dob: dob,
      item_id:item_id,
      item_courses:item_courses,
      item_name:item_name,
      item_tc_id:item_tc_id,
      item_duration:item_duration,
      item_price:item_price,
      created_on: created_on
         
    }).then(success => {   
          console.log("DATA SAVED")
    let text = "Thank you for your register. Your data has been saved.If you leave your message,you write cancel" + "\u000A";
        text += "Your reference id is " + ref;
    let response = {
      "text": text
    };
    console.log("USER_ID",user_id);
     console.log("USERID", userInputs);
    callSend(user_id,response);
    }).catch(error => {
          console.log(error);
      }); 
     
         
});


app.get('/offcourse_registration/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('offcourse_registration.ejs',{title:"Add courses", sender_id:sender_id});
});

app.post('/offcourse_registration',function(req,res){
      
      
      let ref = generateRandom(8);
      let name  = req.body.name;
      let email    = req.body.email;
      let phone  = req.body.phone;
      let dob = req.body.dob;
      let item_id = req.body.item_id;
      let item_courses = req.body.item_courses;
      let item_name = req.body.item_name;
      let item_tc_id = req.body.item_tc_id;
      let item_duration = req.body.item_duration;
      let item_price = req.body.item_price;

      
      
     
      let today = new Date();
      let created_on = today;

    
      
      db.collection('offcourse_registration').doc(ref).set({
      name: name,
      email:email,
      phone: phone,
      dob: dob,
      item_id:item_id,
      item_courses:item_courses,
      item_name:item_name,
      item_tc_id:item_tc_id,
      item_duration:item_duration,
      item_price:item_price,
      created_on: created_on
         
    }).then(success => {   
          console.log("DATA SAVED")
    let text = "Thank you for your register. Your data has been saved.If you leave your message,you write cancel" + "\u000A";
        text += "Your reference id is " + ref;
    let response = {
      "text": text
    };
    console.log("USER_ID",user_id);
     console.log("USERID", userInputs);
    callSend(user_id,response);
    }).catch(error => {
          console.log(error);
      }); 
     
         
});







app.get('/jobapply/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('jobapply.ejs',{title:"Add Jobs", sender_id:sender_id});
});

app.post('/jobapply',function(req,res){
      
      
      let ref = generateRandom(8);
      let name  = req.body.name;
      let email    = req.body.email;
      let phone  = req.body.phone;
      let dob = req.body.dob;
      let certificate = req.body.certificate;
      let item_name = req.body.item_name;
      let item_agent_id = req.body.item_agent_id;
      let item_title = req.body.item_title;
      let item_require = req.body.item_require;
      let item_apply = req.body.item_apply;
      let item_hot = req.body.item_hot;
       let item_location = req.body.item_location;

      
      
     
      let today = new Date();
      let created_on = today;

    
      
      db.collection('jobapply').doc(ref).set({
      name: name,
      email:email,
      phone: phone,
      dob: dob,
      certificate:certificate,
      item_name:item_name,
      item_agent_id:item_agent_id,
      item_title:item_title,
      item_require:item_require,
      item_apply:item_apply,
      item_hot:item_hot,
      item_location:item_location,
      created_on: created_on
         
    }).then(success => {   
          console.log("DATA SAVED")
    let text = "Thank you for your register. Your data has been saved.If you leave your message,you write cancel" + "\u000A";
        text += "Your reference id is " + ref;
    let response = {
      "text": text
    };
    console.log("USER_ID",user_id);
     console.log("USERID", userInputs);
    callSend(user_id,response);
    }).catch(error => {
          console.log(error);
      }); 
     
         
});

//route url
/*app.get('/viewseaman', function(req,res){
  
  let doc.id = req.params.training_center_id; 

    db.collection("course_registration").doc(training_center_id).delete().then(()=>{
      
        res.redirect('/viewseaman');
        
    }).catch((err)=>console.log('ERROR:', error));   

});*/





app.get('/view_review', async function(req,res){




  const seamanref = db.collection('give_review').orderBy('created_on', 'desc');
  const snapshot = await seamanref.get();

  if (snapshot.empty) {
    console.log('Yamin:');
    res.send('no data');
  } 

  let data = []; 

  snapshot.forEach(doc => { 
    
    let rate = {}; 

    rate = doc.data();
    
    rate.id = doc.id; 
    
    let d = new Date(doc.data().created_on._seconds);
    d = d.toString();
    rate.created_on = d;   

    data.push(rate);
    
  });  

  console.log('DATA:', data); 
  res.render('view_review.ejs', {data:data});

});




app.get('/show', async function(req,res){




  const courseRef = db.collection('STCW').orderBy('created_on', 'desc');
  const snapshot = await courseRef.get();

  if (snapshot.empty) {
    console.log('Yamin:');
    res.send('no data');
  } 

  let data = []; 

  snapshot.forEach(doc => { 
    
    let course = {}; 

    course = doc.data();
    
    course.id = doc.id; 
    
    let d = new Date(doc.data().created_on._seconds);
    d = d.toString();
    course.created_on = d;   

    data.push(course);
    
  });  

  console.log('DATA:', data); 
  res.render('show.ejs', {data:data});

});

 




  app.get('/show1', async function(req,res){


  const courseRef = db.collection('offshore').orderBy('created_on', 'desc');
  const snapshot = await courseRef.get();

  if (snapshot.empty) {
    console.log('Yamin:');
    res.send('no data');
  } 

  let data = []; 

  snapshot.forEach(doc => { 
    
    let course = {}; 

    course = doc.data();
    
    course.id = doc.id; 
    
    let d = new Date(doc.data().created_on._seconds);
    d = d.toString();
    course.created_on = d;   

    data.push(course);
    
  });  

  console.log('DATA:', data); 
  res.render('show1.ejs', {data:data});

});


app.get('/showjob', async function(req,res){




  const jobRef = db.collection('addjob').orderBy('created_on', 'desc');
  const snapshot = await jobRef.get();

  if (snapshot.empty) {
    console.log('Yamin:');
    res.send('no data');
  } 

  let data = []; 

  snapshot.forEach(doc => { 
    
    let job = {}; 

    job = doc.data();
    
    job.id = doc.id; 
    
    let d = new Date(doc.data().created_on._seconds);
    d = d.toString();
    job.created_on = d;   

    data.push(job);
    
  });  

  console.log('DATA:', data); 
  res.render('showjob.ejs', {data:data});

});



app.get('/viewseaman/:training_center_id', async function(req,res){
 let training_center_id = req.params.training_center_id;
  const seamanref = db.collection('course_registration').where('item_tc_id','==',training_center_id);
  const snapshot = await seamanref.get();

  if (snapshot.empty) {
    console.log('Yamin:');
    res.send('no data');
  } 
else{
let data = []; 

  snapshot.forEach(doc => { 
    
    let item = {}; 

    item = doc.data();
    
    item.doc_id = doc.id; 
    
    let d = new Date(doc.data().created_on._seconds);
    d = d.toString();
    item.created_on = d;   

    data.push(item);
    
  });  

  console.log('Training Center students:', data); 
  res.render('viewseaman.ejs', {data:data});

}
  

});


app.get('/viewjob/:agent_id', async function(req,res){
 let agent_id = req.params.agent_id;
  const seamanref = db.collection('jobapply').where('item_agent_id','==',agent_id);
  const snapshot = await seamanref.get();

  if (snapshot.empty) {
    console.log('Yamin:');
    res.send('no data');
  } 
else{
let data = []; 

  snapshot.forEach(doc => { 
    
    let view = {}; 

    view = doc.data();
    
    view.doc_id = doc.id; 
    
    let d = new Date(doc.data().created_on._seconds);
    d = d.toString();
    view.created_on = d;   

    data.push(view);
    
  });  

  console.log('Agents seaman:', data); 
  res.render('viewjob.ejs', {data:data});

}
  

});


var list=[‘one’,’two’,’three’,’four’,’five’];
list.forEach(function(element) {
document.getElementById(element).addEventListener(“click”, function(){
var cls=document.getElementById(element).className;
if(cls.includes(“unchecked”))
{
document.getElementById(element).classList.remove(“unchecked”);
document.getElementById(element).classList.add(“checked”);
}
else
{
document.getElementById(element).classList.remove(“checked”); document.getElementById(element).classList.add(“unchecked”);
}
});
});


app.post('/show', function(req, res){
    
   
    
    let course = {};
    course.id = req.body.item_id;
    course.courses = req.body.item_courses;
    course.name = req.body.item_name;
    course.tc_id = req.body.item_tc_id;
    course.duration = req.body.item_duration;
    course.price = req.body.item_price;

      console.log('COURSE', course);
  
    res.render('course_registration.ejs', course);   
});


app.post('/course_registration', function(req, res){
    
   res.json(req.body);
    
    
});




app.post('/show1', function(req, res){
    
   
    
    let course = {};
    course.id = req.body.item_id;
    course.courses = req.body.item_courses;
    course.name = req.body.item_name;
    course.tc_id = req.body.item_tc_id;
    course.duration = req.body.item_duration;
    course.price = req.body.item_price;

      console.log('COURSE', course);
  
    res.render('offcourse_registration.ejs', course);   
});


app.post('/offcourse_registration', function(req, res){
    
   res.json(req.body);
    
    
});




app.post('/showjob', function(req, res){
    
   
    
    let job = {};
    job.name = req.body.item_name;
    job.agent_id = req.body.item_agent_id;
    job.title = req.body.item_title;
    job.require = req.body.item_require;
    job.apply = req.body.item_apply;
    job.hot = req.body.item_hot;
     job.location = req.body.item_location;

      console.log('Job', job);
  
    res.render('jobapply.ejs', job);   
});


app.post('/jobapply', function(req, res){
    
   res.json(req.body);
    
    
});



app.get('/cart', function(req, res){     
    

    if(!customer[user_id].cart){
        customer[user_id].cart = [];
    }
    if(customer[user_id].cart.length < 1){
        res.send('your cart is empty. back to shop <a href="../show">shop</a>');
    }else{ 

       // customer[user_id].cart.forEach((item) => sub_total += item.total);        

       // cart_total = sub_total - cart_discount;       

        //customer[user_id].use_point = false;

        res.render('cart.ejs');    
    }
});



app.get('/give_review/:sender_id',async(req,res)=>{
    const sender_id = req.params.sender_id;
    const courseRef = db.collection('course_registration').doc(seaman_ref);
    const doc = await courseRef.get();
  if (!doc.exists) {
    console.log('No such document!');
  } else {
    
    let data = doc.data();
    data.doc_id = doc.id;
    
    res.render('give_review.ejs', {data:data,title:"Review", sender_id:sender_id});
  } 
  
   
});



app.post('/give_review',function(req,res){
      
      let ref = generateRandom(8);
    
     let name = req.body.name;
     let id = req.body.id;
      let tc = req.body.tc;
      let course = req.body.course;
      let review = req.body.review;
      let sender = req.body.sender; 
    
      let today = new Date();
      let created_on = today;

      console.log("AA");
      
      db.collection('give_review').add({
      
     name:name,
     id:id,
      tc: tc,
      course: course,
      review: review,
      created_on: created_on

         
    }).then(success => {   
          console.log("DATA SAVED")
    let text = "Thank you for your review. Your data has been saved.If you leave your message,you write cancel" + "\u000A";
   
    let response = {
      "text": text
    };
    callSend(sender,response);
    }).catch(error => {
          console.log(error);
      }); 
     
         
});








app.get('/STCW/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('STCW.ejs',{title:"Add courses", sender_id:sender_id});
});

app.post('/STCW',function(req,res){
      
      
      let name  = req.body.name;
      let tc_id    = req.body.id;
      let courses  = req.body.courses;
      let date = req.body.date;
      let end = req.body.end;
      let detail = req.body.detail;
      let duration = req.body.duration;
      let price = req.body.price;
      let address = req.body.address;
      let sender = req.body.sender; 
     
      let today = new Date();
      let created_on = today;

      console.log("DD");
      
      db.collection('STCW').add({
      name: name,
      tc_id:tc_id,
      courses: courses,
      date: date,
      end: end,
      detail: detail,
       duration: duration,
      price: price,
      address: address,
      created_on: created_on
         
    }).then(success => {   
          console.log("DATA SAVED")
    let text = "Thank you for your add course. Your data has been saved.If you leave your message,you write cancel" + "\u000A";
   
    let response = {
      "text": text
    };
    callSend(sender,response);
    }).catch(error => {
          console.log(error);
      }); 
     
         
});












app.get('/offshore/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('offshore.ejs',{title:"Add courses", sender_id:sender_id});
});

app.post('/offshore',function(req,res){
      
      
      let name  = req.body.name;
      let tc_id    = req.body.id;
      let courses  = req.body.courses;
      let date = req.body.date;
      let end = req.body.end;
      let detail = req.body.detail;
      let duration = req.body.duration;
      let price = req.body.price;
      let address = req.body.address;
      let sender = req.body.sender; 
     
      let today = new Date();
      let created_on = today;

      console.log("DD");
      
      db.collection('offshore').add({
      name: name,
      tc_id:tc_id,
      courses: courses,
      date: date,
      end: end,
      detail: detail,
       duration: duration,
      price: price,
      address: address,
      created_on: created_on
         
    }).then(success => {   
          console.log("DATA SAVED")
    let text = "Thank you for your add course. Your data has been saved.If you leave your message,you write cancel" + "\u000A";
   
    let response = {
      "text": text
    };
    callSend(sender,response);
    }).catch(error => {
          console.log(error);
      }); 
     
         
});




app.get('/agent_register/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('agent_register.ejs',{title:"Register", sender_id:sender_id});
});





app.post('/agent_register',function(req,res){
      
      let ref = generateRandom(8);
    
      let name  = req.body.name;
      let email = req.body.email;
      let phone = req.body.phone;
      let sender = req.body.sender; 
     

      console.log("AA");
      
      db.collection('agent_register').doc(ref).set({
      name: name,
      email: email,
      phone: phone
      
    }).then(success => {   
          console.log("DATA SAVED")
    let text = "Thank you for your register.Please click already registered." + "\u000A";
    text += "Your reference id is " + ref
    ;
    let response = {
      "text": text
    };
    callSend(sender,response);
    return agent_register(sender_psid);
    }).catch(error => {
          console.log(error);
      }); 
     
         
});


app.get('/addjob/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('addjob.ejs',{title:"Add courses", sender_id:sender_id});
});

app.post('/addjob',function(req,res){
      
      
      let name  = req.body.name;
      let agent_id    = req.body.agent_id;
      let title  = req.body.title;
      let require = req.body.require;
      let apply = req.body.apply;
      let hot = req.body.hot;
      let location = req.body.location;
      let sender = req.body.sender; 
     
      let today = new Date();
      let created_on = today;

      console.log("DD");
      
      db.collection('addjob').add({
      name: name,
      agent_id:agent_id,
      title: title,
      require: require,
      apply: apply,
      hot: hot,
      location: location,
      created_on: created_on
         
    }).then(success => {   
          console.log("DATA SAVED")
    let text = "Thank you for your add job. Your data has been saved.If you leave your message,you write cancel" + "\u000A";
   
    let response = {
      "text": text
    };
    callSend(sender,response);
    }).catch(error => {
          console.log(error);
      }); 
     
         
});







/*app.get('/register',function(req,res){   
      let data = {
        user_name: currentUser.name,
      } 
     res.render('register.ejs', {data:data});
});


app.post('/register',function(req,res){   
    
    currentUser.name = req.body.name;
    currentUser.phone = req.body.phone;
    currentUser.email = req.body.email;

    let data = {
        viberid: currentUser.id,
        name: currentUser.name,
        phone: currentUser.phone,
        email: currentUser.email
    }

   

    db.collection('users').doc(currentUser.id).set(data)
    .then(()=>{
            let data = {
                   "receiver":currentUser.id,
                   "tracking_data":"tracking data",
                   "type":"text",
                   "text": "Thank you!"+req.body.name
                }                

                fetch('https://chatapi.viber.com/pa/send_message', {
                    method: 'post',
                    body:    JSON.stringify(data),
                    headers: { 'Content-Type': 'application/json', 'X-Viber-Auth-Token': process.env.AUTH_TOKEN },
                })
                .then(res => res.json())
                .then(json => console.log('JSON', json))

    }).catch((error)=>{
        console.log('ERROR:', error);
    });
       
});*/


/*app.get('/webview/:sender_id',function(req,res){
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
            agent_register(sender_psid);
          break;
          
        case "off":
            showQuickReplyOff(sender_psid);
          break; 
        case "confirm-appointment":
              saveAppointment(userInputs[user_id], sender_psid);
          break;              
        default:
            botDefaultReply(sender_psid);
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
  }else if(current_question == 'q8'){
     let order_ref = received_message.text; 

     console.log('order_ref: ', order_ref);    
     current_question = '';     
     showOrder(sender_psid, order_ref);
  }else if(current_question == 'q9'){
     let agent_ref = received_message.text; 

     console.log('agent_ref: ', agent_ref);    
     current_question = '';     
     showOrder1(sender_psid, agent_ref);
  }else if(current_question == 'q10'){
      seaman_ref = received_message.text; 

     console.log('seaman_ref: ', seaman_ref);    
     current_question = '';     
     showOrder2(sender_psid, seaman_ref);
  }
  else {
      
      let user_message = received_message.text;      
     
      user_message = user_message.toLowerCase(); 

      switch(user_message) { 
      case "Get start":
          hiReply(sender_psid);
        break;
         case "already":
          already(sender_psid);
        break;
      case "choose":
        choose(sender_psid);
        break;                
      case "cancel":
        choose(sender_psid);
        break;
                   
      default:
          botDefaultReply(sender_psid);
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
          shopMenu(sender_psid);
        break;
        case "jobs":
          viewjob(sender_psid);
        break; 
         case "offshore":
          viewoff(sender_psid);
        break;   
        case "check-order":         
          current_question = "q8";
          botQuestions(current_question, sender_psid);
        break;
        case "check":         
          current_question = "q9";
          botQuestions(current_question, sender_psid);
        break; 
        case "viewreview":         
          view(sender_psid);
        break; 
        case "review":         
          current_question = "q10";
          botQuestions(current_question, sender_psid);
        break;                     
      default:
          botDefaultReply(sender_psid);
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
                  "payload": "jobs", 
                },               
              ],
          },{
            "title": "View Review",
            "image_url":"https://thumbs.dreamstime.com/b/review-meeting-concept-little-man-showing-playcard-white-49949784.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "View",
                  "payload": "viewreview",
                },               
              ],
          },{
            "title": "You can give review and rate",
            "image_url":"https://s3.amazonaws.com/blog4.0/blog/wp-content/uploads/Feature-image-5-positive-Review-Examples-1-1140x634.png",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Give review and rate",
                  "payload": "review",
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
                 
                  "payload": "offshore", 
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
                  
                  "payload": "check-order",
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



const agent_register = (sender_psid) => {
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
                "url":APP_URL+"agent_register/"+sender_psid,
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              
                },    
                {
                  "type": "postback",
                  "title": "Already registered",
                  
                  "payload": "check",
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


const showOrder = async(sender_psid, order_ref) => {    

    const userref = db.collection('register').doc(order_ref);
    const user = await userref.get();
   console.log('SHOW_ORDER',order_ref);
    if (!user.exists) {
      let response = { "text": "Incorrect reference id" };
      callSend(sender_psid, response).then(()=>{
        return register(sender_psid);
      });
    }else{
       training_center_id = order_ref;
        let response = { "text": "You are correct." };
        callSend(sender_psid, response).then(()=>{
          return already(sender_psid);

          });
    }   

}

const showOrder1 = async(sender_psid, agent_ref) => {    

    const userref = db.collection('agent_register').doc(agent_ref);
    const user = await userref.get();
    console.log('SHOW_ORDER',agent_ref);
    if (!user.exists) {
      let response = { "text": "Incorrect reference id" };
      callSend(sender_psid, response).then(()=>{
        return agent_register(sender_psid);
      });
    }else{
      agent_id = agent_ref;
        let response = { "text": "You are correct." };
        callSend(sender_psid, response).then(()=>{
          return agent_already(sender_psid);

          });
    }   

}




const showOrder2 = async(sender_psid, seaman_ref) => {    

    const userref = db.collection('course_registration').doc(seaman_ref);
    const user = await userref.get();
    console.log('SHOW_ORDER',seaman_ref);
    if (!user.exists) {
      let response = { "text": "Incorrect reference id" };
      callSend(sender_psid, response).then(()=>{
        return showtype(sender_psid);
      });
    }else{
      
        let response = { "text": "You are correct." };
        callSend(sender_psid, response).then(()=>{
          return for_review(sender_psid);

          });
    }   

}
 

const for_review = (sender_psid) => {
    let response1 = {"text": "Hello. Please choose one."};
    let response2 = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title":"Click if you want to review courses.",
                  
            "buttons": [                
                  {
                "type": "web_url",
                "title": "Give review",
                "url":APP_URL+"give_review/"+sender_psid,
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
        return callSend(sender_psid, response2)
      });
}







const already = (sender_psid) => {
    let response1 = {"text": "Hello. Please choose one."};
    let response2 = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title":"You can add courses, view your courses and view students",
                  
            "buttons": [                
                  {
                "type": "web_url",
                "title": "Add courses(STCW)",
                "url":APP_URL+"STCW/"+sender_psid,
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              
                },    
                {
                  "type": "web_url",
                "title": "Add courses(Offshore)",
                "url":APP_URL+"offshore/"+sender_psid,
                 "webview_height_ratio": "full",
                "messenger_extensions": true,  
                }, 
                {
                  "type": "web_url",
                "title": "View Seaman registered",
                "url":APP_URL+"viewseaman/"+training_center_id,
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
        return callSend(sender_psid, response2)
      });
}

const agent_already = (sender_psid) => {
    let response1 = {"text": "Hello. Please choose one."};
    let response2 = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title":"You can add courses, view your courses and view students",
                  
            "buttons": [                
                  {
                "type": "web_url",
                "title": "Add Jobs",
                "url":APP_URL+"addjob/"+sender_psid,
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              
                },    
                {
                  "type": "web_url",
                "title": "View seaman registered",
                "url":APP_URL+"viewjob/"+agent_id,
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
        return callSend(sender_psid, response2)
      });
}
const shopMenu =(sender_psid) => {
  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "All courses",  
            "image_url":"https://marlins.co.uk/wp-content/uploads/sites/8/2017/02/diversity-670x321.jpg",                  
            "buttons": [              
              {
                "type": "web_url",

                "title": "View",
                "url":APP_URL+"show/",
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }  
  callSend(sender_psid, response);
}



const shopMenu1 =(sender_psid) => {
  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "All courses",  
            "image_url":"https://marlins.co.uk/wp-content/uploads/sites/8/2017/02/diversity-670x321.jpg",                  
            "buttons": [              
              {
                "type": "web_url",

                "title": "View",
                "url":APP_URL+"show1/",
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }  
  callSend(sender_psid, response);
}

const view =(sender_psid) => {
  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "All Review",  
            "image_url":"https://static.wixstatic.com/media/e5eac2_aacf74a52d9a4b2e9aae7f93162ce5e5~mv2_d_1600_1472_s_2.jpg",                  
            "buttons": [              
              {
                "type": "web_url",

                "title": "View",
                "url":APP_URL+"view_review/",
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }  
  callSend(sender_psid, response);
}

const viewjob =(sender_psid) => {
  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "All Jobs",  
            "image_url":"https://seamanloan.com.ph/wp-content/uploads/2018/09/Seaman-Loan.png",                  
            "buttons": [              
              {
                "type": "web_url",

                "title": "View",
                "url":APP_URL+"showjob/",
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }  
  callSend(sender_psid, response);
}


const viewoff =(sender_psid) => {
  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "All courses",  
            "image_url":"https://sqemarine.com/wp-content/uploads/2018/06/Ship-Safety-Officer.jpg",                  
            "buttons": [              
              {
                "type": "web_url",

                "title": "View",
                "url":APP_URL+"show1/",
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }  
  callSend(sender_psid, response);
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
  }else if(current_question == 'q8'){
    console.log('Q8',bot_questions.q8);
    let response = {"text": bot_questions.q8};
    callSend(sender_psid, response);
  }else if(current_question == 'q9'){
    let response = {"text": bot_questions.q9};
    callSend(sender_psid, response);
  }else if(current_question == 'q10'){
    let response = {"text": bot_questions.q10};
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
}*/

const thankyouReply =(sender_psid, name) => {
  let ref = generateRandom(6);
  let response = { "text": "Thank you for your register" + name + ref};
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
}

const botDefaultReply = (sender_psid) => {
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