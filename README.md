# **Ciesta Bot - Telegram Bot with Image Upscale Feature**  

Ciesta is a simple telegram bot program created by **Ken Developer**. This bot has several interesting features, including:  

## **Features**  
✅ **User Registration System**  
✅ **Role-based Access (Regular, Premium, Owner)**  
✅ **Weather Forecast**  
✅ **Latest News from BBC**  
✅ **More Features Coming Soon...**  

---

## **Installation**  

### **1. Clone the Repository**  
```sh
git clone https://github.com/KenDeveloper12/Ciesta
cd ciesta-bot
```

### **2. Install Dependencies**  
```sh
npm install https fs path node-telegram-bot-api
```

### **3. Configure the Bot**  
Rename **`config.example.js`** to **`config.js`** and update the required values:  

```javascript
module.exports = {
  ownerId: 'YOUR_TELEGRAM_USER_ID',
  token: 'YOUR_TELEGRAM_BOT_TOKEN',
  newsAPI: 'YOUR_NEWS_API_KEY',
  weatherAPI: 'YOUR_WEATHER_API_KEY',
  database: {
    path: 'database/user.json',
    directory: 'database'
  }
};
```

### **4. Run the Bot**  
```sh
npm start or node bot.js
```

---

## **Usage**  

### **General Commands**  
| Command | Description |
|---------|------------|
| `/start` | Start interacting with the bot. |
| `/register [username]` | Register as a user. |
| `/status` | Check your user status. |
| `/listmenu` | Show the list of available commands. |

---


## **Dependencies**  
- [Node Telegram Bot API](https://www.npmjs.com/package/node-telegram-bot-api)  
- [Axios](https://www.npmjs.com/package/axios)  

---

## **Contributing**  
myself  

---

## **License**  
This project is licensed under the **MIT License**.  

---

You can modify this **README.md** as needed before publishing to GitHub! Let me know if you need additional changes. ☺️
