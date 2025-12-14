const { Am } = require("@softwarepatterns/am");

const am = new Am({
  baseUrl: "https://example.com",
});

console.log(typeof am.login === "function");
