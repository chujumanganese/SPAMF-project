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
app.engine("hbs", engine({ defaultLayout: "main", extname: ".hbs", partialsDir: './views/partials' }));
app.use(express.json());  

// initiate a web scan /api/scans
// monitor runtime message activity hook.js injected into the page 
// Block Unauthorized Cross-Origin Message enforce mode in hook.js, delivered by proxy.js
// Receive Vulnerability Report GET /api/reports/:id
// Generate Remediation Recommendation analyzer.js
// Configure Trusted-Origin Policy GET/PUT /api/policy
//  


app.get("/", (req, res) => {
  res.render("home", { title: "Home" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server is running on http://127.0.0.1:${PORT}`);
}); 