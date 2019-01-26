const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const app = require('express')()
var personDict = {};
var teacherClass = {};
const SCOPES = ['https://www.googleapis.com/auth/drive.activity.readonly',
"https://www.googleapis.com/auth/contacts.readonly",
 "https://www.googleapis.com/auth/userinfo.profile",
 "https://www.googleapis.com/auth/drive.readonly",
 "https://www.googleapis.com/auth/drive.metadata.readonly"];
var peopll = null;
var credentials = "";
var footer = "";
	footer += "<br>&copy; HexF 2019";
	footer += "<br><a href=\"https://pcclasses.azurewebsites.net/\">Share this link</a>";
	footer += "<br><a href=\"https://github.com/ComputerCandy/PCClasses/\">View this project on github</a>"
	footer += "<br>Please note: These will not contain all of your class members, I cannot guarantee they are 100% correct and take everything in here with a pinch of salt.";
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
	credentials = JSON.parse(content);
});

fs.readFile('personDict.json', (err, content) => {
	if (err) return console.log('Error loading person dict:', err);
	personDict = JSON.parse(content);
});

fs.readFile('teacherClass.json', (err, content) => {
	if (err) return console.log('Error loading teacherPerson dict:', err);
	teacherClass = JSON.parse(content);
});



function listDriveFolders(auth,res){
	const service = google.drive({version: 'v3', auth});
	const ppl = google.people({version: 'v1', auth});
	
	service.files.list({},(e,r) => {r.data.files.forEach(function(g){
		if(g.mimeType != 'application/vnd.google-apps.folder')
			return
		if(g.name.split(" - ").length != 2)
			return
		if(g.name.split(" - ")[1].split(" ").length < 2)
			return;
		listDriveActivity(auth, g.id, g.name, ppl)
	});
	let z=-1;
	while(true){
	    z++;
	    var g = r.data.files[z];
	    
	    if(g.name.split(" - ")[1].split(" ").length < 2)
			continue;
	    if(g.name.split(" - ").length != 2)
			continue;
		if(g.mimeType != 'application/vnd.google-apps.folder')
			continue;
	    res.redirect("/view/?name=" + g.name.split(" - ")[1]);
	    break;
	}
	    
	    
	})
}
function getPersonById(id, ppl,cb){
	peopll = ppl;
	var teacherName = "Unknown";
	if(personDict[id])
	{
		cb(personDict[id])
		return;
	}
	ppl.people.get({
		resourceName: id,
		personFields: "names"
	}, (e, r) => {		
		if (r.data && r.data.names){
			teacherName = r.data.names[0].displayName
			
			personDict[id] = teacherName;
			
			cb(teacherName)
		}else{
			ppl.people.get({
				resourceName: id,
				personFields: "emailAddresses"
			}, (es, rs) => {
				if(es)
					console.log(es.errors)
				
				
				
				if (r.data && rs.data.emailAddresses){
					teacherName = rs.data.emailAddresses[0].value
					teacherName = teacherName.split("@")[0];
				}
				personDict[id] = teacherName;
				cb(teacherName)
			})
					
		}
		
		
		
	})
	
	
}
function listDriveActivity(auth,ItemId,name,ppl) {
  const service = google.driveactivity({version: 'v2', auth});
  
	
  const params = {
    'pageSize': 100,
	'itemName': 'items/' + ItemId
  };
  service.activity.query({requestBody: params}, (err, res) => {
    if (err) return console.error('The API returned an error: ' + err);
    const activities = res.data.activities;
    if (activities) {
      
	  
	  
      activities.forEach((activity) => {
		  
            if (activity.primaryActionDetail.permissionChange)
				Object.values(activity.primaryActionDetail.permissionChange).forEach(function(f){
                f.forEach(
                    function(g) {
						
                        getPersonById(g.user.knownUser.personName,ppl,function(n){
							if(name.split(" - ")[1] == n)
								return;
							if(n == "school.apps.owner")
								return
							if(!teacherClass[g.user.knownUser.personName + "/" + name.split(" - ")[0]])
								teacherClass[g.user.knownUser.personName + "/" + name.split(" - ")[0]] = [];
							if(teacherClass[g.user.knownUser.personName + "/" + name.split(" - ")[0]].indexOf(name.split(" - ")[1]) == -1)
								teacherClass[g.user.knownUser.personName + "/" + name.split(" - ")[0]].push(name.split(" - ")[1])
							
							fs.writeFile('teacherClass.json', JSON.stringify(teacherClass) , function (err) {if(err) console.error(err)}); 
							fs.writeFile('personDict.json', JSON.stringify(personDict) , function (err) {if(err) console.error(err)}); 
							
						})
                    })
				});
        });
		
		
	
    } else {
      console.log('No activity.');
    }
  });
}



