var crypto = require('crypto');
var fs     = require('fs');
var http   = require('http');
var fork   = require('child_process').fork;
var util   = require('util');

var appName = 'fairy';
var appStart = new Date();

var hyrule = new Object();
hyrule.moblins = new Array();
hyrule.moblins.push(fork('moblin.js'));

var moblin = hyrule.moblins[0];

fs.readFile('moblin.js', 'utf8', function(err, data) {
  if (err) throw err;
  moblin.md5 = crypto.createHash('md5').update(data).digest('hex');
  console.log('['+new Date().toISOString()+'] MD5: '+moblin.md5);
});

moblin.on('message', function moblinMessage(m) {
  handleMoblinMessage(m);
});

hyrule.fairy = new Object();
var fairy = hyrule.fairy;

hyrule.zeldaIP = '10.30.0.73';

hyrule.zeldaDownload = {
  host: hyrule.zeldaIP,
  method: 'GET',
  path: '/moblin.js',
  port: 3000
};

hyrule.zeldaVersion = {
  host: hyrule.zeldaIP,
  method: 'GET',
  path: '/version',
  port: 3000
};

fairy.checkCount = 0;
fairy.prevCheckCount = 0;
fairy.dlCount = 0;
fairy.prevDlCount = 0;
fairy.versionCheckRate = 5000;
fairy.versionCheckInterval = setInterval(moblinVersionCheck, fairy.versionCheckRate);

function moblinVersionCheck () {
  fairy.checkCount++;

  var versionData='';

  var versionRequest = http.request(hyrule.zeldaVersion, function(res) {
    res.setEncoding('utf8');
    res.on('data', function resVersionData(data) {
      versionData += data;
    });
    res.on('end', function resVersionEnd() {
      handleVersionCheck(versionData);
    });
    res.on('close', function resVersionClose(error) {
      console.log(error);
    });
  });

  versionRequest.on('error', function versionRequestError(socketException) {
    handleRequestError(socketException);
  });

  versionRequest.end();
}

function handleVersionCheck(data) {
  if (!fairy.umbilicalCord) {
    console.log('['+new Date().toISOString()+'] Fairy found Zelda.');
    fairy.umbilicalCord = true;
  }

  var remoteHyrule = JSON.parse(data);

  fairy.prevCheckCount = fairy.checkCount;

  hyrule.remoteMD5 = remoteHyrule.moblin.md5;

  if (remoteHyrule.moblin.md5!=moblin.md5) {
    console.log('['+new Date().toISOString()+'] Zelda says she is in Hyrule v'+remoteHyrule.version);
    console.log('['+new Date().toISOString()+'] Zelda\'s MD5: '+remoteHyrule.moblin.md5);
    console.log('['+new Date().toISOString()+'] Your MD5:    '+moblin.md5);
    console.log('['+new Date().toISOString()+'] Downloading new moblin.js');

    if (!fairy.timeoutDownload) {
      fairy.timeoutDownload = setTimeout(moblinDownload, 50);
    }
  }
}

function moblinDownload() {
  fairy.dlCount++;

  if (fairy.dlCount >=50) {
    clearTimeout(fairy.timeoutDownload);
    fairy.dlCount = 0;
  }

  var downloadRequest = http.request(hyrule.zeldaDownload, function(res) {
    res.setEncoding('utf8');
    var fNewMoblin = fs.createWriteStream('newmoblin.js');
    res.on('data', function resDownloadData(chunk) {
      fNewMoblin.write(chunk);
    });
    res.on('close', function resDownloadClose(error) {
      console.log(error);
    });
    res.on('end', function resDownloadEnd() {
      fNewMoblin.end();
      handleDownloadFinished();
    });
  });

  downloadRequest.on('error', function downloadRequestError(socketException) {
    handleRequestError(socketException);
    if (!fairy.timeoutDownload) {
      fairy.timeoutDownload = setTimeout(moblinDownload, 1000);
    }
  });

  downloadRequest.end();
}

function handleDownloadFinished(data) {
  if (!fairy.umbilicalCord) {
    console.log('['+new Date().toISOString()+'] Found Zelda.');
    fairy.umbilicalCord = true;
  }

  fs.readFile('newmoblin.js', 'utf8', function verifyNewMoblin(err, data) {
    if (err) throw err;
    var newMoblinMD5 = crypto.createHash('md5').update(data).digest('hex');
    if (newMoblinMD5 != hyrule.remoteMD5) {
      console.log('['+new Date().toISOString()+'] Problem with download, try again.');
      fairy.timeoutDownload = setTimeout(moblinDownload, 1000);
      return;
    }

    clearInterval(fairy.versionCheckInterval);

    // Probably should do something to make sure we don't fork bomb.
    // Also make sure new version can at least launch and handle tasks.

    moblin.send({fairy: 'Hold on a sec.'});

    hyrule.moblins.push(fork('newmoblin.js'));
    var newMoblin = hyrule.moblins[hyrule.moblins.length-1];
    newMoblin.md5 = newMoblinMD5;
    newMoblin.on('message', function newMoblinMessage(m) {
      handleMoblinMessage(m);
    });
    fairy.timeoutDownload = null;
  });
}

function handleMoblinMessage(m) {
  switch (m.moblin) {
    case 'I handled my first task.':
      if (hyrule.moblins.length>1) {
        fs.rename('newmoblin.js', 'moblin.js', function renameNewMoblin(err) {
          var oldMoblin = hyrule.moblins.shift();
          oldMoblin.send({fairy:'Goodbye.'});
          moblin = hyrule.moblins[0];

          fairy.versionCheckInterval = setInterval(moblinVersionCheck, fairy.versionCheckRate);
        });
      }
      break;
    default:
      console.log(m.moblin);
  }
}

function handleRequestError(socketException) {
    switch(socketException.code) {
      case 'ECONNRESET':
        console.log('['+new Date().toISOString()+'] Zelda just died.');
        moblin.umbilicalCord = false;
        break;
      case 'ECONNREFUSED':
        console.log('['+new Date().toISOString()+'] Can\'t find Zelda.');
        moblin.umbilicalCord = false;
        break;
      default:
        console.log(socketException);
    }
}



