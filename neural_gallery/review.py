"""Localhost review page. It can label photos. It cannot delete them."""

import json
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from PIL import Image, ImageOps

from neural_gallery.access import allowed_file
from neural_gallery.actions import (
    ActionError,
    get_photo_detail,
    mark_trashed,
    move_indexed,
    reveal,
    set_category,
    toggle_favorite,
    toggle_hidden,
    trash_indexed,
    trash_other_copies,
)
from neural_gallery.db import connect
from neural_gallery.faces import (
    confirm_candidate,
    list_candidates,
    list_people,
    merge_people,
    name_person,
)
from neural_gallery.learn import load_examples, suggest
from neural_gallery.scan import scan_folder
from neural_gallery.sync import MOBILE_PWA_HTML, get_sync_engine

PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Neural Gallery</title>
<style>
  :root {
    color-scheme: light dark;
    --ink: #2a2422; --muted: #8a736c; --line: #eadfd8; --bg: #f6eee9; --glow: #fff7f3;
    --card: rgba(255,252,250,.86); --surface: #ffffff; --keep-ink: #fffaf7;
    --noise: #9a4038; --noise-line: #efd2ce; --shadow: rgba(80, 40, 30, .12);
    --pile-shadow: rgba(90, 50, 40, .06); --shot: #efe6e0;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      color-scheme: dark;
      --ink: #f4ebe6; --muted: #b5a399; --line: rgba(255, 236, 226, .14); --bg: #161210; --glow: #2a211c;
      --card: rgba(38, 31, 28, .92); --surface: #2c2420; --keep-ink: #1a1513;
      --noise: #f0a8a1; --noise-line: rgba(240, 168, 161, .4); --shadow: rgba(0, 0, 0, .45);
      --pile-shadow: rgba(0, 0, 0, .35); --shot: #3a302c;
    }
  }
  * { box-sizing: border-box; }
  html { background: var(--bg); }
  body { margin: 0; min-height: 100vh; font: 16px/1.4 "Avenir Next", "Segoe UI", sans-serif; color: var(--ink); background: radial-gradient(1200px 700px at 10% 0%, var(--glow), var(--bg) 55%); }
  button { font: inherit; border: 0; cursor: pointer; color: inherit; }
  .studio { display: grid; grid-template-columns: 280px 1fr; height: 100vh; padding: 18px; gap: 16px; }
  .rail { background: var(--card); border: 1px solid var(--line); border-radius: 28px; padding: 36px 16px 22px; display: flex; flex-direction: column; gap: 14px; }
  .brand { display: flex; gap: 12px; align-items: center; padding: 0 8px; }
  .brand img { width: 42px; height: 42px; border-radius: 12px; box-shadow: none; }
  h1 { margin: 0; font: 500 30px/1 "Iowan Old Style", Palatino, Georgia, serif; }
  .brand p, .meta, #caption { margin: 2px 0 0; color: var(--muted); font-size: 13px; }
  #pick { border-radius: 999px; padding: 10px 14px; background: var(--surface); color: var(--ink); border: 1px solid var(--line); }
  #piles { display: flex; flex-direction: column; gap: 8px; }
  .pile { text-align: left; background: transparent; border-radius: 18px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: baseline; color: var(--ink); }
  .pile.on { background: var(--surface); box-shadow: 0 8px 24px var(--pile-shadow); }
  .pile b { font-weight: 500; }
  .pile span { color: var(--muted); font-variant-numeric: tabular-nums; }
  #stats { padding: 0 8px; }
  .canvas { position: relative; min-width: 0; }
  #review { height: 100%; display: grid; grid-template-rows: 1fr auto auto; place-items: center; padding: 8px 8px 18px; }
  #review.off, #people.off, #group.off { display: none !important; }
  .frame { position: relative; width: min(920px, 100%); height: 100%; display: grid; place-items: center; }
  .nav { position: absolute; top: 50%; z-index: 2; width: 46px; height: 46px; margin-top: -23px; border-radius: 999px; background: var(--surface); color: var(--ink); border: 1px solid var(--line); font-size: 28px; line-height: 1; box-shadow: 0 8px 24px var(--pile-shadow); }
  .nav.prev { left: 8px; }
  .nav.next { right: 8px; }
  .nav:disabled { opacity: .35; cursor: default; }
  #photo { max-width: min(860px, 92%); max-height: calc(100vh - 230px); border-radius: 22px; object-fit: contain; background: var(--surface); box-shadow: 0 18px 50px var(--shadow); transition: opacity .2s ease; }
  #photo.out-keep, #photo.out-noise { opacity: 0; }
  #caption { min-height: 1.2em; letter-spacing: .01em; }
  #actions { display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; }
  .keep, .noise, .skip { border-radius: 999px; padding: 14px 28px; font-size: 17px; }
  .keep { background: var(--ink); color: var(--keep-ink); }
  .noise { background: var(--surface); color: var(--noise); border: 1px solid var(--noise-line); }
  .skip, .quiet { background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 999px; padding: 10px 16px; }
  .danger { background: transparent; color: var(--noise); padding: 10px 8px; }
  .empty { color: var(--muted); padding: 24px; }
  #people, #group { display: none; position: absolute; inset: 0; overflow: auto; padding: 12px; }
  #people.show { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; align-content: start; }
  .faces-intro { grid-column: 1 / -1; padding: 8px 8px 0; }
  .faces-intro h2 { margin: 0; font: 500 28px/1.1 "Iowan Old Style", Palatino, Georgia, serif; }
  .faces-intro p { margin: 6px 0 0; color: var(--muted); }
  #group.show { display: block; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
  .card, .person { background: var(--surface); border-radius: 18px; border: 1px solid var(--line); min-width: 0; }
  .shot { display: block; height: 180px; border-radius: 18px 18px 0 0; background: var(--shot) center/cover no-repeat; }
  .card img { display: block; width: 100%; height: 200px; object-fit: cover; }
  .card .pad, .person div { padding: 10px 12px; }
  .row { display: flex; gap: 8px; }
  .card .row button { flex: 1; border-radius: 999px; padding: 8px 10px; }
  .person input { width: 100%; font: inherit; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); }
  .person .row button { flex: 1; min-width: 0; border-radius: 999px; padding: 8px 10px; font-size: 14px; white-space: nowrap; }
  button.shot { width: 100%; padding: 0; }
  .grid .thumb { display: block; width: 100%; height: 180px; object-fit: cover; background: var(--shot); cursor: pointer; }
  .collage { position: relative; margin-top: 6px; }
  .polaroid { position: absolute; width: 168px; margin: 0; padding: 8px 8px 22px; border: 0; border-radius: 3px; background: var(--surface); box-shadow: 0 16px 34px var(--shadow); cursor: pointer; transform: rotate(var(--spin)); animation: settle .72s cubic-bezier(.16, .84, .32, 1) both; }
  .polaroid img { display: block; width: 100%; height: 148px; object-fit: cover; background: var(--shot); pointer-events: none; }
  .polaroid:hover, .polaroid:focus-visible { z-index: 30; transform: rotate(0deg) scale(1.07); transition: transform .18s ease; }
  @keyframes settle { from { opacity: 0; translate: 0 -56px; scale: .84; } to { opacity: 1; translate: 0 0; scale: 1; } }
  @media (prefers-reduced-motion: reduce) { .polaroid { animation: none; } }
  @media (max-width: 860px) { .studio { grid-template-columns: 1fr; height: auto; } .rail { border-radius: 22px; } }
</style>
</head>
<body>
<div class="studio">
  <aside class="rail">
    <div class="brand"><img src="/icon.png" alt=""><div><h1>Neural Gallery</h1><p>Your folders. On this Mac.</p></div></div>
    <button id="pick" type="button">Choose folder</button>
    <nav id="piles">
      <button class="pile on" data-bucket="inbox" type="button"><b>To sort</b><span id="count-inbox">0</span></button>
      <button class="pile" data-bucket="screenshots" type="button"><b>Screenshots</b><span id="count-screenshots">0</span></button>
      <button class="pile" data-bucket="duplicates" type="button"><b>Near copies</b><span id="count-duplicates">0</span></button>
      <button class="pile" data-bucket="people" type="button"><b>Same face</b><span id="count-people">0</span></button>
      <button class="pile" data-bucket="keep" type="button"><b>Kept</b><span id="count-keep">0</span></button>
      <button class="pile" data-bucket="noise" type="button"><b>Noise</b><span id="count-noise">0</span></button>
    </nav>
    <p id="stats" class="meta"></p>
  </aside>
  <div class="canvas">
    <section id="review">
      <div class="frame">
        <button id="prev" class="nav prev" type="button" aria-label="Previous photo" title="Previous (Left arrow)" hidden>‹</button>
        <img id="photo" alt="">
        <button id="next" class="nav next" type="button" aria-label="Next photo" title="Next (Right arrow)" hidden>›</button>
      </div>
      <p id="caption"></p>
      <div id="actions"></div>
    </section>
    <section id="people"></section>
    <section id="group"></section>
  </div>
