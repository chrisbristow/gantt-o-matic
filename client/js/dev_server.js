const http = require('http');
const fs = require('fs');

const app_folder = ".";

// Create a generic server:
const server = http.createServer((req, res) =>
{
  let file_name = app_folder + req.url;

  // Dispatch files on http request:
  dispatch_file(res, file_name);
});

// Start the http server:
server.listen(8080);

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