# Compiling MindAR Image Targets

## Method 1: Online Compiler (Recommended)

1. Print any poster SVG from this directory, or convert to PNG via browser screenshot
2. Go to https://hiukim.github.io/mind-ar-js-doc/tools/compile
3. Upload your target images (minimum 300x300px, high contrast)
4. Click "Compile" — download the resulting `targets.mind`
5. Rename to `campus-targets.mind` and place in this directory

## Method 2: Using the MindAR CLI

```bash
npm install -g mind-ar
mindar compile target-images/*.png --output campus-targets.mind
```

## Target Poster Files

Each `.svg` in this directory is a high-contrast poster for a specific campus location.
Print them at A4 size and post them around campus. Users scan them with their phone
to anchor Maya at that location.
