<div align="center">

<!-- Animated Header Wave Banner -->
<img src="https://capsule-render.vercel.app/api?type=waving&height=280&color=gradient&customColorList=1,11,20,24&text=ZYPHER%20MD&fontSize=70&fontAlignY=38&animation=twinkling&desc=%E2%9A%A1%20Advanced%20WhatsApp%20Multi-Device%20Superbot%20%E2%9A%A1&descSize=20&descAlignY=60&fontColor=ffffff&stroke=00f2fe&strokeWidth=1" width="100%"/>

<!-- Typing Animation -->
<a href="https://github.com">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&duration=3000&pause=1000&color=00F7FF&center=true&vCenter=true&multiline=true&width=680&height=80&lines=%E2%9C%A8+Welcome+to+Zypher+MD+Official+Repository;%F0%9F%A4%96+AI+Chatbot+%2B+Gemini+2.5%2F3+Flash+Integration;%F0%9F%93%9E+Live+WebRTC+Voice+Call+Audio+Bridge;%F0%9F%90%B3+Ready+for+Docker%2C+PM2+%26+24%2F7+Cloud+Hosting;%F0%9F%91%A8%E2%80%8D%F0%9F%92%BB+Crafted+with+%E2%9D%A4%EF%B8%8F+by+Shenura+Nimnada" alt="Typing SVG" />
</a>

<br/>

<!-- Animated Divider -->
<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4300-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

<!-- Badges Section -->
<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/WhatsApp-MultiDevice-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp" />
  <img src="https://img.shields.io/badge/Baileys-Engine-8A2BE2?style=for-the-badge&logo=codeforces&logoColor=white" alt="Baileys" />
  <img src="https://img.shields.io/badge/Gemini_AI-Enabled-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini" />
  <img src="https://img.shields.io/badge/PM2-Cluster-2B037A?style=for-the-badge&logo=pm2&logoColor=white" alt="PM2" />
</p>

</div>

---

## 🌟 Key Highlights & Features

<div align="center">

| Feature | Description | Status |
| :--- | :--- | :---: |
| 🤖 **Gemini AI Core** | Ultra-fast multimodal chatbot, image & video reasoning, intelligent auto-replies | `Active` 🟢 |
| 📞 **Live Call Bridge** | Real-time WebRTC audio streamer & incoming call management | `Active` 🟢 |
| 🐳 **Dockerized 24/7** | Single container execution with PM2 supervision & auto-restart | `Active` 🟢 |
| 🎬 **CineSubz Movie Engine** | Search, scrape, and download direct Sinhala subtitled movies | `Active` 🟢 |
| 🎨 **Smart Media Tools** | AI Stickers, TextPro 3D Logos, Photooxy, Filters & Audio Converters | `Active` 🟢 |
| 🔒 **Multi-Device Session** | Secure Baileys pairing with automatic reconnect & state persistence | `Active` 🟢 |

</div>

---

## 🚀 One-Click Deployments

Deploy **Zypher MD** to your favorite cloud provider with zero hassle:

<div align="center">

<a href="https://railway.app" target="_blank">
  <img src="https://img.shields.io/badge/Deploy%20on-Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white" alt="Deploy on Railway"/>
</a>
&nbsp;&nbsp;
<a href="https://www.koyeb.com" target="_blank">
  <img src="https://img.shields.io/badge/Deploy%20on-Koyeb-121212?style=for-the-badge&logo=koyeb&logoColor=1F6FED" alt="Deploy on Koyeb"/>
</a>
&nbsp;&nbsp;
<a href="https://render.com" target="_blank">
  <img src="https://img.shields.io/badge/Deploy%20on-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Deploy on Render"/>
</a>
&nbsp;&nbsp;
<a href="https://heroku.com" target="_blank">
  <img src="https://img.shields.io/badge/Deploy%20on-Heroku-430098?style=for-the-badge&logo=heroku&logoColor=white" alt="Deploy on Heroku"/>
</a>

</div>

---

## 🐳 Quickstart with Docker (Recommended)

Running the bot inside Docker guarantees consistent performance with all dependencies (`ffmpeg`, `imagemagick`, `libwebp`) pre-installed.

```bash
# 1. Clone your private repository
git clone https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
cd <YOUR_REPO_NAME>

# 2. Build the Docker image
docker build -t zypher-md .

# 3. Run the container in background (24/7)
docker run -d --name zypher-bot --restart unless-stopped -p 9090:9090 -p 3000:3000 zypher-md

# 4. View real-time logs
docker logs -f zypher-bot
```

---

## 💻 Manual Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables in config.js or .env
# Set your SESSION_ID, OWNER_NUMBER, GEMINI_API_KEY

# 3. Start the bot with PM2
npm start

# Optional: Start Live Call Bridge server
npm run call
```

---

## ⚙️ Environment Configuration

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `SESSION_ID` | Your WhatsApp Baileys Session ID string | `IK~eyJub2lzZ...` |
| `BOT_NAME` | Display name of the bot | `Zypher MD` |
| `PREFIX` | Command prefix | `.` |
| `OWNER_NUMBER` | WhatsApp number of the bot owner | `94788108090` |
| `OWNER_NAME` | Owner's display name | `Shenura Nimnada` |
| `GEMINI_API_KEY` | Google AI Studio Gemini API Key | `AIzaSy...` |
| `MODE` | Bot accessibility mode | `public` or `private` |

---

## 👨‍💻 Developer & Credits

<div align="center">

| Developer | Role | Profile |
| :---: | :---: | :---: |
| **Shenura Nimnada** | Lead Developer & Maintainer | [GitHub](https://github.com) • [WhatsApp](https://wa.me/94788108090) |
| **JawadTechX** | Base Core Architecture | [Original Author](https://github.com/JawadTechYT) |

<br/>

<a href="#top">
  <img src="https://img.shields.io/badge/Back%20To%20Top-%E2%86%91-00f2fe?style=for-the-badge" alt="Back To Top"/>
</a>

<br/><br/>

<!-- Animated Footer Wave -->
<img src="https://capsule-render.vercel.app/api?type=waving&height=120&color=gradient&customColorList=1,11,20,24&section=footer" width="100%"/>

<p align="center">
  <i>Give a ⭐ if you found this project helpful!</i>
</p>

</div>
