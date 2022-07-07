function extractNumber(str) {
  return Number(str.match(/\d+/)[0]);
}

module.exports = {
  sleep: function (time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  },
  sortElements: function (arr) {
    return arr.sort((a, b) => {
      const aOrder = extractNumber(a.file);
      const bOrder = extractNumber(b.file);
      return aOrder - bOrder;
    });
  },
  moveElement: function (arr, from, to) {
    arr.splice(to, 0, arr.splice(from, 1)[0]);
  },
  is200: function (queue) {
    const is200 = queue.every((e) => e.status === "done");
    return is200;
  },
  extractNumber,
};
