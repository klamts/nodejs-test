const fs = require('fs');
const path = require('path');
const axios = require('axios');

const filePath = path.join(__dirname, 'wordForEnglish1.json');
const outputPath = path.join(__dirname, 'wordWithPhonetics.json');

const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

async function fetchPhonetic(word) {
  try {
    const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const entry = res.data[0];
    
    // Tìm phiên âm US
    const phonetic = entry.phonetics.find(p => p.audio?.includes('us.mp3') || p.audio?.includes('us'))?.text
                  || entry.phonetics.find(p => p.text)?.text
                  || "";

    return phonetic;
  } catch (err) {
    console.warn(`⚠️ Không tìm được phiên âm cho từ: ${word}`);
    return "";
  }
}

async function addPhonetics() {
  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    if (!entry.phonetic_us || entry.phonetic_us === "") {
      const phonetic = await fetchPhonetic(entry.word);
      entry.phonetic_us = phonetic;
      console.log(`✅ ${entry.word} → ${phonetic}`);
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\n🎉 Đã lưu vào: ${outputPath}`);
}

addPhonetics();
