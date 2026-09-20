import { chromium } from "playwright";
import { URL } from "node:url";

const DEFAULT_OPTIONS = {
    maxPages: 20,          // total pages visited across the whole crawl
    maxDepth: 2,            // link-following depth from the seed URL
    sameOriginOnly: true,   // don't wander off-domain
    idleWaitMs: 4000,       // how long to sit on each page after load, listening
    navTimeoutMs: 30000,
    concurrency: 1,         // pages processed one at a time (keep it simple/safe)
};

function buildInitScript() {
  return () => {
    const report = (entry) => { 
      try {
        window.__spmmfReport(entry);
      } catch (e) {
        // exposeFunction bridge can throw on non-serializable data; swallow
      }
    };

    // ---- Outgoing: window.postMessage(...) ----
    const originalPostMessage = window.postMessage.bind(window);
    window.postMessage = function (message, targetOrigin, transfer) {
      report({
        direction: "outgoing",
        url: location.href,
        targetOrigin: typeof targetOrigin === "object" ? targetOrigin?.targetOrigin : targetOrigin,
        wildcardOrigin: targetOrigin === "*",
        data: safeSerialize(message),
        stack: new Error().stack,
        timestamp: Date.now(),
      });
      return originalPostMessage(message, targetOrigin, transfer);
    };

    // ---- Incoming: window.addEventListener('message', handler) ----
    const originalAddEventListener = window.addEventListener.bind(window);
    window.addEventListener = function (type, listener, options) {
      if (type === "message" && typeof listener === "function") {
        const src = (() => {
          try {
            return listener.toString();
          } catch {
            return "";
          }
        })();

        const wrapped = function (event) {
          report({
            direction: "incoming",
            url: location.href,
            eventOrigin: event.origin,
            data: safeSerialize(event.data),
            handlerSource: src.slice(0, 500),
            looksLikeItChecksOrigin: /\.origin\b/.test(src),
            timestamp: Date.now(),
          });
          return listener.call(this, event);
        };
        return originalAddEventListener(type, wrapped, options);
      }
      return originalAddEventListener(type, listener, options);
    };

    function safeSerialize(value) {
      try {
        // structured-cloneable check via JSON; falls back to String()
        return JSON.parse(JSON.stringify(value));
      } catch {
        try {
          return String(value);
        } catch {
          return "<unserializable>";
        }
      }
    }
  };
}

async function crawlPage(browser, url, findings, opts) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const discoveredLinks = new Set();

  try {
    // Bridge for the injected hook to report structured data back to Node
    await page.exposeFunction("__spmmfReport", (entry) => {
      findings.push(entry);
    });

    await page.addInitScript(buildInitScript());

    page.on("pageerror", (err) => {
      findings.push({
        direction: "page_error",
        url,
        message: err.message,
        timestamp: Date.now(),
      });
    });

    await page.goto(url, {
      waitUntil: "load",
      timeout: opts.navTimeoutMs,
    });

    // Give async postMessage traffic (ads, iframes, OAuth popups, timers)
    // a real chance to fire before we tear the page down.
    await page.waitForTimeout(opts.idleWaitMs);

    // Collect same-origin links for the crawl queue
    if (opts.sameOriginOnly) {
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
      const base = new URL(url);
      for (const href of hrefs) {
        try {
          const u = new URL(href);
          if (u.origin === base.origin) discoveredLinks.add(u.toString().split("#")[0]);
        } catch {
          // ignore malformed hrefs
        }
      }
    }
  } catch (err) {
    findings.push({
      direction: "crawl_error",
      url,
      message: err.message,
      timestamp: Date.now(),
    });
  } finally {
    await context.close(); // closes the page too; never leaks even on throw
  }

  return discoveredLinks;
}

async function crawler(seedUrl, userOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...userOptions };
  const findings = [];
  const visited = new Set();
  const queue = [{ url: seedUrl, depth: 0 }];

  const browser = await chromium.launch({ headless: true });

  try {
    while (queue.length > 0 && visited.size < opts.maxPages) {
      const { url, depth } = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);

      console.log(`[crawl] (${visited.size}/${opts.maxPages}) depth=${depth} ${url}`);
      const links = await crawlPage(browser, url, findings, opts);

      if (depth < opts.maxDepth) {
        for (const link of links) {
          if (!visited.has(link)) queue.push({ url: link, depth: depth + 1 });
        }
      }
    }
  } finally {
    await browser.close();
  }

  const summary = {
    seedUrl,
    pagesVisited: visited.size,
    totalMessages: findings.filter((f) => f.direction === "incoming" || f.direction === "outgoing").length,
    outgoing: findings.filter((f) => f.direction === "outgoing").length,
    incoming: findings.filter((f) => f.direction === "incoming").length,
    wildcardOutgoing: findings.filter((f) => f.direction === "outgoing" && f.wildcardOrigin).length,
    incomingNoOriginCheckHeuristic: findings.filter(
      (f) => f.direction === "incoming" && !f.looksLikeItChecksOrigin
    ).length,
    errors: findings.filter((f) => f.direction === "crawl_error" || f.direction === "page_error").length,
  };

 

  console.log("================================");
  console.log("Crawl complete.");
  console.table(summary);
  console.log(`Full findings written to ${opts.outputFile}`);

  return { summary, findings };
}

export default crawler;
