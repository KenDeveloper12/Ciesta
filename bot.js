/* 
  Made by Ken developer
  Ciesta V1.5
*/
const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const config = require('./config.js');

// Initialize bot
const bot = new TelegramBot(config.token, { polling: true });

// API URLs
const newsUrl = `https://newsapi.org/v2/top-headlines?sources=bbc-news&pageSize=5&apiKey=${config.newsAPI}`;
const weatherUrl = `http://api.weatherapi.com/v1/current.json?key=${config.weatherAPI}&q=`;

// User roles
const ROLES = {
  REGULAR: 'regular',
  PREMIUM: 'premium',
  OWNER: 'owner'
};

// Database functions
const database = {
  ensureDirectoryExists: () => {
    if (!fs.existsSync(config.database.directory)) {
      fs.mkdirSync(config.database.directory, { recursive: true });
      console.log('Created database directory');
    }
  },
  
  read: () => {
    try {
      database.ensureDirectoryExists();
      
      if (!fs.existsSync(config.database.path)) {
        return { users: [] };
      }
      
      const data = fs.readFileSync(config.database.path, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading database:', error);
      return { users: [] };
    }
  },
  
  write: (data) => {
    try {
      database.ensureDirectoryExists();
      fs.writeFileSync(config.database.path, JSON.stringify(data, null, 2), 'utf8');
      console.log('Data written successfully');
      return true;
    } catch (error) {
      console.error('Error writing to database:', error);
      return false;
    }
  },
  
  addUser: (userData) => {
    const data = database.read();
    const existingUserIndex = data.users.findIndex(user => 
      user.chatId === userData.chatId || user.username === userData.username
    );

    if (!userData.role) {
      userData.role = userData.chatId === config.ownerId ? ROLES.OWNER : ROLES.REGULAR;
    }
    
    if (existingUserIndex !== -1) {
      data.users[existingUserIndex] = {
        ...data.users[existingUserIndex],
        ...userData,
        updatedAt: new Date().toISOString()
      };
      return database.write(data) ? 'updated' : 'error';
    } else {
      data.users.push({
        ...userData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return database.write(data) ? 'added' : 'error';
    }
  },
  
  getUser: (chatId) => {
    const data = database.read();
    return data.users.find(user => user.chatId === chatId) || null;
  },
  
  getUserByUsername: (username) => {
    const data = database.read();
    return data.users.find(user => user.username.toLowerCase() === username.toLowerCase()) || null;
  },
  
  updateUserRole: (username, newRole) => {
    const data = database.read();
    const userIndex = data.users.findIndex(user => 
      user.username.toLowerCase() === username.toLowerCase()
    );
    
    if (userIndex === -1) {
      return 'not_found';
    }
    
    data.users[userIndex].role = newRole;
    data.users[userIndex].updatedAt = new Date().toISOString();
    
    return database.write(data) ? 'success' : 'error';
  },
  
  getAllUsers: () => {
    const data = database.read();
    return data.users;
  }
};

// Permission middleware
const permissions = {
  requireRegistration: (msg, callback) => {
    const chatId = msg.chat.id;
    const user = database.getUser(chatId.toString());
    
    if (!user) {
      bot.sendMessage(chatId, '⚠️ Anda belum terdaftar! Silakan gunakan /register [username] untuk mendaftar terlebih dahulu.');
      return false;
    }
    
    return callback(user);
  },
  
  requirePremium: (msg, callback) => {
    return permissions.requireRegistration(msg, (user) => {
      const chatId = msg.chat.id;
      
      if (user.role !== ROLES.PREMIUM && user.role !== ROLES.OWNER) {
        bot.sendMessage(chatId, '🔒 Fitur ini hanya tersedia untuk pengguna premium!\nGunakan /premium untuk info lebih lanjut.');
        return false;
      }
      
      return callback(user);
    });
  },
  
  requireOwner: (msg, callback) => {
    return permissions.requireRegistration(msg, (user) => {
      const chatId = msg.chat.id;
      
      if (user.role !== ROLES.OWNER) {
        bot.sendMessage(chatId, '⛔ Perintah ini hanya dapat diakses oleh pemilik bot.');
        return false;
      }
      
      return callback(user);
    });
  }
};

// Commands
const commands = {
  register: (msg, match) => {
    const chatId = msg.chat.id;
    const telegramUsername = msg.from.username || null;
    const fullName = `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();
    
    if (!match || !match[1]) {
      bot.sendMessage(chatId, 'Username tidak boleh kosong! Contoh: /register Ciesta');
      return;
    }
    
    const username = match[1];
    
    // Additional validation
    if (username.length < 3) {
      bot.sendMessage(chatId, 'Username harus terdiri dari minimal 3 karakter.');
      return;
    }
    
    // Check if username is already taken by another user
    const existingUser = database.getUserByUsername(username);
    if (existingUser && existingUser.chatId !== chatId.toString()) {
      bot.sendMessage(chatId, `Username "${username}" sudah digunakan. Silakan pilih username lain.`);
      return;
    }
    
    // Set appropriate role
    let role = ROLES.REGULAR;
    if (chatId.toString() === config.ownerId) {
      role = ROLES.OWNER;
    }
    
    // Add user to database
    const userData = {
      chatId: chatId.toString(),
      username: username,
      telegramUsername,
      fullName,
      role: role,
      registeredAt: new Date().toISOString()
    };
    
    const result = database.addUser(userData);
    
    if (result === 'added') {
      bot.sendMessage(chatId, `Registrasi berhasil! Selamat datang, ${username}! 🎉\n\nGunakan /listmenu untuk melihat perintah yang tersedia.`);
    } else if (result === 'updated') {
      bot.sendMessage(chatId, `Data anda telah diperbarui, ${username}! ✅\n\nGunakan /listmenu untuk melihat perintah yang tersedia.`);
    } else {
      bot.sendMessage(chatId, 'Maaf, terjadi kesalahan saat mendaftarkan akun anda. Silakan coba lagi nanti.');
    }
  },
  
  status: (msg) => {
    permissions.requireRegistration(msg, (user) => {
      const chatId = msg.chat.id;
      
      const statusMessage = `🤖 *Status Ciesta Bot*\n
✅ Bot aktif dan terhubung
👤 Username: ${user.username}
🌟 Status: ${user.role === ROLES.PREMIUM ? 'Premium' : (user.role === ROLES.OWNER ? 'Owner' : 'Regular')}
📅 Terdaftar pada: ${new Date(user.registeredAt).toLocaleString()}`;
      
      bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
    });
  },
  
  start: (msg) => {
    const chatId = msg.chat.id;
    const user = database.getUser(chatId.toString());
    
    let message = 'Hello! Saya adalah Ciesta, bot sederhana yang dibuat oleh Ken Developer. 🤖\n\n';
    
    if (user) {
      message += `Selamat datang kembali, ${user.username}! Gunakan /listmenu untuk melihat perintah yang tersedia.`;
    } else {
      message += 'Untuk mulai menggunakan Ciesta, silakan daftar dengan perintah /register [username].';
    }
    
    bot.sendMessage(chatId, message);
  },
  
  randomwaifu: (msg) => {
    permissions.requirePremium(msg, (user) => {
      const chatId = msg.chat.id;
      const waifuPath = require('./src/Anime/waifu.json');
      
      const randomWaifu = Math.floor(Math.random() * waifuPath.length);
      const displayWaifu = waifuPath[randomWaifu].url;
      
      bot.sendPhoto(chatId, displayWaifu);
      console.log(`Mengirim 1x Waifu Ke ${msg.chat.username}`);
    });
  },
  randomanime: (msg) => {
    permissions.requirePremium(msg, (user) => {
      const chatId = msg.chat.id;
      const randomAnimePath = require('./src/Anime/random.json');
      
      const randomAnime = Math.floor(Math.random() * randomAnimePath.length);
      const displayRandomAnime = randomAnimePath[randomAnime].url;
      
      bot.sendPhoto(chatId, displayRandomAnime);
      console.log(`Mengirim 1x Anime Karakter Ke ${msg.chat.username}`);
    });
  },
  stats: (msg) => {
    permissions.requireRegistration(msg, (user) => {
      const chatId = msg.chat.id;
      const message = `🤖Statistics ${user.username}\n
👤 | Username : ${user.username}
📌 | User Id : ${user.chatId}
🌟 | Status: ${user.role === ROLES.PREMIUM ? 'Premium💸' : (user.role === ROLES.OWNER ? 'Owner👑' : 'Regular🧸')}
🖇️ | Telegram Name : ${user.telegramUsername}
📅 | Register Date : ${new Date(user.registeredAt).toLocaleString()}`;

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });
  },
  
  getIp: (msg) => {
    permissions.requireRegistration(msg, async (user) => {
      const chatId = msg.chat.id;
      
      try {
        const response = await axios.get('https://api.ipify.org?format=json');
        const ipInfo = response.data;
        
        console.log(`Chat Id: ${chatId}, Public IP Address: ${ipInfo.ip}`);
        bot.sendMessage(chatId, `Your IP: ${ipInfo.ip}`);
      } catch (error) {
        console.error('Error getting IP:', error);
        bot.sendMessage(chatId, 'Maaf, tidak dapat mengambil informasi IP saat ini.');
      }
    });
  },
  
  eunsoo: (msg) => {
    permissions.requirePremium(msg, (user) => {
      const chatId = msg.chat.id;
      const photoUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Shin_Eun-soo_in_January_2024.png/1200px-Shin_Eun-soo_in_January_2024.png';
      bot.sendPhoto(chatId, photoUrl);
    });
  },
  
  topNews: (msg) => {
    permissions.requirePremium(msg, async (user) => {
      const chatId = msg.chat.id;
      
      try {
        const response = await axios.get(newsUrl);
        const articles = response.data.articles;
        
        if (articles.length === 0) {
          bot.sendMessage(chatId, 'Tidak ada berita terbaru saat ini.');
          return;
        }
        
        bot.sendMessage(chatId, '📰 *Top 5 Berita Terbaru dari BBC News:*', { parse_mode: 'Markdown' });
        
        articles.forEach((article, index) => {
          const message = `${index + 1}. *${article.title}*\n${article.description || ''}\nURL: ${article.url}`;
          bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        });
      } catch (error) {
        console.error('Error fetching news:', error);
        bot.sendMessage(chatId, 'Maaf, tidak dapat mengambil berita terbaru saat ini.');
      }
    });
  },
  
  owner: (msg) => {
    permissions.requireRegistration(msg, (user) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId, '@6283177429423');
    });
  },
  
  weather: (msg, match) => {
    permissions.requirePremium(msg, async (user) => {
      const chatId = msg.chat.id;
      const city = match ? match[1] : 'Jakarta';
      
      try {
        const response = await axios.get(weatherUrl + encodeURIComponent(city));
        const data = response.data;
        
        const locationInfo = data.location;
        const currentWeather = data.current;
        const conditionImg = `https:${currentWeather.condition.icon}`;
        
        const message = `🌦️ *Cuaca untuk ${locationInfo.name}, ${locationInfo.country}*\n
📍 Region: ${locationInfo.region}
🕒 Zona Waktu: ${locationInfo.tz_id}
⏰ Waktu Lokal: ${locationInfo.localtime}\n
🌡️ Suhu: ${currentWeather.temp_c}°C / ${currentWeather.temp_f}°F
💧 Kelembaban: ${currentWeather.humidity}%
💨 Angin: ${currentWeather.wind_kph} km/h, arah ${currentWeather.wind_dir}
☁️ Kondisi: ${currentWeather.condition.text}`;
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        bot.sendPhoto(chatId, conditionImg);
      } catch (error) {
        console.error('Error fetching weather:', error);
        bot.sendMessage(chatId, `Maaf, tidak dapat menemukan informasi cuaca untuk "${city}".`);
      }
    });
  },
  
  listmenu: (msg) => {
    const chatId = msg.chat.id;
    const user = database.getUser(chatId.toString());
    
    let menuMessage = `🤖 *DAFTAR PERINTAH CIESTA BOT* 🤖\n
*Perintah Umum:*
/start - Mulai interaksi dengan bot
/register [username] - Daftar sebagai pengguna
/status - Cek status bot dan akun
/getip - Dapatkan IP publik Anda
/owner - Informasi kontak pemilik bot
/premium - Informasi fitur premium
/stats - Untuk Melihat Statistik Kamu
/listmenu - Tampilkan daftar perintah\n`;

    if (user && (user.role === ROLES.PREMIUM || user.role === ROLES.OWNER)) {
      menuMessage += `
*Perintah Premium:*
/weather [kota] - Cek cuaca untuk kota tertentu
/eunsoo - Tampilkan foto Shin Eun-soo
/randomwaifu - Untuk menampilkan foto waifu random
/randomanime - Untuk menampilkan foto Anime random
/topnews - Dapatkan berita terbaru dari BBC\n`;
    }
    
    if (user && user.role === ROLES.OWNER) {
      menuMessage += `
*Perintah Owner:*
/setpremium [username] - Jadikan pengguna sebagai premium
/revokepremium [username] - Cabut status premium pengguna
/listusers - Tampilkan daftar pengguna
/broadcast [pesan] - Kirim pesan ke semua pengguna\n`;
    }
    
    if (!user) {
      menuMessage += `\n⚠️ Anda belum terdaftar! Silakan gunakan /register [username] untuk mendaftar terlebih dahulu.`;
    }
    
    bot.sendMessage(chatId, menuMessage, { parse_mode: 'Markdown' });
  },
  
  premium: (msg) => {
    const chatId = msg.chat.id;
    const user = database.getUser(chatId.toString());
    
    let message = `🌟 *FITUR PREMIUM CIESTA BOT* 🌟\n
Dapatkan akses ke fitur-fitur eksklusif dengan menjadi pengguna premium!\n
*Keuntungan Premium:*
✅ Akses eksklusif ke fitur yang akan datang
✅ Prioritas dalam pembaruan fitur
✅ Dukungan prioritas\n`;

    if (user) {
      if (user.role === ROLES.PREMIUM) {
        message += `\n🎉 Anda sudah menjadi pengguna premium! Nikmati semua fitur eksklusif yang tersedia.`;
      } else if (user.role === ROLES.OWNER) {
        message += `\n👑 Sebagai owner, Anda memiliki akses ke semua fitur premium.`;
      } else {
        message += `\nUntuk menjadi pengguna premium, silakan hubungi owner bot: /owner`;
      }
    } else {
      message += `\n⚠️ Anda belum terdaftar! Silakan gunakan /register [username] untuk mendaftar terlebih dahulu.`;
    }
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  },
  
  // Owner commands
  setPremium: (msg, match) => {
    permissions.requireOwner(msg, (user) => {
      const chatId = msg.chat.id;
      
      if (!match || !match[1]) {
        bot.sendMessage(chatId, 'Format salah. Gunakan: /setpremium [username]');
        return;
      }
      
      const targetUsername = match[1];
      const result = database.updateUserRole(targetUsername, ROLES.PREMIUM);
      
      if (result === 'success') {
        bot.sendMessage(chatId, `✅ Berhasil menjadikan "${targetUsername}" sebagai pengguna premium.`);
        
        // Notify the user who got premium access
        const targetUser = database.getUserByUsername(targetUsername);
        if (targetUser) {
          bot.sendMessage(
            targetUser.chatId, 
            '🎉 *Selamat!* Anda telah mendapatkan akses premium! Gunakan /listmenu untuk melihat fitur premium yang tersedia.',
            { parse_mode: 'Markdown' }
          );
        }
      } else if (result === 'not_found') {
        bot.sendMessage(chatId, `❌ Pengguna dengan username "${targetUsername}" tidak ditemukan.`);
      } else {
        bot.sendMessage(chatId, '❌ Terjadi kesalahan saat mengupdate status pengguna.');
      }
    });
  },
  
  revokePremium: (msg, match) => {
    permissions.requireOwner(msg, (user) => {
      const chatId = msg.chat.id;
      
      if (!match || !match[1]) {
        bot.sendMessage(chatId, 'Format salah. Gunakan: /revokepremium [username]');
        return;
      }
      
      const targetUsername = match[1];
      const result = database.updateUserRole(targetUsername, ROLES.REGULAR);
      
      if (result === 'success') {
        bot.sendMessage(chatId, `✅ Berhasil mencabut akses premium dari "${targetUsername}".`);
        
        const targetUser = database.getUserByUsername(targetUsername);
        if (targetUser) {
          bot.sendMessage(
            targetUser.chatId, 
            '⚠️ Status premium Anda telah berakhir atau dicabut. Hubungi owner untuk informasi lebih lanjut.'
          );
        }
      } else if (result === 'not_found') {
        bot.sendMessage(chatId, `❌ Pengguna dengan username "${targetUsername}" tidak ditemukan.`);
      } else {
        bot.sendMessage(chatId, '❌ Terjadi kesalahan saat mengupdate status pengguna.');
      }
    });
  },
  
  listUsers: (msg) => {
    permissions.requireOwner(msg, (user) => {
      const chatId = msg.chat.id;
      const users = database.getAllUsers();
      
      if (users.length === 0) {
        bot.sendMessage(chatId, 'Tidak ada pengguna terdaftar.');
        return;
      }
      
      let message = `👥 *DAFTAR PENGGUNA (${users.length})*\n\n`;
      
      users.forEach((user, index) => {
        const roleEmoji = user.role === ROLES.PREMIUM ? '🌟' : (user.role === ROLES.OWNER ? '👑' : '👤');
        message += `${index + 1}. ${roleEmoji} *${user.username}*\n`;
        message += `   ID: ${user.chatId}\n`;
        message += `   Nama: ${user.fullName}\n`;
        message += `   Status: ${user.role}\n`;
        message += `   Terdaftar: ${new Date(user.registeredAt).toLocaleString()}\n\n`;
      });
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });
  },
  
  broadcast: (msg, match) => {
    permissions.requireOwner(msg, async (user) => {
      const chatId = msg.chat.id;
      
      if (!match || !match[1]) {
        bot.sendMessage(chatId, 'Format salah. Gunakan: /broadcast [pesan]');
        return;
      }
      
      const broadcastMessage = match[1];
      const users = database.getAllUsers();
      let successCount = 0;
      let failCount = 0;
      
      bot.sendMessage(chatId, `📣 Memulai broadcast ke ${users.length} pengguna...`);
      
      for (const user of users) {
        try {
          await bot.sendMessage(
            user.chatId, 
            `📣 *PENGUMUMAN*\n\n${broadcastMessage}`,
            { parse_mode: 'Markdown' }
          );
          successCount++;
        } catch (error) {
          console.error(`Error sending broadcast to ${user.username} (${user.chatId}):`, error);
          failCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      bot.sendMessage(
        chatId, 
        `✅ Broadcast selesai!\n✅ Berhasil: ${successCount}\n❌ Gagal: ${failCount}`
      );
    });
  }
};

// User command handlers
bot.onText(/\/register (.+)/, commands.register);
bot.onText(/\/register$/, (msg) => commands.register(msg, null));
bot.onText(/\/status/, commands.status);
bot.onText(/\/start/, commands.start);
bot.onText(/\/getip/, commands.getIp);
bot.onText(/\/eunsoo/, commands.eunsoo);
bot.onText(/\/topnews/, commands.topNews);
bot.onText(/\/owner/, commands.owner);
bot.onText(/\/randomwaifu/, commands.randomwaifu);
bot.onText(/\/randomanime/, commands.randomanime);
bot.onText(/\/weather (.+)/, commands.weather);
bot.onText(/\/weather$/, (msg) => commands.weather(msg, [null, 'Jakarta']));
bot.onText(/\/listmenu/, commands.listmenu);
bot.onText(/\/premium/, commands.premium);
bot.onText(/\/stats/, commands.stats);

// Owner commands
bot.onText(/\/setpremium (.+)/, commands.setPremium);
bot.onText(/\/setpremium$/, (msg) => commands.setPremium(msg, null));
bot.onText(/\/revokepremium (.+)/, commands.revokePremium);
bot.onText(/\/revokepremium$/, (msg) => commands.revokePremium(msg, null));
bot.onText(/\/listusers/, commands.listUsers);
bot.onText(/\/broadcast (.+)/, commands.broadcast);
bot.onText(/\/broadcast$/, (msg) => commands.broadcast(msg, null));

// Handle unknown commands
bot.on('message', (msg) => {
  if (msg.text && msg.text.startsWith('/') && !msg.text.includes('@')) {
    const command = msg.text.split(' ')[0];
    const knownCommands = [
      '/start', '/register', '/status', '/getip', '/eunsoo', 
      '/topnews', '/owner', '/weather', '/listmenu', '/premium',
      '/setpremium', '/revokepremium', '/listusers', '/broadcast', '/stats', '/randomwaifu', '/randomanime'
    ];
    
    if (!knownCommands.includes(command) && !knownCommands.some(cmd => command.startsWith(cmd + ' '))) {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId, `⚠️ Perintah "${command}" tidak dikenali. Gunakan /listmenu untuk melihat daftar perintah yang tersedia.`);
    }
  }
});

database.ensureDirectoryExists();

// Send notification to owner
bot.sendMessage(config.ownerId, 'Ciesta Berhasil Dinyalakan ✅');
console.log('Program Ciesta V1.5 telah berhasil dijalankan.');