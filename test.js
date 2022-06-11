const fs = require("fs");

// async function read() {
//   const buffer = fs.readFile("./inputs/normal-ocr.pdf");
//   console.log(buffer);
// }

// read();

fs.readFile("./inputs/normal-ocr.pdf", function (err, data) {
  // Display the file content
  console.log(data);
});
