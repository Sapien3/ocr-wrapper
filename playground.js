const { exec } = require("child_process");
let acontroller = new AbortController();
let signal = acontroller.signal;
let child = {};
function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function dos() {
  child = exec("echo bahaa", async (err, stdout, stderr) => {
    if (err) throw err;
    console.log(stdout);
    console.log(stderr);
    await sleep(5000);
    if (signal.aborted) return;
    logss();
  });
}

function logss() {
  console.log("done");
}
dos();
sleep(2000).then(() => {
  console.log("time to kill");
  acontroller.abort();
  child.kill();
});
