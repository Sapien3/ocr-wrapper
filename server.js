const fs = require("fs");
const express = require("express");
const app = express();
const cors = require("cors");
const multer = require("multer");
const { exec } = require("child_process");

app.use(express.json());
app.use(cors());
const port = 3070;

//queue indicates the priority of which file to process first
let pagesCount;
let requestedPage = -1;
let childProcess = {};
// let acontroller = {};
// let signal = {};

// class Queue{
//   constructor(arr){
//       this.queue = arr;
//   }

//   resetStatus() {
//     this.queue = this.queue.map(item => ({file:item, status:'pending',binary:[]}));
//   }

//   sortAsc() {
//     this.queue = this.queue.sort((a, b) => {
//       const aOrder = extractNumber(a.file);
//       const bOrder = extractNumber(b.file);
//       return aOrder - bOrder;
//     })
//   }

//   isFirstRequest(){
//     return  this.queue.every((e) => e.status !== "done");
//   }

//   findFirstPendingIndex(){
//       return this.queue.findIndex(item => item.status === "pending");
//   }

//   findCurrentIndex(){
//       return this.queue.findIndex(item => item.status === "current");
//   }

//   makeCurrent(index){
//       this.queue[index].status = "current";
//   }

//   makeDone(index){
//       this.queue[index].status = "done";
//   }

//   getCorrespondingFile(index){
//     const currentIndex = this.findCurrentIndex();
//     const fileWithoutEx = this.queue[currentIndex].file.split(".")[0];
//     const targetName = `${fileWithoutEx}_searchable.pdf`
//     return targetName;
//   }

//   setBinary(index, bufferArray){
//       this.queue[index].binary = bufferArray;
//   }

//   setStatus(index, status){
//       this.queue[index].status = status;
//   }

//   is200(){
//       return this.queue.every(item => item.status === "done");
//   }
// }

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

    fs.rmSync("./temp", { recursive: true, force: true });

    for (const file of files) {
      fs.unlink(`./outputs/${file}`, (err) => {
        if (err) throw err;
      });
    }
  });
}

async function normalProcess(res, queueIndex) {
  // acontroller = new AbortController();
  // signal = acontroller.signal;
  // const filename = file.filename;

  const filename = queue[queueIndex].file;
  console.log(`bash ./pdfOcr.sh ./outputs/${filename}`);
  childProcess = exec(
    `bash ./pdfOcr.sh ./outputs/${filename}`,

    (error, stdout, stderr) => {
      let killed = false;
      // if (queue[queueIndex].aborted) return;
      // console.log("stdout: ", stdout);

      if (error) {
        try {
          const fileWithoutEx = queue[queueIndex].file.split(".")[0];
          fs.unlinkSync(`./outputs/${fileWithoutEx}_searchable.pdf`);
          queue[queueIndex].status = "pending";
        } catch {
          /*do nothing*/
        }
        killed = error.killed;
        killed ? null : console.log(`exec error: ${error}`);
      }

      if (killed) return;
      console.log("stderr: ", stderr);
      pdfToBinary(res, filename);
    }
  );
}

function pdfToBinary(res, filename) {
  console.log("pdfToBinary: ", filename);
  const fileWithoutEx = filename.split(".")[0];
  const target = `${fileWithoutEx}_searchable.pdf`;
  fs.readFile(`./outputs/${target}`, function (err, data) {
    if (err) return;
    // if (signal.aborted) {
    //   console.log("aborted signal");
    //   return;
    // }
    const currentQueue = queue.find((e) => e.status === "current");
    if (!currentQueue) return;
    // console.log("queue from processFile: ", queue);
    // console.log("currentQueue: ", currentQueue);
    const index = queue.indexOf(currentQueue);
    const buffArr = new Uint8Array(data);
    // console.log("Unassigned int length: ", buffArr.length);
    const isFirstRequest = queue.every((e) => e.status !== "done");
    if (isFirstRequest) res.status(200).send(buffArr);
    queue[index].binary = buffArr;
    queue[index].status = "done";
    childProcess = {};
    queue = sortElements(queue);
    if (is200()) {
      // console.log(queue);
      // return clean();
      return;
    }

    executeNextScript(res);
  });
}

