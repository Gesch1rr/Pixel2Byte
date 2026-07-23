```
  ___ _         _ ___ ___      _       
 | _ (_)_ _____| |_  ) _ )_  _| |_ ___ 
 |  _/ \ \ / -_) |/ /| _ \ || |  _/ -_)
 |_| |_/_\_\___|_/___|___/\_, |\__\___|
                          |__/         
```

<div align="center">

**Convert images and pixel art into C byte arrays for Arduino, ESP32, STM32 and OLED displays.**

Free · No signup · Runs entirely in your browser

</div>

---

## About

Pixel2Byte is a browser-based tool that turns any image — or a drawing you make on the spot — into a ready-to-paste C array for embedded displays such as SSD1306, SH1106 and similar monochrome OLED / LCD panels.

Everything happens client-side. No upload, no backend, no account. Open the page and it works, including offline once loaded.

## Features

**Input**
- Drag-and-drop or file picker for PNG, JPG, GIF, BMP and WEBP
- Built-in pixel editor — draw the bitmap directly if you don't have a source image
- Any output size (defaults to 128×64, the classic OLED resolution)

**Processing**
- Three 1-bit conversion modes: simple **threshold**, **Floyd–Steinberg** error diffusion, and **4×4 Bayer** ordered dithering
- **4-bit grayscale** mode for displays that support it
- Adjustable threshold, invert, horizontal flip and 90° rotation
- Live side-by-side preview of the original and the converted bitmap

**Output**
- `PROGMEM` array for Arduino
- Plain `uint8_t` array
- Binary string representation
- Custom variable name, byte-count readout, one-click copy, and `.h` header file download

## Getting started

No build step, no dependencies.

```bash
git clone https://github.com/Gesch1rr/Pixel2Byte.git
cd Pixel2Byte
```

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. The converter itself lives at `app.html`.

## Usage

1. Drop an image into the upload pane, or switch to the **Draw** tab and make one.
2. Set the output width and height to match your display.
3. Pick a color mode and dithering algorithm, then tune the threshold until the preview looks right.
4. Choose an output format and variable name.
5. Hit **CONVERT**, then copy the code or download the `.h` file.

Paste the result into your sketch and draw it:

```cpp
#include "myBitmap.h"

display.drawBitmap(0, 0, myBitmap, MYBITMAP_WIDTH, MYBITMAP_HEIGHT, WHITE);
```

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Ctrl` + `Enter` | Convert |
| `Ctrl` + `Z` | Undo (draw mode) |
| `P` | Pen |
| `E` | Eraser |
| `L` | Line |
| `R` | Rectangle |
| `O` | Oval |
| `F` | Fill |

## How it works

Each pixel is reduced to luminance using the standard `0.299R + 0.587G + 0.114B` weighting. The selected algorithm then quantizes it:

- **Threshold** — compares luminance against a fixed cutoff.
- **Floyd–Steinberg** — quantizes each pixel and pushes the residual error onto neighbours with the classic 7/3/5/1 sixteenths kernel, which preserves detail in photographs.
- **Bayer** — compares luminance against a repeating 4×4 matrix, giving a uniform crosshatch pattern that tends to look cleaner on small icons.

The resulting pixels are packed MSB-first, eight per byte, row by row. In grayscale mode each pixel becomes a 4-bit nibble and two pixels share a byte.

## Project structure

```
index.html      landing page
app.html        the converter
css/            home.css, style.css
js/
  convert.js    image loading, conversion pipeline, code generation, export
  dither.js     threshold, Floyd–Steinberg and Bayer implementations
  draw.js       pixel editor: tools, undo stack, zoom
  app.js        UI wiring, tabs, keyboard shortcuts
  home.js       landing page demo
```
