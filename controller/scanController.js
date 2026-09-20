import crawler from "../crawler/crawler.js";

function scanController(req, res) {
    res.render("scan", { title: "Website Scanner"});
}

async function scanWebsite(req, res){
    const { url } = req.body;
    const {summary, findings } = await crawler(url);
    console.log(summary);
    res.render("scan", { title:"Website scanner", result: summary});
}

export {scanController, scanWebsite};