const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("SERVER OK");
});

app.listen(3000, () => {
  console.log("🔥 TEST SERVER ACTIVO EN 3000");
});