// Unit tests for parseUserUrl (the "Send a Link" input). Run: node tests/test_parse_url.mjs
globalThis.chrome = {};
const { parseUserUrl } = await import("../extension/native.js");
const cases = [
  ["https://example.com/a?b=1#c", "https://example.com/a?b=1#c"],
  ["  http://example.com  ", "http://example.com/"],
  ["example.com", "https://example.com/"],
  ["www.apple.com/iphone", "https://www.apple.com/iphone"],
  ["example.com:8080/x", "https://example.com:8080/x"],
  ["localhost:3000", "https://localhost:3000/"],
  ["localhost", "https://localhost/"],
  ["192.168.1.10/admin", "https://192.168.1.10/admin"],
  ["HTTPS://EXAMPLE.COM", "https://example.com/"],
  ["https://例子.测试/路径", "https://xn--fsqu00a.xn--0zwm56d/%E8%B7%AF%E5%BE%84"],
  ["hello", null],
  ["two words.com", null],
  ["", null],
  ["javascript:alert(1)", null],
  ["chrome://settings", null],
  ["file:///etc/hosts", null],
  ["mailto:a@b.com", null],
  ["ftp://example.com", null],
];
let fail = 0;
for (const [input, want] of cases) {
  const got = parseUserUrl(input);
  const ok = got === want;
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", JSON.stringify(input), "->", got, ok ? "" : `(want ${want})`);
}
process.exit(fail ? 1 : 0);