</div>
<select id="bucket" hidden>
  <option value="inbox">Unlabeled</option>
  <option value="screenshots">Screenshots</option>
  <option value="duplicates">Near duplicates</option>
  <option value="keep">Kept</option>
  <option value="noise">Noise</option>
  <option value="faces">Faces</option>
  <option value="people">People</option>
</select>
<script>
const bucket = document.querySelector("#bucket");
const photo = document.querySelector("#photo");
const caption = document.querySelector("#caption");
const actions = document.querySelector("#actions");
const stats = document.querySelector("#stats");
let current = null;
let history = [];
let index = -1;
let noMore = false;
let skipped = new Set();
let skippedGroups = new Set();
let personKey = "";
let faceTitle = "";
let busy = false;

async function refreshStats() {
  const data = await (await fetch("/api/stats")).json();
  const counts = {
    inbox: data.unlabeled,
    screenshots: data.screenshots,
    duplicates: data.duplicate_groups,
    people: data.people || 0,
    keep: data.keep,
    noise: data.noise
  };
  for (const [name, count] of Object.entries(counts)) {
    const node = document.querySelector("#count-" + name);
    if (node) node.textContent = count;
  }
  document.querySelectorAll(".pile").forEach((pile) => {
    pile.classList.toggle("on", pile.dataset.bucket === bucket.value);
  });
  stats.textContent = data.total + " photos on this Mac. Nothing is deleted unless you say Trash.";
}

function render(item) {
  current = item;
  photo.classList.remove("out-keep", "out-noise");
  if (!item) {
    photo.removeAttribute("src");
    photo.alt = "";
    caption.textContent = "";
    actions.innerHTML = '<p class="empty">This pile is clear. Choose another, or pick a folder.</p>';
    updateNav();
    return;
  }
  photo.classList.add("in");
  photo.src = "/media/" + item.id + "?t=" + Date.now();
  photo.alt = item.name;
  const bits = [item.name, (item.width || "?") + "×" + (item.height || "?")];
  if (item.is_screenshot) bits.push("screenshot");
  if (item.dup_count > 1) bits.push(item.dup_count + " copies");
  if (item.face_count) bits.push(item.face_count + (item.face_count === 1 ? " face" : " faces"));
  if (item.person_names) bits.push(item.person_names);
  if (item.suggestion) bits.push("feels like " + item.suggestion);
  caption.textContent = bits.join("  ·  ");
  actions.innerHTML = `
    <button class="noise" type="button">Noise</button>
    <button class="skip" type="button">Skip</button>
    <button class="keep" type="button">Keep</button>
    <button class="quiet reveal" type="button">Finder</button>
    <button class="quiet move" type="button">Move</button>
    <button class="danger trash" type="button">Trash</button>
    ${personKey ? '<button class="quiet all" type="button">All photos</button>' : ""}
    ${item.dup_count > 1 ? '<button class="danger copies" type="button">Trash the other copies</button>' : ""}`;
  actions.querySelector(".keep").onclick = () => label("keep");
  actions.querySelector(".noise").onclick = () => label("noise");
  actions.querySelector(".skip").onclick = () => skip();
  actions.querySelector(".reveal").onclick = () => post("/api/reveal", {id: current.id});
  actions.querySelector(".move").onclick = () => moveCurrent();
  actions.querySelector(".trash").onclick = () => trashCurrent();
  const copies = actions.querySelector(".copies");
  if (copies) copies.onclick = () => trashCopies();
  const all = actions.querySelector(".all");
  if (all) all.onclick = () => showFacePhotos(personKey, faceTitle);
  updateNav();
}

function updateNav() {
  const prev = document.querySelector("#prev");
  const next = document.querySelector("#next");
  const has = history.length > 0 && current;
  prev.hidden = !has;
  next.hidden = !has;
  prev.disabled = index <= 0;
  next.disabled = noMore && index >= history.length - 1;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}

function showOnly(which) {
  for (const id of ["review", "people", "group"]) {
    const node = document.querySelector("#" + id);
    const on = id === which;
    node.classList.toggle("off", !on);
    node.classList.toggle("show", on && id !== "review");
  }
}

async function load() {
  if (bucket.value === "people") {
    showOnly("people");
    await loadPeople();
    await refreshStats();
    return;
  }
  if (bucket.value === "duplicates") {
    showOnly("group");
    await loadGroup();
    await refreshStats();
    return;
  }
  showOnly("review");
  history = [];
  index = -1;
  noMore = false;
  const item = await fetchNext();
  if (item) {
    history = [item];
    index = 0;
  } else {
    noMore = true;
  }
  render(item);
  await refreshStats();
}

async function fetchNext() {
  const params = new URLSearchParams({bucket: bucket.value, skip: [...skipped].join(",")});
  if (personKey) params.set("person", personKey);
  const response = await fetch("/api/next?" + params);
  if (response.status === 204) return null;
  return response.json();
}

function reviewing() {
  return !document.querySelector("#review").classList.contains("off");
}

async function goPrevious() {
  if (busy || !reviewing() || index <= 0) return;
  index -= 1;
  render(history[index]);
}

async function goNext() {
  if (busy || !reviewing()) return;
  if (index < history.length - 1) {
    index += 1;
    render(history[index]);
    return;
  }
  if (noMore || !current) return;
  busy = true;
  const id = current.id;
  skipped.add(id);
  photo.classList.remove("in");
  photo.classList.add("out-keep");
  await new Promise((resolve) => setTimeout(resolve, 140));
  const item = await fetchNext();
  photo.classList.remove("out-keep");
  if (!item) {
    noMore = true;
    skipped.delete(id);
    render(current);
    busy = false;
    return;
  }
  history.push(item);
  index = history.length - 1;
  render(item);
  busy = false;
}

async function dropCurrentAndAdvance() {
  const atEnd = index < 0 || index >= history.length - 1;
  if (index >= 0) history.splice(index, 1);
  if (!atEnd && index < history.length) {
    render(history[index]);
    await refreshStats();
    return;
  }
  const item = await fetchNext();
  if (item) {
    history.push(item);
    index = history.length - 1;
    noMore = false;
    render(item);
  } else {
    noMore = true;
    index = history.length - 1;
    render(index >= 0 ? history[index] : null);
  }
  await refreshStats();
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json", "X-Neural-Gallery": "1"},
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    alert(detail.error || "Neural Gallery could not do that.");
    return null;
  }
  return response.json();
}

async function label(value) {
  if (!current || busy) return;
  busy = true;
  const id = current.id;
  photo.classList.remove("in");
  photo.classList.add(value === "keep" ? "out-keep" : "out-noise");
  await new Promise((resolve) => setTimeout(resolve, 260));
  skipped.add(id);
  const saved = await post("/api/label", {id, label: value});
  if (!saved) {
    skipped.delete(id);
    photo.classList.remove("out-keep", "out-noise");
    busy = false;
    return;
  }
  await dropCurrentAndAdvance();
  busy = false;
}

async function loadGroup() {
  const board = document.querySelector("#group");
  board.classList.add("show");
  const params = new URLSearchParams({skip: [...skippedGroups].join(",")});
  const response = await fetch("/api/duplicate-group?" + params);
  if (response.status === 204) {
    board.innerHTML = '<p class="empty">No near-duplicate groups left in this pass.</p>';
    return;
  }
  const data = await response.json();
  board.innerHTML = `
    <div class="row" style="align-items:center; margin-bottom:14px">
      <strong>${data.files.length} copies of one shot</strong>
      <button class="skip next" type="button">Next group</button>
    </div>
    <div class="grid">
      ${data.files.map((file) => `
        <article class="card">
          <img src="/media/${file.id}?t=${Date.now()}" alt="">
          <div class="pad">
            <div class="meta">${escapeHtml(file.name)}<br>${file.width || "?"}×${file.height || "?"}${file.label ? " · " + escapeHtml(file.label) : ""}</div>
            <div class="row">
              <button class="keep" type="button" data-id="${file.id}">Keep</button>
              <button class="noise" type="button" data-id="${file.id}">Noise</button>
              <button class="danger trash" type="button" data-id="${file.id}" data-name="${escapeHtml(file.name)}">Trash</button>
            </div>
          </div>
        </article>`).join("")}
    </div>`;
  board.querySelector(".next").onclick = () => {
    skippedGroups.add(data.group_key);
    load();
  };
  board.querySelectorAll(".keep").forEach((button) => {
    button.onclick = () => labelId(Number(button.dataset.id), "keep");
  });
  board.querySelectorAll(".noise").forEach((button) => {
    button.onclick = () => labelId(Number(button.dataset.id), "noise");
  });
  board.querySelectorAll(".trash").forEach((button) => {
    button.onclick = () => trashId(Number(button.dataset.id));
  });
}

