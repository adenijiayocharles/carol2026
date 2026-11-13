(() => {
  "use strict";

  // Canvas size and the photo circle in the template (measured from assets/template.webp)
  const W = 1080;
  const H = 1350;
  const CX = 353;
  const CY = 583;
  const R = 327; // slightly larger than the transparent hole so no gap shows at the edge
  const MAX_ZOOM = 4;
  const FILE_NAME = "christmas-concert-2026-i-will-be-there.jpg";

  const $ = (id) => document.getElementById(id);
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const box = $("canvasBox");
  const fileInput = $("file");
  const zoomInput = $("zoom");
  const zoomRow = $("zoomRow");
  const hint = $("hint");
  const pickBtn = $("pickBtn");
  const cameraBtn = $("cameraBtn");
  const cameraInput = $("cameraFile");
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  cameraBtn.hidden = !isTouch;
  const downloadBtn = $("downloadBtn");
  const shareBtn = $("shareBtn");
  const buttons = document.querySelector(".buttons");

  const frame = new Image();
  frame.src = "assets/template.webp?v=3"; // bump when the template changes so browsers fetch the new one

  const state = {
    photo: null,
    baseScale: 1, // scale at which the photo just covers the circle
    zoom: 1,
    offX: 0, // photo centre relative to circle centre, in canvas px
    offY: 0,
  };

  // ---------- drawing ----------

  function scale() {
    return state.baseScale * state.zoom;
  }

  function clampOffset() {
    const p = state.photo;
    if (!p) return;
    const s = scale();
    const maxX = Math.max(0, (p.width * s) / 2 - R);
    const maxY = Math.max(0, (p.height * s) / 2 - R);
    state.offX = Math.min(maxX, Math.max(-maxX, state.offX));
    state.offY = Math.min(maxY, Math.max(-maxY, state.offY));
  }

  function drawPlaceholder() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(CX, CY - 40, 20, CX, CY, R);
    g.addColorStop(0, "#fffaf3");
    g.addColorStop(1, "#f1e3cf");
    ctx.fillStyle = g;
    ctx.fill();

    // camera icon + label, designed at radius 184 and scaled to the circle
    const k = R / 184;
    ctx.translate(CX, CY);
    ctx.scale(k, k);
    ctx.translate(0, -38);
    ctx.fillStyle = "#c8102e";
    roundRect(-52, -30, 104, 74, 14);
    ctx.fill();
    ctx.fillRect(-20, -42, 40, 16);
    ctx.beginPath();
    ctx.arc(0, 7, 24, 0, Math.PI * 2);
    ctx.fillStyle = "#fffaf3";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 7, 15, 0, Math.PI * 2);
    ctx.fillStyle = "#c8102e";
    ctx.fill();
    ctx.translate(0, 38);

    ctx.fillStyle = "#123d2c";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 34px Inter, system-ui, sans-serif";
    ctx.fillText("Tap to add", 0, 72);
    ctx.fillText("your photo", 0, 114);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    const p = state.photo;
    if (p) {
      const s = scale();
      const w = p.width * s;
      const h = p.height * s;
      ctx.save();
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(p, CX + state.offX - w / 2, CY + state.offY - h / 2, w, h);
      ctx.restore();
    } else {
      drawPlaceholder();
    }

    if (frame.complete && frame.naturalWidth) {
      ctx.drawImage(frame, 0, 0, W, H);
    }
  }

  let raf = 0;
  function requestDraw() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      draw();
    });
  }

  frame.addEventListener("load", draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  draw();

  // ---------- loading a photo ----------

  function openPicker() {
    fileInput.value = "";
    fileInput.click();
  }

  async function loadPhoto(file) {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }
    let bitmap;
    try {
      // Respect phone camera orientation where supported
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      bitmap = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      }).catch(() => null);
    }
    if (!bitmap) {
      alert("Sorry, that photo couldn't be opened. Please try another one.");
      return;
    }

    state.photo = bitmap;
    state.baseScale = (2 * R) / Math.min(bitmap.width, bitmap.height);
    state.zoom = 1;
    state.offX = 0;
    state.offY = 0;
    zoomInput.value = "1";

    box.classList.add("has-photo");
    document.body.classList.add("has-photo-page");
    cameraBtn.textContent = "Retake selfie";
    pickBtn.textContent = isTouch ? "Choose another" : "Change photo";
    downloadBtn.hidden = false;
    shareBtn.hidden = !canShareFiles();
    buttons.classList.toggle("two", !shareBtn.hidden);
    zoomRow.hidden = false;
    hint.hidden = false;
    draw();
  }

  function openCamera() {
    cameraInput.value = "";
    cameraInput.click();
  }

  pickBtn.addEventListener("click", openPicker);
  cameraBtn.addEventListener("click", openCamera);
  $("addHit").addEventListener("click", openPicker);
  fileInput.addEventListener("change", () => loadPhoto(fileInput.files[0]));
  cameraInput.addEventListener("change", () => loadPhoto(cameraInput.files[0]));

  // Drag-and-drop on desktop
  box.addEventListener("dragover", (e) => e.preventDefault());
  box.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadPhoto(f);
  });

  // ---------- pan & zoom ----------

  function setZoom(z, anchorX = CX, anchorY = CY) {
    const old = state.zoom;
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    if (next === old) return;
    // keep the point under the anchor fixed while zooming
    const k = next / old;
    state.offX = anchorX - CX - (anchorX - CX - state.offX) * k;
    state.offY = anchorY - CY - (anchorY - CY - state.offY) * k;
    state.zoom = next;
    zoomInput.value = String(next);
    clampOffset();
    requestDraw();
  }

  zoomInput.addEventListener("input", () => setZoom(parseFloat(zoomInput.value)));

  const pointers = new Map();
  let pinch = null;

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function pinchInfo() {
    const [a, b] = [...pointers.values()];
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!state.photo) {
      const pt = toCanvas(e);
      if (Math.hypot(pt.x - CX, pt.y - CY) <= R + 10) openPicker();
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, toCanvas(e));
    canvas.classList.add("dragging");
    if (pointers.size === 2) pinch = { ...pinchInfo(), zoom: state.zoom };
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const pt = toCanvas(e);
    pointers.set(e.pointerId, pt);

    if (pointers.size === 1) {
      state.offX += pt.x - prev.x;
      state.offY += pt.y - prev.y;
      clampOffset();
      requestDraw();
    } else if (pointers.size === 2 && pinch) {
      const now = pinchInfo();
      // pan by midpoint movement, then zoom around the midpoint
      state.offX += now.mx - pinch.mx;
      state.offY += now.my - pinch.my;
      pinch.mx = now.mx;
      pinch.my = now.my;
      setZoom(pinch.zoom * (now.dist / pinch.dist), now.mx, now.my);
      clampOffset();
      requestDraw();
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) canvas.classList.remove("dragging");
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!state.photo) return;
      e.preventDefault();
      const pt = toCanvas(e);
      setZoom(state.zoom * Math.exp(-e.deltaY * 0.0015), pt.x, pt.y);
    },
    { passive: false }
  );

  // ---------- export ----------

  function makeBlob() {
    draw();
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  }

  function canShareFiles() {
    try {
      const f = new File([new Blob()], FILE_NAME, { type: "image/jpeg" });
      return !!(navigator.canShare && navigator.canShare({ files: [f] }));
    } catch {
      return false;
    }
  }

  downloadBtn.addEventListener("click", async () => {
    downloadBtn.disabled = true;
    try {
      const blob = await makeBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = FILE_NAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      downloadBtn.disabled = false;
    }
  });

  shareBtn.addEventListener("click", async () => {
    shareBtn.disabled = true;
    try {
      const blob = await makeBlob();
      const file = new File([blob], FILE_NAME, { type: "image/jpeg" });
      await navigator.share({
        files: [file],
        title: "Christmas Concert 2026",
        text: "I will be there! Christmas Concert 2026 at RCCG Fountain of Love, Aberdeen.",
      });
    } catch (err) {
      if (err && err.name !== "AbortError") alert("Sharing didn't work here. Please use Download instead.");
    } finally {
      shareBtn.disabled = false;
    }
  });
})();