// function processFile(file, res) {
//   fs.readFile(`./outputs/${file}`, function (err, data) {
//     if (err) throw err;
//     if (signal.aborted) {
//       console.log("aborted signal");
//       return;
//     }
//     const currentQueue = queue.find((e) => e.status === "current");
//     console.log("queue from processFile: ", queue);
//     console.log("currentQueue: ", currentQueue);
//     const index = queue.indexOf(currentQueue);
//     const buffArr = new Uint8Array(data);
//     console.log("Unassigned int length: ", buffArr.length);
//     const isFirstRequest = queue.every((e) => e.status !== "done");
//     if (isFirstRequest) res.status(201).send(buffArr);
//     queue[index].binary = buffArr;
//     queue[index].status = "done";
//     acontroller = {};
//     signal = {};
//   });

//   if (is200()) {
//     console.log(queue);
//     return clean();
//   }

//   executeNextScript(res);
// }

async function script(file, res) {
  // const fileType = file["mimetype"].match("pdf") ? "pdf" : "image";

  // if (fileType === "image") {
  //   normalProcess(file, res);
  //   return;
  // }

  // const filename = file.filename;
  // const url = `./outputs/${filename}`;
  // const docmentAsBytes = await fs.promises.readFile(url);
  // const pdfDoc = await PDFDocument.load(docmentAsBytes);
  // pagesCount = pdfDoc.getPageCount();
  // if (pagesCount === 1) {
  //   normalProcess(file, res);
  //   return;
  // }

  await batchProcess(file, res);
}

async function batchProcess(file, res) {
  const filename = file.filename;
  const url = `./outputs/${filename}`;
  const docmentAsBytes = await fs.promises.readFile(url);
  const pdfDoc = await PDFDocument.load(docmentAsBytes);
  pagesCount = pdfDoc.getPageCount();
  await splitPdf(pdfDoc);
  fs.readdir("./outputs", async (err, files) => {
    if (err) throw err;

    queue = files
      .filter((file) => file.match("splittedFile"))
      .map((e) => ({ file: e, status: "pending", binary: [] }))
      .map((e) => ({ ...e, page: extractNumber(e.file) }));
    queue = sortElements(queue);
    // console.log("queue from batchProcessing: ", queue);

    executeNextScript(res);
  });
  return;
}

function extractNumber(str) {
  return Number(str.match(/\d+/)[0]);
}

