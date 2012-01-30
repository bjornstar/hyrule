var crypto = require("crypto");
var fs     = require("fs");
var http   = require("http");
var fork   = require("child_process").fork;
var util   = require("util");

var defaultConfig = new Object();
defaultConfig.zelda = new Object();
defaultConfig.zelda.http = {"host":"localhost","port":3000};

if (config===undefined) {
  var config = defaultConfig;
}

var hyrule = new Object();
hyrule.appName = "Fairy";
hyrule.appStart = new Date();
hyrule.moblins = new Object();
hyrule.fairy = new Object();

var fairy = hyrule.fairy;
fairy.readyState = "starting";

var parallelMoblins = 1;

if (process.argv[2]&&process.argv[2].match(/^\d+$/g)>0) {
  parallelMoblins = parseInt(process.argv[2]);
}

function log(data) {
  console.log("["+new Date().toISOString()+"] "+hyrule.appName+"."+process.pid+": "+util.inspect(data));
}

fairy.versionCheckRate = 1000;
fairy.versionCheckInterval = setInterval(moblinVersionCheck, fairy.versionCheckRate);
fairy.statsDelay = 1000;

fs.readFile("fairy.js", "utf8", function(err, data) {
  if (err) throw err;
  fairy.md5 = crypto.createHash("md5").update(data).digest("hex");
  log(" Fairy MD5: "+fairy.md5);
});

function launchMoblin() {
  fs.readFile("moblin.js", "utf8", function(err, data) {
    if (err) {
      log("Cannot find moblin.js, will download from Zelda.");
      outofdate = true;
      return;
    }
    var moblinMD5 = crypto.createHash("md5").update(data).digest("hex");
    log("Moblin MD5: "+moblinMD5);

    log("Spawning a moblin.");
    var newMoblin = fork("moblin.js"); // This doesn't launch moblin until the file is read and MD5 is performed.

    log("Moblin."+newMoblin.pid+" launched.");

    process.on("exit", function () {
      newMoblin.send({fairy:"Goodbye."});
    });

    newMoblin.md5 = moblinMD5;
    newMoblin.on("message", handleMoblinMessage);
    newMoblin.on("exit", handleMoblinExit);
    newMoblin.earlyCount = 0;
    newMoblin.lateCount = 1;
    newMoblin.readyState = "starting";
    hyrule.moblins[newMoblin.pid] = newMoblin;
  });
}

function handleMoblinExit(code, signal) {
  log("Moblin."+this.pid+" exited with code "+code);
}

hyrule.zeldaDownload = {
  host: config.zelda.http.host,
  method: "GET",
  path: "/moblin.js",
  port: config.zelda.http.port
};

hyrule.zeldaVersion = {
  host: config.zelda.http.host,
  method: "GET",
  path: "/version",
  port: config.zelda.http.port
};

function moblinVersionCheck () {
  var versionData="";

  var versionRequest = http.request(hyrule.zeldaVersion, function(res) {
    versionRequest.on("error", handleSocketError);
    res.setEncoding("utf8");
    res.on("data", function resVersionData(data) {
      versionData += data;
    });
    res.on("end", function resVersionEnd() {
      handleVersionCheck(versionData);
    });
    res.on("close", function resVersionClose(error) {
      log(error);
    });
  });

  versionRequest.on("error", handleSocketError);
  versionRequest.end();
}

var outofdate = false;
 
function handleVersionCheck(data) {
  if (!fairy.umbilicalCord) {
    log("I found Zelda.");
    fairy.umbilicalCord = true;
  }

  var remoteHyrule = JSON.parse(data);
  fairy.prevCheckCount = fairy.checkCount;
  hyrule.remoteMD5 = remoteHyrule.moblin.md5;

  for (moblinPID in hyrule.moblins) {
    var checkMoblin = hyrule.moblins[moblinPID];

    if (remoteHyrule.moblin.md5==checkMoblin.md5) {
      continue;
    }
    if (checkMoblin.stdin && !checkMoblin.destroyed && checkMoblin.exitcode==null) {
      outofdate = true;
    }
  }
  if (!outofdate) {
    return;
  }
  if (fairy.timeoutDownload) {
    return;
  }
  if (fairy.readyState=="downloading"||fairy.readyState=="verifying") {
    return;
  }
  fairy.readyState = "downloading";
  log("Zelda says she is in Hyrule v"+remoteHyrule.version);
  log("Remote MD5: "+remoteHyrule.moblin.md5);
  log("Downloading new moblin.js");

  fairy.timeoutDownload = setTimeout(moblinDownload, 50);
}

