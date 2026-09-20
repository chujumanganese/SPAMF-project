import express from "express";
import dotenv from "dotenv";
import { engine } from "express-handlebars";

import { scanController, scanWebsite } from "./controller/scanController.js";

dotenv.config();
const app = express();
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "hbs");
app.set("views", "./views");
app.use(express.static("./public"));
app.engine("hbs", engine({ defaultLayout: "main", extname: ".hbs" }));
app.use(express.json());  


app.get("/", (req, res) => {
  res.render("home", { title: "Home" });
});

app.get("/scan", scanController);
app.post("/scanwebsite", scanWebsite);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server is running on http://127.0.0.1:${PORT}`);
}); 