function executeNextScript(res) {
  const currentQueue = queue.find((e) => e.status === "current");
  const firstPendingFile = queue.find((e) => e.status === "pending");
  // console.log("firstPendingFile: ", firstPendingFile);
  const index = queue.indexOf(firstPendingFile);
  if (!firstPendingFile && currentQueue) {
    return pdfToBinary(res, currentQueue.file);
  }
  queue[index].status = "current";
  normalProcess(res, index);
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

async function mergePdf(res) {
  const mergedDocument = await PDFDocument.create();
  fs.readdir("./outputs", async (err, files) => {
    files = files.filter((file) => file.includes("_searchable"));
    files = files.sort((a, b) => extractNumber(a) - extractNumber(b));
    for (let file of files) {
      const docAsBytes = await fs.promises.readFile(`./outputs/${file}`);
      const Doc = await PDFDocument.load(docAsBytes);
      const [copiedPage] = await mergedDocument.copyPages(Doc, [0]);
      mergedDocument.addPage(copiedPage);
    }
    const pdfBytes = await mergedDocument.save();

    // fs.writeFile("./outputs/merged.pdf", pdfBytes, (err) => {
    //   if (err) throw err;
    //   console.log("merged file saved");
    //   console.log(queue);
    //   // res.status(200).download("./outputs/merged.pdf");
    //   res.status(200).send(pdfBytes);
    //   // clean();
    // });
    res.status(200).send(pdfBytes);
    clean();
  });
}

async function writePdfBytesToFile(fileName, pdfBytes) {
  return fs.promises.writeFile(`./outputs/${fileName}`, pdfBytes);
}

function is200() {
  const is200 = queue.every((e) => e.status === "done");
  return is200;
}

function sortElements(arr) {
  return arr.sort((a, b) => {
    const aOrder = extractNumber(a.file);
    const bOrder = extractNumber(b.file);
    return aOrder - bOrder;
  });
}
function moveElement(arr, from, to) {
  arr.splice(to, 0, arr.splice(from, 1)[0]);
}

function changePriority(pageNum, res) {
  const index = queue.findIndex((e) => e.page === pageNum);
  // const currentIndex = queue.findIndex((e) => e.status === "current");
  const currentQueue = queue.find((e) => e.status === "current");
  const currentIndex = queue.indexOf(currentQueue);
  if (index !== currentIndex) {
    killProcess(childProcess, currentIndex);
    moveElement(queue, index, currentQueue);
    // console.log("queue after changePriority: ", queue);
    executeNextScript(res);
  }
}

function killProcess(process, queueIndex) {
  // const queueToKill = queue[queueIndex];
  process.kill();
  fs.rmSync("./temp", { recursive: true, force: true });
  // const redundantFile = queue.filter(e => e.status !== "done" )
  // fs.readdir("./outputs", async (err, files) => {
  //   const wantedFiles = files.filter((e) => e.includes("_searchable"));
  //   for (let file of wantedFiles) {
  //     const correspondingFile = file.split("_")[0];
  //     const relatedQueueIndex = queue.findIndex(
  //       (e) => e.file === `${correspondingFile}.pdf`
  //     );
  //     if (queue[relatedQueueIndex].status !== "done") {
  //       fs.unlinkSync(`./outputs/${file}`);
  //     }
  //   }
  // });
  // const fileWithoutEx = queueToKill.file.split(".")[0];
  // fs.unlinkSync(`./outputs/${fileWithoutEx}_searchable.pdf`);
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

app.post("/queue", (req, res) => {
  console.log("queue: ", queue);
  // if (is200(res)) {
  //   console.log("queue is 200");
  //   res.status(200).end("finished processing");
  //   clean();
  //   return;
  // }
  // const firstPendingFile = queue.find((e) => e.status === "pending");
  // const index = queue.indexOf(firstPendingFile);
  // normalProcess({ filename: firstPendingFile.file }, res, index);
});

app.get("/getPagesCount", (req, res) => {
  console.log("pagesCount: ", pagesCount);
  res.send({ pagesCount });
});

app.get("/mergePDF", (req, res) => {
  if (is200()) {
    return mergePdf(res);
  }
  res.status(204).end("not ready");
});

app.post("/requestBatch", async (req, res) => {
  console.log("req: ", req.body);
  const page = req.body.page;
  requestedPage = page;
  const localRequestedPage = page;
  //waiting here is for preventing fast calls on page switches
  await sleep(2500);
  if (requestedPage !== localRequestedPage) {
    // console.log(`batch ignored:  ${requestedPage} !== ${localRequestedPage}`);
    res.status(204).end();
    return;
  }
  const prcocessingFinished = queue.every((e) => e.status !== "pending");
  const pageQueue = queue.filter((e) => e.page === page);
  if (!prcocessingFinished && !pageQueue[0].binary.length) {
    changePriority(localRequestedPage, res);
  }

  //after giving the priority, recurese until the process is finsihed
  recurse();
  async function recurse() {
    const wantedQueueBinary = queue.find((e) => e.page === page).binary;
    if (!wantedQueueBinary.length) {
      await sleep(300);
      // console.log("recurse");
      return recurse();
    }
    // console.log(page, "binary: ", wantedQueueBinary);
    return res.status(200).send(wantedQueueBinary);
  }
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
  pagesCount = pdfDoc.getPageCount();
  await splitPdf(pdfDoc);

  //merge
  const mergedDocument = await PDFDocument.create();
  fs.readdir("./outputs", async (err, files) => {
    for (let file of files) {
      const target = file.match("splittedFile");
      if (!target) continue;

      const docAsBytes = await fs.promises.readFile(`./outputs/${file}`);
      const Doc = await PDFDocument.load(docAsBytes);
      const [copiedPage] = await mergedDocument.copyPages(Doc, [0]);
      mergedDocument.addPage(copiedPage);
    }
    const pdfBytes = await mergedDocument.save();

    fs.writeFile("./outputs/merged.pdf", pdfBytes, (err) => {
      if (err) throw err;
      console.log("merged file saved");
    });
  });

  // clean();
}
