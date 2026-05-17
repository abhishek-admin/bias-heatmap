# Bias Heatmap

> See the spin, highlighted on the actual page.

**Day 07 / 180 — 180 Days of Building**

News articles look objective — until you look closer. Bias Heatmap maps loaded language, unverified claims, and well-sourced facts across any article using AI. Color-coded, verbatim, no rewriting needed. One click and you'll see exactly which sentences are manipulation and which are journalism.

![Demo](demo.gif)

---

## What it does

- **Loaded Language** — emotionally charged or manipulative phrases, quoted verbatim with explanation
- **Unverified Claims** — statements made without evidence or hidden behind anonymous sourcing
- **Well-Attributed Facts** — properly cited, credible statements that hold up
- **Bias Summary** — political direction (Left / Right / Center), score out of 10, loaded phrase count
- **One-Line Verdict** — what's the spin and exactly who benefits from it

---

## How to use

1. Navigate to any news article
2. Click the extension icon
3. Hit **Map the Bias**
4. See the full color-coded bias report in seconds

---

## Setup

### 1. Load the extension
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select the `bias-heatmap` folder

### 2. Add your API key
Click **⚙** in the popup and paste one of the following:

- **Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com/apikey)
- **OpenRouter API key** — free tier at [openrouter.ai](https://openrouter.ai) (use as fallback if Gemini quota runs out)

Only one key is required. If both are saved, Gemini is used first with OpenRouter as fallback.

---

## Tech stack

- Chrome Extension Manifest V3
- Gemini 2.0 Flash (primary) → OpenRouter fallback
- Two-phase progressive loading: instant scanning preview → full bias heatmap
- Vanilla JS — no frameworks, no build step

---

## Part of 180 Days of Building

Shipping one AI Chrome extension every day for 180 days.

Follow along: [@happy_ships](https://x.com/happy_ships)
