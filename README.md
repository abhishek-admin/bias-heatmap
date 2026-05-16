# Bias Heatmap

> See the spin, highlighted on the actual page.

A Chrome extension that maps bias and manipulation in any news article using AI — color-coded, verbatim, no rewriting needed. One click and you'll see exactly which sentences are loaded language, which claims are unverified, and which facts are properly sourced.

![Demo](demo.gif)

## What it does

- **🔴 Loaded Language** — emotionally charged or manipulative phrases, quoted verbatim with explanation
- **🟡 Unverified Claims** — statements made without evidence or anonymous sourcing
- **🟢 Well-Attributed Facts** — properly cited, credible statements
- **📊 Bias Summary** — direction (Left/Right/Center), score out of 10, loaded phrase count
- **⚡ One-Line Verdict** — what's the spin and who benefits from it

## How to use

1. Navigate to any news article
2. Click the extension icon
3. Hit **🔥 Map the Bias**
4. See the full color-coded bias report in seconds

## Setup

1. Load the extension in Chrome (`chrome://extensions` → Developer Mode → Load unpacked)
2. Click ⚙ and paste your [Gemini API key](https://aistudio.google.com/apikey)
3. Done — works on any news page

## Tech

- Chrome Extension Manifest V3
- Google Gemini API (with OpenRouter fallback)
- Two-phase progressive loading: instant scanning preview → full bias heatmap

---

Built by [@happy_ships](https://x.com/happy_ships) · Day 6/180
