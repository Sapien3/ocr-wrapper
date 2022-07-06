const fs = require("fs");
const express = require("express");
const app = express();
const cors = require("cors");
const multer = require("multer");
const { exec } = require("child_process");
const pm2 = require("pm2");

app.use(express.json());
app.use(cors());
const port = 3070;

//queue indicates the priority of which file to process first
let queue = [];
let pagesCount;
let requestedPage = -1;
let childProcess = null;
// let isMainThread = true;

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

function clean(filename = null) {
  try {
    fs.rmSync("./temp", { recursive: true, force: true });
    fs.rmSync("./outputs", { recursive: true, force: true });
    fs.mkdirSync("./outputs");
  } catch (e) {
    /*do nothing*/
    console.log("cleaning problem: ", e);
  }
  // fs.readdir("./outputs", (err, files) => {
  //   if (err) throw err;

  //   // if (filename) files = files.filter((file) => file !== filename);
  //   // for (const file of files) {
  //   //   fs.unlink(`./outputs/${file}`, (err) => {
  //   //     if (err) console.log("file not found: ", file);
  //   //   });
  //   // }
  // });
}

async function normalProcess(res, queueIndex) {
  const filename = queue[queueIndex].file;
  console.log(`bash ./pdfOcr.sh ./outputs/${filename}`);
  childProcess = exec(
    `bash ./pdfOcr.sh ./outputs/${filename}`,

    (error, stdout, stderr) => {
      let killed = false;
      if (error) {
        try {
          queue[queueIndex].status = "pending";
          const fileWithoutEx = queue[queueIndex].file.split(".")[0];
          fs.unlinkSync(`./outputs/${fileWithoutEx}_searchable.pdf`);
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
  try {
    console.log("pdfToBinary: ", filename);
    const fileWithoutEx = filename.split(".")[0];
    const target = `${fileWithoutEx}_searchable.pdf`;
    fs.readFile(`./outputs/${target}`, function (err, data) {
      if (err) return;
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
      queue = sortElements(queue);
      if (is200()) {
        // console.log(queue);
        // return clean();
        return;
      }

      executeNextScript(res);
    });
  } catch (e) {
    console.log("pdfToBinary error: ", e);
  }
}

async function batchProcess(file, res) {
  console.log("file: ", file);
  // if (childProcess) {
  //   await sleep(1000);
  //   killProcess(childProcess, true, file.originalname);
  // }
  const filename = file.filename;
  const url = `./outputs/${filename}`;
  const docmentAsBytes = await fs.promises.readFile(url);
  const pdfDoc = await PDFDocument.load(docmentAsBytes);
  pagesCount = pdfDoc.getPageCount();
  await splitPdf(pdfDoc);
  fs.readdir("./outputs", async (err, files) => {
    if (err) throw err;
    const filteredFiles = files.filter((file) => !file.includes("_searchable"));
    queue = filteredFiles
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
    killProcess(childProcess);
    moveElement(queue, index, currentQueue);
    // console.log("queue after changePriority: ", queue);
    executeNextScript(res);
  }
}

function killProcess(process) {
  try {
    // if (hardKill) {
    //   process.kill();
    //   console.log("hardKill");
    //   queue = [];
    //   pagesCount;
    //   requestedPage = -1;
    //   childProcess = null;
    //   clean();
    // } else {
    process.kill();
    fs.rmSync("./temp", { recursive: true, force: true });
    // }
  } catch (e) {
    //do nothing
    console.log("kill error: ", e);
  }
}

app.post("/store", async (req, res) => {
  // if (childProcess) {
  //   killProcess(childProcess, true);
  //   await sleep(1000);
  // }
  clean();
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json(err);
    } else if (err) {
      return res.status(500).json(err);
    }
    // console.log("file: ", req.file);
    batchProcess(req.file, res);
    // normalProcess(req.file, res);
    // playground(req.file, res);
  });
});

app.get("/getPagesCount", (req, res) => {
  console.log("pagesCount: ", pagesCount);
  res.send({ pagesCount });
});

app.get("/mergePDF", (req, res) => {
  try {
    if (is200()) {
      return mergePdf(res);
    }
    res.status(204).end("not ready");
  } catch {
    //do nothing
  }
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

app.get("/checkAvailability", (req, res) => {
  //if there is a process running, kill the mainThread
  //then pm2 will automatically restart the server
  if (childProcess) {
    res.status(200).send("killing main thread");
    killProcess(childProcess);
    process.exit(2);
    // pm2.disconnect();
  }
  res.status(200).send("available");
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
