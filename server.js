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

function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

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
        processFile(file, res);
      }
    });
  });
}

function processFile(file, res) {
  fs.readFile(`./outputs/${file}`, function (err, data) {
    if (err) throw err;
    // console.log(data);
    const buffArr = new Uint8Array(data);
    // const buffArr = Buffer.from(data);
    // console.log(buffArr);
    res.setHeader("Content-Type", "application/octet-stream");
    // res.writeHead(200, {
    //   "Content-Length": Buffer.byteLength(buffArr),
    //   "Content-Type": "application/octet-stream; charset=utf-8",
    // });
    res.status(201).send(buffArr);
    // res.write("OK");
    // sleep(3000).then(() => {
    //   res.write(JSON.stringify(buffArr));
    //   res.end();
    // });
    // res.write(JSON.stringify(buffArr));
    // res.end();
  });
}

async function script(file, res) {
  const fileType = file["mimetype"].match("pdf") ? "pdf" : "image";

  if (fileType === "image") {
    normalProcess(file, res);
    return;
  }

  const filename = file.filename;
  const url = `./outputs/${filename}`;
  const docmentAsBytes = await fs.promises.readFile(url);
  const pdfDoc = await PDFDocument.load(docmentAsBytes);
  const pagesCount = pdfDoc.getPageCount();
  if (pagesCount <= 2) {
    normalProcess(file, res);
    return;
  }

  await batchProcess(file, res, pdfDoc);
  // clean();
}

async function normalProcess(file, res) {
  const filename = file.filename;
  console.log(`bash ./pdfOcr.sh ./outputs/${filename}`);
  exec(`bash ./pdfOcr.sh ./outputs/${filename}`, (error, stdout, stderr) => {
    console.log(stdout);
    console.log(stderr);
    if (error !== null) {
      console.log(`exec error: ${error}`);
    }
    pdfToBinary(res);
    // sleep(3000).then(() => res.status(200).send(new Uint8Array([1, 2, 3, 4])));
    clean();
  });
}

async function batchProcess(file, res, pdfDoc) {
  //contains files names order of which to excute correspondingly
  const queue = [];

  const filename = file.filename;
  // const url = `./outputs/${filename}`;
  await splitPdf(pdfDoc);
  // await sleep(4000);
  fs.readdir("./outputs", async (err, files) => {
    if (err) throw err;

    for (let i = 0; i < files.length; i++) {
      const wantedFile = files[i].match("splittedFile");
      if (!wantedFile) continue;
      if (i === 1) {
        await normalProcess({ filename: files[i] }, res);
      }
    }
  });
  // res.status(200).send("OK");
  return;
}

async function splitPdf(pdfDoc) {
  const numberOfPages = pdfDoc.getPages().length;

  for (let i = 0; i < numberOfPages; i++) {
    // Create a new "sub" document
    const subDocument = await PDFDocument.create();
    // copy the page at current index
    const [copiedPage] = await subDocument.copyPages(pdfDoc, [i]);
    subDocument.addPage(copiedPage);
    const pdfBytes = await subDocument.save();
    await writePdfBytesToFile(`splittedFile-${i + 1}.pdf`, pdfBytes);
  }
}

async function writePdfBytesToFile(fileName, pdfBytes) {
  return fs.promises.writeFile(`./outputs/${fileName}`, pdfBytes);
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
    // normalProcess(req.file, res);
    // playground(req.file, res);
    // return res.status(200).send(req.file);
  });
});

app.get("/", (req, res) => {
  res.send("connected\n");
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});

const PDFDocument = require("pdf-lib").PDFDocument;

async function playground(file, res) {
  const filename = file.filename;
  const url = `./outputs/${filename}`;
  const docmentAsBytes = await fs.promises.readFile(url);
  const pdfDoc = await PDFDocument.load(docmentAsBytes);
  const pagesLength = pdfDoc.getPageCount();
  const docPages = pdfDoc.getPages();
  const firstPage = docPages[0];
  const { width, height } = firstPage.getSize();
  console.log(
    "pagesLength: ",
    pagesLength,
    "width: ",
    width,
    "height: ",
    height
  );

  const newDoc = await PDFDocument.create();
  // const [pdfDocFirstPage] = await newDoc.copyPages(pdfDoc, [0]);
  // newDoc.addPage(pdfDocFirstPage);
  newDoc.addPage([50, 30]);
  newDoc.addPage([200, 200]);
  const pdfBytes = await newDoc.save();
  res.send(pdfBytes);

  clean();
}
