// const { exec } = require("child_process");
// const executeScript = (script) => {
//   exec(script, (error, stdout, stderr) => {
//     console.log(stdout);
//     console.log(stderr);
//     if (error !== null) {
//       console.log(`exec error: ${error}`);
//     }
//   });
// };

// const express = require("express");
// const app = express();
// const port = 3070;

// app.get("/", (req, res) => {
//   console.log("started excuting...");
//   executeScript("pdfOcr ./inputs/normal-ocr.pdf");
//   res.send("done");
// });

// app.listen(port, () => {
//   console.log(`app listening on port ${port}`);
// });

const fs = require("fs");
const express = require("express");
const app = express();
const cors = require("cors");

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);
app.use("/pdf", express.static(__dirname + "/inputs"));
// app.use("/pdf", express.static(__dirname + "/imgs"));
const port = 3070;

app.post("/", (req, res) => {
  console.log("body", req.body);
  console.log("files", req.files);
  // executeScript("pdfOcr ./inputs/normal-ocr.pdf");
  res.send("done\n");
});

app.get("/", (req, res) => {
  // executeScript("pdfOcr ./inputs/normal-ocr.pdf");

  // res.send(`<a href="normal-ocr.pdf">normal-ocr.pdf</a>`);
  // const file = fs.ReadStream("./inputs/normal-ocr.pdf");
  // fs.readFile("./inputs/normal-ocr.pdf", function (err, data) {
  fs.readFile("./inputs/searchable.pdf", function (err, data) {
    // Display the file content
    const buffArr = new Uint8Array(data);
    console.log(buffArr);
    // res.setHeader("Content-Type", "application/pdf");
    res.send(buffArr);
    // console.log(data);
    // res.end(Buffer.from(data, "binary"));
    // res.setHeader("Content-Type", "application/pdf");
    // res.setHeader("Content-Type", "MimeType");
    // res.pipe(buffArr);
  });

  // const file = fs.createReadStream("./inputs/searchable.pdf");
  // const stat = fs.statSync("./inputs/searchable.pdf");
  // res.setHeader("Content-Length", stat.size);
  // res.setHeader("Content-Type", "application/pdf");
  // res.setHeader("Content-Disposition", "attachment; filename=searchable.pdf");
  // file.pipe(res);
  // console.log(file);

  // console.log("done");
  // res.send(file);
  // res.send(file);
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