var port = process.env.PORT || 1337;
app.get('/', (req, res) => {
	const {client_secret, client_id, redirect_uris} = credentials.web;
	const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: 'online',
		scope: SCOPES,
		redirect_uri: 'https://pcclasses.azurewebsites.net/auth',
		hd: 'paraparaumucollege.school.nz'
	  });
	  
	  res.redirect(authUrl)
	 
	})
app.get('/auth/', (req, res) => {
	 if(!req.query.code)
		return res.send("Invald Token")
	
	const {client_secret, client_id, redirect_uris} = credentials.web;
	const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);
	  
	var code = req.query.code;
	
	oAuth2Client.getToken(code, (err, token) => {
	  if (err) return res.send("Invald Token with error: " + err);
	  oAuth2Client.setCredentials(token);
	  listDriveFolders(oAuth2Client,res);
	  
	});
		
	
	
})


app.get('/view/', (req, res) => {
	if(!req.query.name)
		return res.send("Invalid Name");
	var resp = "";
	var name = req.query.name;
	
	Object.keys(teacherClass).forEach(function(g){
		if(teacherClass[g].includes(name)){
			var c = g.split("/");
			getPersonById(c[0] + "/" + c[1], null, function(z){
				resp += "<ul> " + c[2] + " with " + z;	
					teacherClass[g].forEach(function(x){
						resp += "<li>"+x+"</li>";
					});
				resp += "</ul>";
			})
			
			
			
		}
	})
	resp += footer;
	res.send(resp);
});

app.get('/class/', (req, res) => {
    if(!req.query.name)
		return res.send("Invalid Class");
	var resp = "";
	var c = req.query.name;
    getPersonById(c.split("/")[0] + "/" + c.split("/")[1],peopll,function(a){
		            resp += "<h1>" + a + "'s " + c.split("/")[2] + " class</h1>";  
		            resp += "<ul>";
		            teacherClass[c].forEach(function(x){
						resp += "<li>"+x+"</li>";
					});
					
		            resp += "</ul>";
		            resp += footer;
		            res.send(resp);
		        })
		        
    });

app.get('/list/', (req, res) => {
	
	var people = [];
	var resp = "<h1>Students</h1><ul>";
	Object.keys(teacherClass).forEach(function(g){
		teacherClass[g].forEach(function(c){
		    if(!people.includes(c))
		        people.push(c)
		})
	})
	
	people.forEach(function(p){
	    resp += "<li><a href=\"/view/?name=" + p + "\">" + p + "</a>";
	});
	resp += "</ul>";
	resp += "<h6>Count: " + people.length + "</h6>";
	var g = [];
	resp += "<h1>Teachers</h1><ul>";
	Object.keys(teacherClass).forEach(function(c){
		    if(!g.includes(c)){
		        g.push(c);
		        getPersonById(c.split("/")[0] + "/" + c.split("/")[1],peopll,function(a){
		            resp += "<li><a href=\"/class/?name=" + c + "\">" + a + " with " + c.split("/")[2] + "</a>";    
		        })
		        
		    }
	})
	
	
	
	resp += "</ul>"
	resp += "<h6>Count: " + g.length + "</h6>";
	
	resp += footer;
	res.send(resp);
});



app.listen(port, () => console.log(`Example app listening on port ${port}!`))
