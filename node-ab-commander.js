var exec = require('child_process').exec;

var express = require('express');
var app = express();

var SERVER_PORT = 7117;

function startWebServer() {
  app.listen(parseInt(SERVER_PORT, 10));
  console.log('stress test client listening on port ' + SERVER_PORT);
}

function puts(error, stdout, stderr) { console.log(stdout); }

app.get('/st/:nbrOfConcurrentClients/:nbrOfRequests/:targetUrl*', function(req, res) {
  try {
    var targetUrl = req.params.targetUrl;
    var nbrOfConcurrentClients = req.params.nbrOfConcurrentClients;
    var nbrOfRequests = req.params.nbrOfRequests;
    console.log('Starting test with ' + nbrOfRequests + ' requests to ' + targetUrl + ' (' + nbrOfConcurrentClients + ' concurrent clients)');
    exec("ab -n " + nbrOfRequests + " -c " + nbrOfConcurrentClients + " " + targetUrl, puts);
    res.writeHead(200);
    res.end();
  } catch (err) {
    console.log('error processing request (' + req.url + '): ' + err);
  }
});

startWebServer();
