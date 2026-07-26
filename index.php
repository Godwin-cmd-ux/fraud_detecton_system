<?php
require_once 'config/database.php';

if (isAdminLoggedIn()) {
    header("Location: admin/dashboard.php");
    exit();
} elseif (isUserLoggedIn()) {
    header("Location: User/dashboard.php");
    exit();
}
// Guests see the landing page below instead of an immediate redirect.
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sentinel &mdash; Fraud Detection System</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:        #0E1525;
    --panel:     #16203A;
    --panel-2:   #121A30;
    --line:      #25324F;
    --text:      #E8ECF4;
    --text-dim:  #8C97B3;
    --amber:     #F2A93B;
    --teal:      #3FD8B0;
    --red:       #E5484D;
    --radius:    10px;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{
    background:var(--bg);
    color:var(--text);
    font-family:'IBM Plex Sans', sans-serif;
    line-height:1.55;
    -webkit-font-smoothing:antialiased;
  }
  body::before{
    content:"";
    position:fixed; inset:0;
    background:
      radial-gradient(ellipse 900px 500px at 15% -10%, rgba(63,216,176,0.07), transparent 60%),
      radial-gradient(ellipse 700px 500px at 110% 20%, rgba(242,169,59,0.06), transparent 60%);
    pointer-events:none;
    z-index:0;
  }
  a{color:inherit;}
  .wrap{max-width:1120px; margin:0 auto; padding:0 28px;}
  :focus-visible{outline:2px solid var(--teal); outline-offset:3px;}

  /* ---------- NAV ---------- */
  header.site{
    position:sticky; top:0; z-index:40;
    background:rgba(14,21,37,0.86);
    backdrop-filter:blur(10px);
    border-bottom:1px solid var(--line);
  }
  nav{
    display:flex; align-items:center; justify-content:space-between;
    padding:18px 28px; max-width:1120px; margin:0 auto;
  }
  .brand{
    display:flex; align-items:center; gap:10px;
    font-family:'Space Grotesk', sans-serif;
    font-weight:700; font-size:18px; letter-spacing:0.2px;
  }
  .brand .dot{
    width:9px; height:9px; border-radius:50%;
    background:var(--teal);
    box-shadow:0 0 0 4px rgba(63,216,176,0.16);
  }
  .nav-links{display:flex; gap:28px; font-size:14.5px; color:var(--text-dim);}
  .nav-links a{text-decoration:none; transition:color .15s;}
  .nav-links a:hover{color:var(--text);}
  .nav-cta{
    font-size:14px; font-weight:500;
    padding:9px 18px; border-radius:7px;
    background:var(--text); color:var(--bg);
    text-decoration:none;
    transition:opacity .15s;
  }
  .nav-cta:hover{opacity:.88;}
  .nav-secondary{
    font-size:14px; font-weight:500;
    color:var(--text-dim);
    text-decoration:none;
    transition:color .15s;
  }
  .nav-secondary:hover{color:var(--text);}
  @media (max-width:480px){ .nav-secondary{display:none;} }
  @media (max-width: 720px){ .nav-links{display:none;} }

  /* ---------- HERO ---------- */
  .hero{position:relative; z-index:1; padding:88px 0 64px;}
  .eyebrow{
    display:inline-flex; align-items:center; gap:8px;
    font-family:'IBM Plex Mono', monospace;
    font-size:12.5px; color:var(--teal);
    border:1px solid rgba(63,216,176,0.3);
    background:rgba(63,216,176,0.06);
    padding:6px 12px; border-radius:99px;
    margin-bottom:24px;
  }
  .eyebrow .pulse{width:6px; height:6px; border-radius:50%; background:var(--teal); animation:blink 2s infinite;}
  @keyframes blink{0%,100%{opacity:1;}50%{opacity:.25;}}

  h1.display{
    font-family:'Space Grotesk', sans-serif;
    font-weight:700;
    font-size:clamp(34px, 5vw, 56px);
    line-height:1.08;
    letter-spacing:-0.5px;
    max-width:760px;
    margin-bottom:22px;
  }
  h1.display span{color:var(--amber);}
  .hero p.sub{
    font-size:18px; color:var(--text-dim);
    max-width:560px; margin-bottom:36px;
  }
  .hero-actions{display:flex; gap:14px; flex-wrap:wrap; margin-bottom:64px;}
  .btn-primary{
    font-size:15px; font-weight:600;
    padding:13px 24px; border-radius:8px;
    background:var(--text); color:var(--bg);
    text-decoration:none; border:none; cursor:pointer;
    transition:transform .15s, opacity .15s;
  }
  .btn-primary:hover{transform:translateY(-1px); opacity:.92;}
  .btn-secondary{
    font-size:15px; font-weight:500;
    padding:13px 24px; border-radius:8px;
    border:1px solid var(--line); color:var(--text);
    text-decoration:none;
    transition:border-color .15s, background .15s;
  }
  .btn-secondary:hover{border-color:#3a4a72; background:rgba(255,255,255,0.02);}

  /* ---------- TICKER (signature element) ---------- */
  .ticker-frame{
    border:1px solid var(--line);
    border-radius:var(--radius);
    background:linear-gradient(180deg, var(--panel), var(--panel-2));
    overflow:hidden;
  }
  .ticker-head{
    display:flex; align-items:center; justify-content:space-between;
    padding:13px 18px;
    border-bottom:1px solid var(--line);
    font-family:'IBM Plex Mono', monospace;
    font-size:12px; color:var(--text-dim);
  }
  .ticker-head .lights{display:flex; gap:6px;}
  .ticker-head .lights span{width:7px; height:7px; border-radius:50%; background:#2a3656;}
  .ticker-cols{
    display:grid;
    grid-template-columns: 100px 1fr 110px 100px 110px;
    gap:12px;
    padding:10px 18px;
    font-family:'IBM Plex Mono', monospace;
    font-size:11px; color:#5b6789;
    text-transform:uppercase; letter-spacing:0.6px;
    border-bottom:1px solid var(--line);
  }
  .ticker-body{height:266px; overflow:hidden; position:relative;}
  .ticker-row{
    display:grid;
    grid-template-columns: 100px 1fr 110px 100px 110px;
    gap:12px;
    align-items:center;
    padding:11px 18px;
    font-family:'IBM Plex Mono', monospace;
    font-size:12.5px;
    border-bottom:1px solid rgba(37,50,79,0.6);
    animation: rise .5s ease both;
  }
  @keyframes rise{ from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:translateY(0); } }
  .ticker-row .id{color:var(--text-dim);}
  .ticker-row .merchant{color:var(--text);}
  .ticker-row .amount{color:var(--text); text-align:right;}
  .status-pill{
    display:inline-flex; align-items:center; gap:6px;
    font-size:11px; padding:3px 9px; border-radius:99px;
    width:fit-content;
  }
  .status-scanning{background:rgba(140,151,179,0.12); color:var(--text-dim);}
  .status-cleared{background:rgba(63,216,176,0.12); color:var(--teal);}
  .status-flagged{background:rgba(242,169,59,0.14); color:var(--amber);}
  .status-pill .sdot{width:5px;height:5px;border-radius:50%; background:currentColor;}
  .risk{color:var(--text-dim); text-align:right;}
  .ticker-row.is-flagged .amount{color:var(--amber);}

  @media (max-width: 640px){
    .ticker-cols, .ticker-row{ grid-template-columns: 70px 1fr 80px; }
    .ticker-cols span:nth-child(4), .ticker-cols span:nth-child(5),
    .ticker-row .status-pill + span, .ticker-row .risk { display:none; }
  }

  @media (prefers-reduced-motion: reduce){
    .ticker-row{animation:none;}
    .pulse{animation:none;}
  }

  /* ---------- PILLARS ---------- */
  section.pillars{padding:80px 0; border-top:1px solid var(--line); position:relative; z-index:1;}
  .section-head{max-width:560px; margin-bottom:48px;}
  .section-head .kicker{
    font-family:'IBM Plex Mono', monospace; font-size:12px;
    color:var(--text-dim); letter-spacing:1px; text-transform:uppercase;
    margin-bottom:12px; display:block;
  }
  .section-head h2{
    font-family:'Space Grotesk', sans-serif; font-weight:600;
    font-size:clamp(24px,3vw,32px); letter-spacing:-0.3px;
  }
  .pillar-grid{
    display:grid; grid-template-columns:repeat(3,1fr); gap:1px;
    background:var(--line); border:1px solid var(--line); border-radius:var(--radius);
    overflow:hidden;
  }
  .pillar{background:var(--panel-2); padding:30px 26px;}
  .pillar .icon{
    width:38px; height:38px; border-radius:9px;
    display:flex; align-items:center; justify-content:center;
    margin-bottom:20px;
    border:1px solid var(--line);
  }
  .pillar .icon svg{width:18px; height:18px;}
  .pillar h3{font-size:16.5px; font-weight:600; margin-bottom:8px;}
  .pillar p{font-size:14.5px; color:var(--text-dim);}
  @media (max-width:820px){ .pillar-grid{grid-template-columns:1fr;} }

  /* ---------- PIPELINE ---------- */
  section.pipeline{padding:80px 0; border-top:1px solid var(--line); position:relative; z-index:1;}
  .pipe-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:24px;}
  .pipe-step{position:relative; padding-top:8px;}
  .pipe-step .num{
    font-family:'IBM Plex Mono', monospace; font-size:13px; color:var(--text-dim);
    margin-bottom:14px; display:block;
  }
  .pipe-step h3{font-size:16px; font-weight:600; margin-bottom:8px;}
  .pipe-step p{font-size:14px; color:var(--text-dim);}
  .pipe-step:not(:last-child)::after{
    content:""; position:absolute; top:13px; left:calc(100% + 12px);
    width:calc(24px - 24px); /* visual placeholder, arrows added via ::before on next */
  }
  .pipe-rule{height:1px; background:var(--line); margin-top:14px;}
  @media (max-width:880px){ .pipe-grid{grid-template-columns:1fr 1fr; gap:32px;} }
  @media (max-width:520px){ .pipe-grid{grid-template-columns:1fr;} }

  /* ---------- CTA / FOOTER ---------- */
  section.cta-band{
    padding:72px 0; border-top:1px solid var(--line);
    position:relative; z-index:1;
  }
  .cta-box{
    border:1px solid var(--line); border-radius:var(--radius);
    background:linear-gradient(135deg, rgba(63,216,176,0.06), rgba(242,169,59,0.05));
    padding:44px; text-align:center;
  }
  .cta-box h2{
    font-family:'Space Grotesk', sans-serif; font-weight:600;
    font-size:clamp(22px,3vw,28px); margin-bottom:12px;
  }
  .cta-box p{color:var(--text-dim); margin-bottom:26px;}

  footer{
    border-top:1px solid var(--line);
    padding:30px 0 40px;
    font-size:13px; color:var(--text-dim);
    display:flex; justify-content:space-between; align-items:center;
    position:relative; z-index:1;
  }
  footer .brand{font-size:14px;}
  @media (max-width:560px){ footer{flex-direction:column; gap:10px; text-align:center;} }
