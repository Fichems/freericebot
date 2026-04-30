import { useState, useRef } from "react";

function buildScript({ minDelay, maxDelay, nextDelay, riceGoal, useRiceGoal }) {
  const goal = useRiceGoal ? riceGoal : 0;
  return `// ==UserScript==
// @name         FreeRice Auto-Answer Bot
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Automatically answers FreeRice questions with optimal timing + rice goal
// @match        https://freerice.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────────────────────
  const MIN_DELAY_MS  = ${minDelay};   // min ms before clicking answer
  const MAX_DELAY_MS  = ${maxDelay};   // max ms before clicking answer
  const NEXT_DELAY_MS = ${nextDelay};  // ms after answering before next question loads
  const RICE_GOAL     = ${goal};       // grains to donate then stop (0 = unlimited)
  // ──────────────────────────────────────────────────────────────────────────

  const RICE_PER_Q = 10;
  let observer    = null;
  let answerTimer = null;
  let running     = true;
  let questionCount = 0;

  const riceEarned = () => questionCount * RICE_PER_Q;

  function checkGoalReached() {
    if (RICE_GOAL > 0 && riceEarned() >= RICE_GOAL) {
      running = false;
      clearTimeout(answerTimer);
      if (observer) observer.disconnect();
      const st  = document.getElementById('fr-st');
      const tog = document.getElementById('fr-toggle');
      const row = document.getElementById('fr-goal-row');
      if (st)  { st.textContent = 'Goal reached! 🎯'; st.style.color = '#ffdd55'; }
      if (tog) { tog.textContent = 'Done'; tog.disabled = true; tog.style.opacity = '0.5'; }
      if (row) { row.style.color = '#ffdd55'; }
      return true;
    }
    return false;
  }

  function rnd(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function injectHUD() {
    const hud = document.createElement('div');
    hud.id = 'fr-bot-hud';
    hud.style.cssText = [
      'position:fixed;bottom:16px;right:16px;z-index:99999;',
      'background:rgba(0,0,0,0.87);color:#7fff7f;font-family:monospace;',
      'font-size:13px;padding:12px 16px;border-radius:9px;',
      'border:1px solid #3f3;box-shadow:0 0 20px rgba(0,255,60,0.2);',
      'user-select:none;min-width:210px;line-height:1.75;'
    ].join('');
    const goalLine = RICE_GOAL > 0
      ? '<div id="fr-goal-row">Rice: <span id="fr-rice">0</span> / ' + RICE_GOAL.toLocaleString() + ' \u{1F33E}</div>'
      : '<div id="fr-goal-row">Rice: <span id="fr-rice">0</span> \u{1F33E} (unlimited)</div>';
    hud.innerHTML = [
      '<div style="color:#aaffaa;font-weight:bold;margin-bottom:4px;">\uD83C\uDF5A FreeRice Bot</div>',
      '<div>Status: <span id="fr-st" style="color:#7fff7f">Running</span></div>',
      '<div>Questions: <span id="fr-count">0</span></div>',
      goalLine,
      '<button id="fr-toggle" style="margin-top:8px;background:#1a5a1a;color:#fff;border:none;',
      'border-radius:4px;padding:3px 10px;cursor:pointer;font-size:12px;font-family:monospace;">Pause</button>'
    ].join('');
    document.body.appendChild(hud);
    document.getElementById('fr-toggle').addEventListener('click', function() {
      running = !running;
      document.getElementById('fr-st').textContent = running ? 'Running' : 'Paused';
      document.getElementById('fr-st').style.color  = running ? '#7fff7f' : '#ff9966';
      document.getElementById('fr-toggle').textContent = running ? 'Pause' : 'Resume';
      if (running) tryAnswer();
    });
  }

  function updateHUD() {
    var cnt  = document.getElementById('fr-count');
    var rice = document.getElementById('fr-rice');
    if (cnt)  cnt.textContent  = questionCount;
    if (rice) rice.textContent = riceEarned().toLocaleString();
  }

  function getAnswerButtons() {
    var a = Array.from(document.querySelectorAll('[class*="answer"]:not([class*="correct"]):not([class*="wrong"])'));
    var b = Array.from(document.querySelectorAll('button[class*="choice"]'));
    return a.concat(b).filter(function(el) { return el.offsetParent !== null && !el.disabled; });
  }

  function getCorrectAnswer() {
    return document.querySelector('[class*="correct"]')
        || document.querySelector('[class*="right"]')
        || document.querySelector('[data-correct="true"]')
        || null;
  }

  function getNextButton() {
    return document.querySelector('[class*="next"]')
        || document.querySelector('button[class*="continue"]')
        || null;
  }

  function tryAnswer() {
    if (!running) return;
    clearTimeout(answerTimer);
    answerTimer = setTimeout(function() {
      if (!running) return;
      var correct = getCorrectAnswer();
      if (correct) {
        correct.click();
        questionCount++;
        updateHUD();
        if (checkGoalReached()) return;
        setTimeout(function() { var n = getNextButton(); if (n) n.click(); }, NEXT_DELAY_MS);
        return;
      }
      var buttons = getAnswerButtons();
      if (buttons.length > 0) {
        buttons[0].click();
        questionCount++;
        updateHUD();
        if (checkGoalReached()) return;
        setTimeout(function() { var n = getNextButton(); if (n) n.click(); }, NEXT_DELAY_MS);
      }
    }, rnd(MIN_DELAY_MS, MAX_DELAY_MS));
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(function() {
      var hasQ = document.querySelector('[class*="question"],[class*="prompt"],[class*="stem"]');
      if (hasQ && getAnswerButtons().length > 0) tryAnswer();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener('load', function() {
    injectHUD();
    startObserver();
    setTimeout(tryAnswer, 1500);
  });

})();`;
}