function moblinDownload() {
  delete fairy.timeoutDownload;

  var downloadRequest = http.request(hyrule.zeldaDownload, function(res) {
    downloadRequest.on("error", function downloadRequestError(socketException) {
      handleSocketError(socketException);
      if (!fairy.timeoutDownload) {
        fairy.timeoutDownload = setTimeout(moblinDownload, 1000);
      }
    });

    res.setEncoding("utf8");
    var fNewMoblin = fs.createWriteStream("newmoblin.js");
    res.on("data", function resDownloadData(chunk) {
      fNewMoblin.write(chunk);
    });
    res.on("close", function resDownloadClose(error) {
      console.log(error);
    });
    res.on("end", function resDownloadEnd() {
      fNewMoblin.end();
      handleDownloadFinished();
    });
  });

  downloadRequest.on("error", function downloadRequestError(socketException) {
    log("downloadRequestError");
    handleSocketError(socketException);
    if (!fairy.timeoutDownload) {
      fairy.timeoutDownload = setTimeout(moblinDownload, 1000);
    }
  });

  downloadRequest.end();
}

function handleDownloadFinished(data) {
  if (!fairy.umbilicalCord) {
    log("Found Zelda.");
    fairy.umbilicalCord = true;
  }

  clearInterval(fairy.versionCheckInterval);
  delete fairy.versionCheckInterval;

  fs.readFile("newmoblin.js", "utf8", function verifyNewMoblin(err, data) {
    if (err) {
      log("Problem reading newmoblin.js, trying again.");
      if (!fairy.timeoutDownload) {
        fairy.timeoutDownload = setTimeout(moblinDownload, 1000);
        return;
      }
    }

    var newMoblinMD5 = crypto.createHash("md5").update(data).digest("hex");
    if (newMoblinMD5 != hyrule.remoteMD5) {
      log("Problem with download, trying again.");
      log(newMoblinMD5);
      log(hyrule.remoteMD5);
      if (!fairy.timeoutDownload) {
        fairy.readyState = "downloading";
        fairy.timeoutDownload = setTimeout(moblinDownload, 1000);
        return;
      }
    }

    outofdate = false;

    for (moblinPID in hyrule.moblins) {
      var updateMoblin = hyrule.moblins[moblinPID];
      if (updateMoblin.stdin && !updateMoblin.stdin.destroyed && updateMoblin.md5!=hyrule.remoteMD5) {
        updateMoblin.send({fairy: "Hold on a sec."});
        updateMoblin.readyState = "paused";
      }
    }

    fairy.readyState="verifying";

    if (hyrule.moblins.length>parallelMoblins+1) {
      log("Plenty of moblins around, not launching a new one.");
      return;
    } else {
      log(hyrule.moblins.length+" moblins nearby, I can spawn a new one.");
    }

    log("Spawning a newmoblin.");
    var newMoblin = fork("newmoblin.js");

    newMoblin.md5 = newMoblinMD5;
    newMoblin.on("message", handleMoblinMessage);
    newMoblin.on("exit", handleMoblinExit);
    newMoblin.earlyCount = 0;
    newMoblin.lateCount = 1;
    newMoblin.readyState = "starting";
    hyrule.moblins[newMoblin.pid] = newMoblin;

    //fairy.timeoutStartup = setTimeout(failedMoblinStartup, 1000); // This is probably bad too.
    delete fairy.timeoutDownload;
  });
}

