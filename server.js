const express = require("express");
const app = express();
const cors = require("cors");
const multer = require("multer");
const { sleep, is200 } = require("./utils");
const {
  clean,
  killProcess,
  changePriority,
  mergePdf,
  batchProcess,
} = require("./actions");

app.use(express.json());
app.use(cors());
const port = 3070;
console.log(output_dir);

//middleware to handle file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, output_dir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname.split(" ").join("-"));
  },
});

const upload = multer({ storage: storage }).single("file");

app.post("/store", async (req, res) => {
  clean();
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json(err);
    } else if (err) {
      return res.status(500).json(err);
    }

    batchProcess(req.file, res);
  });
});

app.get("/getPagesCount", (req, res) => {
  console.log("pagesCount: ", pagesCount);
  res.send({ pagesCount });
});

app.get("/mergePDF", (req, res) => {
  try {
    if (is200(queue)) {
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

  let i = 0;
  const waitingTime = 300;
  const maxTime = 60 * 1000;
  //after giving the priority, recurese until the process is finsihed
  recurse();
  async function recurse() {
    if (i > maxTime) return res.status(204).end();
    const wantedQueueBinary = queue.find((e) => e.page === page).binary;
    if (!wantedQueueBinary.length) {
      i += waitingTime;
      await sleep(waitingTime);
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
  }
  res.status(200).send("available");
});
app.get("/", (req, res) => {
  res.send("connected\n");
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
