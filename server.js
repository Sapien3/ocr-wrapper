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
const multer = require("multer");
const { exec } = require("child_process");

// app.use(express.json());
app.use(cors());
// app.use(
//   cors({
//     origin: "http://localhost:3000",
//   })
// );
// app.use("/pdf", express.static(__dirname + "/inputs"));
// app.use("/pdf", express.static(__dirname + "/imgs"));
const port = 3070;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./outputs");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname.split(" ").join("-"));
  },
});

const upload = multer({ storage: storage }).single("file");

function clean() {
  fs.readdir("./outputs", (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(`./outputs/${file}`, (err) => {
        if (err) throw err;
      });
    }
  });
}

function pdfToBinary(res) {
  fs.readdir("./outputs", (err, files) => {
    if (err) throw err;
    files.forEach((file) => {
      const target = file.match("_searchable");
      if (target) {
        console.log(file);
        processFile(file);
      }
    });
  });

  function processFile(file) {
    fs.readFile(`./outputs/${file}`, function (err, data) {
      const buffArr = new Uint8Array(data);
      console.log(buffArr);
      // res.setHeader("Content-Type", "application/octet-stream");
      res.send(buffArr);
    });
  }
}

async function script(file, res) {
  const filename = file.filename;
  console.log(`bash ./pdfOcr.sh ./outputs/${filename}`);
  exec(`bash ./pdfOcr.sh ./outputs/${filename}`, (error, stdout, stderr) => {
    console.log(stdout);
    console.log(stderr);
    if (error !== null) {
      console.log(`exec error: ${error}`);
    }
    pdfToBinary(res);
    clean();
  });
}

app.post("/", (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json(err);
    } else if (err) {
      return res.status(500).json(err);
    }
    // console.log("file: ", req.file);
    script(req.file, res);
    // return res.status(200).send(req.file);
  });
});

app.get("/", (req, res) => {
  res.send("connected\n");
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
