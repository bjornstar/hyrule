var mongodb = require('mongodb'); // 3rd party node package. We use it for database
var express = require('express'); // 3rd party node package. We use it for web interface
var cluster = require('cluster'); //    Native node package. We use it for multi-threaded socket handling
var crypto  = require('crypto');  //    Native node package. We use it for md5
var fs      = require('fs');      //    Native node package. We use it to read/write files
var net     = require('net');     //    Native node package. We use it for socket interface
var os      = require('os');      //    Native node package. We use it to determine # of CPUs
var util    = require('util');    //    Native node package. We use it for logging

var hyrule = new Object(); 
hyrule.appName = 'Zelda';
hyrule.appStart = new Date();
hyrule.moblin = new Object();
hyrule.fairy = new Object();
hyrule.config = new Object();

var configFileDefault = ('./config/default.json');
var configFile = configFileDefault;

if (process.argv[2]) {
  configFile = './config/'+process.argv[2]+'.json';
}

var config;

try {
  config = require(configFile); // This holds our configuration data.
  log('Using '+configFile);
} catch (err) {
  config = require(configFileDefault);
  log('Using default config.');
}

var ObjectID = mongodb.ObjectID;  // This is a Mongo BSON datatype.

var serverHyrule = new mongodb.Server(config.hyrule.host, config.hyrule.port); // This is our database server
var dbHyrule = new mongodb.Db(config.hyrule.database, serverHyrule, {}); // This is our database

function log(data) {
  console.log('['+new Date().toISOString()+'] '+hyrule.appName+'.'+process.pid+': '+util.inspect(data));
}



function showMeTheData() {
  log("Early Outs: "+clstrEarlyOuts+", Database Hits: "+clstrDBHits);
}

var clstrEarlyOuts = 0;
var clstrDBHits = 0;

