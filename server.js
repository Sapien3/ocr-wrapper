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

//queue indicates the priority of which file to process first
let queue = [];
let pagesCount;

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

async function normalProcess(file, res, index) {
  const filename = file.filename;
  queue[index].status = "current";
  console.log(`bash ./pdfOcr.sh ./outputs/${filename}`);
  exec(`bash ./pdfOcr.sh ./outputs/${filename}`, (error, stdout, stderr) => {
    console.log(stdout);
    console.log(stderr);
    if (error !== null) {
      console.log(`exec error: ${error}`);
    }
    pdfToBinary(res, filename);
  });
}

function pdfToBinary(res, filename) {
  fs.readdir("./outputs", (err, files) => {
    if (err) throw err;
    files.forEach((file) => {
      const fileWithoutEx = filename.split(".")[0];
      const target = file.match(`${fileWithoutEx}_searchable`);
      if (target) {
        processFile(file, res);
      }
    });
  });
}

function processFile(file, res) {
  fs.readFile(`./outputs/${file}`, function (err, data) {
    if (err) throw err;

    const currentQueue = queue.find((e) => e.status === "current");
    console.log("currentQueue: ", currentQueue);
    const index = queue.indexOf(currentQueue);
    const buffArr = new Uint8Array(data);
    console.log("Unassigned int length: ", buffArr.length);

    if (is200(res)) {
      // res.send(buffArr);
      queue[index].binary = buffArr;
      queue[index].status = "done";
      res.status(200).end("finished processing");
      console.log("last queue check: ", queue);
      clean();
      console.log("queue from process file: ", queue);
      return;
    }

    res.status(201).send(buffArr);
    queue[index].binary = buffArr;
    queue[index].status = "done";
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
  pagesCount = pdfDoc.getPageCount();
  if (pagesCount === 1) {
    normalProcess(file, res);
    return;
  }

  await batchProcess(file, res, pdfDoc);
}

async function batchProcess(file, res, pdfDoc) {
  const filename = file.filename;
  // const url = `./outputs/${filename}`;
  await splitPdf(pdfDoc);
  // await sleep(4000);
  fs.readdir("./outputs", async (err, files) => {
    if (err) throw err;

    queue = files
      .filter((file) => file.match("splittedFile"))
      .map((e) => ({ file: e, status: "pending", binary: [] }))
      .sort((a, b) => {
        const aOrder = Number(a.file.match(/\d+/)[0]);
        const bOrder = Number(b.file.match(/\d+/)[0]);
        return aOrder - bOrder;
      });
    console.log("queue from batchProcessing: ", queue);

    const firstPendingFile = queue.find((e) => e.status === "pending");
    const index = queue.indexOf(firstPendingFile);
    normalProcess({ filename: firstPendingFile.file }, res, index);
  });
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

app.post("/store", (req, res) => {
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
  });
});

function is200(res) {
  const is200 = queue.every((e) => e.status !== "pending");
  return is200;
}
app.post("/queue", (req, res) => {
  console.log("queue: ", queue);
  if (is200(res)) {
    res.status(200).end("finished processing");
    clean();
    return;
  }
  const firstPendingFile = queue.find((e) => e.status === "pending");
  const index = queue.indexOf(firstPendingFile);
  normalProcess({ filename: firstPendingFile.file }, res, index);
});

app.get("/getPagesCount", (req, res) => {
  console.log("pagesCount: ", pagesCount);
  res.send({ pagesCount });
});

app.get("/mergePDF", (req, res) => {
  console.log("started mergingPDF...");
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
