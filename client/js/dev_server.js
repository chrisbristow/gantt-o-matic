const http = require('http');
//const ws = require('ws');
const fs = require('fs');

const app_folder = ".";

//let loops = 10;

// Create a generic server:
const server = http.createServer((req, res) =>
{
  let file_name = app_folder + req.url;

  // Dispatch files on http request:
  dispatch_file(res, file_name);
});

// Create a WebSocket server linked to the generic http server:
//const wss = new ws.WebSocketServer({ server });

// Start a timer to broadcast updates to clients:
//setTimeout(() => send_it(0), 1000);

// If a client connects:
// wss.on('connection', function connection(ws)
// {
//   // On error:
//   ws.on('error', console.error);

//   // Show messages from the clients:
//   ws.on('message', function message(data)
//   {
//     console.log('Received: %s', data);
//   });

//   // Send a start-up message to the newly-connected client:
//   ws.send('Initialising');
// });

// Start the http server:
server.listen(8080);

// Broadcast to any WebSocket connected clients:
// function send_it(n)
// {
//   console.log("B: " + n);

//   // The ws module keeps a list of connected clients - loop through them:
//   wss.clients.forEach(function each(client)
//   {
//     if(client.readyState === ws.WebSocket.OPEN)
//     {
//       console.log("-");
//       client.send("From server: " + n + ": X");
//     }
//   });

//   loops --;

//   if(loops === 0)
//   {
//     process.exit(0);
//   }

//   setTimeout(() => send_it(n + 1), 1000);
// }

// Dispatch a request file via http:
function dispatch_file(res, file_name)
{
  fs.readFile(file_name, (err, filedata) =>
  {
    if(err)
    {
      res.statusCode = 400;
      res.end("File not found");
      console.log("File: " + file_name + " not found");
    }
    else
    {
      res.statusCode = 200;
      res.end(filedata);
      console.log("File: " + file_name + " dispatched");
    }
  });
}