async function labelId(id, value) {
  const saved = await post("/api/label", {id, label: value});
  if (!saved) return;
  await load();
}

async function trashId(id) {
  const saved = await post("/api/trash", {id});
  if (!saved) return;
  await load();
}

async function scanFromApp() {
  const button = document.querySelector("#pick");
  let folder = "";
  if (window.pywebview && window.pywebview.api) {
    folder = await window.pywebview.api.choose_folder();
  } else {
    folder = window.prompt("Paste the folder path to index");
  }
  if (!folder) return;
  button.disabled = true;
  stats.textContent = "Indexing… this can take a minute.";
  const summary = await post("/api/scan", {folder});
  button.disabled = false;
  if (!summary) return;
  skipped.clear();
  skippedGroups.clear();
  await load();
}

document.querySelector("#pick").onclick = () => scanFromApp();
document.querySelectorAll(".pile").forEach((pile) => {
  pile.onclick = () => {
    bucket.value = pile.dataset.bucket;
    bucket.onchange();
  };
});

async function chooseFolder() {
  if (window.pywebview && window.pywebview.api) {
    return await window.pywebview.api.choose_folder();
  }
  return window.prompt("Move this photo into which folder? Paste a full path.");
}

async function moveCurrent() {
  if (!current) return;
  const folder = await chooseFolder();
  if (!folder) return;
  if (!window.confirm("Move " + current.name + " into " + folder + "?")) return;
  const saved = await post("/api/move", {id: current.id, destination: folder});
  if (!saved) return;
  skipped.add(current.id);
  await dropCurrentAndAdvance();
}

async function trashCurrent() {
  if (!current || busy) return;
  busy = true;
  const id = current.id;
  photo.classList.remove("in");
  photo.classList.add("out-noise");
  await new Promise((resolve) => setTimeout(resolve, 220));
  skipped.add(id);
  const saved = await post("/api/trash", {id});
  if (!saved) {
    skipped.delete(id);
    photo.classList.remove("out-noise");
    busy = false;
    return;
  }
  await dropCurrentAndAdvance();
  busy = false;
}

async function trashCopies() {
  if (!current || current.dup_count < 2) return;
  const others = current.dup_count - 1;
  if (!window.confirm("Move the other " + others + " near-duplicate" + (others === 1 ? "" : "s") + " to the Trash? This photo stays.")) return;
  const saved = await post("/api/trash-copies", {id: current.id});
  if (!saved) return;
  await load();
}

async function loadPeople() {
  const board = document.querySelector("#people");
  const groups = await (await fetch("/api/people")).json();
  const intro = `<div class="faces-intro"><h2>Same face</h2><p>Each card is a guess that these photos show one person. See all to look through every photo in that guess.</p></div>`;
  if (!groups.length) {
    board.innerHTML = intro + '<p class="empty">No face groups yet.</p>';
    return;
  }
  board.innerHTML = intro + groups.map((person) => `
    <article class="person">
      <div class="shot" style="background-image:url(/media/${person.sample_id}?w=480)"></div>
      <div>
        <strong>${escapeHtml(person.name || "Unnamed face")}</strong>
        <p class="meta">${person.photo_count} photos</p>
        <input value="${escapeHtml(person.name || "")}" data-key="${escapeHtml(person.person_key)}" placeholder="Name this person">
        <div class="row" style="margin-top:8px">
          <button class="quiet save" type="button">Save name</button>
          <button class="quiet see" type="button" data-key="${escapeHtml(person.person_key)}" data-name="${escapeHtml(person.name || "")}">See all ${person.photo_count}</button>
        </div>
      </div>
    </article>`).join("");
  board.querySelectorAll(".save").forEach((button) => {
    button.onclick = async () => {
      const input = button.parentElement.parentElement.querySelector("input");
      await post("/api/person", {person_key: input.dataset.key, name: input.value});
      await loadPeople();
    };
  });
  board.querySelectorAll(".see").forEach((button) => {
    button.onclick = () => showFacePhotos(button.dataset.key, button.dataset.name || "");
  });
}

async function showFacePhotos(key, name) {
  if (!key) return;
  personKey = key;
  faceTitle = name || "";
  const board = document.querySelector("#group");
  showOnly("group");
  board.innerHTML = '<p class="empty">Loading photos…</p>';
  const response = await fetch("/api/person-photos?person=" + encodeURIComponent(key));
  if (!response.ok) {
    board.innerHTML = '<p class="empty">Those photos could not be loaded.</p>';
    return;
  }
  const data = await response.json();
  if (!faceTitle) faceTitle = data.name || "";
  const title = faceTitle || "Unnamed face";
  const files = data.files;
  const width = Math.max(320, board.clientWidth - 28);
  const layout = collageLayout(files.length, width);
  board.innerHTML = `
    <div class="faces-intro">
      <button class="quiet back" type="button">Back</button>
      <h2>${escapeHtml(title)}</h2>
      <p>${files.length} photos, spread out like a pile. Click one to sort it.</p>
    </div>
    <div class="collage" style="height:${layout.height}px">
      ${files.map((file, i) => {
        const spot = layout.spots[i];
        return `<button class="polaroid" type="button" data-id="${file.id}" style="left:${spot.left}px; top:${spot.top}px; z-index:${spot.z}; --spin:${spot.spin}deg; animation-delay:${spot.delay}s"><img alt="" loading="lazy" src="/media/${file.id}?w=320"></button>`;
      }).join("")}
    </div>`;
  board.querySelector(".back").onclick = () => {
    bucket.value = "people";
    personKey = "";
    faceTitle = "";
    load();
  };
  board.querySelectorAll(".polaroid").forEach((button) => {
    button.onclick = () => sortFacePhoto(files, Number(button.dataset.id));
  });
}

function collageLayout(count, width) {
  const cardW = 176;
  const cardH = 214;
  const stepX = Math.round(cardW * 0.74);
  const stepY = Math.round(cardH * 0.68);
  const cols = Math.max(2, Math.floor((width - cardW - 16) / stepX) + 1);
  const rows = Math.ceil(count / cols);
  const spots = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const n = Math.imul(i + 1, 2246822519) >>> 0;
    spots.push({
      left: 6 + col * stepX + (n % 18) - 8,
      top: 4 + row * stepY + ((n >>> 8) % 16) - 6,
      spin: (n % 15) - 7,
      delay: Math.min(i, 22) * 0.042,
      z: (n % 5) + 1
    });
  }
  return { height: rows * stepY + cardH + 28, spots };
}

function sortFacePhoto(files, id) {
  if (!files.length) return;
  bucket.value = "faces";
  history = files;
  const found = files.findIndex((file) => file.id === id);
  index = found >= 0 ? found : 0;
  noMore = true;
  skipped = new Set(files.map((file) => file.id));
  showOnly("review");
  render(history[index]);
  refreshStats();
}

function skip() {
  goNext();
}

function typingTarget(target) {
  return !!(target && target.closest && target.closest("input, textarea, select"));
}

function reportTyping(on) {
  const api = window.pywebview && window.pywebview.api;
  if (api && api.set_typing) api.set_typing(!!on);
}

function neuralGalleryArrow(direction) {
  if (typingTarget(document.activeElement)) return;
  if (!reviewing()) return;
  if (direction < 0) goPrevious();
  else goNext();
}

