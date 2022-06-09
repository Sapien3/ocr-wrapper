const { exec } = require("child_process");
const executeScript = (script) => {
  exec(script, (error, stdout, stderr) => {
    console.log(stdout);
    console.log(stderr);
    if (error !== null) {
      console.log(`exec error: ${error}`);
    }
  });
};

const express = require("express");
const app = express();
const port = 3070;

app.get("/", (req, res) => {
  console.log("started excuting...");
  executeScript("bash pdfOcr.sh");
  res.send("done");
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