function handleMoblinMessage(m) {
  if (!fairy.versionCheckInterval) {
    fairy.versionCheckInterval = setInterval(moblinVersionCheck, fairy.versionCheckRate);
  }
  if (m.early) {
    this.earlyCount+=m.early;
  }
  if (m.late) {
    this.lateCount+=m.late;
  }
  if (!m.moblin) {
    return;
  }
  switch (m.moblin) {
    case "I died.":
      delete hyrule.moblins[this.pid]; 
      break;
    case "I handled my first task.":
      if (hyrule.remoteMD5==undefined) {
        fairy.readyState = "running";
        this.readyState = "running";
        log("Moblin."+this.pid+" handled its first task.");
        return;
      }

      if (fairy.readyState=="verifying") {
        fairy.readyState = "running";
        this.readyState = "running";

        log("Moblin."+this.pid+" is verified to be running properly.");

        fs.rename("newmoblin.js", "moblin.js", function renameNewMoblin(err) {
          if (err) {
            return;
          }

          for (moblinPID in hyrule.moblins) {
            var oldMoblin = hyrule.moblins[moblinPID];
            if (oldMoblin.stdin && !oldMoblin.stdin.destroyed && oldMoblin.readyState=="paused") {
              oldMoblin.send({fairy:"Goodbye."});
            }
          }

          if (!fairy.versionCheckInterval) {
            fairy.versionCheckInterval = setInterval(moblinVersionCheck, fairy.versionCheckRate);
          }
          clearTimeout(fairy.timeoutStartup);
          delete fairy.timeoutStartup;
        });
        return;
      }

      if (this.md5==hyrule.remoteMD5) {
        this.readyState = "running";
        log("Moblin."+this.pid+" is current & running.");
        return;
      }

      break;
   default:
      console.log(m);
  }
}

function areMoblinsAlive() {
  oldMoblins = new Array();
  deadMoblins = new Array();
  liveMoblins = new Array();
  for (moblinPID in hyrule.moblins) {
    var moblinC = hyrule.moblins[moblinPID];
    if (moblinC.exitCode!=null) {
      deadMoblins.push(moblinPID);
    }
    if (moblinC.md5!=hyrule.remoteMD5) {
      oldMoblins.push(moblinPID);
    }
    if (fairy.timeoutDownload||fairy.timeoutStartup) {
      log("DOWNLOAD IN PROGRESS.");
      return;
    }
    liveMoblins.push(moblinPID);
  }
  if (liveMoblins.length<parallelMoblins) {
    launchMoblin();
  }
}

areMoblinsAlive();
hyrule.areMoblinsAliveInterval = setInterval(areMoblinsAlive,1500);

fairy.statsInterval = setInterval(fairyStats, fairy.statsDelay);

function fairyStats() {
  var output1 = '';
  var output2 = '';
  for (moblin in hyrule.moblins) {
    mC = hyrule.moblins[moblin];
    output1 += ' '+pad(mC.pid+'',9);
    output2 += ' '+pad(mC.earlyCount+'',4)+' '+pad(Math.round(fairy.statsDelay/mC.lateCount)+'',4);
    mC.earlyCount=0;
    mC.lateCount=1;
  }
  log(output1);
  log(output2);
}

function pad(str,howmany) {
  while(str.length < howmany) {
    str = ' '+str;
  }
  return str;
}

function failedMoblinStartup() {
  /*
  console.log("New moblin failed to start up.");
  if (hyrule.moblins[hyrule.moblins.length-1].stdin && !hyrule.moblins[hyrule.moblins.length-1].stdin.destroyed) {
    hyrule.moblins[hyrule.moblins.length-1].send({fairy: "Goodbye."});
  } else {
    hyrule.moblins[hyrule.moblins.length-1].kill();
    //delete hyrule.moblins[hyrule.moblins.length-1];
  }
  if (hyrule.moblins[0].stdin && !hyrule.moblins[0].stdin.destroyed) {
    hyrule.moblins[0].send({fairy: "OK, keep going."});
  }
  fairy.versionCheckInterval = setInterval(moblinVersionCheck, fairy.versionCheckRate);
  */
}

function handleSocketError(socketException) {
  switch(socketException.code) {
    case "ECONNRESET":
      if (fairy.umbilicalCord||fairy.umbilicalCord===undefined) {
        log("I saw Zelda die.");
        fairy.umbilicalCord = false;
      }
      break;
    case "ECONNREFUSED":
      if (fairy.umbilicalCord||fairy.umbilicalCord===undefined) {
        log("I can't find Zelda.");
        fairy.umbilicalCord = false;
      }
      break;
    default:
      log(socketException);
  }
}
