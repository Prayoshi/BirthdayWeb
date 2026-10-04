# 🎂 Pixel Birthday Cake

A tiny, personalised birthday web page in pixel-art style. Blow out the candles (with your microphone, or just tap them), watch a shower of pixel cats rain down, then open an envelope to read a letter with confetti.

No frameworks, no build step, no dependencies. Just HTML, CSS and JavaScript.

## ✨ Features

- **Animated pixel-art cake** with a shimmering design, drawn entirely with CSS `box-shadow`
- **Flickering candles** you can blow out with your **microphone** (blow detection via the Web Audio API) or by **tapping/clicking** them
- **Cat shower**: every candle blown out drops a shower of pixel cats in 10 colours. They fall, bounce, land, and float on the page floor
- **"Skip the mic" button** for devices without a microphone, or if permission is denied
- **Envelope page**: tap to open, and the letter slides out
- **Letter overlay** with a typed-out message and confetti
- **Personalise via URL**, with no code editing needed
- Responsive (works on phones) and respects `prefers-reduced-motion`

## 🚀 Getting Started

### Run locally

1. Download or clone this repo.
2. Open `index.html` in your browser.

> **Microphone note:** browsers only allow mic access on `https://` pages or `localhost`. If you open the file directly (`file://`) and the mic doesn't work, either use the **Skip the mic** button, tap the candles instead, or run a local server:
>
> ```bash
> # Python 3
> python -m http.server 8000
> # then visit http://localhost:8000
> ```

### Live demo

If you've enabled GitHub Pages, your site will be at:

```
https://<your-username>.github.io/<your-repo-name>/
```

## 🎨 Personalise It

### Option 1: Use the URL (easiest)

Add parameters to the end of the link:

```
index.html?name=Riya&candles=6&wish=Stay%20magical&from=Sam
```

| Parameter | What it does | Default |
|-----------|--------------|---------|
| `name`    | Name shown in the title (`HAPPY BIRTHDAY, NAME!`) | `FRIEND` |
| `candles` | Number of candles (1 to 15) | `5` |
| `wish`    | The message inside the letter | placeholder text |
| `from`    | Sign-off under the letter | `with love` |

Tip: use `%20` for spaces in URLs, or let a tool like [urlencoder.org](https://www.urlencoder.org/) do it for you.

### Option 2: Edit the defaults

Open `script.js` and change the `DEFAULTS` block at the top:

```js
const DEFAULTS = {
  name: "FRIEND",
  candles: 5,
  wish: "Your message here",
  from: "with love",
};
```

### Other tweaks (in `script.js`)

| Setting | Purpose |
|---------|---------|
| `BLOW_MIN_VOLUME`, `BLOW_LOW_RATIO`, `BLOW_HOLD_MS` | Blow sensitivity (lower volume = more sensitive) |
| `SHOWER_CATS`, `FINAL_SHOWER_CATS`, `SKIP_SHOWER_CATS` | How many cats fall per candle / last candle / skip |
| `MAX_FLOOR_CATS` | Cap on cats resting on the page |
| `CAT_COLORS` | Which cat colours can appear |
| `CAKE_CATS` | The cats sitting beside the cake: `[colour, side, y, scale]` |

### Add a new cat colour

In `cat.css`, add a block that sets the colour variables, then add the name to `CAT_COLORS` in `script.js`:

```css
.cat-pink { --cat-line:#8a3b5a; --cat-body:#ffb3cf; --cat-hi:#ffe3ee; --cat-eye:#4a1830; --cat-nose:#ff6f9f; }
```

## 📁 Project Structure

```
.
├── index.html   # Page structure: cake page, envelope page, letter overlay
├── style.css    # Layout, colours, envelope and letter styling
├── cake.css     # Pixel-art cake and its shimmer animation
├── candle.css   # Pixel-art candles, flame flicker, blown-out state
├── cat.css      # Pixel-art cat (one design, recoloured with CSS variables) and shower animations
└── script.js    # Candles, mic detection, cat shower, envelope, letter, confetti
```

## 🛠️ Built With

- HTML5, CSS3 (pixel art via `box-shadow`)
- Vanilla JavaScript (Web Audio API, Web Animations API, Canvas for confetti)
- [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) from Google Fonts

## 🌐 Browser Support

Works in modern Chrome, Edge, Firefox and Safari (desktop and mobile). Microphone blowing requires a secure context (HTTPS or localhost) and user permission.

## 📄 License

Free to use and modify for your own birthday surprises. Add a license file (e.g. MIT) if you'd like to share it more formally.

Made with 💖 and a lot of pixel cats.
