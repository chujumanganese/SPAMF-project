import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("IT WORKS!");
});

app.listen(3201, () => {
  console.log("LISTENING ON 3000");
});