document.addEventListener("focusin", (event) => reportTyping(typingTarget(event.target)));
document.addEventListener("focusout", () => reportTyping(false));
document.addEventListener("mousedown", (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey) return;
  if (!event.target.closest || event.target.closest("button, a, input, textarea, select, label, img, .card, .person, #actions")) return;
  const api = window.pywebview && window.pywebview.api;
  if (!api || !api.begin_drag) return;
  api.begin_drag();
});
document.querySelector("#prev").onclick = () => goPrevious();
document.querySelector("#next").onclick = () => goNext();
bucket.onchange = () => { history = []; index = -1; noMore = false; skipped.clear(); skippedGroups.clear(); personKey = ""; faceTitle = ""; load(); };
document.addEventListener("keydown", (event) => {
  if (typingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.keyCode === 37 || event.keyCode === 39) {
    event.preventDefault();
    neuralGalleryArrow(event.key === "ArrowLeft" || event.keyCode === 37 ? -1 : 1);
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "k") label("keep");
  if (key === "n") label("noise");
  if (key === "s") skip();
});
load();
</script>
</body>
</html>
"""


def duplicate_group(connection, skip_keys: set[str]):
    rows = connection.execute(
        """
        SELECT group_key
        FROM dup_groups
        GROUP BY group_key
        HAVING COUNT(*) >= 2
        ORDER BY COUNT(*) DESC, group_key
        """
    ).fetchall()
    for row in rows:
        group_key = row["group_key"]
        if group_key in skip_keys:
            continue
        files = connection.execute(
            """
            SELECT files.id, files.path, files.width, files.height, files.label
            FROM files
            JOIN dup_groups ON dup_groups.file_id = files.id
            WHERE dup_groups.group_key = ?
            ORDER BY COALESCE(files.width, 0) * COALESCE(files.height, 0) DESC, files.id
            """,
            (group_key,),
        ).fetchall()
        return {
            "group_key": group_key,
            "files": [
                {
                    "id": item["id"],
                    "name": Path(item["path"]).name,
                    "path": item["path"],
                    "width": item["width"],
                    "height": item["height"],
                    "label": item["label"],
                }
                for item in files
            ],
        }
    return None


def _person_key(value: str | None) -> str | None:
    if not value or not value.startswith("p") or not value[1:].isdigit() or len(value) > 32:
        return None
    return value


def _where(bucket: str, skip_ids: set[int], person_key: str | None):
    where = ["1 = 1"]
    params: list = []
    if bucket == "inbox":
        where.append("label IS NULL")
    elif bucket == "screenshots":
        where.append("is_screenshot = 1 AND label IS NULL")
    elif bucket == "duplicates":
        where.append("label IS NULL AND id IN (SELECT file_id FROM dup_groups)")
    elif bucket == "keep":
        where.append("label = 'keep'")
    elif bucket == "noise":
        where.append("label = 'noise'")
    elif bucket == "faces":
        if person_key:
            where.append("id IN (SELECT file_id FROM faces WHERE person_key = ?)")
            params.append(person_key)
        else:
            where.append("id IN (SELECT file_id FROM faces)")
    else:
        return None
    if skip_ids:
        marks = ",".join("?" for _ in skip_ids)
        where.append(f"id NOT IN ({marks})")
        params.extend(sorted(skip_ids))
    return where, params


def _rows(connection, bucket: str, skip_ids: set[int], person_key: str | None, limit: int):
    built = _where(bucket, skip_ids, person_key)
    if built is None:
        return []
    where, params = built
    limit = max(1, min(int(limit), 12))
    sql = f"""
        SELECT files.*,
               (SELECT COUNT(*) FROM dup_groups other
                 WHERE other.group_key = (
                   SELECT group_key FROM dup_groups mine WHERE mine.file_id = files.id
                 )) AS dup_count,
               (SELECT COUNT(*) FROM faces WHERE faces.file_id = files.id) AS face_count,
               (SELECT group_concat(name, ', ') FROM (
                    SELECT DISTINCT people.name AS name
                    FROM faces
                    JOIN people ON people.person_key = faces.person_key
                    WHERE faces.file_id = files.id AND people.name != ''
               )) AS person_names
        FROM files
        WHERE {' AND '.join(where)}
        ORDER BY is_screenshot DESC, id
        LIMIT {limit}
    """
    return connection.execute(sql, params).fetchall()


def _next_row(connection, bucket: str, skip_ids: set[int], person_key: str | None = None):
    rows = _rows(connection, bucket, skip_ids, person_key, 1)
    return rows[0] if rows else None


def person_photos(connection, person_key: str) -> dict:
    """Every photo in one face group, not just the sample on the card."""
    rows = connection.execute(
        """
        SELECT files.*,
               (SELECT COUNT(*) FROM dup_groups other
                 WHERE other.group_key = (
                   SELECT group_key FROM dup_groups mine WHERE mine.file_id = files.id
                 )) AS dup_count,
               (SELECT COUNT(*) FROM faces WHERE faces.file_id = files.id) AS face_count,
               (SELECT group_concat(name, ', ') FROM (
                    SELECT DISTINCT people.name AS name
                    FROM faces
                    JOIN people ON people.person_key = faces.person_key
                    WHERE faces.file_id = files.id AND people.name != ''
               )) AS person_names
        FROM files
        WHERE id IN (SELECT file_id FROM faces WHERE person_key = ?)
        ORDER BY files.id
        LIMIT 2000
        """,
        (person_key,),
    ).fetchall()
    named = connection.execute(
        "SELECT name FROM people WHERE person_key = ?",
        (person_key,),
    ).fetchone()
    return {
        "person_key": person_key,
        "name": (named["name"] if named else "") or "",
        "files": [
            {
                "id": row["id"],
                "name": Path(row["path"]).name,
                "width": row["width"],
                "height": row["height"],
                "is_screenshot": bool(row["is_screenshot"]),
                "label": row["label"],
                "dup_count": row["dup_count"] or 0,
                "face_count": row["face_count"] or 0,
                "person_names": row["person_names"] or "",
                "suggestion": "",
            }
            for row in rows
        ],
    }


def _stats(connection) -> dict:
    def count(sql: str) -> int:
        return int(connection.execute(sql).fetchone()[0])

    return {
        "total": count("SELECT COUNT(*) FROM files WHERE is_trashed = 0"),
        "unlabeled": count("SELECT COUNT(*) FROM files WHERE label IS NULL AND is_trashed = 0"),
        "favorites": count("SELECT COUNT(*) FROM files WHERE is_favorite = 1 AND is_trashed = 0"),
        "screenshots": count("SELECT COUNT(*) FROM files WHERE is_screenshot = 1 AND is_trashed = 0"),
        "videos": count("SELECT COUNT(*) FROM files WHERE is_video = 1 AND is_trashed = 0"),
        "raw": count("SELECT COUNT(*) FROM files WHERE is_raw = 1 AND is_trashed = 0"),
        "portraits": count("SELECT COUNT(*) FROM files WHERE is_portrait = 1 AND is_trashed = 0"),
        "live_photos": count("SELECT COUNT(*) FROM files WHERE is_live_photo = 1 AND is_trashed = 0"),
        "hidden": count("SELECT COUNT(*) FROM files WHERE is_hidden = 1 AND is_trashed = 0"),
        "trashed": count("SELECT COUNT(*) FROM files WHERE is_trashed = 1"),
        "geocoded": count("SELECT COUNT(*) FROM files WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND is_trashed = 0"),
        "duplicate_groups": count("SELECT COUNT(DISTINCT group_key) FROM dup_groups"),
        "faces": count("SELECT COUNT(*) FROM faces"),
        "people": count(
            """
            SELECT COUNT(*) FROM (
                SELECT person_key FROM faces
                WHERE person_key IS NOT NULL
                GROUP BY person_key HAVING COUNT(*) >= 1
            )
            """
        ),
        "pets": count("SELECT COUNT(*) FROM people WHERE is_pet = 1"),
        "candidates": count(
            """
            SELECT COUNT(*) FROM faces
            LEFT JOIN people ON people.person_key = faces.person_key
            WHERE (people.name IS NULL OR people.name = '')
            """
        ),
        "keep": count("SELECT COUNT(*) FROM files WHERE label = 'keep' AND is_trashed = 0"),
        "noise": count("SELECT COUNT(*) FROM files WHERE label = 'noise' AND is_trashed = 0"),
        "panoramas": count("SELECT COUNT(*) FROM files WHERE ((width * 1.0 / NULLIF(height, 0)) >= 2.2 OR is_panorama = 1) AND is_trashed = 0"),
        "documents": count("SELECT COUNT(*) FROM files WHERE (id IN (SELECT file_id FROM asset_ocr) OR category = 'document' OR is_document = 1) AND is_trashed = 0"),
        "shared_albums": count("SELECT COUNT(*) FROM shared_albums"),
        "shared_with_you": count("SELECT COUNT(DISTINCT file_id) FROM shared_album_files"),
        "partner_sharing": count("SELECT COUNT(*) FROM shared_album_files WHERE album_id IN (SELECT id FROM shared_albums WHERE name LIKE '%partner%')"),
        "travel": count("SELECT COUNT(DISTINCT strftime('%Y-%m', COALESCE(captured_at, datetime(mtime, 'unixepoch')))) FROM files WHERE latitude IS NOT NULL AND is_trashed = 0"),
        "imports": count("SELECT COUNT(*) FROM files WHERE is_trashed = 0"),
        "prores": count("SELECT COUNT(*) FROM files WHERE is_video = 1 AND (path LIKE '%prores%' OR mime_type LIKE '%quicktime%') AND is_trashed = 0"),
        "slomo": count("SELECT COUNT(*) FROM files WHERE is_video = 1 AND (path LIKE '%slomo%' OR path LIKE '%slow%') AND is_trashed = 0"),
        "timelapse": count("SELECT COUNT(*) FROM files WHERE is_video = 1 AND (path LIKE '%timelapse%' OR path LIKE '%time-lapse%') AND is_trashed = 0"),
        "screen_recordings": count("SELECT COUNT(*) FROM files WHERE is_video = 1 AND is_screenshot = 1 AND is_trashed = 0"),
    }


def query_photos(
    connection,
    category: str = "all",
    sort: str = "date_desc",
    search: str = "",
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    where = ["1 = 1"]
    params: list = []

    cat = (category or "all").lower().strip()
    if cat == "all":
        where.append("is_trashed = 0 AND is_hidden = 0")
    elif cat == "favorites":
        where.append("is_favorite = 1 AND is_trashed = 0 AND is_hidden = 0")
    elif cat == "recents":
        where.append("is_trashed = 0 AND is_hidden = 0")
    elif cat == "videos":
        where.append("is_video = 1 AND is_trashed = 0 AND is_hidden = 0")
    elif cat in ("slomo", "videos_slomo"):
        where.append("is_video = 1 AND (path LIKE '%slomo%' OR path LIKE '%slow%') AND is_trashed = 0")
    elif cat in ("timelapse", "videos_timelapse"):
        where.append("is_video = 1 AND (path LIKE '%timelapse%' OR path LIKE '%time-lapse%') AND is_trashed = 0")
    elif cat in ("screen-recordings", "videos_screen_recording"):
        where.append("is_video = 1 AND is_screenshot = 1 AND is_trashed = 0")
    elif cat == "screenshots":
        where.append("is_screenshot = 1 AND is_trashed = 0 AND is_hidden = 0")
    elif cat == "selfies":
        where.append("id IN (SELECT file_id FROM faces GROUP BY file_id HAVING COUNT(*) = 1) AND is_trashed = 0")
    elif cat == "portraits":
        where.append("is_portrait = 1 AND is_trashed = 0 AND is_hidden = 0")
    elif cat in ("live-photos", "live_photos"):
        where.append("is_live_photo = 1 AND is_trashed = 0 AND is_hidden = 0")
    elif cat == "raw":
        where.append("is_raw = 1 AND is_trashed = 0 AND is_hidden = 0")
    elif cat == "panoramas":
        where.append("(width * 1.0 / NULLIF(height, 0)) >= 2.2 AND is_trashed = 0")
    elif cat == "documents":
        where.append("(id IN (SELECT file_id FROM asset_ocr) OR category = 'document') AND is_trashed = 0")
    elif cat == "duplicates":
        where.append("id IN (SELECT file_id FROM dup_groups) AND is_trashed = 0")
    elif cat in ("low-quality", "low_quality"):
        where.append("(blur_score < 40.0 OR quality_score < 4.0) AND is_trashed = 0")
    elif cat == "inbox":
        where.append("label IS NULL AND is_trashed = 0")
    elif cat == "hidden":
        where.append("is_hidden = 1 AND is_trashed = 0")
    elif cat == "trash":
        where.append("is_trashed = 1")
    elif cat in ("shared-albums", "shared-with-you", "partner-sharing"):
        where.append("id IN (SELECT file_id FROM shared_album_files) AND is_trashed = 0")
    elif cat.startswith("folder:"):
        f_id = cat.split("folder:")[1]
        if f_id.isdigit():
            where.append("id IN (SELECT file_id FROM shared_album_files WHERE album_id = ?) AND is_trashed = 0")
            params.append(int(f_id))
    elif cat in ("pets", "people"):
        if cat == "pets":
            where.append("id IN (SELECT file_id FROM faces JOIN people ON people.person_key = faces.person_key WHERE people.is_pet = 1) AND is_trashed = 0")
        else:
            where.append("id IN (SELECT file_id FROM faces) AND is_trashed = 0")
    else:
        where.append("category = ? AND is_trashed = 0 AND is_hidden = 0")
        params.append(cat)

    if search and search.strip():
        q = f"%{search.strip()}%"
        where.append("""(
            files.path LIKE ? OR
            files.camera_make LIKE ? OR
            files.camera_model LIKE ? OR
            files.location_name LIKE ? OR
            files.id IN (SELECT file_id FROM asset_ocr WHERE text LIKE ?) OR
            files.id IN (SELECT file_id FROM faces JOIN people ON people.person_key = faces.person_key WHERE people.name LIKE ?)
        )""")
        params.extend([q, q, q, q, q, q])

    order_clause = "ORDER BY id DESC"
    if sort == "date_desc":
        order_clause = "ORDER BY COALESCE(captured_at, mtime) DESC, id DESC"
    elif sort == "date_asc":
        order_clause = "ORDER BY COALESCE(captured_at, mtime) ASC, id ASC"
    elif sort == "size_desc":
        order_clause = "ORDER BY size DESC"
    elif sort == "name_asc":
        order_clause = "ORDER BY path ASC"
    elif sort == "category":
        order_clause = "ORDER BY category ASC, COALESCE(captured_at, mtime) DESC, id DESC"

    limit_val = max(1, min(int(limit), 500))
    offset_val = max(0, int(offset))

    sql = f"""
        SELECT files.*,
               (SELECT COUNT(*) FROM dup_groups other
                 WHERE other.group_key = (
                   SELECT group_key FROM dup_groups mine WHERE mine.file_id = files.id
                 )) AS dup_count,
               (SELECT COUNT(*) FROM faces WHERE faces.file_id = files.id) AS face_count,
               (SELECT group_concat(name, ', ') FROM (
                    SELECT DISTINCT people.name AS name
                    FROM faces
                    JOIN people ON people.person_key = faces.person_key
                    WHERE faces.file_id = files.id AND people.name != ''
               )) AS person_names
        FROM files
        WHERE {' AND '.join(where)}
        {order_clause}
        LIMIT {limit_val} OFFSET {offset_val}
    """
    rows = connection.execute(sql, params).fetchall()
    return [
        {
            "id": row["id"],
            "path": row["path"],
            "name": Path(row["path"]).name,
            "file_name": row["file_name"] or Path(row["path"]).name,
            "original_extension": row["original_extension"] or Path(row["path"]).suffix.lstrip(".").lower(),
            "width": row["width"],
            "height": row["height"],
            "size": row["size"],
            "created_at": row["captured_at"] if row["captured_at"] else row["mtime"],
            "mtime": row["mtime"],
            "is_favorite": bool(row["is_favorite"]),
            "is_video": bool(row["is_video"]),
            "is_screenshot": bool(row["is_screenshot"]),
            "is_raw": bool(row["is_raw"]),
            "is_portrait": bool(row["is_portrait"]),
            "is_live_photo": bool(row["is_live_photo"]),
            "is_hidden": bool(row["is_hidden"]),
            "is_trashed": bool(row["is_trashed"]),
            "camera_make": row["camera_make"] or "",
            "camera_model": row["camera_model"] or "",
            "lens_model": row["lens_model"] or "",
            "focal_length": f"{row['focal_length_mm']}mm" if row["focal_length_mm"] else "",
            "f_number": f"ƒ/{row['aperture_f_number']}" if row["aperture_f_number"] else "",
            "exposure_time": str(row["shutter_speed_seconds"] or ""),
            "iso": str(row["iso_equivalent"] or ""),
            "color_space": row["color_space"] or "",
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "altitude": row["altitude_meters"],
            "city": row["location_name"] or "",
            "country": "",
            "quality_score": row["quality_score"],
            "blur_score": row["blur_score"],
            "label": row["label"],
            "category": row["category"],
            "dup_count": row["dup_count"] or 0,
            "face_count": row["face_count"] or 0,
            "person_names": row["person_names"] or "",
        }
        for row in rows
    ]


def map_pins(connection) -> list[dict]:
    rows = connection.execute(
        """
        SELECT id, path, latitude, longitude, altitude_meters, location_name,
               camera_make, camera_model, aperture_f_number, shutter_speed_seconds, iso_equivalent,
               is_favorite, captured_at, mtime
        FROM files
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND is_trashed = 0
        ORDER BY id DESC
        LIMIT 5000
        """
    ).fetchall()
    return [
        {
            "id": row["id"],
            "name": Path(row["path"]).name,
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "altitude": row["altitude_meters"],
            "city": row["location_name"] or "Unknown Location",
            "country": "",
            "camera": f"{row['camera_make'] or ''} {row['camera_model'] or ''}".strip(),
            "exposure": f"ƒ/{row['aperture_f_number'] or ''} · {row['shutter_speed_seconds'] or ''} · ISO {row['iso_equivalent'] or ''}".strip(" ·"),
            "is_favorite": bool(row["is_favorite"]),
            "thumb": f"/media/{row['id']}?w=320",
        }
        for row in rows
    ]


def sync_status(port: int = 8765) -> dict:
    return get_sync_engine().get_status(port=port)


def choose_folder_dialog(prompt: str = "Select a photo folder to index in Neural Gallery") -> str | None:
    """Prompt the user with native macOS Finder Open panel via AppleScript."""
    import subprocess
    try:
        script = f'POSIX path of (choose folder with prompt "{prompt}")'
        res = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=120)
        if res.returncode == 0:
            folder = res.stdout.strip().rstrip("/")
            if folder and Path(folder).is_dir():
                return folder
    except Exception:
        pass
    return None


def folder_presets() -> list[dict]:
    """Common macOS photo directories for quick one-click indexing."""
    home = Path.home()
    presets = [
        {"name": "Pictures", "path": str(home / "Pictures"), "icon": "📸", "exists": (home / "Pictures").is_dir()},
        {"name": "Downloads", "path": str(home / "Downloads"), "icon": "📥", "exists": (home / "Downloads").is_dir()},
        {"name": "Desktop", "path": str(home / "Desktop"), "icon": "🖥️", "exists": (home / "Desktop").is_dir()},
        {"name": "Documents", "path": str(home / "Documents"), "icon": "📄", "exists": (home / "Documents").is_dir()},
        {"name": "Home Folder", "path": str(home), "icon": "🏠", "exists": True},
    ]
    volumes = Path("/Volumes")
    if volumes.is_dir():
        for vol in volumes.iterdir():
            if vol.is_dir() and vol.name not in ("Macintosh HD", "Macintosh HD - Data"):
                presets.append({
                    "name": f"Volume: {vol.name}",
                    "path": str(vol),
                    "icon": "💾",
                    "exists": True
                })
    return presets


def make_handler(db_path: Path):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt: str, *args) -> None:
            print(f"[HTTP] {self.client_address[0]}:{self.client_address[1]} - {fmt % args}", flush=True)

        def _send(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.end_headers()
            if not getattr(self, "_is_head", False):
                self.wfile.write(body)

        def _json(self, status: int, payload) -> None:
            self._send(status, json.dumps(payload).encode(), "application/json")

        def do_HEAD(self) -> None:
            self._is_head = True
            try:
                self.do_GET()
            finally:
                self._is_head = False

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.send_header("Access-Control-Max-Age", "86400")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            root_dir = Path(__file__).resolve().parent.parent

            if parsed.path.startswith("/assets/"):
                asset_file = root_dir / "dist" / parsed.path.lstrip("/")
                if asset_file.is_file():
                    content_type = "text/javascript" if asset_file.suffix == ".js" else "text/css" if asset_file.suffix == ".css" else "application/octet-stream"
                    self._send(200, asset_file.read_bytes(), content_type)
                    return

            if parsed.path == "/":
                dist_index = root_dir / "dist" / "index.html"
                if dist_index.is_file():
                    self._send(200, dist_index.read_bytes(), "text/html; charset=utf-8")
                    return
                preview_path = root_dir / "preview.html"
                if preview_path.is_file():
                    self._send(200, preview_path.read_bytes(), "text/html; charset=utf-8")
                    return
                self._send(200, PAGE.encode(), "text/html; charset=utf-8")
                return

            if parsed.path in ("/preview", "/preview.html"):
                preview_path = root_dir / "preview.html"
                if preview_path.is_file():
                    self._send(200, preview_path.read_bytes(), "text/html; charset=utf-8")
                    return
                self._send(200, PAGE.encode(), "text/html; charset=utf-8")
                return
            if parsed.path in ("/sync", "/sync/", "/sync.html"):
                self._send(200, MOBILE_PWA_HTML.encode(), "text/html; charset=utf-8")
                return
            if parsed.path == "/legacy":
                self._send(200, PAGE.encode(), "text/html; charset=utf-8")
                return
            if parsed.path == "/icon.png":
                icon = Path(__file__).resolve().parent.parent / "assets" / "AppIcon.png"
                if not icon.is_file():
                    self._send(404, b"", "text/plain")
                    return
                body = icon.read_bytes()
                self._send(200, body, "image/png")
                return
            if parsed.path == "/api/stats":
                connection = connect(db_path)
                try:
                    self._json(200, _stats(connection))
                finally:
                    connection.close()
                return
            if parsed.path == "/api/folders/presets":
                self._json(200, folder_presets())
                return
            if parsed.path == "/api/photos":
                query = parse_qs(parsed.query)
                category = (query.get("category") or ["all"])[0]
                sort = (query.get("sort") or ["date_desc"])[0]
                search = (query.get("search") or [""])[0]
                limit = (query.get("limit") or ["100"])[0]
                offset = (query.get("offset") or ["0"])[0]
                connection = connect(db_path)
                try:
                    photos = query_photos(
                        connection,
                        category=category,
                        sort=sort,
                        search=search,
                        limit=int(limit) if limit.isdigit() else 100,
                        offset=int(offset) if offset.isdigit() else 0,
                    )
                finally:
                    connection.close()
                self._json(200, photos)
                return
            if parsed.path == "/api/photo":
                query = parse_qs(parsed.query)
                raw_id = (query.get("id") or [""])[0]
                if not raw_id.isdigit():
                    self._json(400, {"error": "valid id is required"})
                    return
                connection = connect(db_path)
                try:
                    detail = get_photo_detail(connection, int(raw_id))
                except ActionError as exc:
                    self._json(404, {"error": str(exc)})
                    return
                finally:
                    connection.close()
                self._json(200, detail)
                return
            if parsed.path == "/api/map/pins":
                connection = connect(db_path)
                try:
                    pins = map_pins(connection)
                finally:
                    connection.close()
                self._json(200, pins)
                return
            if parsed.path == "/api/people/candidates":
                query = parse_qs(parsed.query)
                limit = (query.get("limit") or ["24"])[0]
                connection = connect(db_path)
                try:
                    candidates = list_candidates(connection, int(limit) if limit.isdigit() else 24)
                finally:
                    connection.close()
                self._json(200, candidates)
                return
            if parsed.path == "/api/sync/status":
                self._json(200, sync_status(port=self.server.server_address[1]))
                return
            if parsed.path == "/api/folders":
                connection = connect(db_path)
                try:
                    rows = connection.execute("""
                        SELECT shared_albums.id, shared_albums.name, shared_albums.created_at,
                               COUNT(shared_album_files.file_id) AS count
                        FROM shared_albums
                        LEFT JOIN shared_album_files ON shared_album_files.album_id = shared_albums.id
                        GROUP BY shared_albums.id
                        ORDER BY shared_albums.id ASC
                    """).fetchall()
                    folders = [
                        {"id": r["id"], "name": r["name"], "created_at": r["created_at"], "count": r["count"]}
                        for r in rows
                    ]
                    self._json(200, folders)
                finally:
                    connection.close()
                return
            if parsed.path == "/api/search":
                query = parse_qs(parsed.query)
                q = (query.get("q") or query.get("search") or [""])[0]
                limit = (query.get("limit") or ["100"])[0]
                connection = connect(db_path)
                try:
                    results = query_photos(connection, search=q, limit=int(limit) if limit.isdigit() else 100)
                finally:
                    connection.close()
                self._json(200, results)
                return
            if parsed.path == "/api/duplicate-group":
                query = parse_qs(parsed.query)
                raw_skip = (query.get("skip") or [""])[0]
                skip_keys = {part for part in raw_skip.split(",") if part}
                connection = connect(db_path)
                try:
                    group = duplicate_group(connection, skip_keys)
                finally:
                    connection.close()
                if group is None:
                    self._send(204, b"", "application/json")
                    return
                self._json(200, group)
                return
            if parsed.path == "/api/queue":
                query = parse_qs(parsed.query)
                bucket = (query.get("bucket") or ["inbox"])[0]
                raw_skip = (query.get("skip") or [""])[0]
                person = _person_key((query.get("person") or [""])[0])
                limit = (query.get("limit") or ["4"])[0]
                skip_ids = {int(part) for part in raw_skip.split(",") if part.isdigit()}
                connection = connect(db_path)
                try:
                    rows = _rows(connection, bucket, skip_ids, person, int(limit) if limit.isdigit() else 4)
                finally:
                    connection.close()
                self._json(200, [{"id": row["id"], "name": Path(row["path"]).name} for row in rows])
                return
            if parsed.path == "/api/next":
                query = parse_qs(parsed.query)
                bucket = (query.get("bucket") or ["inbox"])[0]
                raw_skip = (query.get("skip") or [""])[0]
                person = _person_key((query.get("person") or [""])[0])
                skip_ids = set()
                for part in raw_skip.split(","):
                    if part.isdigit():
                        skip_ids.add(int(part))
                connection = connect(db_path)
                try:
                    row = _next_row(connection, bucket, skip_ids, person)
                    if row is None:
                        self._send(204, b"", "application/json")
                        return
                    keep_hashes, noise_hashes = load_examples(connection)
                    name = Path(row["path"]).name
                    self._json(200, {
                        "id": row["id"],
                        "path": row["path"],
                        "name": name,
                        "width": row["width"],
                        "height": row["height"],
                        "is_screenshot": bool(row["is_screenshot"]),
                        "label": row["label"],
                        "dup_count": row["dup_count"] or 0,
                        "face_count": row["face_count"] or 0,
                        "person_names": row["person_names"] or "",
                        "suggestion": suggest(row, keep_hashes, noise_hashes),
                    })
                finally:
                    connection.close()
                return
            if parsed.path == "/api/person-photos":
                query = parse_qs(parsed.query)
                person = _person_key((query.get("person") or [""])[0])
                if person is None:
                    self._json(400, {"error": "unknown person"})
                    return
                connection = connect(db_path)
                try:
                    self._json(200, person_photos(connection, person))
                finally:
                    connection.close()
                return
            if parsed.path == "/api/people":
                connection = connect(db_path)
                try:
                    self._json(200, list_people(connection))
                finally:
                    connection.close()
                return
            if parsed.path.startswith("/media/"):
                token = parsed.path.removeprefix("/media/")
                if not token.isdigit():
                    self._send(404, b"", "text/plain")
                    return
                connection = connect(db_path)
                try:
                    path = allowed_file(connection, int(token))
                finally:
                    connection.close()
                if path is None:
                    self._send(404, b"", "text/plain")
                    return
                edge = 1600
                asked = (parse_qs(parsed.query).get("w") or ["1600"])[0]
                if asked.isdigit():
                    edge = max(120, min(int(asked), 1600))
                try:
                    body = _thumbnail(path, edge)
                except (OSError, Image.DecompressionBombError, ValueError):
                    self._send(404, b"", "text/plain")
                    return
                self._send(200, body, "image/jpeg")
                return
            self._send(404, b"", "text/plain")

        def _payload(self):
            parsed = urlparse(self.path)
            is_sync = parsed.path.startswith("/api/sync/")
            if not is_sync and self.headers.get("X-Neural-Gallery") != "1":
                self._json(400, {"error": "missing X-Neural-Gallery header"})
                return None
            length = int(self.headers.get("Content-Length") or "0")
            if length <= 0 or length > 8192:
                self._json(400, {"error": "bad body"})
                return None
            try:
                return json.loads(self.rfile.read(length))
            except json.JSONDecodeError:
                self._json(400, {"error": "bad json"})
                return None

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/api/sync/upload":
                content_len = int(self.headers.get("Content-Length", 0))
                if content_len == 0:
                    self._json(400, {"error": "empty upload"})
                    return
                body = self.rfile.read(content_len)
                ctype = self.headers.get("Content-Type", "")
                filename = self.headers.get("X-Filename") or f"sync_photo_{int(time.time())}.jpg"
                file_bytes = body
                if "multipart/form-data" in ctype and "boundary=" in ctype:
                    boundary = ctype.split("boundary=")[1].strip()
                    parts = body.split(b"--" + boundary.encode())
                    for part in parts:
                        if b"Content-Disposition" in part and b"filename=" in part:
                            hdr_end = part.find(b"\r\n\r\n")
                            if hdr_end != -1:
                                headers_part = part[:hdr_end].decode("utf-8", errors="ignore")
                                for line in headers_part.split("\r\n"):
                                    if "filename=" in line:
                                        raw_fn = line.split("filename=")[1].strip('"\'; ')
                                        if raw_fn:
                                            filename = raw_fn
                                file_bytes = part[hdr_end + 4:].rstrip(b"\r\n--")
                                break

                incoming_folder = Path.home() / "Pictures" / "Neural Gallery Imports"
                res = get_sync_engine().ingest_bytes(filename, file_bytes, incoming_folder, db_path)
                self._json(200, res)
                return

            if parsed.path == "/api/scan":
                payload = self._payload()
                if payload is None:
                    return
                folder = payload.get("folder")
                if not isinstance(folder, str) or not folder.strip():
                    self._json(400, {"error": "folder is required"})
                    return
                try:
                    summary = scan_folder(Path(folder), db_path)
                except NotADirectoryError:
                    self._json(400, {"error": "that folder does not exist"})
                    return
                self._json(200, summary)
                return

            if parsed.path == "/api/folders/choose":
                folder = choose_folder_dialog()
                if folder:
                    self._json(200, {"folder": folder, "success": True})
                else:
                    self._json(200, {"folder": None, "canceled": True})
                return

            valid_post_paths = {
                "/api/label",
                "/api/trash",
                "/api/restore",
                "/api/trash/empty",
                "/api/trash/bulk",
                "/api/favorites/bulk",
                "/api/trash-copies",
                "/api/move",
                "/api/reveal",
                "/api/person",
                "/api/favorite",
                "/api/hide",
                "/api/category",
                "/api/folders",
                "/api/folders/delete",
                "/api/folders/add",
                "/api/folders/remove",
                "/api/person/confirm",
                "/api/person/merge",
                "/api/sync/pair",
                "/api/sync/unpair",
                "/api/sync/rotate-pin",
                "/api/sync/tunnel/toggle",
            }
            if parsed.path not in valid_post_paths:
                self._send(404, b"", "text/plain")
                return

            payload = self._payload()
            if payload is None:
                return

            connection = connect(db_path)
            try:
                if parsed.path == "/api/label":
                    file_id = payload.get("id")
                    label = payload.get("label")
                    if not isinstance(file_id, int) or label not in ("keep", "noise", ""):
                        self._json(400, {"error": "id and label are required"})
                        return
                    stored = None if label == "" else label
                    cursor = connection.execute(
                        "UPDATE files SET label = ? WHERE id = ?",
                        (stored, file_id),
                    )
                    connection.commit()
                    if cursor.rowcount != 1:
                        self._json(404, {"error": "not indexed"})
                        return
                    self._json(200, {"id": file_id, "label": stored})
                    return

                if parsed.path == "/api/favorite":
                    file_id = payload.get("id")
                    if not isinstance(file_id, int):
                        self._json(400, {"error": "valid file id is required"})
                        return
                    new_val = payload.get("is_favorite")
                    if new_val is not None:
                        val = 1 if new_val else 0
                        connection.execute("UPDATE files SET is_favorite = ? WHERE id = ?", (val, file_id))
                        connection.commit()
                        state = bool(val)
                    else:
                        state = toggle_favorite(connection, file_id)
                    self._json(200, {"id": file_id, "is_favorite": state})
                    return

                if parsed.path == "/api/hide":
                    file_id = payload.get("id")
                    if not isinstance(file_id, int):
                        self._json(400, {"error": "valid file id is required"})
                        return
                    new_val = payload.get("is_hidden")
                    if new_val is not None:
                        val = 1 if new_val else 0
                        connection.execute("UPDATE files SET is_hidden = ? WHERE id = ?", (val, file_id))
                        connection.commit()
                        state = bool(val)
                    else:
                        state = toggle_hidden(connection, file_id)
                    self._json(200, {"id": file_id, "is_hidden": state})
                    return

                if parsed.path == "/api/category":
                    category = payload.get("category")
                    if not isinstance(category, str):
                        self._json(400, {"error": "category string is required"})
                        return
                    raw_ids = payload.get("ids")
                    if raw_ids is None and "id" in payload:
                        raw_ids = [payload.get("id")]
                    if not isinstance(raw_ids, list) or not raw_ids:
                        self._json(400, {"error": "valid id or ids list is required"})
                        return
                    for fid in raw_ids:
                        if isinstance(fid, int):
                            try:
                                set_category(connection, fid, category)
                            except Exception:
                                pass
                    self._json(200, {"ids": raw_ids, "category": category})
                    return

                if parsed.path == "/api/folders":
                    name = (payload.get("name") or "").strip()
                    if not name:
                        self._json(400, {"error": "folder name is required"})
                        return
                    cur = connection.cursor()
                    cur.execute(
                        "INSERT INTO shared_albums (name, album_type, created_at) VALUES (?, 'folder', ?)",
                        (name, time.time()),
                    )
                    folder_id = cur.lastrowid
                    connection.commit()
                    self._json(200, {"id": folder_id, "name": name, "count": 0})
                    return

                if parsed.path == "/api/folders/delete":
                    folder_id = payload.get("id")
                    if not isinstance(folder_id, int):
                        self._json(400, {"error": "valid folder id is required"})
                        return
                    connection.execute("DELETE FROM shared_albums WHERE id = ?", (folder_id,))
                    connection.commit()
                    self._json(200, {"success": True, "id": folder_id})
                    return

                if parsed.path == "/api/folders/add":
                    folder_id = payload.get("folder_id")
                    raw_ids = payload.get("file_ids") or payload.get("ids") or []
                    if isinstance(raw_ids, int):
                        raw_ids = [raw_ids]
                    for fid in raw_ids:
                        if isinstance(fid, int):
                            connection.execute(
                                "INSERT OR IGNORE INTO shared_album_files (album_id, file_id) VALUES (?, ?)",
                                (folder_id, fid),
                            )
                    connection.commit()
                    self._json(200, {"success": True, "folder_id": folder_id, "count": len(raw_ids)})
                    return

                if parsed.path == "/api/folders/remove":
                    folder_id = payload.get("folder_id")
                    raw_ids = payload.get("file_ids") or payload.get("ids") or []
                    if isinstance(raw_ids, int):
                        raw_ids = [raw_ids]
                    for fid in raw_ids:
                        if isinstance(fid, int):
                            connection.execute(
                                "DELETE FROM shared_album_files WHERE album_id = ? AND file_id = ?",
                                (folder_id, fid),
                            )
                    connection.commit()
                    self._json(200, {"success": True, "folder_id": folder_id, "count": len(raw_ids)})
                    return

                if parsed.path in ("/api/trash", "/api/restore", "/api/trash/bulk"):
                    is_restore = parsed.path == "/api/restore" or bool(payload.get("restore")) or payload.get("trashed") is False
                    raw_ids = payload.get("ids")
                    if raw_ids is None and "id" in payload:
                        raw_ids = [payload.get("id")]
                    if not isinstance(raw_ids, list) or not raw_ids:
                        self._json(400, {"error": "valid id or ids list is required"})
                        return
                    soft = payload.get("soft", True)
                    processed = []
                    for fid in raw_ids:
                        if not isinstance(fid, int):
                            continue
                        try:
                            if is_restore:
                                mark_trashed(connection, fid, False)
                                processed.append(fid)
                            elif soft:
                                mark_trashed(connection, fid, True)
                                processed.append(fid)
                            else:
                                trash_indexed(connection, fid)
                                processed.append(fid)
                        except Exception:
                            pass
                    connection.commit()
                    self._json(200, {
                        "ids": processed,
                        "id": processed[0] if len(processed) == 1 else None,
                        "trashed": not is_restore,
                        "restored": is_restore,
                        "soft": soft,
                        "count": len(processed),
                    })
                    return

                if parsed.path == "/api/trash/empty":
                    trashed_rows = connection.execute("SELECT id FROM files WHERE is_trashed = 1").fetchall()
                    count = 0
                    for row in trashed_rows:
                        fid = row["id"]
                        try:
                            trash_indexed(connection, fid)
                            count += 1
                        except Exception:
                            connection.execute("DELETE FROM files WHERE id = ?", (fid,))
                            count += 1
                    connection.commit()
                    self._json(200, {"emptied": count, "success": True})
                    return

                if parsed.path == "/api/favorites/bulk":
                    raw_ids = payload.get("ids")
                    is_fav = bool(payload.get("is_favorite", True))
                    if not isinstance(raw_ids, list) or not raw_ids:
                        self._json(400, {"error": "ids list is required"})
                        return
                    val = 1 if is_fav else 0
                    for fid in raw_ids:
                        if isinstance(fid, int):
                            connection.execute("UPDATE files SET is_favorite = ? WHERE id = ?", (val, fid))
                    connection.commit()
                    self._json(200, {"ids": raw_ids, "is_favorite": is_fav, "count": len(raw_ids)})
                    return

                if parsed.path == "/api/person":
                    person_key = _person_key(payload.get("person_key"))
                    name = payload.get("name")
                    is_pet = bool(payload.get("is_pet", False))
                    pet_type = payload.get("pet_type")
                    if person_key is None or not isinstance(name, str):
                        self._json(400, {"error": "person_key and name are required"})
                        return
                    try:
                        name_person(connection, person_key, name, is_pet=is_pet, pet_type=pet_type)
                    except ValueError as exc:
                        self._json(404, {"error": str(exc)})
                        return
                    connection.commit()
                    self._json(200, {"person_key": person_key, "name": name.strip(), "is_pet": is_pet, "pet_type": pet_type})
                    return

                if parsed.path == "/api/person/confirm":
                    face_id = payload.get("face_id")
                    person_key = _person_key(payload.get("person_key"))
                    if not isinstance(face_id, int) or person_key is None:
                        self._json(400, {"error": "face_id and person_key are required"})
                        return
                    confirm_candidate(connection, face_id, person_key)
                    self._json(200, {"face_id": face_id, "person_key": person_key})
                    return

                if parsed.path == "/api/person/merge":
                    source = _person_key(payload.get("source"))
                    target = _person_key(payload.get("target"))
                    if source is None or target is None:
                        self._json(400, {"error": "source and target person keys are required"})
                        return
                    merge_people(connection, source, target)
                    self._json(200, {"source": source, "target": target, "merged": True})
                    return

                if parsed.path == "/api/sync/pair":
                    pin = payload.get("pin")
                    if not isinstance(pin, str) or not pin.strip():
                        self._json(400, {"error": "6-digit pairing PIN is required"})
                        return
                    name = payload.get("name") or "Mobile Device"
                    model = payload.get("model") or "Phone"
                    device_id = payload.get("device_id") or f"dev-{uuid.uuid4().hex[:8]}"
                    res = get_sync_engine().pair_device(device_id, pin.strip(), name, model)
                    if res.get("success"):
                        self._json(200, res)
                    else:
                        self._json(401, res)
                    return

                if parsed.path == "/api/sync/unpair":
                    device_id = payload.get("device_id")
                    if not isinstance(device_id, str):
                        self._json(400, {"error": "device_id is required"})
                        return
                    res = get_sync_engine().unpair_device(device_id)
                    self._json(200, {"success": res, "device_id": device_id})
                    return

                if parsed.path == "/api/sync/tunnel/toggle":
                    enabled = bool(payload.get("enabled", True))
                    from neural_gallery.sync import set_tunnel_enabled, get_tunnel_url
                    res_enabled = set_tunnel_enabled(enabled, port=self.server.server_address[1])
                    t_url = get_tunnel_url() if res_enabled else None
                    self._json(200, {
                        "success": True,
                        "tunnel_enabled": res_enabled,
                        "tunnel_url": t_url,
                    })
                    return

                if parsed.path == "/api/sync/rotate-pin":
                    engine = get_sync_engine()
                    new_pin = engine.generate_new_sas_pin()
                    self._json(200, {
                        "success": True,
                        "sas_pin": new_pin,
                        "pin_expires_in": engine.get_pin_ttl_remaining(),
                    })
                    return

                file_id = payload.get("id")
                if not isinstance(file_id, int):
                    self._json(400, {"error": "id is required"})
                    return
                if parsed.path == "/api/trash-copies":
                    result = trash_other_copies(connection, file_id)
                    connection.commit()
                    self._json(200, result)
                    return
                if parsed.path == "/api/move":
                    destination = payload.get("destination")
                    if not isinstance(destination, str) or not destination.strip():
                        self._json(400, {"error": "destination is required"})
                        return
                    moved = move_indexed(connection, file_id, Path(destination))
                    connection.commit()
                    self._json(200, {"id": file_id, "path": moved})
                    return
                if parsed.path == "/api/reveal":
                    reveal(connection, file_id)
                    self._json(200, {"id": file_id})
                    return
            except ActionError as exc:
                connection.rollback()
                self._json(400, {"error": str(exc)})
            finally:
                connection.close()

    return Handler


def _thumbnail(path: Path, edge: int = 1600) -> bytes:
    with Image.open(path) as image:
        oriented = ImageOps.exif_transpose(image)
        if oriented is not None:
            image = oriented
        image = image.convert("RGB")
        image.thumbnail((edge, edge))
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=80)
        return buffer.getvalue()


def serve(db_path: Path, port: int = 8765) -> None:
    try:
        from neural_gallery.sync import start_tunnel_auto, stop_tunnel
        start_tunnel_auto(port)
    except Exception:
        pass

    server = ThreadingHTTPServer(("0.0.0.0", port), make_handler(db_path))
    print(f"Neural Gallery review at http://127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        try:
            from neural_gallery.sync import stop_tunnel
            stop_tunnel()
        except Exception:
            pass


