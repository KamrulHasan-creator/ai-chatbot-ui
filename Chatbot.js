const ChatBot = (() => {
  // ── State ──────────────────────
  const state = {
    messages: [],
    isRecording: false,
    recordingTime: 0,
    playingId: null,
    isBotTyping: false,
    pos: { x: 0, y: 0 },
    dragging: false,
    dragOffset: { x: 0, y: 0 },
    showInitialQuestions: true,
  };

  const media = {
    recorder: null,
    chunks: [],
    stream: null,
    timer: null,
    timeRef: 0,
    audioEls: {},
  };

  // ── Initial Questions Data ──────────────────────
  const initialQuestions = [
    {
      id: 1,
      question: "Experience & Team",
      answer: "Orangebd has 16+ years of experience and a team of 80+ people, including 60+ software development professionals, delivering user-friendly and comprehensive digital solutions.",
    },
    {
      id: 2,
      question: "Our Services",
      answer: "Orangebd provides e-governance platforms, e-learning platforms, digital archiving platforms, portal frameworks, web-based solution development, customized software solutions, and online news portal frameworks.",
    },
    {
      id: 3,
      question: "Contact & Credentials",
      answer: "Orangebd is a member of BASIS, BCS, DCCI, and e-CAB, and it is ISO 9001:2015 certified. Contact: info@orangebd.com | www.orangebd.com",
    },
  ];

  // ── WebSocket ─────────────────────
  let socket = null;

  const initWebSocket = () => {
    socket = new WebSocket("ws://localhost:8000/ws/stt");

    socket.onopen = () => {
      setStatus("● Online", "text-xs text-green-400");
      pushSystemMsg("Connected to server");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        state.isBotTyping = false;
        state.messages.push({ id: Date.now(), type: "bot", text: data.text || "No response" });
        renderMessages();
      } catch (e) {
        console.error(e);
      }
    };

    socket.onclose = () => {
      setStatus("● Offline", "text-xs text-red-400");
    };

    socket.onerror = () => {
      setStatus("● Error", "text-xs text-red-400");
    };
  };

  const setStatus = (html, className) => {
    const el = document.getElementById("status");
    if (!el) return;
    el.innerHTML = html;
    el.className = className;
  };

  const pushSystemMsg = (text) => {
    state.messages.push({ id: Date.now(), type: "system", text });
    renderMessages();
  };

  // ── DOM refs ──────────────────────
  const $ = (id) => document.getElementById(id);
  const modal      = () => $("chatModal");
  const toggleBtn  = () => $("toggleBtn");
  const messagesEl = () => $("chatMessages");
  const textInput  = () => $("textInput");
  const recBar     = () => $("recBar");
  const recTime    = () => $("recTime");
  const recWaves   = () => $("recWaves");
  const stopWrap   = () => $("stopWrap");
  const micBtn     = () => $("micBtn");

  // ── Helpers ─────────────────────────
  const isMobile = () => window.innerWidth <= 480;

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const scrollToBottom = () => {
    const el = messagesEl();
    if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 30);
  };

  // ── Wave bars HTML ──────────────────────────
  const waveBarsHTML = (active) => {
    const delays      = [0, 0.08, 0.16, 0.24, 0.12, 0.04, 0.2, 0.06, 0.14, 0.1];
    const idleHeights   = [8, 14, 18, 12, 20, 10, 16, 8, 14, 10];
    const activeHeights = [8, 16, 22, 12, 24, 10, 20, 8, 18, 12];

    return delays.map((d, i) => {
      const h = active ? activeHeights[i] : idleHeights[i];
      return `<div style="
        width: 3px;
        height: ${h}px;
        background: rgba(255,255,255,${active ? "0.95" : "0.7"});
        border-radius: 2px;
        flex-shrink: 0;
        ${active ? `animation: waveAnim 0.5s ease-in-out ${d}s infinite alternate;` : ""}
      "></div>`;
    }).join("");
  };

  // ── Check for special keywords ──────────────────────
  const getAutoResponse = (text) => {
    const lowerText = text.toLowerCase();

    if (socket && socket.readyState !== WebSocket.OPEN) {
      if (lowerText.includes("who") && lowerText.includes("design")) {
        return "Orangebd designed me.";
      }
      if (lowerText.includes("designer")) {
        return "I was designed by Orangebd.";
      }
      if (lowerText.includes("who create") || lowerText.includes("who made")) {
        return "I was created by Orangebd.";
      }
    }

    return null;
  };

  // ── Handle Initial Question Click ──────────────────────
  const handleQuestionClick = (qId) => {
    const question = initialQuestions.find(q => q.id === qId);
    if (!question) return;

    state.messages.push({ id: Date.now(), type: "user", text: question.question });
    state.showInitialQuestions = false;
    state.isBotTyping = true;
    renderMessages();

    setTimeout(() => {
      state.isBotTyping = false;
      state.messages.push({ id: Date.now(), type: "bot", text: question.answer });
      renderMessages();
    }, 500);

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "text", message: question.question }));
    }
  };

  // ── Render Initial Questions ──────────────────────
  const renderInitialQuestions = () => {
    const container = messagesEl();
    if (!container) return;

    const welcomeDiv = document.createElement("div");
    welcomeDiv.style.cssText = "display:flex;justify-content:center;width:100%;margin-bottom:16px;padding:12px;";
    welcomeDiv.innerHTML = `
      <div style="text-align:center;color:#cbd5e1;font-size:13px;">
        <div style="font-size:32px;margin-bottom:8px;">👋</div>
        <div style="font-weight:700;margin-bottom:6px;font-size:14px;color:#e2e8f0;">Welcome!</div>
        <div style="font-size:12px;color:#94a3b8;">Hello! I'm Orangebd Smart Assistant. How can I help you today?</div>
      </div>
    `;
    container.appendChild(welcomeDiv);

    const questionsDiv = document.createElement("div");
    questionsDiv.style.cssText = "display:flex;flex-direction:column;gap:8px;padding:0 12px 12px 12px;";

    initialQuestions.forEach((q) => {
      const btn = document.createElement("button");
      btn.style.cssText = `
        padding:10px 12px;
        border:1px solid rgba(255,102,0,0.4);
        border-radius:10px;
        background:rgba(255,102,0,0.1);
        color:#e2e8f0;
        font-size:12px;
        cursor:pointer;
        text-align:left;
        line-height:1.4;
        transition:all 0.2s ease;
        font-weight:500;
      `;

      btn.addEventListener("mouseenter", () => {
        btn.style.background = "rgba(255,102,0,0.2)";
        btn.style.borderColor = "rgba(255,102,0,0.6)";
        btn.style.transform = "translateX(4px)";
      });

      btn.addEventListener("mouseleave", () => {
        btn.style.background = "rgba(255,102,0,0.1)";
        btn.style.borderColor = "rgba(255,102,0,0.4)";
        btn.style.transform = "translateX(0)";
      });

      btn.textContent = q.question;
      btn.onclick = () => handleQuestionClick(q.id);
      questionsDiv.appendChild(btn);
    });

    container.appendChild(questionsDiv);
  };

  // ── Render messages ──────────────────────
  const renderMessages = () => {
    const container = messagesEl();
    if (!container) return;
    container.innerHTML = "";

    if (state.messages.length === 0 && state.showInitialQuestions) {
      renderInitialQuestions();
      return;
    }

    state.messages.forEach((msg) => {
      const isUser   = msg.type === "user";
      const isSystem = msg.type === "system";

      if (isSystem) {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;justify-content:center;width:100%;";
        row.innerHTML = `<div style="font-size:12px;color:#94a3b8;text-align:center;">${msg.text}</div>`;
        container.appendChild(row);
        return;
      }

      const row = document.createElement("div");
      row.style.cssText = `
        display: flex;
        flex-direction: ${isUser ? "row-reverse" : "row"};
        align-items: flex-end;
        gap: 6px;
        align-self: ${isUser ? "flex-end" : "flex-start"};
        max-width: ${isMobile() ? "95%" : "88%"};
        margin: ${isMobile() ? "0 auto" : "0"};
        padding: ${isMobile() ? "0 4px" : "0"};
      `;

      const icon = document.createElement("div");
      icon.style.cssText = `
        width:26px; height:26px; border-radius:50%; flex-shrink:0;
        display:flex; align-items:center; justify-content:center;
        font-size:13px; margin-bottom:2px;
        background:${isUser ? "linear-gradient(135deg,#ff6600,#cc4400)" : "#334155"};
      `;
      icon.textContent = isUser ? "👤" : "🤖";

      const bubble = document.createElement("div");
      const isMobileView = isMobile();
      bubble.style.cssText = `
        padding: ${isMobileView ? "8px 10px" : "9px 12px"};
        border-radius: 18px;
        border-bottom-right-radius: ${isUser ? "5px" : "18px"};
        border-bottom-left-radius: ${!isUser ? "5px" : "18px"};
        font-size: ${isMobileView ? "12px" : "13px"};
        color: white;
        line-height: 1.5;
        word-break: break-word;
        background: ${isUser
          ? "linear-gradient(135deg,#ff6600,#cc4400)"
          : "#334155"};
        max-width: ${isMobileView ? "280px" : "100%"};
      `;

      if (msg.isVoice) {
        const audio = document.createElement("audio");
        audio.src = msg.audioUrl;
        audio.id = `audio-${msg.id}`;
        audio.onended = () => audioEnded(msg.id);
        document.body.appendChild(audio);
        media.audioEls[msg.id] = audio;

        bubble.innerHTML = `
          <div style="display:flex;align-items:center;gap:${isMobile() ? "5px" : "7px"};height:36px;">
            <button id="playbtn-${msg.id}" onclick="ChatBot.togglePlay(${msg.id})"
              style="width:26px;height:26px;border-radius:50%;border:none;
                background:rgba(255,255,255,0.25);color:white;cursor:pointer;
                font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="fa-solid fa-play"></i>
            </button>
            <div id="wavebox-${msg.id}"
              style="display:flex;align-items:center;gap:2px;width:${isMobile() ? "60px" : "70px"};height:26px;overflow:hidden;flex-shrink:0;">
              ${waveBarsHTML(false)}
            </div>
            <span style="font-size:${isMobile() ? "10px" : "11px"};opacity:0.75;flex-shrink:0;white-space:nowrap;">
              ${formatTime(msg.duration || 0)}
            </span>
          </div>
        `;
      } else {
        bubble.textContent = msg.text;
      }

      row.appendChild(icon);
      row.appendChild(bubble);
      container.appendChild(row);
    });

    if (state.isBotTyping) {
      const typingRow = document.createElement("div");
      typingRow.style.cssText = `display:flex;align-items:flex-end;gap:6px;margin-left:${isMobile() ? "8px" : "32px"};`;
      typingRow.innerHTML = `
        <div style="display:flex;align-items:flex-end;gap:4px;padding:10px 12px;
          border-radius:18px;border-bottom-left-radius:5px;background:#334155;">
          <div class="typing-dot" style="animation-delay:0s;"></div>
          <div class="typing-dot" style="animation-delay:0.15s;"></div>
          <div class="typing-dot" style="animation-delay:0.3s;"></div>
        </div>
      `;
      container.appendChild(typingRow);
    }

    scrollToBottom();
  };

  // ── Open / Close ─────────────────
  const open = () => {
    const m = modal();
    if (!isMobile()) {
      state.pos = { x: window.innerWidth - 360, y: window.innerHeight - 560 };
      m.style.left   = state.pos.x + "px";
      m.style.top    = state.pos.y + "px";
      m.style.width  = "340px";
      m.style.height = "520px";
    } else {
      m.style.width        = "100%";
      m.style.height       = "100%";
      m.style.left         = "0px";
      m.style.top          = "0px";
      m.style.borderRadius = "0px";
    }
    m.style.display = "flex";
    toggleBtn().style.display = "none";
    renderMessages();
  };

  const close = () => {
    modal().style.display     = "none";
    toggleBtn().style.display = "flex";
  };

  // ── Send text via WebSocket ──────────────────────
  const send = () => {
    if (state.isRecording) { stopRecording(); return; }
    const text = textInput().value.trim();
    if (!text) return;

    state.messages.push({ id: Date.now(), type: "user", text });
    textInput().value  = "";
    state.isBotTyping  = true;
    state.showInitialQuestions = false;
    renderMessages();

    const autoResponse = getAutoResponse(text);
    if (autoResponse) {
      setTimeout(() => {
        state.isBotTyping = false;
        state.messages.push({ id: Date.now(), type: "bot", text: autoResponse });
        renderMessages();
      }, 500);
      return;
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "text", message: text }));
    } else {
      state.isBotTyping = false;
      state.messages.push({ id: Date.now(), type: "bot", text: "⚠️ Not connected to server." });
      renderMessages();
    }
  };

  const handleKey = (e) => { if (e.key === "Enter") send(); };

  // ── Recording UI toggle ────────────
  const updateRecordingUI = () => {
    const isRec = state.isRecording;
    textInput().style.display = isRec ? "none"  : "block";
    recBar().style.display    = isRec ? "flex"   : "none";
    stopWrap().style.display  = isRec ? "flex"   : "none";
    micBtn().style.display    = isRec ? "none"   : "flex";

    if (isRec) {
      recTime().textContent = formatTime(0);
      recWaves().innerHTML  = [0, 0.1, 0.2, 0.15, 0.05, 0.08]
        .map((d) => `<div class="rec-wave-bar" style="animation-delay:${d}s;height:8px;"></div>`)
        .join("");
    }
  };

  // ── Stop recording ───────────────────────────────────────────
  const stopRecording = () => {
    clearInterval(media.timer);
    const capturedDuration = media.timeRef;

    if (media.recorder && media.recorder.state !== "inactive") {
      media.recorder.onstop = () => {
        if (media.chunks.length === 0) return;
        const blob = new Blob(media.chunks, { type: "audio/webm" });

        const url = URL.createObjectURL(blob);
        state.messages.push({
          id: Date.now(), type: "user",
          isVoice: true, audioUrl: url, duration: capturedDuration,
        });
        state.showInitialQuestions = false;
        renderMessages();

        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(blob);
          state.isBotTyping = true;
          renderMessages();
        } else {
          state.messages.push({ id: Date.now(), type: "bot", text: "⚠️ Not connected to server." });
          renderMessages();
        }
      };
      media.recorder.stop();
    }

    if (media.stream) {
      media.stream.getTracks().forEach((t) => t.stop());
      media.stream = null;
    }

    state.isRecording   = false;
    state.recordingTime = 0;
    media.timeRef        = 0;
    updateRecordingUI();
  };

  // ── Start recording ──────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      media.stream   = stream;
      media.chunks   = [];

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      media.recorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) media.chunks.push(e.data);
      };

      recorder.start();
      state.isRecording   = true;
      state.recordingTime = 0;
      media.timeRef        = 0;
      updateRecordingUI();

      media.timer = setInterval(() => {
        media.timeRef++;
        state.recordingTime++;
        const el = recTime();
        if (el) el.textContent = formatTime(state.recordingTime);
      }, 1000);

    } catch (err) {
      console.error(err);
      pushSystemMsg("Microphone error — " + err.name);
    }
  };

  const toggleRecording = () => {
    if (state.isRecording) stopRecording();
    else startRecording();
  };

  // ── Play / Pause voice bubbles ───────────────────────────────
  const togglePlay = (msgId) => {
    const audio   = media.audioEls[msgId] || document.getElementById(`audio-${msgId}`);
    const btn     = document.getElementById(`playbtn-${msgId}`);
    const waveBox = document.getElementById(`wavebox-${msgId}`);
    if (!audio) return;

    if (state.playingId === msgId) {
      audio.pause();
      state.playingId = null;
      if (btn)     btn.innerHTML     = '<i class="fa-solid fa-play"></i>';
      if (waveBox) waveBox.innerHTML = waveBarsHTML(false);
    } else {
      if (state.playingId) {
        const p  = media.audioEls[state.playingId] || document.getElementById(`audio-${state.playingId}`);
        const pb = document.getElementById(`playbtn-${state.playingId}`);
        const pw = document.getElementById(`wavebox-${state.playingId}`);
        if (p)  { p.pause(); p.currentTime = 0; }
        if (pb) pb.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (pw) pw.innerHTML = waveBarsHTML(false);
      }
      audio.play();
      state.playingId = msgId;
      if (btn)     btn.innerHTML     = '<i class="fa-solid fa-pause"></i>';
      if (waveBox) waveBox.innerHTML = waveBarsHTML(true);
    }
  };

  const audioEnded = (msgId) => {
    state.playingId = null;
    const btn     = document.getElementById(`playbtn-${msgId}`);
    const waveBox = document.getElementById(`wavebox-${msgId}`);
    if (btn)     btn.innerHTML     = '<i class="fa-solid fa-play"></i>';
    if (waveBox) waveBox.innerHTML = waveBarsHTML(false);
  };

  // ── Drag to reposition (desktop only) ───────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    initWebSocket();

    const input = $("textInput");
    if (input) input.focus();

    const header = $("chatHeader");
    if (!header) return;

    header.addEventListener("mousedown", (e) => {
      if (isMobile()) return;
      if (e.target.closest("button")) return;
      state.dragging    = true;
      state.dragOffset  = { x: e.clientX - state.pos.x, y: e.clientY - state.pos.y };
      header.style.cursor = "grabbing";
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!state.dragging) return;
      state.pos = { x: e.clientX - state.dragOffset.x, y: e.clientY - state.dragOffset.y };
      const m   = modal();
      m.style.left = state.pos.x + "px";
      m.style.top  = state.pos.y + "px";
    });

    window.addEventListener("mouseup", () => {
      if (!state.dragging) return;
      state.dragging      = false;
      header.style.cursor = "grab";
    });

    header.addEventListener("touchstart", (e) => {
      if (isMobile()) return;
      if (e.target.closest("button")) return;
      const t = e.touches[0];
      state.dragging   = true;
      state.dragOffset = { x: t.clientX - state.pos.x, y: t.clientY - state.pos.y };
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (!state.dragging) return;
      const t   = e.touches[0];
      state.pos = { x: t.clientX - state.dragOffset.x, y: t.clientY - state.dragOffset.y };
      const m   = modal();
      m.style.left = state.pos.x + "px";
      m.style.top  = state.pos.y + "px";
    }, { passive: true });

    window.addEventListener("touchend", () => { state.dragging = false; });

    window.addEventListener("resize", () => {
      const m = modal();
      if (m.style.display === "none") return;

      if (isMobile()) {
        m.style.width        = "100%";
        m.style.height       = "100%";
        m.style.left         = "0px";
        m.style.top          = "0px";
        m.style.borderRadius = "0px";
      } else {
        state.pos.x  = Math.max(0, Math.min(state.pos.x, window.innerWidth  - 340));
        state.pos.y  = Math.max(0, Math.min(state.pos.y, window.innerHeight - 520));
        m.style.left = state.pos.x + "px";
        m.style.top  = state.pos.y + "px";
        m.style.width  = "340px";
        m.style.height = "520px";
      }
    });
  });

  // ── Public API ──────────────
  return { open, close, send, handleKey, toggleRecording, togglePlay };
})();