</style>
</head>
<body>

<header class="site">
  <nav>
    <div class="brand"><span class="dot"></span> Sentinel</div>
    <div class="nav-links">
      <a href="#how">How it works</a>
      <a href="#pillars">Capabilities</a>
    </div>
    <div style="display:flex; align-items:center; gap:18px;">
      <a class="nav-secondary" href="register.php">Create account</a>
      <a class="nav-cta" href="login.php">Sign in</a>
    </div>
  </nav>
</header>

<main>
  <section class="hero wrap">
    <span class="eyebrow"><span class="pulse"></span> LIVE MONITORING ACTIVE</span>
    <h1 class="display">Catch the fraud before it <span>clears.</span></h1>
    <p class="sub">Sentinel watches every transaction as it happens, flags what doesn't fit the pattern, and puts the decision in front of a reviewer &mdash; before the money moves.</p>
    <div class="hero-actions">
      <a class="btn-primary" href="login.php">Sign in to your dashboard</a>
      <a class="btn-secondary" href="#how">See how detection works</a>
    </div>

    <div class="ticker-frame">
      <div class="ticker-head">
        <span>transaction_stream.live</span>
        <span class="lights"><span></span><span></span><span></span></span>
      </div>
      <div class="ticker-cols">
        <span>Ref</span><span>Merchant</span><span>Amount</span><span>Status</span><span>Risk</span>
      </div>
      <div class="ticker-body" id="tickerBody"></div>
    </div>
  </section>

  <section class="pillars wrap" id="pillars">
    <div class="section-head">
      <span class="kicker">Capabilities</span>
      <h2>Built to notice what doesn't belong.</h2>
    </div>
    <div class="pillar-grid">
      <div class="pillar">
        <div class="icon" style="border-color:rgba(63,216,176,.35); background:rgba(63,216,176,.07);">
          <svg viewBox="0 0 24 24" fill="none" stroke="#3FD8B0" stroke-width="1.8"><path d="M3 12h4l2 7 4-14 2 7h6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <h3>Pattern recognition</h3>
        <p>Every account builds its own baseline. Sentinel learns normal behavior, then notices the moment something breaks it.</p>
      </div>
      <div class="pillar">
        <div class="icon" style="border-color:rgba(242,169,59,.35); background:rgba(242,169,59,.07);">
          <svg viewBox="0 0 24 24" fill="none" stroke="#F2A93B" stroke-width="1.8"><path d="M12 4l8 14H4l8-14z" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke-linecap="round"/></svg>
        </div>
        <h3>Real-time alerts</h3>
        <p>Suspicious activity reaches a reviewer in seconds, not after the next batch report runs.</p>
      </div>
      <div class="pillar">
        <div class="icon" style="border-color:var(--line); background:rgba(255,255,255,.03);">
          <svg viewBox="0 0 24 24" fill="none" stroke="#E8ECF4" stroke-width="1.8"><path d="M5 4h14v16l-7-4-7 4V4z" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <h3>Full audit trail</h3>
        <p>Every flag, override, and resolution is logged with who reviewed it and why &mdash; ready for the next audit.</p>
      </div>
    </div>
  </section>

  <section class="pipeline wrap" id="how">
    <div class="section-head">
      <span class="kicker">How it works</span>
      <h2>One transaction, four checkpoints.</h2>
    </div>
    <div class="pipe-grid">
      <div class="pipe-step">
        <span class="num">01</span>
        <h3>Ingest</h3>
        <p>Transactions stream in as they're created, with no delay between the action and the check.</p>
        <div class="pipe-rule"></div>
      </div>
      <div class="pipe-step">
        <span class="num">02</span>
        <h3>Analyze</h3>
        <p>Amount, location, timing, and history are compared against the account's established pattern.</p>
        <div class="pipe-rule"></div>
      </div>
      <div class="pipe-step">
        <span class="num">03</span>
        <h3>Flag</h3>
        <p>Anything outside the expected range is held and scored, instead of clearing automatically.</p>
        <div class="pipe-rule"></div>
      </div>
      <div class="pipe-step">
        <span class="num">04</span>
        <h3>Review</h3>
        <p>A reviewer sees the full context and clears or blocks it &mdash; the outcome feeds back into the model.</p>
        <div class="pipe-rule"></div>
      </div>
    </div>
  </section>

  <section class="cta-band wrap">
    <div class="cta-box">
      <h2>Your queue is waiting.</h2>
      <p>Sign in to review flagged activity and check on your accounts.</p>
      <div class="hero-actions" style="justify-content:center; margin-bottom:0;">
        <a class="btn-primary" href="login.php">Sign in</a>
        <a class="btn-secondary" href="register.php">Create an account</a>
      </div>
    </div>
  </section>
