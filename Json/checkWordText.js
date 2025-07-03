const fs = require('fs');
const path = require('path');

// Lấy tên file từ tham số dòng lệnh
const fileName = process.argv[2];
if (!fileName) {
  console.error('❌ Vui lòng truyền tên file JSON.\nVí dụ: node checkWordText.js ourworld1_unit9.json');
  process.exit(1);
}

const filePath = path.join(__dirname, fileName);

console.log(`🟢 Đang kiểm tra file: ${filePath}`);

fs.readFile(filePath, 'utf8', (err, jsonData) => {
  if (err) {
    console.error(`❌ Không thể đọc file: ${filePath}`);
    process.exit(1);
  }

  try {
    const parsed = JSON.parse(jsonData);

    const keys = Object.keys(parsed).filter(k => k.startsWith('unit'));
    if (keys.length === 0) {
      console.error('❌ Không tìm thấy key bắt đầu bằng "unit" trong JSON.');
      process.exit(1);
    }

    keys.forEach(key => {
      const words = parsed[key];
      if (!Array.isArray(words)) {
        console.error(`❌ Key "${key}" không chứa mảng.`);
        return;
      }

      console.log(`🔍 Kiểm tra key "${key}" (${words.length} mục):`);

      let errorCount = 0;

      words.forEach((word, idx) => {
        if (!word || typeof word.word_text !== 'string' || word.word_text.trim() === '') {
          console.error(`❌ Mục ${idx + 1} bị thiếu hoặc trống "word_text":`, word);
          errorCount++;
        }
      });

      if (errorCount === 0) {
        console.log(`✅ Tất cả mục trong "${key}" đều có "word_text".`);
      } else {
        console.log(`⚠️ Tổng cộng ${errorCount} mục bị lỗi trong "${key}".`);
      }
    });
  } catch (err) {
    console.error('❌ Lỗi phân tích JSON:', err.message);
    process.exit(1);
  }
});
