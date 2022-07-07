const fs = require("fs");
const { exec } = require("child_process");
const PDFDocument = require("pdf-lib").PDFDocument;
const { sortElements, moveElement, is200, extractNumber } = require("./utils");

global.output_dir = "./outputs";
global.temp_dir = "./temp";

//queue indicates the priority of which file to process first
global.queue = [];
global.pagesCount = undefined;
global.requestedPage = -1;
global.childProcess = null;

async function batchProcess(file, res) {
  // console.log("file: ", file);
  const filename = file.filename;
  const url = `${output_dir}/${filename}`;
  const docmentAsBytes = await fs.promises.readFile(url);
  const pdfDoc = await PDFDocument.load(docmentAsBytes);
  pagesCount = pdfDoc.getPageCount();
  await splitPdf(pdfDoc);
  fs.readdir(output_dir, async (err, files) => {
    if (err) throw err;
    const filteredFiles = files.filter((file) => !file.includes("_searchable"));
    queue = filteredFiles
      .filter((file) => file.match("splittedFile"))
      .map((e) => ({ file: e, status: "pending", binary: [] }))
      .map((e) => ({ ...e, page: extractNumber(e.file) }));
    queue = sortElements(queue);
    // console.log("queue from batchProcessing: ", queue);

    executeNextQueue(res);
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

function executeNextQueue(res) {
  const currentQueue = queue.find((e) => e.status === "current");
  const firstPendingFile = queue.find((e) => e.status === "pending");
  // console.log("firstPendingFile: ", firstPendingFile);
  const index = queue.indexOf(firstPendingFile);
  if (!firstPendingFile && currentQueue) {
    return pdfToBinary(res, currentQueue.file);
  }
  queue[index].status = "current";
  runCommand(res, index);
}

async function runCommand(res, queueIndex) {
  const filename = queue[queueIndex].file;
  console.log(`bash ./pdfOcr.sh ${output_dir}/${filename}`);
  childProcess = exec(
    `bash ./pdfOcr.sh ${output_dir}/${filename}`,

    (error, stdout, stderr) => {
      let killed = false;
      if (error) {
        try {
          queue[queueIndex].status = "pending";
          const fileWithoutEx = queue[queueIndex].file.split(".")[0];
          fs.unlinkSync(`${output_dir}/${fileWithoutEx}_searchable.pdf`);
        } catch {
          /*do nothing*/
        }
        killed = error.killed;
        killed ? null : console.log(`exec error: ${error}`);
      }

      if (killed) return;
      // console.log("stout: ", stdout);
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
    fs.readFile(`${output_dir}/${target}`, function (err, data) {
      if (err) return;
      const currentQueue = queue.find((e) => e.status === "current");
      if (!currentQueue) return;
      // console.log("queue from processFile: ", queue);
      // read current queue binary and then store it in the queue
      const index = queue.indexOf(currentQueue);
      const buffArr = new Uint8Array(data);
      // console.log("Unassigned int length: ", buffArr.length);
      const isFirstRequest = queue.every((e) => e.status !== "done");
      //sends a json object containing the binary data if it is the first request
      if (isFirstRequest) res.status(200).send(buffArr);
      queue[index].binary = buffArr;
      queue[index].status = "done";
      queue = sortElements(queue);

      if (is200(queue)) return;

      executeNextQueue(res);
    });
  } catch (e) {
    console.log("pdfToBinary error: ", e);
  }
}

async function writePdfBytesToFile(fileName, pdfBytes) {
  return fs.promises.writeFile(`${output_dir}/${fileName}`, pdfBytes);
}

async function mergePdf(res) {
  const mergedDocument = await PDFDocument.create();
  fs.readdir(output_dir, async (err, files) => {
    files = files.filter((file) => file.includes("_searchable"));
    files = files.sort((a, b) => extractNumber(a) - extractNumber(b));
    for (let file of files) {
      const docAsBytes = await fs.promises.readFile(`${output_dir}/${file}`);
      const Doc = await PDFDocument.load(docAsBytes);
      const [copiedPage] = await mergedDocument.copyPages(Doc, [0]);
      mergedDocument.addPage(copiedPage);
    }
    const pdfBytes = await mergedDocument.save();

    // await writePdfBytesToFile("merged.pdf", pdfBytes);

    res.status(200).send(pdfBytes);
    clean();
  });
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
    executeNextQueue(res);
  }
}

function clean() {
  try {
    fs.rmSync(temp_dir, { recursive: true, force: true });
    fs.rmSync(output_dir, { recursive: true, force: true });
    fs.mkdirSync(output_dir);
  } catch (e) {
    console.log("cleaning problem: ", e);
  }
}

function killProcess(process) {
  try {
    process.kill();
    fs.rmSync(temp_dir, { recursive: true, force: true });
  } catch (e) {
    console.log("kill error: ", e);
  }
}

module.exports = {
  clean,
  killProcess,
  changePriority,
  mergePdf,
  batchProcess,
};
