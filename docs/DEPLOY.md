# Deployment Guide — Maya Campus Guide

## Prerequisites
- GitHub repository with the code pushed
- Vercel account (for frontend)
- Render account (for backend)
- Groq API key (https://console.groq.com/keys)

---

## Step 1: Deploy Backend (Render)

1. Go to https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Connect your GitHub repo
4. Set:
   - **Name:** `maya-api`
   - **Root Directory:** `backend`
   - **Runtime:** `Python`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port 10000`
   - **Plan:** Free
5. Add environment variable:
   - `GROQ_API_KEY` = your Groq API key
   - `CORS_ORIGIN` = `https://maya-gitam.vercel.app` (after frontend deploys)
6. Click **Create Web Service**
7. Wait for deploy — copy the URL (e.g., `https://maya-api.onrender.com`)

---

## Step 2: Deploy Frontend (Vercel)

1. Go to https://vercel.com
2. Click **Add New** → **Project**
3. Connect your GitHub repo
4. Set:
   - **Root Directory:** `web-ui` (override from default)
   - **Framework:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Add environment variable:
   - `VITE_API_BASE` = `https://maya-api.onrender.com` (from Step 1)
6. Click **Deploy**
7. Wait for deploy — copy the URL (e.g., `https://maya-gitam.vercel.app`)

---

## Step 3: Update CORS

1. Go back to Render dashboard → Environment
2. Update `CORS_ORIGIN` to your Vercel URL
3. Redeploy: Manual Deploy → Deploy latest commit

---

## Step 4: Print Materials

1. Open `web-ui/public/targets/` — each `.svg` is a printable poster
2. Print at A4 size and post at corresponding campus locations
3. Use a QR code generator to create QR codes pointing to your Vercel URL
4. Place QR codes on each poster

---

## Step 5: .mind File Compilation

1. Convert poster SVGs to PNG (open in browser → screenshot, or use tools/canvas tool)
2. Go to https://hiukim.github.io/mind-ar-js-doc/tools/compile
3. Upload all PNGs
4. Download `targets.mind` → rename to `campus-targets.mind`
5. Place in `web-ui/public/targets/` and redeploy frontend

---

## URLs after deployment

| Component | URL |
|-----------|-----|
| Frontend | `https://maya-gitam.vercel.app` |
| Backend API | `https://maya-api.onrender.com` |
| Health Check | `https://maya-api.onrender.com/` |
| Locations | `https://maya-api.onrender.com/locations` |

## Testing

- Visit frontend URL on desktop → should load 3D scene
- Visit on mobile → should request camera for AR
- Open browser console to check for errors
- Test voice: press mic button or hold Space → speak → hear Maya respond