if (cluster.isMaster) {
  for (var i = 0;i < os.cpus().length; i++) {
    var worker = cluster.fork();

    worker.on('message', function (msg) {
      switch (msg.jsonOut) {
        case 'earlyOut':
          clstrEarlyOuts++;
          break;
        case 'dbHit':
          clstrDBHits++;
          break;
        default:
          //log(msg);
      }
    });

    worker.on('death', function(worker) {
      log('worker '+worker.pid+ ' died.');
    });
  }

  var lovelyDataInterval = setInterval(showMeTheData, 3000);
} else {

dbHyrule.open(function() {
  log('Welcome to Hyrule.');
  var timeDBOpen = new Date();
  log('It took ' + (timeDBOpen.getTime() - hyrule.appStart.getTime()) + 'ms for ' + hyrule.appName + ' to connect to the database.');
});

fs.readFile('package.json', 'utf8', function(err,data) {
  if (err) throw err;
  var jsonPackage = JSON.parse(data);
  hyrule.version = jsonPackage.version;
  log('You are '+hyrule.appName+' in Hyrule v'+hyrule.version);
});

hyrule.config.watcher = fs.watchFile(configFile, configWatchEvent);
hyrule.moblin.watcher = fs.watchFile('moblin.js', generateMoblinMD5);
hyrule.fairy.watcher = fs.watchFile('fairy.js', generateFairyMD5);

var newmoblin = '';
var newfairy = '';

function configWatchEvent(exxnt, filename) {
  log(exxnt);
  log(hyrule.moblin.md5inprogress);
  if (exxnt==='rename') {
    return;
  }
  if (exxnt==='change') {
    log('config file has been modified.');
  }
  generateMoblinMD5();
  generateFairyMD5();
}

function generateMoblinMD5(exxnt, filename) {
  if (exxnt==='rename') {
    return;
  }
  if (hyrule.moblin.md5inprogress) {
    return;
  }
  hyrule.moblin.md5inprogress = true;
  if (exxnt==='change') {
    log('moblin.js has been modified.');
  }
  fs.readFile('moblin.js', 'utf8', function(err,data) {
    if (err) throw err;
    newmoblin = 'var config = new Object();\n\nconfig.zelda = '+JSON.stringify(config.zelda)+';\n\n'+data;
    hyrule.moblin.md5 = crypto.createHash('md5').update(newmoblin).digest('hex');
    log('Moblin MD5: '+hyrule.moblin.md5);
    delete hyrule.moblin.md5inprogress;
  });
}

function generateFairyMD5(exxnt, filename) {
  if (exxnt==='rename') {
    return;
  }
  if (hyrule.fairy.md5inprogress) {
    return;
  }
  hyrule.fairy.md5inprogress = true;
  if (exxnt==='change') {
    log('fairy.js has been modified.');
  }
  fs.readFile('fairy.js', 'utf8', function(err,data) {
    if (err) throw err;
    newfairy = 'var config = new Object();\n\nconfig.zelda = '+JSON.stringify(config.zelda)+';\n\n'+data;
    hyrule.fairy.md5 = crypto.createHash('md5').update(newfairy).digest('hex');
    log(' Fairy MD5: '+hyrule.fairy.md5);
    delete hyrule.fairy.md5inprogress;
  });
}

generateMoblinMD5('launch', null);
generateFairyMD5('launch', null);

var defaultPause = 50;
var zeldaExpress = express.createServer();

function Client(mac) {
	var self = this; //You have to do this so you can reference these things later.
	var machine;
	var start = new Date();

	this.mac = mac.toLowerCase();
	var findObject = new Object();

	if (self.mac.length==12) {
		self.findObject = {mac:self.mac};
	} else if (self.mac.length==24) {
		self.findObject = {_id:new ObjectID(self.mac)};
	}

	this.taskOut = {task:{pause:defaultPause}}; //,_id:new ObjectID(),created:new Date()}; // This is the default task.

	this.appendError = function(errorObject) {
		log(errorObject);
		if (!self.taskOut.errors||self.taskOut.errors.length==0) {
			self.taskOut.errors = new Array();
		}
		self.taskOut.errors.push({'error':errorObject,_id:new ObjectID(),'created':new Date()});
	}

	function getMachines(errCollection, collectionMachine, callback) {
		if (errCollection!=null) {
			self.appendError({'errordata':errCollection,'errorin':'hyrule.collection(\'machines\')'});
			self.res.json(self.taskOut);
		} else {
			collectionMachine.findAndModify(
			self.findObject,
			[],
			{'$set':{'lastseen':new Date(),'alive':true}, '$inc':{'timesseen':1}},
			{'new':true, 'upsert':true, 'fields': {'jobs':{'$slice':5},'jobs.tasks':{'$slice':5},'created':1}},
			function(famErr, famMachine) {
				if (famErr && !famErr.ok) {
					self.appendError({'errordata':famErr,'errorin':'collectionMachine.findAndModify'});
					self.res.json(self.taskOut);
				} else {
					if (famMachine!=null) {
						self.machine = famMachine;
						if (!self.machine.created || !self.machine.jobs) {
							if (!self.machine.created) {
								self.machine.created = new Date();
							}
							if (!self.machine.jobs) {
								self.machine.jobs = new Array();
							}
							collectionMachine.update(self.findObject,{'$set':{'created':new Date(),'jobs':new Array()}},function() {});
						}

// Every request from the client, we need to do up to here. ^^^^^^^^^^^^^

	self.doyourthang(collectionMachine);

// And after here. vvvvvvvvvvv

					} else {
						self.appendError({'errordata':famErr,'errorin':'collectionMachine.findAndModify:no results'});
						self.res.json(self.taskOut);
						delete inProgress[self.req.params.mac];
					}
				}
			});
		}
	}

	function taskThang(cMachine) {
		var tStart = self.taskOut;// Our default task.
		var jCount = 0;// This is kind of like our process count.
		var tCount = 0;// This is kind of like our thread count.

		var updateObject = new Object();
		updateObject['$set'] = new Object();

		var uO = updateObject['$set'];// Makes referring to updateObject easier.

		for (job in self.machine.jobs) {
			if (self.machine.jobs[job].locked) {
				break;
			}

			if (self.machine.jobs[job].started) {
				jCount +=1; 
			}

			if (jCount>=2) {
				break;
			}

			var jStart = self.machine.jobs[job];

			if (!jStart.started && jCount<1) {
				var jStarted = new Date()
				var jTimeout = new Date(jStarted.getTime() + jStart.duration);
				jStart.started = jStarted;
				jStart.timeout = jTimeout;

				uO['jobs.'+job+'.started'] = jStarted;
				uO['jobs.'+job+'.timeout'] = jTimeout;

				jCount +=1
			}

			for (task in jStart.tasks) {
				if (jStart.tasks[task].started) {
					tCount +=1 
					break;
				}

				if (tCount>=1) {
					break;
				}

				tStart = jStart.tasks[task];

				tStarted = new Date();
				tTimeout = new Date(tStarted.getTime() + tStart.duration);
				tStart.started = tStarted;
				tStart.timeout = tTimeout;

				uO['jobs.'+job+'.tasks.'+task+'.started'] = tStarted;
				uO['jobs.'+job+'.tasks.'+task+'.timeout'] = tTimeout;

				tCount +=1
			}
		}

		if (tStart != self.taskOut) {
			cMachine.update(self.findObject,updateObject,function(errSave) { // Yay for atomic operations.
				if (errSave) {
					log('errored: ' + JSON.stringify(tStart) + ' ' + new Date());
				} else {
				//	log('updated: ' + JSON.stringify(tStart) + ' ' + self.start.getTime() + ' ' + now.getTime());
				}
			});
		}
                process.send({jsonOut:'dbHit'});
		self.res.json(tStart); // We're not waiting for the save event to finish.
		delete inProgress[self.req.params.mac];

		self.end = new Date();
//		log(self.end - self.start);
	}

	function passThang(collectionMachine) {
		var jPass;
		var tRemove = -1;

		var updateObject = new Object();
		updateObject['$pull'] = new Object();

		var uO = updateObject['$pull'];

		for (job in self.machine.jobs) {
			if (!self.machine.jobs[job].started) { // Dont' bother looking if it hasn't started.
				break;
			}

			if (self.machine.jobs[job].locked) { // Don't bother looking if it's locked.
				break;
			}

			jPass = self.machine.jobs[job];
			jRemove = job;

			for (task in jPass.tasks) {
				if (self.taskID != jPass.tasks[task]._id) {
					continue;
				}

				if (!jPass.tasks[task].started) {
var now = new Date();
log('NOT STARTED!!!! ' + JSON.stringify(jPass.tasks[task]) + ' ' + self.start.getTime() + ' ' + now.getTime());
					break;
				}

				var tLog = jPass.tasks[task];
				tLog.machine = self.machine._id;
				tLog.job = jPass._id;
				tLog.completed = new Date();

				dbHyrule.collection('tasks', function(err, collectionTask) {
					collectionTask.insert(tLog);
				});

				uO['jobs.'+job+'.tasks'] = new Object();
				uO['jobs.'+job+'.tasks']._id = new ObjectID(tLog._id);

				tRemove = task;
			}
		}

		if (tRemove == -1) {
			return;
		}

		jPass.tasks.splice(tRemove,1);

		if (jPass.tasks.length==0) {
			var jLog = self.machine.jobs.splice(jRemove,1);
			jLog.machine = self.machine._id;
			jLog.completed = new Date();
			delete jLog.tasks;
			dbHyrule.collection('jobs', function(err, collectionJob) {
				collectionJob.insert(jLog);
			});

			uO['jobs'] = new Object();
			uO['jobs']._id = new ObjectID(jLog._id);
		}

		collectionMachine.update(self.findObject, updateObject, function(err,callback){ // it's atomic!
			if (err && !err.ok) {
				appendError({'errorData':err,'errorin':'updating machine on pass.'});
				self.res.send('not ok.');
			} else {
				self.res.send('ok'); // Here we wait until save completes before responding.
				delete inProgress[self.req.params.mac];
			}
		});
	}

	function failThang(collectionMachine) {
		dbHyrule.collection('tasks', function(err, collectionTask) {
			if (self.machine.jobs.length && self.machine.jobs[0].started && !self.machine.jobs[0].locked) { // don't pass if locked.
				if (self.machine.jobs[0].tasks.length && self.machine.jobs[0].tasks[0].started) {
					var taskDone = new Object();
					taskDone = self.machine.jobs[0].tasks.shift();
					taskDone.machine = self.machine._id;
					taskDone.job = self.machine.jobs[0]._id;
					taskDone.completed = new Date();
					collectionTask.insert(taskDone);
					if (self.machine.jobs[0].tasks.length==0) {
						var jobDone = new Object();
						jobDone = self.machine.jobs.shift();
						jobDone.machine = self.machine._id;
						jobDone.completed = new Date();
						jobDone.fail = true;
						delete jobDone.tasks;
						dbHyrule.collection('jobs', function(err, collectionJob) {
							collectionJob.insert(jobDone);
						});
					}
					collectionMachine.save(self.machine, {}, function(err,callback){
						if (err && !err.ok) {
							appendError({'errorData':err,'errorin':'updating machine on pass.'});
							self.res.send('not ok.\n');
						} else {
							self.res.send('ok\n');
						}
					});
				} else {
					log('no tasks to pass.');
					self.res.send('no tasks to pass.');
				}
			} else if (self.machine.jobs[0].locked) {
				log('job is locked!');
				self.res.send('locked.');
			} else {
				log('no jobs to pass.');
				self.res.send('no jobs to pass.');
			}
		});
	}

	function task(req, res) {
		self.req = req;
		self.res = res;
		self.start = new Date();
		self.doyourthang = taskThang;
	
		dbHyrule.collection('machines', getMachines);
	}

	function pass(req, res) {
		self.req = req;
		self.res = res;
		self.start = new Date();
		self.taskID = req.params.taskid;
		self.doyourthang = passThang;

		dbHyrule.collection('machines', getMachines);
	}

	function fail(req, res) {
		self.req = req;
		self.res = res;
		self.start = new Date();
		self.taskID = req.params.taskid;
		self.doyourthang = failThang;

		dbHyrule.collection('machines', getMachines);
	}

	this.task = task;
	this.pass = pass;
	this.fail = fail;
	
	return this;
}

var inProgress = new Object();
var lastOverRun = new Date();

zeldaExpress.get('/:client(client|moblin)/:mac([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/task', function(req, res){
	var reqTime = new Date();
	if (inProgress[req.params.mac]) {
		inProgress[req.params.mac]++;
		if (inProgress[req.params.mac] >= 3) {
			lastOverRun = new Date();
		}
		if (inProgress[req.params.mac] >= 10) {
			log('THE BRAKES!');
			log(inProgress);
			defaultPause +=5;
			inProgress[req.params.mac] = 1;
		}
		res.json({task:{pause:defaultPause}});
		return;
	}

	if (reqTime.getTime() - lastOverRun.getTime()>1000 && defaultPause > 10) {
		lastOverRun = new Date();
		defaultPause-=5;
	}
	inProgress[req.params.mac] = new Object();
	inProgress[req.params.mac] = 1;
	var zCurrent = new Client(req.params.mac);
	zCurrent.task(req, res);
});

zeldaExpress.post('/:client(client|moblin)/:mac([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/pass/:taskid([0-9a-fA-F]{24})?', function(req, res){
	if (inProgress[req.params.mac]) {
		res.json({task:{pause:defaultPause}});
		overRun++;
		return;
	}
	var zCurrent = new Client(req.params.mac);
	zCurrent.pass(req, res);
});

zeldaExpress.post('/:client(client|moblin)/:mac([0-9a-fA-F]{12}|[0-9a-fA-F]{24})/fail/:taskid([0-9a-fA-F]{24})?', function(req, res){
	if (inProgress[req.params.mac]) {
		res.json({task:{pause:defaultPause}});
		overRun++;
		return;
	}
	log('got a fail');
	log(req.params.taskid);
	var zCurrent = new Client(req.params.mac);
	zCurrent.fail(req, res);
});

zeldaExpress.get('/version', function(req,res) {
  res.send(hyrule);
});

zeldaExpress.get('/moblin.js', function(req,res) {
  res.header('Content-Type', 'text/plain');
  res.send(newmoblin);
});

zeldaExpress.get('/fairy.js', function(req,res) {
  res.header('Content-Type', 'text/plain');
  res.send(newfairy);
});

zeldaExpress.listen(config.zelda.http.port);

// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//  That's web stuff, it's slow
//


//
//  This is socket stuff, it's fast
// vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv

var zelServer = net.createServer(zelOnCreate);
var zelSockID = 0;

function zelOnCreate(zelSock) {
  zelSock.setEncoding('utf8');
  zelSock.setNoDelay(true);
  zelSock.id = zelSockID++;
  zelSock.data = '';

  zelSock.on('data', zelSockOnData);  
  zelSock.on('end', zelSockOnEnd);
  zelSock.on('error', zelSockOnError);
}

function zelSockOnData(data) {
  this.data+=data;

  if (this.data.lastIndexOf(String.fromCharCode(3))!=this.data.length-1) {
    return;
  }
  
  var prevChunk = '';
  var chunks = this.data.split(String.fromCharCode(3));

  var defaultTask = "{\"task\":{\"pause\":\""+defaultPause+"\"}}";
  
  for (chunk in chunks) {
    if (chunks[chunk].length==0) {
      continue;
    }

    var moblinData = JSON.parse(chunks[chunk]);

    this.send = responseObjectSend;
    this.json = responseObjectJSON;
    
    var reqTime = new Date();

    if (inProgress[moblinData.params.mac]) {
      inProgress[moblinData.params.mac]++;
      if (inProgress[moblinData.params.mac] >= 5) {
        lastOverRun = new Date();
      }
      if (inProgress[moblinData.params.mac] >= 10) {
        log('THE BRAKES!');
        log(inProgress);
        defaultPause +=5;
        inProgress[moblinData.params.mac] = 1;
      }
      process.send({jsonOut:'earlyOut'});
      this.send(defaultTask);
    } else {

      if (reqTime.getTime() - lastOverRun.getTime()>1000 && defaultPause > 10) {
        lastOverRun = new Date();
        defaultPause-=5;
      }

      inProgress[moblinData.params.mac] = new Object();
      inProgress[moblinData.params.mac] = 1;

      var zCurrent = new Client(moblinData.params.mac);
      zCurrent.task(moblinData,this);
    }
  }
  this.data = '';
  
}  
    
function responseObjectSend(out) {
  if (this.destroyed||this.readyState=='closed') {
    log('zelSock'+this.id+' is dead.');
    return;
  }
  
  try {
    this.write(out);
    this.write(String.fromCharCode(3));
  } catch (err) {
    //Socket closed.
  }
}

function responseObjectJSON(out) {
  var output = JSON.stringify(out)
  if (this.destroyed||this.readyState=='closed') {
    log('zelSock'+this.id+' is dead.');
    return;
  }
  try {
    this.write(output);
    this.write(String.fromCharCode(3));
  } catch (err) {
    // Our socket closed.
  }
}

function zelSockOnEnd() {
  log('A moblin disconnected.');
}

function zelSockOnError(socketException) {
  handleSocketError(socketException);
}

zelServer.listen(config.zelda.socket.port, function zeldaSocketListen() {
  log('ZeldaSocket is listening on port '+config.zelda.socket.port+'.');
});

function handleSocketError(socketException) {
  switch(socketException.code) {
    case 'ECONNRESET':
      log('A moblin crashed.');
      break;
    case 'ECONNREFUSED':
      log('Try to repro this lol.');
      break;
    default:
      log(socketException);
  }
}

}
