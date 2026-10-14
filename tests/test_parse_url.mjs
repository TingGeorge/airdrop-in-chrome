// Unit tests for parseUserUrl / findUrlInText (the "Send a Link" input).
// Run: node tests/test_parse_url.mjs
globalThis.chrome = {};
const { parseUserUrl, findUrlInText, isShareable } = await import("../extension/native.js");

const parseCases = [
  // Full URLs
  ["https://example.com/a?b=1#c", "https://example.com/a?b=1#c"],
  ["  http://example.com  ", "http://example.com/"],
  ["HTTPS://EXAMPLE.COM", "https://example.com/"],
  ["https://例子.测试/路径", "https://xn--fsqu00a.xn--0zwm56d/%E8%B7%AF%E5%BE%84"],
  ["https://user:pass@example.com/", "https://user:pass@example.com/"],
  ["http://[::1]:8080/x", "http://[::1]:8080/x"],
  // Bare domains get https
  ["example.com", "https://example.com/"],
  ["www.apple.com/iphone", "https://www.apple.com/iphone"],
  ["README.md", "https://readme.md/"],
  // Dev servers / LAN devices get http
  ["localhost", "http://localhost/"],
  ["localhost:3000", "http://localhost:3000/"],
  ["example.com:8080/x", "http://example.com:8080/x"],
  ["192.168.1.10/admin", "http://192.168.1.10/admin"],
  ["[::1]:8080", "http://[::1]:8080/"],
  ["[::1]", "http://[::1]/"],
  ["https://[::1]/x].", "https://[::1]/x"],
  // Pasted from chats and documents
  ["<https://example.com/a>", "https://example.com/a"],
  ['"https://example.com/a"', "https://example.com/a"],
  ["“https://example.com/a”", "https://example.com/a"],
  ["(https://example.com/a)", "https://example.com/a"],
  ["https://example.com/a).", "https://example.com/a"],
  ["https://example.com/a.", "https://example.com/a"],
  ["https://example.com/a,", "https://example.com/a"],
  ["https://example.com/a!?", "https://example.com/a"],
  ["https://en.wikipedia.org/wiki/Mercury_(planet)", "https://en.wikipedia.org/wiki/Mercury_(planet)"],
  ["https://en.wikipedia.org/wiki/Mercury_(planet)).", "https://en.wikipedia.org/wiki/Mercury_(planet)"],
  ["  <apple.com/iphone>.  ", "https://apple.com/iphone"],
  ['"(https://example.com/a)",', "https://example.com/a"],
  ["(see https://example.com/a", null],
  ["(https://example.com/a", "https://example.com/a"],
  ["[https://example.com/a]", "https://example.com/a"],
  // Not links
  ["hello", null],
  ["two words.com", null],
  ["", null],
  ["1.2", null],
  ["www.", null],
  ["a.", null],
  [".com", null],
  ["::1", null],
  ["user:pass@host", null],
  ["javascript:alert(1)", null],
  ["chrome://settings", null],
  ["file:///etc/hosts", null],
  ["mailto:a@b.com", null],
  ["ftp://example.com", null],
  ["data:text/html,hi", null],
];

const findCases = [
  ["example.com", "https://example.com/"],
  ["Look at this: https://example.com/a!", "https://example.com/a"],
  ["first https://a.example/1\nsecond https://b.example/2", "https://a.example/1"],
  ["see <https://example.com/x> for details", "https://example.com/x"],
  ["(more at https://example.com/x).", "https://example.com/x"],
  ["no links here, just e.g. words", null],
];

const shareableCases = [
  [["https://x.com"], true],
  [["file:///Users/me/a.pdf"], true],
  [["file:///Users/me/a.pdf", { allowFile: false }], false],
  [["chrome://settings"], false],
  [["not a url"], false],
];

let fail = 0;
function check(name, input, got, want) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", name, JSON.stringify(input), "->", got, ok ? "" : `(want ${want})`);
}
for (const [input, want] of parseCases) check("parse", input, parseUserUrl(input), want);
for (const [input, want] of findCases) check("find ", input, findUrlInText(input), want);
for (const [args, want] of shareableCases) check("share", args, isShareable(...args), want);
console.log(fail ? `${fail} failed` : "All URL tests passed.");
process.exit(fail ? 1 : 0);
