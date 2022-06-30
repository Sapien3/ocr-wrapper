const { exec } = require("child_process");
const process = require("process");
// let acontroller = new AbortController();
// let signal = acontroller.signal;
let signal = false;
let child = {};
function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function dos() {
  child = exec(
    `bash ./pdfOcr.sh ./outputs/splittedFile-4.pdf`,
    { killSignal: "SIGINT" },
    async (err, stdout, stderr) => {
      // if (signal) {
      //   console.log(child.pid);
      //   return;
      // }
      if (err) console.log("err: ", err.killed);
      throw err;
      // await sleep(5000);
      // console.log(stdout);
      // console.log(stderr);
      // logss();
    }
  );
}

function logss() {
  console.log("done");
}
dos();
sleep(1000).then(() => {
  console.log(`time to kill ${child.pid}`);
  child.kill();
  // child.kill("SIGINT");
  // console.log(process.kill(child.pid, 0));
  // signal = true;
});
