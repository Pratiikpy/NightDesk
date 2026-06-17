import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMacroEvents, eventSeverity, macroWindowFor } from "../src/perception/macro";
import { parseYahooNews, newsCatalyst, type NewsItem } from "../src/perception/news";
import { buildPerceptionContext, NullEventProvider } from "../src/perception/events";

test("parseMacroEvents accepts a raw array or a {data:[]} envelope", () => {
  const raw = [{ date: "2026-03-03", events: ["CPI", "Nonfarm Payrolls"] }];
  assert.equal(parseMacroEvents(raw).length, 1);
  assert.equal(parseMacroEvents({ data: raw })[0]!.events.length, 2);
  assert.deepEqual(parseMacroEvents(null), []);
});

test("eventSeverity flags macro heavyweights as high", () => {
  assert.equal(eventSeverity("FOMC Rate Decision"), "high");
  assert.equal(eventSeverity("CPI"), "high");
  assert.equal(eventSeverity("PPI"), "medium");
  assert.equal(eventSeverity("Some minor survey"), "low");
});

test("macroWindowFor is active only on a high-severity macro day (ET date)", () => {
  const now = Date.parse("2026-03-03T18:00:00Z"); // ET date 2026-03-03
  const events = [{ date: "2026-03-03", events: ["CPI"] }];
  const w = macroWindowFor(events, now);
  assert.equal(w.active, true);
  assert.equal(w.severity, "high");
  assert.equal(macroWindowFor([{ date: "2099-01-01", events: ["CPI"] }], now).active, false);
});

test("parseYahooNews maps providerPublishTime to ms", () => {
  const items = parseYahooNews({ news: [{ title: "X", publisher: "P", providerPublishTime: 1700000000, link: "u" }] });
  assert.equal(items.length, 1);
  assert.equal(items[0]!.publishedAt, 1700000000 * 1000);
});

test("newsCatalyst is look-ahead-safe, relevance-filtered, and keyword-driven", () => {
  const now = 1_000_000_000_000;
  const items: NewsItem[] = [
    { title: "Apple beats earnings, raises guidance", publisher: "", publishedAt: now - 3_600_000, link: "" }, // relevant + catalyst
    { title: "Apple future headline", publisher: "", publishedAt: now + 3_600_000, link: "" }, // FUTURE → excluded
    { title: "Apple old earnings recap", publisher: "", publishedAt: now - 48 * 3_600_000, link: "" }, // too old → excluded
  ];
  const c = newsCatalyst(items, ["AAPL", "apple"], now, 24);
  assert.equal(c.fresh, true);
  assert.equal(c.relevantCount, 1, "only the in-window past Apple item counts");
  assert.match(c.matched[0]!, /earnings/);

  const quiet = newsCatalyst([{ title: "Apple stock drifts sideways", publisher: "", publishedAt: now - 3_600_000, link: "" }], ["AAPL", "apple"], now, 24);
  assert.equal(quiet.fresh, false);
});

test("newsCatalyst ignores a catalyst headline that is NOT about the company (no false positive)", () => {
  const now = 1_000_000_000_000;
  // A real catalyst keyword ("upgrades") but about AMD — must NOT fire for META.
  const items: NewsItem[] = [{ title: "Citi upgrades AMD shares to Buy", publisher: "", publishedAt: now - 3_600_000, link: "" }];
  const c = newsCatalyst(items, ["META", "meta platforms", "facebook"], now, 24);
  assert.equal(c.fresh, false);
  assert.equal(c.relevantCount, 0);
});

test("buildPerceptionContext abstains on a catalyst or a high-macro day, else trades", () => {
  const macroOff = { active: false, date: "", events: [], severity: "low" as const, summary: "" };
  const macroOn = { active: true, date: "d", events: ["CPI"], severity: "high" as const, summary: "CPI" };
  const newsFresh = { fresh: true, count: 1, relevantCount: 1, matched: ["earnings"], latestTitle: "earnings", summary: "catalyst" };
  const newsQuiet = { fresh: false, count: 0, relevantCount: 0, matched: [], latestTitle: null, summary: "no recent news" };

  assert.equal(buildPerceptionContext("AAPL", macroOff, newsFresh).abstainRecommended, true);
  assert.equal(buildPerceptionContext("AAPL", macroOn, newsQuiet).abstainRecommended, true);
  const trade = buildPerceptionContext("AAPL", macroOff, newsQuiet);
  assert.equal(trade.abstainRecommended, false);
  assert.equal(trade.severity, "none");
});

test("NullEventProvider never abstains (keeps sim offline + deterministic)", async () => {
  const c = await new NullEventProvider().contextFor("AAPL");
  assert.equal(c.abstainRecommended, false);
});
