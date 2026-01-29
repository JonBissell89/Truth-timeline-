# Deployment Guide

**Get Truth Timeline running on your phone in minutes!**

---

## Option 1: Railway (Recommended - Easiest)

Railway offers free hosting with a public URL.

### Steps:

1. **Push this repo to GitHub** (if not already done)

2. **Go to [Railway.app](https://railway.app)**
   - Sign up with GitHub

3. **Create New Project**
   - Click "Deploy from GitHub repo"
   - Select `Truth-timeline-` repository
   - Railway auto-detects Python and uses `Procfile`

4. **Set Environment Variables** (optional)
   - No special variables needed for basic setup

5. **Deploy**
   - Railway automatically builds and deploys
   - Get your URL: `https://yourapp.up.railway.app`

6. **Access from phone**
   - Open the URL in your phone browser
   - Add to home screen for app-like experience

**Cost**: Free tier (500 hours/month)

---

## Option 2: Replit (Fast Setup)

Perfect for quick testing and sharing.

### Steps:

1. **Go to [Replit.com](https://replit.com)**
   - Sign up/login

2. **Import from GitHub**
   - Click "Create Repl"
   - Select "Import from GitHub"
   - Enter your repo URL

3. **Configure**
   - Replit auto-detects Python
   - Click "Run" - it will install dependencies

4. **Access**
   - Replit gives you a URL: `https://truth-timeline.yourname.repl.co`
   - Works on any device

**Cost**: Free (with some limitations on always-on)

---

## Option 3: PythonAnywhere

Good for longer-term hosting.

### Steps:

1. **Sign up at [PythonAnywhere.com](https://www.pythonanywhere.com)**

2. **Upload code**
   - Use Git: `git clone <your-repo>`
   - Or upload files manually

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt --user
   ```

4. **Configure Web App**
   - Go to "Web" tab
   - Add new web app
   - Choose "Manual configuration" + Python 3.10
   - Set source code directory
   - Set WSGI file to point to FastAPI app

5. **Start server**
   - Reload web app
   - Access at `https://yourusername.pythonanywhere.com`

**Cost**: Free tier available

---

## Option 4: Render

Similar to Railway, very reliable.

### Steps:

1. **Go to [Render.com](https://render.com)**
   - Sign up with GitHub

2. **New Web Service**
   - Connect your GitHub repo
   - Render auto-detects Python

3. **Configure**
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn src.api:app --host 0.0.0.0 --port $PORT`

4. **Deploy**
   - Get URL: `https://truth-timeline.onrender.com`

**Cost**: Free tier available (spins down after inactivity)

---

## Option 5: Local Development

Run on your computer (not accessible from phone unless on same network).

### Steps:

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run server**
   ```bash
   ./run.sh
   ```

   Or manually:
   ```bash
   python3 -m uvicorn src.api:app --reload --port 8000
   ```

3. **Access**
   - Open browser: `http://localhost:8000`
   - On phone (same WiFi): `http://YOUR_COMPUTER_IP:8000`

---

## Making It Phone-Friendly

Once deployed, you can add the web app to your phone's home screen:

### iPhone:
1. Open the URL in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Name it "Truth Timeline"

### Android:
1. Open the URL in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home screen"
4. Name it "Truth Timeline"

Now it works like a native app!

---

## Custom Domain (Optional)

Most platforms let you add a custom domain:

1. Buy a domain (e.g., `truthtimeline.com`)
2. In your platform settings, add custom domain
3. Update DNS records as instructed
4. Access at your custom URL

---

## Database Persistence

The SQLite database is stored in `data/timeline.db`.

**Important**: Some platforms have ephemeral filesystems (like Heroku). For those:

1. **Upgrade to persistent storage**, OR
2. **Switch to PostgreSQL**:
   - Update `src/db.py` connection string
   - Add `psycopg2-binary` to `requirements.txt`
   - Use platform's PostgreSQL addon

**Railway/Render**: Persistent filesystem included in free tier ✓

---

## Recommended Setup for Phone Use

1. **Deploy to Railway** (fastest, free, persistent)
2. **Get your URL**: `https://yourapp.up.railway.app`
3. **Open on phone** and add to home screen
4. **Share the URL** with friends to collaborate!

---

## Environment Variables

For production, you may want to set:

```bash
# Database path (if using PostgreSQL)
DATABASE_URL=postgresql://user:pass@host/db

# API keys (for future LLM integration)
OPENAI_API_KEY=your-key-here
```

---

## Monitoring & Logs

All platforms provide logs:

- **Railway**: Click on deployment → Logs tab
- **Replit**: Built-in console
- **Render**: Dashboard → Logs
- **PythonAnywhere**: Files → Log files

---

## Troubleshooting

### "Module not found" error
- Make sure `requirements.txt` is installed
- Check Python version (needs 3.7+)

### Database locked
- SQLite allows one writer at a time
- For high traffic, switch to PostgreSQL

### Site won't load on phone
- Check if deployment is running (not sleeping)
- Verify HTTPS is enabled
- Check browser console for errors

### Changes not showing
- Clear browser cache
- Hard refresh (Ctrl+Shift+R on desktop)
- On phone: Clear site data in browser settings

---

## Next Steps

Once deployed:

1. ✅ Access from your phone browser
2. ✅ Create your first user account
3. ✅ Start defining terms and building your timeline
4. ✅ Share the URL with friends!

**Your personal reality timeline is now accessible anywhere!**