</main>

<footer class="wrap">
  <div class="brand">Sentinel</div>
  <div>&copy; <?php echo date('Y'); ?> Sentinel Fraud Detection System</div>
</footer>

<script>
(function(){
  var merchants = ["Northgate Mart","Azuri Fuel Co.","Coral Bay Hotel","QuickPay Wallet","Horizon Pharmacy","Savanna Foods","BlueLine Transit","Metro Electronics","Kibo Traders","Riverside Clinic","Sunrise Logistics","Pinnacle Insurers"];
  var body = document.getElementById('tickerBody');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rowCount = 0;

  function refNo(){
    rowCount++;
    return 'TX-' + (48000 + rowCount);
  }
  function amount(){
    return '$' + (Math.random()*1800 + 12).toFixed(2);
  }
  function buildRow(){
    var roll = Math.random();
    var status, statusClass, risk, flaggedClass = '';
    if (roll > 0.86) { status = 'Flagged'; statusClass = 'status-flagged'; risk = (Math.random()*30+68).toFixed(0)+'%'; flaggedClass = ' is-flagged'; }
    else if (roll > 0.62) { status = 'Scanning'; statusClass = 'status-scanning'; risk = '&mdash;'; }
    else { status = 'Cleared'; statusClass = 'status-cleared'; risk = (Math.random()*20+2).toFixed(0)+'%'; }

    var row = document.createElement('div');
    row.className = 'ticker-row' + flaggedClass;
    row.innerHTML =
      '<span class="id">' + refNo() + '</span>' +
      '<span class="merchant">' + merchants[Math.floor(Math.random()*merchants.length)] + '</span>' +
      '<span class="amount">' + amount() + '</span>' +
      '<span class="status-pill ' + statusClass + '"><span class="sdot"></span>' + status + '</span>' +
      '<span class="risk">' + risk + '</span>';
    return row;
  }

  function tick(){
    var row = buildRow();
    body.insertBefore(row, body.firstChild);
    while (body.children.length > 9) {
      body.removeChild(body.lastChild);
    }
  }

  for (var i=0;i<7;i++){ tick(); }
  if (!reduced) { setInterval(tick, 1900); }
})();
</script>

</body>
</html>