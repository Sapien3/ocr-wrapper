// const { exec } = require("child_process");
// let acontroller = new AbortController();
// let signal = acontroller.signal;
// let child = {};
// function sleep(time) {
//   return new Promise((resolve) => setTimeout(resolve, time));
// }

// async function dos() {
//   child = exec("echo bahaa", async (err, stdout, stderr) => {
//     if (err) throw err;
//     console.log(stdout);
//     console.log(stderr);
//     await sleep(5000);
//     if (signal.aborted) return;
//     logss();
//   });
// }

// function logss() {
//   console.log("done");
// }
// dos();
// sleep(2000).then(() => {
//   console.log("time to kill");
//   acontroller.abort();
//   child.kill();
// });

class Queue {
  constructor(arr) {
    this.queue = arr;
  }

  resetStatus() {
    this.queue = this.queue.map((item) => ({
      file: item,
      status: "pending",
      page: extractNumber(item),
      binary: [],
    }));
  }

  sortAsc() {
    this.queue = this.queue.sort((a, b) => {
      const aOrder = extractNumber(a.file);
      const bOrder = extractNumber(b.file);
      return aOrder - bOrder;
    });
  }

  isFirstRequest() {
    return this.queue.every((e) => e.status !== "done");
  }

  findFirstPendingIndex() {
    return this.queue.findIndex((item) => item.status === "pending");
  }

  findCurrentIndex() {
    return this.queue.findIndex((item) => item.status === "current");
  }

  resetCurrent() {
    const currentIndex = this.findCurrentIndex();
    this.queue[currentIndex].status = "pending";
  }

  makeCurrent(index) {
    this.queue[index].status = "current";
  }

  makeDone(index) {
    this.queue[index].status = "done";
  }

  getCorrespondingFile(index) {
    const currentIndex = this.findCurrentIndex();
    const fileWithoutEx = this.queue[currentIndex].file.split(".")[0];
    const targetName = `${fileWithoutEx}_searchable.pdf`;
    return targetName;
  }

  moveItem(from, to) {
    const item = this.queue.splice(from, 1)[0];
    this.queue.splice(to, 0, item);
  }

  findPageBinary(page) {
    return this.queue.find((item) => item.file === page).binary;
  }

  findPageIndex(page) {
    return this.queue.findIndex((item) => item.page === page);
  }

  setBinary(index, bufferArray) {
    this.queue[index].binary = bufferArray;
  }

  setStatus(index, status) {
    this.queue[index].status = status;
  }

  is200() {
    return this.queue.every((item) => item.status === "done");
  }

  getIndexFromName(name) {
    return this.queue.findIndex((item) => item.file === name);
  }
}

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;

  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

function extractNumber(str) {
  return Number(str.match(/\d+/)[0]);
}

const fs = require("fs");

fs.readdir("./outputs", (err, files) => {
  // let wantedFiles = files.filter(file => file.includes("splittedFile") && !file.includes("_searchable"));
  // wantedfiles = shuffle(wantedFiles);
  let wantedFiles = ["splitted-1", "splitted-2"];

  const myQueue = new Queue(wantedFiles);
  myQueue.resetStatus();
  // myQueue.moveItem(0, 1);
  // myQueue.setStatus(1, "current");
  // myQueue.setStatus(3, "done");
  // myQueue.setStatus(4, "done");
  // myQueue.sortAsc();
  // const a = myQueue.getCorrespondingFile(4);
  console.log(myQueue.queue);
});