const PRESETS = [500, 1000, 5000, 10000, 50000];

export default function App() {
  const [tab, setTab]               = useState("install");
  const [copied, setCopied]         = useState(false);
  const [minDelay, setMinDelay]     = useState(1800);
  const [maxDelay, setMaxDelay]     = useState(2800);
  const [nextDelay, setNextDelay]   = useState(700);
  const [riceGoal, setRiceGoal]     = useState(1000);
  const [useGoal, setUseGoal]       = useState(true);
  const [customVal, setCustomVal]   = useState("1000");
  const codeRef = useRef(null);

  const script = buildScript({ minDelay, maxDelay, nextDelay, riceGoal, useRiceGoal: useGoal });

  function copy() {
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  function applyCustom(raw) {
    setCustomVal(raw);
    const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(n) && n > 0) { setRiceGoal(n); setUseGoal(true); }
  }

  const qPerMin    = Math.round(60000 / ((minDelay + maxDelay) / 2 + nextDelay + 400));
  const ricePerMin = qPerMin * 10;
  const minsToGoal = useGoal ? Math.ceil(riceGoal / ricePerMin) : null;

  const steps = [
    { n: "01", t: "Install Tampermonkey", b: "Add the Tampermonkey extension to Chrome, Firefox, or Edge from their extension stores." },
    { n: "02", t: "Create a new script",  b: 'Click the Tampermonkey icon → Dashboard → "+" to open a blank userscript editor.' },
    { n: "03", t: "Paste & save",         b: "Select all content in the editor, paste the script, then press Ctrl+S to save." },
    { n: "04", t: "Open FreeRice",        b: "Go to freerice.com and start any quiz. The bot activates with a green HUD overlay." },
  ];

  const G = "#7fff7f";
  const card = { background: "#0a1a0a", border: "1px solid #1a4a1a", borderRadius: 10, padding: "18px 22px", marginBottom: 14 };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f0a", fontFamily: "'Courier New', monospace", color: "#c8ffc8" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(180deg,#001a00,#0a0f0a)", borderBottom: "1px solid #1a4a1a", padding: "32px 24px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#4a9a4a", letterSpacing: "0.3em", marginBottom: 10 }}>TAMPERMONKEY USERSCRIPT</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <span style={{ fontSize: 36 }}>🍚</span>
          <h1 style={{ margin: 0, fontSize: "clamp(22px,5vw,36px)", fontWeight: "bold", color: G, textShadow: "0 0 24px rgba(100,255,100,0.35)" }}>
            FreeRice Auto-Bot
          </h1>
        </div>
        <p style={{ color: "#5a9a5a", margin: "10px auto 0", fontSize: 14, maxWidth: 500 }}>
          Human-like timing, live HUD, and a configurable rice donation goal
        </p>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 20px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "1px solid #1a4a1a" }}>
          {["install","configure","script"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: tab===t ? "#0d2e0d" : "transparent", border: "none",
              borderBottom: tab===t ? `2px solid ${G}` : "2px solid transparent",
              color: tab===t ? G : "#4a7a4a", padding: "10px 20px", cursor: "pointer",
              fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase",
              fontFamily: "inherit", transition: "all .15s",
            }}>{t}</button>
          ))}
        </div>

        {/* INSTALL */}
        {tab === "install" && (
          <div>
            <div style={{ ...card, background: "#0d1f0d", marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#4a8a4a", letterSpacing: "0.2em", marginBottom: 8 }}>HOW IT WORKS</div>
              <p style={{ margin: 0, color: "#9acc9a", lineHeight: 1.75, fontSize: 14 }}>
                A MutationObserver fires the instant a new question renders. The bot waits a randomized human-like
                delay, then clicks an answer. If wrong, it detects the highlighted correct answer and clicks it.
                When your rice goal is reached the bot stops automatically and the HUD turns gold.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              {steps.map(s => (
                <div key={s.n} style={{ ...card, marginBottom: 0, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 10, right: 14, fontSize: 30, color: "#0d2e0d", fontWeight: "bold" }}>{s.n}</div>
                  <div style={{ color: G, fontWeight: "bold", marginBottom: 7, fontSize: 14 }}>{s.t}</div>
                  <div style={{ color: "#6a9a6a", fontSize: 13, lineHeight: 1.6 }}>{s.b}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[["⏱ Smart timing","Randomized delay mimics human reaction"],["👁 MutationObserver","Zero polling — instant DOM reaction"],["🎯 Rice goal","Auto-stops when donation target is hit"]].map(([t,d]) => (
                <div key={t} style={{ flex:1, minWidth:160, ...card, marginBottom:0 }}>
                  <div style={{ color: G, fontSize: 13, marginBottom: 4 }}>{t}</div>
                  <div style={{ color: "#5a8a5a", fontSize: 12 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONFIGURE */}
        {tab === "configure" && (
          <div>
            <div style={{ color: "#6a9a6a", fontSize: 13, marginBottom: 20 }}>
              Set your rice goal and tune timing, then copy the customized script.
            </div>

            {/* Rice Goal Card */}
            <div style={{ ...card, border: useGoal ? "1px solid #3a7a3a" : "1px solid #1a4a1a", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ color: G, fontWeight: "bold", fontSize: 15 }}>🎯 Rice Goal</div>
                {/* Toggle */}
                <div onClick={() => setUseGoal(v => !v)} style={{
                  display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13, color:"#9acc9a", userSelect:"none"
                }}>
                  <div style={{
                    width:38, height:20, borderRadius:10,
                    background: useGoal ? "#1a6a1a" : "#1a2a1a",
                    border: `1px solid ${useGoal ? "#5aaa5a" : "#2a4a2a"}`,
                    position:"relative", transition:"all .2s",
                  }}>
                    <div style={{
                      width:14, height:14, borderRadius:"50%",
                      background: useGoal ? G : "#3a6a3a",
                      position:"absolute", top:2, left: useGoal ? 20 : 2, transition:"all .2s",
                    }}/>
                  </div>
                  {useGoal ? "Enabled" : "Unlimited"}
                </div>
              </div>

              {/* Presets */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14, alignItems:"center" }}>
                <span style={{ color:"#4a7a4a", fontSize:12 }}>Quick set:</span>
                {PRESETS.map(g => (
                  <button key={g} onClick={() => { setRiceGoal(g); setCustomVal(g.toLocaleString()); setUseGoal(true); }} style={{
                    background: riceGoal===g && useGoal ? "#1a5a1a" : "#0d2e0d",
                    border: `1px solid ${riceGoal===g && useGoal ? G : "#2a5a2a"}`,
                    borderRadius:6, color: riceGoal===g && useGoal ? G : "#5a9a5a",
                    padding:"4px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:12,
                    transition:"all .15s",
                  }}>{g.toLocaleString()}</button>
                ))}
              </div>

              {/* Custom input */}
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: useGoal ? 14 : 0 }}>
                <span style={{ color:"#7a9a7a", fontSize:13 }}>Custom:</span>
                <input type="text" value={customVal}
                  onChange={e => applyCustom(e.target.value)}
                  onFocus={() => setUseGoal(true)}
                  placeholder="e.g. 25000"
                  style={{
                    background:"#050f05", border:"1px solid #2a5a2a", borderRadius:6,
                    color: G, fontFamily:"inherit", fontSize:14,
                    padding:"6px 12px", width:120, outline:"none",
                  }}
                />
                <span style={{ color:"#5a8a5a", fontSize:13 }}>grains</span>
              </div>

              {/* Summary bar */}
              {useGoal && (
                <div style={{
                  padding:"10px 14px", background:"#050f05", borderRadius:7,
                  border:"1px solid #1a4a1a", fontSize:13,
                  display:"flex", gap:22, flexWrap:"wrap",
                }}>
                  <span style={{ color: G }}>🌾 {riceGoal.toLocaleString()} grains</span>
                  <span style={{ color:"#9acc9a" }}>= {Math.ceil(riceGoal/10).toLocaleString()} questions</span>
                  <span style={{ color:"#6a9a6a" }}>≈ {minsToGoal} min at current speed</span>
                </div>
              )}
            </div>

            {/* Timing sliders */}
            {[
              { label:"Min answer delay (ms)", val:minDelay, set:setMinDelay, min:500,  max:5000, desc:"Fastest the bot will answer. Lower = faster but less human-like." },
              { label:"Max answer delay (ms)", val:maxDelay, set:setMaxDelay, min:600,  max:8000, desc:"Slowest — upper bound of the random jitter window." },
              { label:"Next question delay (ms)", val:nextDelay, set:setNextDelay, min:200, max:3000, desc:"Pause after answering before loading the next question." },
            ].map(f => (
              <div key={f.label} style={card}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ color:"#9acc9a", fontSize:14 }}>{f.label}</div>
                  <div style={{ background:"#0d2e0d", border:"1px solid #2a6a2a", borderRadius:5, padding:"4px 12px", color:G, fontSize:15, minWidth:70, textAlign:"center" }}>{f.val}</div>
                </div>
                <input type="range" min={f.min} max={f.max} step={100} value={f.val}
                  onChange={e => f.set(Number(e.target.value))}
                  style={{ width:"100%", accentColor:G, cursor:"pointer" }} />
                <div style={{ color:"#4a7a4a", fontSize:12, marginTop:6 }}>{f.desc}</div>
              </div>
            ))}

            <div style={{ background:"#0d1f0d", border:"1px solid #2a6a2a", borderRadius:8, padding:"14px 18px", fontSize:13, color:"#7acf7a", display:"flex", gap:26, flexWrap:"wrap" }}>
              <span>⚡ ~<strong style={{ color:G }}>{qPerMin}</strong> questions/min</span>
              <span>🌾 ~<strong style={{ color:G }}>{ricePerMin.toLocaleString()}</strong> grains/min</span>
              {useGoal && <span>⏱ ~<strong style={{ color:G }}>{minsToGoal}</strong> min to goal</span>}
            </div>
          </div>
        )}

        {/* SCRIPT */}
        {tab === "script" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ color:"#6a9a6a", fontSize:13 }}>Ready-to-paste userscript (with your settings baked in)</div>
              <button onClick={copy} style={{
                background: copied ? "#1a5a1a" : "#0d2e0d",
                border: `1px solid ${copied ? G : "#2a6a2a"}`,
                borderRadius:6, color: copied ? G : "#5aaa5a",
                padding:"7px 18px", cursor:"pointer", fontFamily:"inherit",
                fontSize:13, letterSpacing:"0.1em", transition:"all .2s",
              }}>{copied ? "✓ COPIED!" : "COPY SCRIPT"}</button>
            </div>
            <pre ref={codeRef} style={{
              background:"#050f05", border:"1px solid #1a4a1a", borderRadius:10,
              padding:20, overflowX:"auto", overflowY:"auto", maxHeight:520,
              fontSize:11.5, lineHeight:1.65, color:"#8acf8a", margin:0, whiteSpace:"pre",
            }}>{script}</pre>
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop:28, display:"flex", justifyContent:"center" }}>
          <button onClick={() => { setTab("script"); setTimeout(copy, 80); }} style={{
            background:"linear-gradient(135deg,#1a5a1a,#0d3a0d)", border:"1px solid #3a8a3a",
            borderRadius:8, color:G, padding:"12px 36px", cursor:"pointer",
            fontFamily:"inherit", fontSize:14, letterSpacing:"0.15em", fontWeight:"bold",
            boxShadow:"0 0 20px rgba(100,255,100,0.15)",
          }}>🍚 COPY SCRIPT & GO</button>
        </div>

        <div style={{ marginTop:20, textAlign:"center", color:"#3a6a3a", fontSize:11, lineHeight:1.8 }}>
          FreeRice donates 10 grains of rice per correct answer to the UN World Food Programme.
        </div>
      </div>
    </div>
  );
}
