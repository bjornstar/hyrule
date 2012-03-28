var mongodb = require('mongodb');

var ObjectID = mongodb.ObjectID;

var serverHyrule = new mongodb.Server('localhost', 27017);
var dbHyrule = new mongodb.Db('hyrule', serverHyrule, {});
var cMachines = new mongodb.Collection(dbHyrule, 'machines');
var cJobs = new mongodb.Collection(dbHyrule, 'jobs');
var cTasks = new mongodb.Collection(dbHyrule, 'tasks');
var cLogs = new mongodb.Collection(dbHyrule, 'logs');

var hyrule = new Object();
hyrule.appName = 'Ganon';
hyrule.appStart = new Date();

function log(data) {
  console.log("["+new Date().toISOString()+"] "+hyrule.appName+"."+process.pid+": "+JSON.stringify(data));
}

dbHyrule.open(function() {
  log('Welcome to Hyrule.');
  var timeDBOpen = new Date();
  log('It took ' + (timeDBOpen.getTime() - hyrule.appStart.getTime()) + 'ms for ' + hyrule.appName + ' to connect to the database.');
});


var ganonTimer = 1000;
var secondsago = 10;

function ganonTime() {
  var now = new Date();
  var onesecondago = new Date(now.getTime-1000);
  var findObject = new Object();
  findObject["$or"] = new Array();
  findObject["$or"].push({"jobs.tasks.timeout":{$lt:onesecondago}});
  findObject["$or"].push({"jobs.timeout":{$lt:now}});

  cMachines.find(findObject).toArray( function(fError, fMachines) {
    if (fError) {
      log(fError);
    }
    if (fMachines.length) {
      failMachine(fMachines, now);
    }
    var end = new Date();
    //log("job  timeout: "+(end.getTime()-now.getTime()));
  });
}

function failMachine(machines, when) {
  for (machine in machines) {
    var fMachine = machines[machine];

    var findObject = new Object();
    findObject._id = fMachine._id;

    var updateJobObject = new Object();
    updateJobObject["$pull"] = new Object();

    var uJO = updateJobObject["$pull"]; // shortcut for updateJobObject["$pull"]

    log("Machine: "+fMachine._id);

    var jRemove = new Array();

    for (job in fMachine.jobs) {
      var fJob = fMachine.jobs[job];
      if (!fJob.started) { // Not started yet, so it couldn't have timed out. Move along.
        continue;
      }

      if (fJob.locked) { // Job is locked, come back later.
        continue;
      }

      log("Job:     " + fJob._id + " " + fJob.timeout);

      var tRemove = new Array();

      var updateTaskObject = new Object();
      updateTaskObject["$pull"] = new Object();

      var uTO = updateTaskObject["$pull"]; // shortcut for updateTaskObject["$pull"]

      for (task in fJob.tasks) {
        var fTask = fJob.tasks[task];
        if (!fTask.started) { //Not started yet, so it couldn't have timed out. Move along.
          continue;
        }

        if (fTask.timeout >= when) {
          continue;
        }

        log("Task:    " + fTask._id + " " + fTask.timeout + " " + when + " " + new Date().toISOString());

        var tLog = fTask;
        tLog.machine = fMachine._id;
        tLog.job = fJob._id;
        tLog.timouted = when;

        cTasks.insert(tLog);

        uTO["jobs."+job+".tasks"] = new Object();
        uTO["jobs."+job+".tasks"]._id = tLog._id;

        tRemove.push(fTask._id);
      }

      while (tRemove.length) {
        var tSplice = tRemove.shift();
        for (task in fJob.tasks) {
          if (fJob.tasks[task]._id == tSplice) {
            fJob.tasks.splice(task,1);
            break;
          }
        }
      }

      cMachines.update(findObject, updateTaskObject, function(err, callback) {
        if (err) {
          log("error updating machines.");
        } else {
          log("removed task "+JSON.stringify(updateTaskObject));
        }
      });

      if (fJob.tasks.length==0 || fJob.timeout < when) {
        var jLog = fJob;
        jLog.machine = fMachine._id;
        jLog.timeouted = when;
        delete jLog.tasks;

        cJobs.insert(jLog);

        uJO['jobs'] = new Object();
        uJO['jobs']._id = jLog._id;

        jRemove.push(fJob._id);
      }
    }

    while (jRemove.length) {
      var jSplice = jRemove.shift();
      for (job in fMachine.jobs) {
        if (fMachine.jobs[job]._id == jSplice) {
          fMachine.jobs.splice(job,1);
          break;
        }
      }
    }

    cMachines.update(findObject, updateJobObject, function(err, callback) {
      var end = new Date();
      if (err) {
        log("error updating machines.");
      } else {
        log("removed job  "+JSON.stringify(updateJobObject));
      }
    });
  }
}		

function idleTimeout() {
  var now = new Date();
  var sometimeago = new Date(now.getTime()-secondsago*1000);

  var findObject = new Object();
  findObject.alive = true;
  findObject.lastseen = new Object();
  findObject.lastseen['$lt'] = sometimeago;

  var setObject = {'$set':{alive:false}};

  cMachines.update(findObject, setObject, {safe:true, multi:true, upsert:false}, function () {
    var end = new Date();
    log("idle timeout: "+(end.getTime()-now.getTime()));
  });
}

function taskTimeout() {
  var now = new Date();
  var sometimeago = new Date(now.getTime()-secondsago*1000);

  var findObject = new Object();
  findObject.live = true;
  findObject['entries.ts'] = new Object();
  findObject['entries.ts']['$lt'] = sometimeago.getTime();

  var setObject = {'$set':{live:false}};
log(findObject);
  cLogs.update(findObject, setObject, {safe:true, multi:true, upsert:false}, function() {
    var end = new Date();
    log("task timeout: "+(end.getTime()-now.getTime()));
  });
}

setInterval(idleTimeout, ganonTimer);
setInterval(ganonTime, ganonTimer);
setInterval(taskTimeout, ganonTimer);
