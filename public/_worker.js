// साइट को कुछ समय के लिए बंद करने की फ़ाइल।
//
// इसे repo में  public/_worker.js  के नाम से डालिए — अगली बिल्ड के बाद पूरी साइट
// पर यही पन्ना दिखेगा (खबरें, तस्वीरें, एडमिन — सब बंद)।
//
// साइट दोबारा चालू करनी हो तो GitHub से यह फ़ाइल हटा दीजिए (Delete file → Commit)।
// 2-3 मिनट में साइट जैसी थी वैसी लौट आएगी। कोई खबर नहीं मिटती।
//
// 503 का मतलब है "अभी उपलब्ध नहीं" — Google इसे अस्थायी मानता है, इसलिए
// साइट की रैंकिंग को नुक़सान नहीं होता।

const PAGE = `<!doctype html>
<html lang="hi">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>साइट अभी उपलब्ध नहीं है</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font-family: system-ui, -apple-system, "Noto Sans Devanagari", sans-serif;
         background:#f4f5f7; color:#15181d; padding:24px; }
  @media (prefers-color-scheme: dark) { body { background:#0f1114; color:#e8eaed; } }
  .box { max-width:460px; text-align:center; }
  h1 { font-size:26px; line-height:1.4; margin:0 0 14px; }
  p  { font-size:17px; line-height:1.7; opacity:.8; margin:0 0 10px; }
  .dot { width:54px; height:54px; border-radius:50%; margin:0 auto 22px;
         background:#d21f26; opacity:.15; display:grid; place-items:center; }
  .dot span { width:18px; height:18px; border-radius:50%; background:#d21f26; }
</style>
<div class="box">
  <div class="dot"><span></span></div>
  <h1>यह वेबसाइट अभी अस्थायी रूप से बंद है</h1>
  <p>रखरखाव का काम चल रहा है। कृपया कुछ समय बाद दोबारा आइए।</p>
</div>
</html>`;

export default {
  async fetch() {
    return new Response(PAGE, {
      status: 503,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': '3600',
      },
    });
  },
};
