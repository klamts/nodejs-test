// server.js
const os = require('os');
const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const fs = require('fs');
const app = express();
const { exec } = require('child_process'); // <== Thêm dòng này
const db = new sqlite3.Database('./lms_demo.sqlite');
const multer = require('multer');
const upload = multer({ dest:'./Upload' }); // Đường dẫn lưu tạm thời
const { spawn } = require('child_process');
const audioUploader = multer({ dest: 'whisper_xu_ly/' });




// ========== Middleware ==========
app.use(express.static(path.join(__dirname, 'public'))); // Public assets
app.use('/video', express.static(path.join(__dirname, 'video'))); // Serve video files
app.use(express.json()); // 👈 Thêm dòng này
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/Upload', express.static('D:/nodejs/Upload')); // Hoặc thư mục tương ứng trong hệ thống của bạn
app.use('/tts/audio', express.static(path.join(__dirname, 'tts/audio'))); // để phát audio
app.use('/data', express.static(path.join(__dirname, 'data')));
// Session setup (must come before routers)
// Cấu hình Express để phục vụ các file từ thư mục 'uploads'

app.use(session({
  secret: 'secret123',
  resave: false,
  saveUninitialized: true
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ========== Database Initialization ==========
db.serialize(() => {
      // ✅ Thêm bảng exercises

  db.run(`
  CREATE TABLE IF NOT EXISTS book_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Khóa chính, tự tăng
    user_id INTEGER,                       -- ID người dùng
    book_title TEXT NOT NULL,               -- Tên sách (bắt buộc)
    reflection TEXT NOT NULL,               -- Cảm nhận (bắt buộc)
    audio_path TEXT,                        -- Đường dẫn đến file ghi âm
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- Thời gian gửi
    FOREIGN KEY (user_id) REFERENCES users(id)  -- Liên kết với bảng users
  );`);    
  db.run(`CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER,
    title TEXT NOT NULL,
    html TEXT NOT NULL,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    subject_id INTEGER,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  )`);
  db.run(`
  CREATE TABLE IF NOT EXISTS game_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    score INTEGER NOT NULL,
    total_time INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// ========== Routes ==========
app.get('/', (req, res) => res.redirect('/login'));

// Login
app.get('/login', (req, res) => res.render('login'));
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
    if (err) return res.send("Lỗi đăng nhập");
    if (user) {
      req.session.user = user;
      res.redirect('/dashboard');
    } else {
      res.send("Sai tài khoản hoặc mật khẩu");
    }
  });
});

// Register
app.get('/register', (req, res) => res.render('register'));
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password], function(err) {
    if (err) return res.send("Tên tài khoản đã tồn tại");
    res.redirect('/login');
  });
});

// Dashboard
// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const userId = req.session.user.id;

  // Lấy danh sách môn học từ cơ sở dữ liệu
  db.all(`
    SELECT subjects.id, subjects.name FROM subjects
    JOIN user_subjects ON subjects.id = user_subjects.subject_id
    WHERE user_subjects.user_id = ?
  `, [userId], (err, subjects) => {
    if (err) {
      console.error("❌ Lỗi khi lấy môn học:", err);
      return res.status(500).send("Lỗi máy chủ");
    }

    // Tạo danh sách unit phonics
    const phonicsUnits = [
      { id: 'unit1', name: 'Unit 1: /p/, /b/, /t/, /d/' },
      { id: 'unit7', name: 'Unit 7: /s/, /z/' },
      { id: 'unit8', name: 'Unit 8: /m/, /n/' }
    ];

    // (Tùy chọn) Lấy danh sách unit động từ thư mục Json
    /*
    const fs = require('fs');
    const path = require('path');
    const jsonDir = path.join(__dirname, 'Json');
    const phonicsUnits = fs.readdirSync(jsonDir)
      .filter(file => file.startsWith('ourworld1_') && file.endsWith('.json'))
      .map(file => ({
        id: file.replace('ourworld1_', '').replace('.json', ''),
        name: `Unit ${file.replace('ourworld1_', '').replace('.json', '')}`
      }));
    */

    // Render dashboard với subjects và phonicsUnits
    res.render('dashboard', {
      user: req.session.user,
      subjects,
      phonicsUnits // Thêm biến phonicsUnits
    });
  });
});

// Dashboard
// app.get('/dashboard', (req, res) => {
//   if (!req.session.user) return res.redirect('/login');
//   const userId = req.session.user.id;

//   // Lấy danh sách môn học từ cơ sở dữ liệu
//   db.all(`
//     SELECT subjects.id, subjects.name FROM subjects
//     JOIN user_subjects ON subjects.id = user_subjects.subject_id
//     WHERE user_subjects.user_id = ?
//   `, [userId], (err, subjects) => {
//     if (err) {
//       console.error("❌ Lỗi khi lấy môn học:", err);
//       return res.status(500).send("Lỗi máy chủ");
//     }

//     // Hard-code danh sách unit phonics (có thể thay bằng logic động)
//     const phonicsUnits = [
//       { id: 'unit1', name: 'Unit 1: /p/, /b/, /t/, /d/' },
//       { id: 'unit7', name: 'Unit 7: /s/, /z/' },
//       { id: 'unit8', name: 'Unit 8: /m/, /n/' }
//     ];

//     // (Tùy chọn) Quét thư mục Json để lấy danh sách unit động
//     /*
//     const fs = require('fs');
//     const path = require('path');
//     const jsonDir = path.join(__dirname, 'Json');
//     const phonicsUnits = fs.readdirSync(jsonDir)
//       .filter(file => file.startsWith('ourworld1_') && file.endsWith('.json'))
//       .map(file => ({
//         id: file.replace('ourworld1_', '').replace('.json', ''),
//         name: `Unit ${file.replace('ourworld1_', '').replace('.json', '')}`
//       }));
//     */

//     // Render dashboard với subjects và phonicsUnits
//     res.render('dashboard', {
//       user: req.session.user,
//       subjects,
//       phonicsUnits // Thêm danh sách unit phonics
//     });
//   });
// });

// Videos by subject
app.get('/subject/:id', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const subjectId = req.params.id;
  
  db.all("SELECT * FROM videos WHERE subject_id = ?", [subjectId], (err, videos) => {
    if (err) {
      console.error("❌ Lỗi khi lấy video:", err);
      return res.status(500).send("Lỗi máy chủ khi lấy video.");
    }

    res.render('subject', { videos });
  });
});

app.get('/question/:id', (req, res) => {
  const jsonFilePath = path.join('D:/nodejs/Json', 'wordForEnglish1.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  res.render('questionQuiz', { questionQuiz: jsonData });
});

// Video playback
// app.get('/video/:id', (req, res) => {
//   const jsonFilePath = path.join('D:/nodejs/Json', 'wordForEnglish1.json');
//   const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
//   if (!req.session.user) return res.redirect('/login');
//   const videoId = req.params.id;
//   db.get("SELECT * FROM videos WHERE id = ?", [videoId], (err, video) => {
//     if (err || !video) return res.send("Không tìm thấy video");
//     const filename = path.basename(video.url);
//     res.render('quiz', { video, videoPath: '/video/' + filename,quizData: jsonData  });
//   });
// });
// app.get('/video/:id', (req, res) => {
//   const jsonFilePath = path.join('D:/nodejs/Json', 'sentence.json');
//   const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
//   if (!req.session.user) return res.redirect('/login');
//   const videoId = req.params.id;
//   db.get("SELECT * FROM videos WHERE id = ?", [videoId], (err, video) => {
//     if (err || !video) return res.send("Không tìm thấy video");
//     const filename = path.basename(video.url);
//     res.render('testquiz', { video, videoPath: '/video/' + filename,quizSentenceData: jsonData  });
//   });
// });
// Video playback route
// app.get('/video/:id', (req, res) => {
//   const quizType = req.query.type || 'sentence';
//   let jsonFilePath, template, quizDataKey;

//   if (quizType === 'word') {
//     jsonFilePath = path.join(__dirname, 'Json', 'wordForEnglish1.json');
//     template = 'quiz';
//     quizDataKey = 'quizData';
//   } else {
//     jsonFilePath = path.join(__dirname, 'Json', 'sentence.json');
//     template = 'testquiz';
//     quizDataKey = 'quizSentenceData';
//   }

//   let jsonData;
//   try {
//     jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
//   } catch (err) {
//     return res.status(500).send('Lỗi đọc file JSON');
//   }

//   if (!req.session.user) {
//     return res.redirect('/login');
//   }

//   const videoId = req.params.id;
//   db.get("SELECT * FROM videos WHERE id = ?", [videoId], (err, video) => {
//     if (err || !video) {
//       return res.status(404).send("Không tìm thấy video");
//     }
//     const filename = path.basename(video.url);
//     res.render(template, {
//       video,
//       videoPath: '/video/' + filename,
//       [quizDataKey]: jsonData
//     });
//   });
// });

app.get('/video/:id', (req, res) => {
  const wordJsonPath = path.join("D:/nodejs/Json", 'learnwithvideo.json');
  const sentenceJsonPath = path.join("D:/nodejs/Json", 'sentence.json');
  
  const wordData = JSON.parse(fs.readFileSync(wordJsonPath, 'utf8'));
  const sentenceData = JSON.parse(fs.readFileSync(sentenceJsonPath, 'utf8'));
  console.log(wordData)
  console.log(sentenceData)
  if (!req.session.user) return res.redirect('/login');

  const videoId = req.params.id;
  db.get("SELECT * FROM videos WHERE id = ?", [videoId], (err, video) => {
    if (err || !video) return res.send("Không tìm thấy video");
    const filename = path.basename(video.url);
    res.render('quiz1', {
      video,
      videoPath: '/video/' + filename,
      quizData: wordData,
      quizSentenceData: sentenceData // ✅ Thêm dòng này
    });
  });
});
app.get('/learnwithvideo/:id', (req, res) => {
  const videoId = req.params.id;

  // 1. Đọc JSON từ enriched_output_filled.json
  const jsonPath = path.join("D:/nodejs/Json", 'enriched_output_filled.json');
  const enrichedData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // 2. Chuyển dữ liệu từ interactive_segments sang danh sách phẳng
  const flatWords = enrichedData.interactive_segments.flatMap(segment =>
    segment.enriched_words.map(word => ({
      word: word.word_text || word.source_phrase,
      source_phrase: word.source_phrase,
      vi: word.meaning_vi,
      en: word.meaning_en,
      part_of_speech: word.pos,
      ipa: word.ipa,
      syllables: word.syllables,
      example: word.example_en,
      example_vi: word.example_vi,
      image_url: word.image_url,
      audio_url: word.audio_url,
      video_timestamp_link: word.video_timestamp_link,
      example_end: segment.segment_end
    }))
  );

  // 3. Lấy thông tin video từ DB
  db.get("SELECT * FROM videos WHERE id = ?", [videoId], (err, video) => {
    if (err || !video) return res.send("❌ Không tìm thấy video");

    const filename = path.basename(video.url);

    // 4. Trả giao diện LearnWithVideo với dữ liệu vocabList
    res.render('LearnWithVideo', {
      video,
      videoPath: '/video/' + filename,
      vocabList: flatWords
    });
  });
});

app.get("/api/gamelearnwithvideo/:id", (req, res) => {
  const videoId = req.params.id;                 // bạn có thể dùng để lọc sau này

  /* 1. Đọc enriched_output_filled.json */
  const jsonPath = path.join("D:/nodejs/Json", "enriched_output_filled.json");
  let enrichedData;

  try {
    enrichedData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Cannot read JSON file" });
  }

  /* 2. Phẳng hóa interactive_segments thành flatWords */
  const flatWords = enrichedData.interactive_segments.flatMap(segment =>
    segment.enriched_words.map(word => ({
      // thông tin gốc
      word:           word.word_text || word.source_phrase,
      source_phrase:  word.source_phrase,
      vi:             word.meaning_vi,
      en:             word.meaning_en,
      part_of_speech: word.pos,
      ipa:            word.ipa,
      syllables:      word.syllables,
      example:        word.example_en,
      example_vi:     word.example_vi,
      image_url:      word.image_url,
      audio_url:      word.audio_url,
      video_timestamp_link: word.video_timestamp_link,
      example_end:    segment.segment_end,
      // mảng words cho trò chơi
      words:          (word.source_phrase || "").split(/\s+/).filter(Boolean)
    }))
  );

  /* 3. Tạo gameData: chỉ lấy cụm > 1 từ, xáo trộn thứ tự */
  const gameData = flatWords
    .filter(entry => entry.words.length > 1)
    .map(entry => {
      const shuffled = [...entry.words]
        .map(w => ({ w, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(o => o.w);

      return {
        correctOrder: entry.words,
        shuffled,
        meaning_vi: entry.vi,
        meaning_en: entry.en,
        ipa:            entry.ipa,
        audio_url: entry.audio_url,
        video_link: entry.video_timestamp_link
      };
    });


  // 4. Trả giao diện LearnWithVideo với dữ liệu vocabList
   res.json({ data: gameData });
});
app.get("/gamelearnwithvideo/:id", (req, res) => {
  res.render("gameFoeLearnWithVideo", { videoId: req.params.id });
});
app.get("/api/game/rebuild-sentence", (req, res) => {
  const videoId = req.params.id;                 // bạn có thể dùng để lọc sau này

  /* 1. Đọc enriched_output_filled.json */
  const jsonPath = path.join("D:/nodejs/Json", "enriched_output_filled.json");
  let enrichedData;

  try {
    enrichedData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Cannot read JSON file" });
  }

  /* 2. Phẳng hóa interactive_segments thành flatWords */
  const flatWords = enrichedData.interactive_segments.flatMap(segment =>
    segment.enriched_words.map(word => ({
      // thông tin gốc
      word:           word.word_text || word.source_phrase,
      source_phrase:  word.source_phrase,
      vi:             word.meaning_vi,
      en:             word.meaning_en,
      part_of_speech: word.pos,
      ipa:            word.ipa,
      syllables:      word.syllables,
      example:        word.example_en,
      example_vi:     word.example_vi,
      image_url:      word.image_url,
      audio_url:      word.audio_url,
      video_timestamp_link: word.video_timestamp_link,
      example_end:    segment.segment_end,
      // mảng words cho trò chơi
      words:          (word.example_en || "").split(/\s+/).filter(Boolean)
    }))
  );

  /* 3. Tạo gameData: chỉ lấy cụm > 1 từ, xáo trộn thứ tự */
  const gameData = flatWords
    .filter(entry => entry.words.length > 3)
    .map(entry => {
      const shuffled = [...entry.words]
        .map(w => ({ w, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map(o => o.w);

      return {
        meaning_vi: entry.meaning_vi,
        example_vi: entry.example_vi,
        correctOrder: entry.words,
        shuffled
      };
    });


  // 4. Trả giao diện LearnWithVideo với dữ liệu vocabList
   res.json({ data: gameData });
});
app.get('/game/rebuild-sentence', (req, res) => {
  res.render('gameSentenceBuilder');
});
app.get('/question/:id', (req, res) => {
  const subjectId = req.params.id;
  const jsonFilePath = path.join('D:/nodejs/Json', `wordForEnglish${subjectId}.json`);
  
  try {
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    res.render('questionQuiz', { questionQuiz: jsonData });
  } catch (err) {
    res.send("❌ Không tìm thấy file quiz cho môn học này.");
  }
});
app.post('/save-quiz-result', (req, res) => {
  const { question_text, correct_answer, user_answer, is_correct } = req.body;
  const user_id = req.session.user?.id || null;

  console.log("📩 Nhận kết quả từ client:", req.body); // 👈 thêm dòng này

  db.run(`
    INSERT INTO quiz_results (user_id, question_text, correct_answer, user_answer, is_correct)
    VALUES (?, ?, ?, ?, ?)
  `, [user_id, question_text, correct_answer, user_answer, is_correct ? 1 : 0], (err) => {
    if (err) {
      console.error("❌ Lỗi khi lưu kết quả quiz:", err);
      return res.status(500).json({ success: false, message: "Lỗi lưu kết quả." });
    }
    res.json({ success: true });
  });
});

// Admin page
app.get('/admin', (req, res) => {
  db.all("SELECT * FROM users", [], (err, users) => {
    db.all("SELECT * FROM subjects", [], (err2, subjects) => {
      res.render('admin', { users, subjects });
    });
  });
});

app.post('/assign', (req, res) => {
  const { user_id, subject_id } = req.body;
  db.run("INSERT INTO user_subjects (user_id, subject_id) VALUES (?, ?)", [user_id, subject_id], (err) => {
    res.redirect('/admin');
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/exercises/:subjectId', (req, res) => {
  const subjectId = req.params.subjectId;

  db.all("SELECT * FROM exercises WHERE subject_id = ?", [subjectId], (err, exercises) => {
    if (err) {
      console.error("Lỗi lấy bài tập:", err);
      return res.send("Lỗi khi lấy danh sách bài tập.");
    }
    res.render('exercise_list', { exercises });
  });
});

app.get('/exercise/:id', (req, res) => {
  db.get("SELECT * FROM exercises WHERE id = ?", [req.params.id], (err, exercise) => {
    if (err || !exercise) return res.send("Không tìm thấy bài tập");
    res.render('exercise_detail', { exercise });
  });
});

app.get('/exercises/:subjectId/:exerciseId', (req, res) => {
  const exerciseId = req.params.exerciseId;

  db.get("SELECT * FROM exercises WHERE id = ?", [exerciseId], (err, exercise) => {
    if (err || !exercise) return res.send("Không tìm thấy bài tập");
    res.render('exercise_detail', { exercise });
  });
});

app.get('/book-report', (req, res) => {
  const subjectId = req.query.subject_id || null;
  res.render('book_report_form', { subjectId });
});

app.get('/my-book-reports', (req, res) => {
  // Kiểm tra xem người dùng có đăng nhập hay không
  if (!req.session.user) {
    return res.redirect('/login');  // Nếu chưa đăng nhập, chuyển hướng về trang login
  }

  const userId = req.session.user.id;  // Lấy user_id từ session
  console.log(req.session.user.id);
  // Truy vấn để lấy tất cả các phiếu đọc sách của người dùng
  db.all("SELECT * FROM book_reports WHERE user_id = ?", [userId], (err, reports) => {
    if (err) {
      console.error("Lỗi khi lấy danh sách phiếu:", err);
      return res.send("❌ Lỗi khi lấy danh sách phiếu.");
    }

    // Nếu không có phiếu nào, gửi thông báo
    if (reports.length === 0) {
      return res.render('book_report_list', { reports: [], message: "❗ Bạn chưa gửi phiếu nào." });
    }

    // Gửi dữ liệu phiếu đọc sách về giao diện
    res.render('book_report_list', { reports });
  });
});




// Cấu hình bodyParser để xử lý dữ liệu form (dành cho text)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());  // Dành cho dữ liệu JSON nếu có

app.post('/book-report', upload.single('audio'), (req, res) => {
  const { book_title, chapter, reflection } = req.body;
  const user_id = req.session.user?.id || 1; // Lấy user_id từ session hoặc mặc định là 1
  const audioPath = req.file ? req.file.filename : null;

  // Chạy câu lệnh SQL để lưu vào CSDL
  db.run(`
    INSERT INTO book_reports (user_id, book_title, chapter, reflection, audio_path)
    VALUES (?, ?, ?, ?, ?)
  `, [user_id, book_title, chapter, reflection, audioPath], (err) => {
    if (err) {
      console.error("❌ Lỗi ghi phiếu:", err);
      return res.send("❌ Ghi phiếu thất bại!");
    }
    res.send("✅ Đã gửi phiếu kèm ghi âm!");
  });
});
app.get('/practice-pronunciation', (req, res) => {
  const jsonFilePath = path.join('D:/nodejs/Json', 'wordWithPhonetics.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  res.render('practicePronunciation', { words: jsonData });
});
// app.get('/practice-pronunciation-ourworld1-unit8', (req, res) => {
  
//   const jsonFilePath = path.join('D:/nodejs/Json', 'ourworld1_unit8.json');
//   const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
//   const words = jsonData.unit8.filter(w => w.word_text);
//   res.render('practice_pronunciation_ourworld1_unit8.ejs', { words });
// });

// Render trang luyện phát âm theo unit
// app.get('/practice/:level/:unit', (req, res) => {
//   const level = req.params.level; // "1", "2", "3"
//   const unit = req.params.unit;   // "unit0", "unit1", ...
//   const fileName = `ourworld${level}_${unit}.json`;
//   const dataFile = path.join('D:/nodejs/Json', fileName);

//   fs.readFile(dataFile, 'utf8', (err, jsonData) => {
//     if (err) return res.status(404).send('❌ Không tìm thấy file dữ liệu JSON');

//     try {
//       const parsed = JSON.parse(jsonData);
//       console.log('✅ File JSON đọc được, có key:', Object.keys(parsed)); // 🔍 Kiểm tra keys
//       const words = parsed[unit]; // lấy theo key "unit8"

//       if (!words || !Array.isArray(words)) {
//         return res.status(500).send(`❌ Dữ liệu không hợp lệ cho key "${unit}"`);
//       }

//       res.render('practice_pronunciationOWunit', { words,unit });

//     } catch (parseError) {
//       return res.status(500).send('❌ Lỗi đọc dữ liệu JSON');
//     }
//   });
// });
app.get('/practice/:level/:unit', (req, res) => {
  const level = req.params.level;
  const unit = req.params.unit;
  const fileName = `ourworld1_${unit}.json`;
  const dataFile = path.join(__dirname, 'Json', fileName);

  console.log("🟢 Đang truy cập:", dataFile);
  console.log("unit param:", unit);

  fs.readFile(dataFile, 'utf8', (err, jsonData) => {
    if (err) {
      console.error('❌ Không tìm thấy file:', dataFile);
      return res.status(404).send('❌ Không tìm thấy file dữ liệu JSON');
    }

    try {
      const parsed = JSON.parse(jsonData);
      const words = parsed[unit];
      const target_sounds = parsed["target_sounds"] || [];

      if (!words || !Array.isArray(words)) {
        console.error(`❌ Dữ liệu không hợp lệ cho key "${unit}"`);
        console.log("Các key trong file JSON:", Object.keys(parsed));
        return res.status(500).send(`❌ Dữ liệu không hợp lệ cho key "${unit}"`);
      }

      // 🟢 Tạo danh sách words đã kiểm tra và thêm mặc định
      const fixedWords = words.map((w, idx) => {
        if (!w || typeof w.word_text !== 'string' || w.word_text.trim() === '') {
          console.warn(`⚠️ Mục ${idx + 1} thiếu hoặc trống "word_text", gán 'N/A'`);
          return { ...w, word_text: 'N/A' };
        }
        return w;
      });

      console.log(`✅ Hoàn tất kiểm tra ${fixedWords.length} từ.`);

      res.render('practice_pronunciationOWunit', { words: fixedWords, unit, target_sounds });
    } catch (err) {
      console.error('❌ Lỗi phân tích JSON:', err);
      return res.status(500).send('❌ Lỗi đọc JSON');
    }
  });
});
//game cho ourworld1
app.get('/practice/:level/:unit/game', (req, res) => {
  
  
  const level = req.params.level;
  const unit = req.params.unit;
  const fileName = `ourworld${level}_${unit}.json`;
  const dataFile = path.join(__dirname, 'Json', fileName); // Sửa lại dùng __dirname

  console.log("🟢 Đang truy cập:", dataFile); // DEBUG
 
  fs.readFile(dataFile, 'utf8', (err, jsonData) => {
    if (err) {
      console.error('❌ Không tìm thấy file:', dataFile);
      return res.status(404).send('❌ Không tìm thấy file dữ liệu JSON');
    }

    try {
      const parsed = JSON.parse(jsonData);
      const words = parsed[unit];
      const targetSounds = parsed["target_sounds"] || [];

      if (!words || !Array.isArray(words)) {
        return res.status(500).send(`❌ Dữ liệu không hợp lệ cho key "${unit}"`);
      }

      res.render('game_flashcard_ourworld1', { words, unit, targetSounds });
    } catch (err) {
      console.error('❌ Lỗi JSON:', err);
      return res.status(500).send('❌ Lỗi đọc JSON');
    }
  });
});
app.get('/practice/:level/:unit/imageflash', (req, res) => {
  const level = req.params.level;
  const unit = req.params.unit;
  const fileName = `ourworld${level}_${unit}.json`;
  const dataFile = path.join(__dirname, 'Json', fileName); // Sửa lại dùng __dirname

 
   fs.readFile(dataFile, 'utf8', (err, jsonData) => {
    if (err) {
      console.error('❌ Không tìm thấy file:', dataFile);
      return res.status(404).send('❌ Không tìm thấy file dữ liệu JSON');
    }

    try {
      const parsed = JSON.parse(jsonData);
      const words = parsed[unit];
      const targetSounds = parsed["target_sounds"] || [];

      if (!words || !Array.isArray(words)) {
        return res.status(500).send(`❌ Dữ liệu không hợp lệ cho key "${unit}"`);
      }

      res.render('image_flashcard_game', { words, unit, targetSounds });
    } catch (err) {
      console.error('❌ Lỗi JSON:', err);
      return res.status(500).send('❌ Lỗi đọc JSON');
    }
  });
});
app.get('/practice/:level/:unit/listen_sound_match', (req, res) => {
  const level = req.params.level;
  const unit = req.params.unit;
  const fileName = `ourworld${level}_${unit}.json`;
  const dataFile = path.join(__dirname, 'Json', fileName); // Sửa lại dùng __dirname

  
  fs.readFile(dataFile, 'utf8', (err, jsonData) => {
    if (err) {
      console.error('❌ Không tìm thấy file:', dataFile);
      return res.status(404).send('❌ Không tìm thấy file dữ liệu JSON');
    }

    try {
      const parsed = JSON.parse(jsonData);
      const words = parsed[unit];
      const targetSounds = parsed["target_sounds"] || [];

      if (!words || !Array.isArray(words)) {
        return res.status(500).send(`❌ Dữ liệu không hợp lệ cho key "${unit}"`);
      }

      res.render('game_listen_sound_match', { words, unit, targetSounds });
    } catch (err) {
      console.error('❌ Lỗi JSON:', err);
      return res.status(500).send('❌ Lỗi đọc JSON');
    }
  });
});
// Practice question-answer
app.get('/practice-questionanswer', (req, res) => {
  const jsonFilePath = path.join('D:/nodejs/Json', 'questionAnswer.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  res.render('questionanswer', { words: jsonData });
});

// Route cho các bài học phonics
// Route cho các bài học phonics
app.get('/phonics/:unit', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const unit = req.params.unit; // ví dụ: unit1
  const lesson = 'index'; // mặc định là trang danh sách
  const dataFile = path.join(__dirname, 'Json', `ourworld1_${unit}.json`);

  // Đọc dữ liệu JSON
  fs.readFile(dataFile, 'utf8', (err, jsonData) => {
    if (err) return res.status(404).send('❌ Không tìm thấy file dữ liệu JSON');

    try {
      const parsed = JSON.parse(jsonData);
      const words = parsed[unit];
      const targetSounds = parsed.target_sounds || [];

      if (!Array.isArray(words)) {
        return res.status(500).send(`❌ Dữ liệu không hợp lệ cho key "${unit}"`);
      }

      // Dữ liệu bài học (giữ nguyên từ code trước)
      const lessonData = {
        index: {
          title: `Unit ${unit.toUpperCase()} Overview`
        },
        1: {
          sound: '/p/',
          letter: 'Pp',
          keyWords: ['pen', 'paint', 'map', 'top', 'happy'],
          additionalWords: ['apple', 'point', 'cap', 'puzzle'],
          tr: ['TR: 11', 'TR: 12', 'TR: 13', 'TR: 14'],
          warmUp: 'Write the alphabet on the board, pausing for students to prompt you with letters. Say A, b, c, d—What’s next? (e) Continue until you have the whole alphabet. Then trace a letter in the air and say What letter is this? Stand up if your name begins with (t). Repeat with other letters.',
          activities: [
            'Trace the letter Pp and practice the /p/ sound.',
            'Listen to words with /p/ and repeat.',
            'Identify the position of /p/ in words (beginning, middle, end).',
            'Circle Yes or No if the word contains /p/.'
          ],
          extend: 'Play Bingo with pictures from page 12.',
          wrapUp: 'Act out words with /p/ while others stand still for non-/p/ words.'
        },
        2: {
          sound: '/b/',
          letter: 'Bb',
          keyWords: ['book', 'ball', 'tub', 'robot', 'rainbow'],
          additionalWords: ['cub', 'bag', 'rabbit', 'boy'],
          tr: ['TR: 15', 'TR: 16', 'TR: 17', 'TR: 18'],
          warmUp: 'Review words with /p/ using Picture Cards. Students arrange themselves in order based on called words.',
          activities: [
            'Trace the letter Bb and practice the /b/ sound.',
            'Listen to words with /b/ and repeat.',
            'Identify the position of /b/ in words (beginning, middle, end).',
            'Write p or b for each word.'
          ],
          extend: 'Feed sound monsters (/p/ or /b/) with Picture Cards.',
          wrapUp: 'Point to words with /p/ or /b/ in the middle on pages 12-13.'
        },
        3: {
          sound: '/t/',
          letter: 'Tt',
          keyWords: ['ten', 'table', 'sit', 'goat', 'fourteen'],
          additionalWords: ['two', 'rectangle', 'eat', 'coat'],
          tr: ['TR: 19', 'TR: 20', 'TR: 21', 'TR: 22'],
          warmUp: 'Sort words from Lessons 1 and 2 into /p/ and /b/ columns using index cards.',
          activities: [
            'Trace the letter Tt and practice the /t/ sound.',
            'Listen to words with /t/ and repeat.',
            'Identify the position of /t/ in words (beginning, middle, end).',
            'Circle Yes or No if the word contains /t/.'
          ],
          extend: 'Pair students to stand up if their Picture Card has /p/, /b/, or /t/.',
          wrapUp: 'Fill in missing t in words like _en, goo_, four_teen.'
        },
        4: {
          sound: '/d/',
          letter: 'Dd',
          keyWords: ['desk', 'door', 'board', 'sad', 'noodles'],
          additionalWords: ['red', 'duck', 'window', 'doll'],
          tr: ['TR: 23', 'TR: 24', 'TR: 25', 'TR: 26'],
          warmUp: 'Repeat words from one sound group (/p/, /b/, or /t/) in order and identify the target sound.',
          activities: [
            'Trace the letter Dd and practice the /d/ sound.',
            'Listen to words with /d/ and repeat.',
            'Identify the position of /d/ in words (beginning, middle, end).',
            'Write t or d for each word.'
          ],
          extend: 'Chant a nonsense rhyme with missing t and d letters.',
          wrapUp: 'Identify the word that doesn’t belong in a group of four (three with /d/, one without).'
        },
        5: {
          sound: '/p/, /b/, /t/, /d/',
          letter: 'Review',
          keyWords: ['pen', 'book', 'table', 'desk'],
          additionalWords: ['boy', 'ball', 'window', 'toys'],
          tr: ['TR: 27'],
          warmUp: 'Use Picture Cards to review words with /p/, /b/, /t/, /d/.',
          activities: [
            'Follow a path, circling pictures with /p/, /b/, /t/, /d/ in correct colors.',
            'Listen to a chant and repeat, clapping and turning around.',
            'Find objects in a picture with target sounds.'
          ],
          extend: 'Reorder the chant lines and check with TR: 27.',
          wrapUp: 'Find classroom objects from the chant and say their target sounds.'
        },
        story: {
          title: 'Bella’s First Day of School',
          summary: 'Bella is excited for the first day of school. She puts all of her favorite things into her bag. It’s not easy for Bella to carry her bag to school—or to get her book out!',
          keyWords: ['book', 'pen', 'desk', 'bag'],
          tr: ['TR: 28', 'TR: 29', 'TR: 30'],
          activities: [
            'Listen to the story and identify words with /p/, /b/, /t/, /d/.',
            'Circle the correct letter (t or d) for words in TR: 30.',
            'Color a picture based on numbers and letters from the story.'
          ],
          wrapUp: 'Draw a bag outline and list items with /p/, /b/, /t/, /d/ inside.'
        }
      };

      // Render file phonics.ejs
      res.render('phonics', {
        unit,
        lesson,
        words,
        targetSounds,
        lessonData: lessonData[lesson]
      });
    } catch (parseError) {
      return res.status(500).send('❌ Lỗi đọc dữ liệu JSON');
    }
  });
});

app.get('/phonics/:unit/:lesson', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const unit = req.params.unit;
  const lesson = req.params.lesson;
  const dataFile = path.join(__dirname, 'Json', `ourworld1_${unit}.json`);

  // Đọc dữ liệu JSON
  fs.readFile(dataFile, 'utf8', (err, jsonData) => {
    if (err) return res.status(404).send('❌ Không tìm thấy file dữ liệu JSON');

    try {
      const parsed = JSON.parse(jsonData);
      const words = parsed[unit];
      const targetSounds = parsed.target_sounds || [];

      if (!Array.isArray(words)) {
        return res.status(500).send(`❌ Dữ liệu không hợp lệ cho key "${unit}"`);
      }

      // Dữ liệu bài học (giữ nguyên từ code trước)
      const lessonData = {
        1: {
          sound: '/p/',
          letter: 'Pp',
          keyWords: ['pen', 'paint', 'map', 'top', 'happy'],
          additionalWords: ['apple', 'point', 'cap', 'puzzle'],
          tr: ['TR: 11', 'TR: 12', 'TR: 13', 'TR: 14'],
          warmUp: 'Write the alphabet on the board, pausing for students to prompt you with letters. Say A, b, c, d—What’s next? (e) Continue until you have the whole alphabet. Then trace a letter in the air and say What letter is this? Stand up if your name begins with (t). Repeat with other letters.',
          activities: [
            'Trace the letter Pp and practice the /p/ sound.',
            'Listen to words with /p/ and repeat.',
            'Identify the position of /p/ in words (beginning, middle, end).',
            'Circle Yes or No if the word contains /p/.'
          ],
          extend: 'Play Bingo with pictures from page 12.',
          wrapUp: 'Act out words with /p/ while others stand still for non-/p/ words.'
        },
        2: {
          sound: '/b/',
          letter: 'Bb',
          keyWords: ['book', 'ball', 'tub', 'robot', 'rainbow'],
          additionalWords: ['cub', 'bag', 'rabbit', 'boy'],
          tr: ['TR: 15', 'TR: 16', 'TR: 17', 'TR: 18'],
          warmUp: 'Review words with /p/ using Picture Cards. Students arrange themselves in order based on called words.',
          activities: [
            'Trace the letter Bb and practice the /b/ sound.',
            'Listen to words with /b/ and repeat.',
            'Identify the position of /b/ in words (beginning, middle, end).',
            'Write p or b for each word.'
          ],
          extend: 'Feed sound monsters (/p/ or /b/) with Picture Cards.',
          wrapUp: 'Point to words with /p/ or /b/ in the middle on pages 12-13.'
        },
        3: {
          sound: '/t/',
          letter: 'Tt',
          keyWords: ['ten', 'table', 'sit', 'goat', 'fourteen'],
          additionalWords: ['two', 'rectangle', 'eat', 'coat'],
          tr: ['TR: 19', 'TR: 20', 'TR: 21', 'TR: 22'],
          warmUp: 'Sort words from Lessons 1 and 2 into /p/ and /b/ columns using index cards.',
          activities: [
            'Trace the letter Tt and practice the /t/ sound.',
            'Listen to words with /t/ and repeat.',
            'Identify the position of /t/ in words (beginning, middle, end).',
            'Circle Yes or No if the word contains /t/.'
          ],
          extend: 'Pair students to stand up if their Picture Card has /p/, /b/, or /t/.',
          wrapUp: 'Fill in missing t in words like _en, goo_, four_teen.'
        },
        4: {
          sound: '/d/',
          letter: 'Dd',
          keyWords: ['desk', 'door', 'board', 'sad', 'noodles'],
          additionalWords: ['red', 'duck', 'window', 'doll'],
          tr: ['TR: 23', 'TR: 24', 'TR: 25', 'TR: 26'],
          warmUp: 'Repeat words from one sound group (/p/, /b/, or /t/) in order and identify the target sound.',
          activities: [
            'Trace the letter Dd and practice the /d/ sound.',
            'Listen to words with /d/ and repeat.',
            'Identify the position of /d/ in words (beginning, middle, end).',
            'Write t or d for each word.'
          ],
          extend: 'Chant a nonsense rhyme with missing t and d letters.',
          wrapUp: 'Identify the word that doesn’t belong in a group of four (three with /d/, one without).'
        },
        5: {
          sound: '/p/, /b/, /t/, /d/',
          letter: 'Review',
          keyWords: ['pen', 'book', 'table', 'desk'],
          additionalWords: ['boy', 'ball', 'window', 'toys'],
          tr: ['TR: 27'],
          warmUp: 'Use Picture Cards to review words with /p/, /b/, /t/, /d/.',
          activities: [
            'Follow a path, circling pictures with /p/, /b/, /t/, /d/ in correct colors.',
            'Listen to a chant and repeat, clapping and turning around.',
            'Find objects in a picture with target sounds.'
          ],
          extend: 'Reorder the chant lines and check with TR: 27.',
          wrapUp: 'Find classroom objects from the chant and say their target sounds.'
        },
        story: {
          title: 'Bella’s First Day of School',
          summary: 'Bella is excited for the first day of school. She puts all of her favorite things into her bag. It’s not easy for Bella to carry her bag to school—or to get her book out!',
          keyWords: ['book', 'pen', 'desk', 'bag'],
          tr: ['TR: 28', 'TR: 29', 'TR: 30'],
          activities: [
            'Listen to the story and identify words with /p/, /b/, /t/, /d/.',
            'Circle the correct letter (t or d) for words in TR: 30.',
            'Color a picture based on numbers and letters from the story.'
          ],
          wrapUp: 'Draw a bag outline and list items with /p/, /b/, /t/, /d/ inside.'
        }
      };

      // Render file phonics.ejs
      res.render('phonics', {
        unit,
        lesson,
        words,
        targetSounds,
        lessonData: lessonData[lesson]
      });
    } catch (parseError) {
      return res.status(500).send('❌ Lỗi đọc dữ liệu JSON');
    }
  });
});
// app.post('/pronounce/upload', upload.single('audio'), (req, res) => {
//   const audioPath = path.resolve(req.file.path);
//   const expected = req.body.expected.toLowerCase().trim();
//   const outputDir = path.resolve('uploads');
//   const baseName = path.basename(audioPath);
//   const txtFile = path.join(outputDir, `${baseName}.txt`);

//   const command = `whisper "${audioPath}" --language en --model base --output_format txt --output_dir ${outputDir}`;

//   console.log("Running:", command);

//   exec(command, (err, stdout, stderr) => {
//     if (err) {
//       console.error("Whisper error:", stderr);
//       return res.status(500).json({ error: stderr });
//     }

//     // ✅ Kiểm tra tồn tại trước khi đọc
//     if (!fs.existsSync(txtFile)) {
//       return res.status(500).json({ error: "Whisper không tạo được file .txt" });
//     }

//     const transcript = fs.readFileSync(txtFile, 'utf8').trim().toLowerCase();
//     const isCorrect = transcript.includes(expected);

//     // cleanup
//     fs.unlinkSync(audioPath);
//     fs.unlinkSync(txtFile);

//     res.json({ userSaid: transcript, expected, isCorrect });
//   });
// });
// app.post('/pronounce/upload', upload.single('audio'), (req, res) => {
//   const userAudio = path.resolve(req.file.path);
//   const expected = req.body.expected.toLowerCase();
//   const refAudio = path.resolve(__dirname, `tts/audio/${expected}.wav`);

//   if (!fs.existsSync(refAudio)) {
//     return res.status(400).json({ error: 'Chưa có âm thanh mẫu TTS để so sánh.' });
//   }

//   const py = spawn('python', ['compare_audio.py', refAudio, userAudio]);
//   let result = '';

//   py.stdout.on('data', data => result += data.toString());
//   py.on('close', code => {
//     fs.unlinkSync(userAudio);
//     const score = parseFloat(result);
//     res.json({ expected, userSaid: '[user speech]', isCorrect: score >= 75, score });
//   });
// });
// // Route tạo file phát âm TTS nếu chưa có
// app.post('/tts/generate', (req, res) => {
//   const word = req.body.word;
//   const filename = `${word.toLowerCase()}.wav`;
//   const filepath = path.join(__dirname, 'tts/audio', filename);

//   if (fs.existsSync(filepath)) {
//     return res.json({ url: `/tts/audio/${filename}` });
//   }

//   const py = spawn('python', ['tts_generate.py', word, filepath]);
//   py.on('close', code => {
//     if (fs.existsSync(filepath)) {
//       res.json({ url: `/tts/audio/${filename}` });
//     } else {
//       res.status(500).json({ error: 'Không tạo được file TTS.' });
//     }
//   });
// });


// app.post('/tts/generate', (req, res) => {
//   const { word, voice } = req.body;

//   if (!word) {
//     return res.status(400).json({ error: 'Thiếu từ cần phát âm.' });
//   }

//   const voiceMap = {
//     "Microsoft David - English (United States)": "en-US-DavidNeural",
//     "Microsoft Zira - English (United States)": "en-US-ZiraNeural",
//     "Microsoft Mark - English (United States)": "en-US-MarkNeural",
//     // Thêm các giọng khác nếu cần
//   };

//   const mappedVoice = voiceMap[voice] || "en-US-GuyNeural";
//   const fileName = `${word.toLowerCase()}.mp3`;
//   const filePath = path.join(__dirname, 'tts', fileName);

//   if (fs.existsSync(filePath)) {
//     return res.json({ url: `/tts/${fileName}` });
//   }

//   const { exec } = require('child_process');

  
//   const edgePath = '"C:\\Users\\<tên bạn>\\AppData\\Roaming\\Python\\Python311\\Scripts\\edge-tts.exe"';

//   const cmd = `${edgePath} --text "${word}" --voice "${mappedVoice}" --write-media "${filePath}"`;
//   exec(cmd, (error, stdout, stderr) => {
//     if (error) {
//       console.error("TTS Error:", stderr); // ⬅️ In lỗi chi tiết ra console
//       return res.status(500).json({ error: 'Tạo âm thanh thất bại.', details: stderr });
//     }
//     return res.json({ url: `/tts/${fileName}` });
//   });
// });

// app.post('/tts/generate', async (req, res) => {
//     const { word, voice } = req.body;

//     // Nếu voice không có, dùng mặc định (có thể sửa theo nhu cầu)
//     const voiceToUse = voice && voice.trim() !== '' ? voice : 'en-US-AriaNeural';

//     const sanitize = (text) =>
//   text.toLowerCase()
//       .replace(/[^a-z0-9 _-]/gi, '')   // loại bỏ ký tự đặc biệt
//       .replace(/\s+/g, '_')            // thay khoảng trắng bằng gạch dưới
//       .slice(0, 50);                   // giới hạn độ dài tên file

// const filename = `${sanitize(word)}.wav`;
//     const outputPath = path.join(__dirname, 'public', 'tts', filename);

//     if (fs.existsSync(outputPath)) {
//         return res.json({ url: `/tts/${filename}` });
//     }

//     const command = `edge-tts --voice "${voiceToUse}" --text "${word}" --write-media "${outputPath}"`;

//     exec(command, (error, stdout, stderr) => {
//         if (error) {
//             console.error('TTS error:', error);
//             return res.status(500).json({ error: 'Tạo âm thanh thất bại.' });
//         }
//         return res.json({ url: `/tts/${filename}` });
//     });
// });

// app.post('/tts/generate', async (req, res) => {
//   const { word, voice } = req.body;

//   if (!word) {
//     return res.status(400).json({ error: 'Thiếu từ cần phát âm.' });
//   }

//   const voiceToUse = voice && voice.trim() !== '' ? voice : 'en-US-AriaNeural';

//   const sanitize = (text) =>
//     text.toLowerCase()
//         .replace(/[^a-z0-9 _-]/gi, '')
//         .replace(/\s+/g, '_')
//         .slice(0, 50);

//   const filename = `${sanitize(word)}.wav`;
//   const outputPath = path.join(__dirname, 'public', 'tts', filename);

//   // Nếu file đã tồn tại
//   if (fs.existsSync(outputPath)) {
//     return res.json({ url: `/tts/${filename}` });
//   }

//   try {
//     const stream = await edgeTTS
//       .synthesize({
//         text: word,
//         voice: voiceToUse
//       })
//       .then(res => res.stream());

//     const file = fs.createWriteStream(outputPath);
//     stream.pipe(file);

//     file.on('finish', () => {
//       return res.json({ url: `/tts/${filename}` });
//     });
//   } catch (err) {
//     console.error('TTS error:', err);
//     return res.status(500).json({ error: 'Không tạo được âm thanh.' });
//   }
// });


app.post('/tts/generate', async (req, res) => {
  const { word, voice } = req.body;
  console.log(`Generating TTS for word: ${word}, voice: ${voice || 'en-US-AriaNeural'}`);
  if (!word || typeof word !== 'string' || word.trim() === '') {
    return res.status(400).json({ error: 'Từ cần phát âm không hợp lệ.' });
  }
  const voiceToUse = voice && voice.trim() ? voice : 'en-US-AriaNeural';
  const sanitize = (text) => text.toLowerCase().replace(/[^a-z0-9_-]/g, '').replace(/\s+/g, '_').slice(0, 50);
  const filename = `${sanitize(word)}.wav`;
  const outputPath = path.join(__dirname, 'public', 'tts', filename);
  const ttsDir = path.join(__dirname, 'public', 'tts');

  // Ensure tts directory exists
  try {
    if (!fs.existsSync(ttsDir)) {
      fs.mkdirSync(ttsDir, { recursive: true });
      console.log(`Created directory: ${ttsDir}`);
    }
  } catch (err) {
    console.error(`Failed to create tts directory:`, err);
    return res.status(500).json({ error: 'Không thể tạo thư mục lưu âm thanh.', details: err.message });
  }

  // Return existing file if it exists
  if (fs.existsSync(outputPath)) {
    console.log(`File already exists: ${outputPath}`);
    return res.json({ url: `/tts/${filename}` });
  }

  try {
    const tts = new EdgeTTS({ voice: voiceToUse });
    await tts.toFile(word.trim(), outputPath);
    console.log(`TTS generated: ${outputPath}`);
    res.json({ url: `/tts/${filename}` });
  } catch (err) {
    console.error(`TTS error for ${word}:`, err);
    res.status(500).json({ error: 'Không thể tạo âm thanh.', details: err.message });
  }
});
// app.post('/pronounce/upload', upload.single('audio'), async (req, res) => {
//     const expectedWord = req.body.expected;
//     const userAudioPath = req.file.path;
//     const refAudioPath = path.join(__dirname, 'public', 'tts', `${expectedWord.toLowerCase()}.wav`);

//     if (!fs.existsSync(refAudioPath)) {
//         return res.status(400).json({ error: 'Chưa có file phát âm để so sánh.' });
//     }

//     const py = spawn('python', ['compare_audio.py', userAudioPath, refAudioPath]);
//     let output = '';
//     py.stdout.on('data', (data) => output += data.toString());
//     py.stderr.on('data', (data) => console.error('Python error:', data.toString()));

//     py.on('close', (code) => {
//         if (output.startsWith('ERROR:')) {
//             return res.status(500).json({ error: output });
//         }
//         const score = parseFloat(output);
//         return res.json({
//             score,
//             isCorrect: score > 50,
//             expected: expectedWord
//         });
//     });
// });

const { spawnSync } = require('child_process');

const processAudio = async (req, res) => {
    const expectedWord = req.body.expected?.trim().toLowerCase();
    const userAudioPath = path.resolve(req.file.path);
    const outputDir = path.resolve('./Upload');
    const baseName = path.basename(userAudioPath);
    const txtOutputPath = path.join(outputDir, `${baseName}.txt`);

    const whisperCmd = `whisper "${userAudioPath}" --language en --model base --output_format txt --output_dir "${outputDir}"`;
    console.log("🌀 Whisper command:", whisperCmd);

    exec(whisperCmd, (err, stdout, stderr) => {
        if (err) {
            console.error("❌ Whisper failed:", stderr);
            return res.status(500).json({ error: "Whisper gặp lỗi khi xử lý âm thanh." });
        }

        if (!fs.existsSync(txtOutputPath)) {
            return res.status(500).json({ error: "Không tạo được transcript từ Whisper." });
        }

        const transcript = fs.readFileSync(txtOutputPath, 'utf8').trim().toLowerCase();
        fs.unlinkSync(userAudioPath);
        fs.unlinkSync(txtOutputPath);

        const { partial_ratio } = require('fuzzball');
        const score = partial_ratio(transcript, expectedWord);

        let feedback = '';
        if (score >= 90) feedback = '🎉 Phát âm hoàn hảo!';
        else if (score >= 75) feedback = '👍 Phát âm tốt, cần chỉnh nhẹ!';
        else if (score >= 60) feedback = '🧐 Gần đúng, luyện thêm một chút.';
        else feedback = '❌ Cần luyện tập lại.';

        return res.json({
            expected: expectedWord,
            userSaid: transcript,
            isCorrect: score >= 60,
            score,
            feedback
        });
    });
};
app.post('/pronounce/upload', upload.single('audio'), (req, res) => {
  const expected = req.body.expected;
  const audioBuffer = req.file.buffer;

  // TODO: Phân tích âm thanh bằng AI hoặc mô phỏng
  // Giả lập phản hồi:
  res.json({
    expected,
    userSaid: expected, // giả định đúng
    isCorrect: true,
    score: 95,
    feedback: 'Phát âm tốt!'
  });
});
// Route xử lý upload âm thanh và kiểm tra phát âm bằng Whisper
// app.post('/pronounce/ourworld1/unit8/upload', audioUploader.single('audio'), async (req, res) => {
//   try {
//     const expected = req.body.expected;
//     const learnerName = req.body.name || 'Ẩn danh';
//     const audioPath = req.file?.path;

//     console.log('📩 File nhận được từ browser:', req.file);
//     console.log('📩 req.body.expected:', expected);
//     console.log('📩 req.body.name:', learnerName);

//     if (!audioPath || !fs.existsSync(audioPath)) {
//       return res.status(400).json({ error: '❌ File âm thanh không tồn tại hoặc không hợp lệ' });
//     }

//     console.log('📤 Gửi đến Flask:', audioPath);

//     const form = new FormData();
//     form.append('audio', fs.createReadStream(audioPath), {
//       filename: 'voice.wav',
//       contentType: 'audio/wav'
//     });
//     form.append('expected', expected);         // ✅ Gửi kèm từ cần đọc
//     form.append('name', learnerName);          // ✅ Gửi tên người học
//     const response = await fetch('http://localhost:5005/transcribe', {
//       method: 'POST',
//       body: form,
//       headers: form.getHeaders()
//     });

//     const result = await response.json();
//     fs.unlink(audioPath, () => {}); // ✅ Xoá file tạm

//     if (result.error) return res.json({ error: result.error });

//     const userSaid = result.userSaid || '';
//     const normalize = s => s.toLowerCase().replace(/[^a-z]/g, '').trim();
//     const isCorrect = result.is_correct ?? false;
//     const score = Math.round((result.similarity || 0) * 100);

//     db.run(
//       `INSERT INTO pronunciation_history (name, word, user_said, score, is_correct, timestamp)
//        VALUES (?, ?, ?, ?, ?, datetime('now'))`,
//       [learnerName, expected, userSaid, score, isCorrect ? 1 : 0],
//       err => {
//         if (err) console.error('❌ DB error:', err.message);
//       }
//     );

//     return res.json({ expected, userSaid, isCorrect, score, feedback: isCorrect ? '✅ Phát âm đúng!' : '❌ Còn sai.' });

//   } catch (err) {
//     return res.json({ error: 'Không thể kết nối đến Whisper server: ' + err.message });
//   }
// });
app.post('/pronounce/ourworld1/:unit/upload', audioUploader.single('audio'), async (req, res) => {
  const unit = req.params.unit; // unit7, unit8...
  const expected = req.body.expected;
  const learnerName = req.body.name || 'Ẩn danh';
  const audioPath = req.file?.path;

  try {
    if (!audioPath || !fs.existsSync(audioPath)) {
      return res.status(400).json({ error: '❌ File âm thanh không tồn tại hoặc không hợp lệ' });
    }

    const form = new FormData();
    form.append('audio', fs.createReadStream(audioPath), {
      filename: 'voice.wav',
      contentType: 'audio/wav'
    });
    form.append('expected', expected);
    form.append('name', learnerName);

    const response = await fetch('http://localhost:5005/transcribe', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const result = await response.json();
    fs.unlink(audioPath, () => {});

    if (result.error) return res.json({ error: result.error });

    const userSaid = result.userSaid || '';
    const normalize = s => s.toLowerCase().replace(/[^a-z]/g, '').trim();
    const isCorrect = result.is_correct ?? false;
    const score = Math.round((result.similarity || 0) * 100);

    db.run(
      `INSERT INTO pronunciation_history (name, word, user_said, score, is_correct, timestamp, unit)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
      [learnerName, expected, userSaid, score, isCorrect ? 1 : 0, unit],
      err => {
        if (err) console.error('❌ DB error:', err.message);
      }
    );

    return res.json({ expected, userSaid, isCorrect, score, unit });

  } catch (err) {
    return res.json({ error: 'Không thể kết nối đến Whisper server: ' + err.message });
  }
});

app.post('/questionanswer/upload', upload.single('audio'), processAudio);
app.get('/game/word-assemble', (req, res) => {
  const jsonFilePath = path.join(__dirname, 'Json', 'wordWithPhonetics.json');
  const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

  const random = data[Math.floor(Math.random() * data.length)];

  res.render('game_word_assemble', {
    word: random.word,
    definition: random.definitions?.[0]?.english || "",
    translation: random.definitions?.[0]?.vietnamese || "",
    phonetic_us: random.phonetic_us || "",
    level: "easy" // hoặc 'easy', 'hard' medium
  });
});
// Route cho trò chơi đoán từ qua ngữ cảnh
app.get('/game/context-clue', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const jsonFilePath = path.join(__dirname, 'Json', 'wordWithPhonetics.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

  // Chọn ngẫu nhiên một từ và câu ví dụ
  const randomWord = jsonData[Math.floor(Math.random() * jsonData.length)];
  const example = randomWord.examples[Math.floor(Math.random() * randomWord.examples.length)];
  const correctAnswer = randomWord.word;

  // Tạo 3 lựa chọn sai ngẫu nhiên từ các từ khác
  const otherWords = jsonData
    .filter(w => w.word !== correctAnswer)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(w => w.word);
  const options = [correctAnswer, ...otherWords].sort(() => Math.random() - 0.5);

  // Thay từ đúng bằng ____ trong câu ví dụ
  const question = example.english.replace(correctAnswer, '_____');

  res.render('game_context_clue', {
    question,
    options,
    correctAnswer,
    definition: randomWord.definitions[0].vietnamese,
    phonetic: randomWord.phonetic_us,
    ttsUrl: `/tts/audio/${correctAnswer.toLowerCase()}.wav`,
    user: req.session.user
  });
});

// Route lưu kết quả trò chơi
app.post('/game/context-clue/submit', (req, res) => {
  const { question, correct_answer, user_answer, is_correct } = req.body;
  const user_id = req.session.user?.id || null;

  db.run(
    `INSERT INTO quiz_results (user_id, question_text, correct_answer, user_answer, is_correct)
     VALUES (?, ?, ?, ?, ?)`,
    [user_id, question, correct_answer, user_answer, is_correct ? 1 : 0],
    (err) => {
      if (err) {
        console.error("❌ Lỗi khi lưu kết quả:", err);
        return res.status(500).json({ success: false, message: "Lỗi lưu kết quả." });
      }
      res.json({ success: true });
    }
  );
});
app.get('/game/match-word-meaning', (req, res) => {
  const jsonFilePath = path.join(__dirname, 'Json', 'wordWithPhonetics.json');
  const allWords = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

  const selected = allWords.sort(() => 0.5 - Math.random()).slice(0, 4);
  const definitions = selected.map((word, index) => ({
    text: word.definitions?.[0]?.vietnamese || "Không rõ nghĩa",
    originalIndex: index
  }));

  const shuffledDefinitions = definitions.sort(() => 0.5 - Math.random());

  res.render('matching_game', {
    words: selected,
    definitions: shuffledDefinitions
  });
});
app.get('/practice-questionanswer-Unit7_George_Robot', (req, res) => {
  const jsonFilePath = path.join('D:/nodejs/Json', 'questionanwserUnit7_George_Robot.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  res.render('Unit7_George_Robot', { words: jsonData });
});

app.get('/lesson/george-robot', (req, res) => {
  res.render('george_robot_lesson');
});
// ✅ Thêm đoạn này nếu chưa có
app.get('/hoithoai/hoithoaiunit8', (req, res) => {
  res.render('hoithoaiunit8');
});
app.get('/hoithoai/hoithoaiourworld1unit1_0', (req, res) => {
  res.render('hoithoaiourworld1unit1_0');
});
app.get('/hoithoai/hoithoaiourworld1unit1_1', (req, res) => {
  res.render('hoithoaiourworld1unit1_1');
});
// ✅ Thêm đoạn này nếu chưa có
app.get('/hoithoai/hoithoaiourworld3_unit0', (req, res) => {
  res.render('hoithoaiourworld3_unit0');
});
// ✅ Thêm đoạn này nếu chưa có
app.get('/docvaviet/docvaviet_ourworld3_unit0', (req, res) => {
  res.render('docvaviet');
});
// ✅ Thêm đoạn này nếu chưa có
app.get('/baihoc/StundentBook_Ourworld3_Unit0/hoi_va_traloi', (req, res) => {
  res.render('hoi_va_traloi');
});
// ✅ Thêm đoạn này nếu chưa có
app.get('/baihoc/StundentBook_Ourworld3_Unit0/hoi_va_traloi1', (req, res) => {
  res.render('hoi_va_traloi1');
});

app.get('/baihoc/StundentBook_Ourworld3_Unit0', (req, res) => {
  res.render('StundentBook_Ourworld3_Unit0');
});
app.get('/baihoc/StundentBook_Ourworld3_Unit1', (req, res) => {
  res.render('StundentBook_Ourworld3_Unit1');
});
app.get('/name-it-game', (req, res) => {
  res.render('name_it_game', { position: 0 });
});
app.get('/family-fun', (req, res) => {
  res.render('family_fun', { position: 0 });
});
app.get('/family-in-many-cultures', (req, res) => {
  res.render('families_in_many_cultures', { position: 0 });
});
app.get('/one-or-more', (req, res) => {
  res.render('one_or_more', { position: 0 });
});
app.get('/yes-or-no', (req, res) => {
  res.render('yes_or_no', { position: 0 });
});
app.get('/fluency-phrasing-families-in-many-cultures', (req, res) => {
  res.render('fluency_phrasing_families_in_many_cultures', { position: 0 });
});

app.get('/compare-author-purpose-families-in-many-cultures-the-world-is-your-family', (req, res) => {
  res.render('compare_author_purpose_families_in_many_cultures_the_world_is_your_family', { position: 0 });
});

app.get('/grammar-common-anddproper-nouns', (req, res) => {
  res.render('grammar_common_anddproper_nouns', { position: 0 });
});

app.get('/key-point-reading-papa-and-me', (req, res) => {
  res.render('key_point_reading_papa_and_me', { position: 0 });
});

app.get('/practice-book-level_b', (req, res) => {
  res.render('Practice_Book_Level_B', { position: 0 });
});

app.get('/grammar-proper-nouns-meet-my-family', (req, res) => {
  res.render('grammar_proper_nouns_meet_my_family', { position: 0 });
});

app.get('/reread-and-summarize-setting-chart-papa-and-me', (req, res) => {
  res.render('reread_and_summarize_setting_chart_papa_and_me', { position: 0 });
});

app.get('/fluence-intonation-papa-and-me', (req, res) => {
  res.render('fluence_intonation_papa_and_me', { position: 0 });
});

app.get('/respond-and-extend-t-chart-compare-genres', (req, res) => {
  res.render('respond_and_extend_t_chart_compare_genres', { position: 0 });
});

app.get('/grammar-proper-nouns-name-game', (req, res) => {
  res.render('grammar_proper_nouns_name_game', { position: 0 });
});

app.get('/writing-project-rubric-organization', (req, res) => {
  res.render('writing_project_rubric_organization', { position: 0 });
});

app.get('/writing-project-revise', (req, res) => {
  res.render('writing_project_revise', { position: 0 });
});

app.get('/writing-project-edit-and-proofread', (req, res) => {
  res.render('writing_project_edit_and_proofread', { position: 0 });
});

app.get('/unit-concepttmap-shoot-for-the-sun', (req, res) => {
  res.render('unit_concepttmap_shoot_for_the_sun', { position: 0 });
});

app.get('/book-level_b', (req, res) => {
  res.render('book_level_b', { position: 0 });
});
app.get('/describe-our-routine', (req, res) => {
  res.render('describe_our_routine', { position: 0 });
});

app.get('/social-studies-vocabulary-fammily-member', (req, res) => {
  res.render('social_studies_vocabulary_fammily_member', { position: 0 });
});

app.get('/thinking-map-organize-ideas-idea-web', (req, res) => {
  res.render('thinking_map_organize_ideas_idea_web', { position: 0 });
});

app.get('/academic-vocabulary-more-key-words-care', (req, res) => {
  res.render('academic_vocabulary_more_key_words_care', { position: 0 });
});

app.get('/families-in-many-cultures-by-heather-adamson', (req, res) => {
  res.render('families_in_many_cultures_by_heather_adamson', { position: 0 });
});

app.get('/think-and-respond-talk-about-it', (req, res) => {
  res.render('think_and_respond_talk_about_it', { position: 0 });
});

app.get('/word-work-identify-nouns', (req, res) => {
  res.render('word_work_identify_nouns', { position: 0 });
});

app.get('/the-world-is-your-family-by-josh-thome', (req, res) => {
  res.render('the_world_is_your_family_by_josh_thome', { position: 0 });
});

app.get('/respond-and-extend-compare-author-purpose', (req, res) => {
  res.render('respond_and_extend_compare_author_purpose', { position: 0 });
});

app.get('/grammar-and-spelling-plural-nouns', (req, res) => {
  res.render('grammar_and_spelling_plural_nouns', { position: 0 });
});
// app.get('/baihoc/phonic_Ourworld1_Unit1', (req, res) => {
//   // Hàm tạo danh sách file từ số bắt đầu đến số kết thúc
// function makeAudioFiles(start, end) {
//   return Array.from({ length: end - start + 1 }, (_, i) => {
//     const num = String(start + i).padStart(3, '0');
//     return `TR${num}.mp3`;
//   });
// }

// const lessonAudioMap = {
//   'unit1_lesson1.png': makeAudioFiles(11, 14),
//   'unit1_lesson2.png': makeAudioFiles(15, 18),
//   'unit1_lesson3.png': makeAudioFiles(19, 22),
//   'unit1_lesson4.png': makeAudioFiles(23, 26),
//   'unit1_lesson5.png': ['TR027.mp3'], // chỉ 1 file
//   'unit1_lesson6.png': makeAudioFiles(28, 30)
// };

//   const imgDir = path.join(__dirname, 'public/PhonicOurworld1');
//   const filesImg = fs.readdirSync(imgDir);
//   const imageList = filesImg
//     .filter(name => /^unit1_lesson\d+\.png$/.test(name))
//     .sort((a, b) => {
//       const aNum = parseInt(a.match(/\d+/g)[1]);
//       const bNum = parseInt(b.match(/\d+/g)[1]);
//       return aNum - bNum;
//     });

//   // Tạo danh sách lesson kèm audio tương ứng
//   const lessons = imageList.map(image => ({
//     image,
//     audios: lessonAudioMap[image] || []
//   }));

//   res.render('BaihocOurWorld1_Unit1', { lessons });
// });

// app.get('/baihoc/phonic_Ourworld1_Unit7', (req, res) => {
  
//   res.render('BaihocOurWorld1_Unit7');
// });
// app.get('/baihoc/phonic_Ourworld1_Unit8', (req, res) => {
  
//   res.render('BaihocOurWorld1_Unit8');
// });
// app.get('/baihoc/phonic_Ourworld1_Unit9', (req, res) => {
//   // Hàm tạo danh sách file từ số bắt đầu đến số kết thúc
//   function makeAudioFiles(start, end) {
//     return Array.from({ length: end - start + 1 }, (_, i) => {
//       const num = String(start + i).padStart(3, '0');
//       return `TR${num}.mp3`;
//     });
//   }

//   const lessonAudioMap = {
//     'unit9_lesson1.png': makeAudioFiles(173, 176),
//     'unit9_lesson2.png': makeAudioFiles(177, 180),
//     'unit9_lesson3.png': makeAudioFiles(181, 184),
//     'unit9_lesson4.png': makeAudioFiles(185, 188),
//     'unit9_lesson5.png': ['TR190.mp3'],
//     'unit9_lesson6.png': makeAudioFiles(191, 193)
//   };

//   const imgDir = path.join(__dirname, 'public/PhonicOurworld1');
//   const filesImg = fs.readdirSync(imgDir);
//   const imageList = filesImg
//     .filter(name => /^unit9_lesson\d+\.png$/.test(name)) // SỬA CHỖ NÀY
//     .sort((a, b) => {
//       const aNum = parseInt(a.match(/\d+/g)[1]);
//       const bNum = parseInt(b.match(/\d+/g)[1]);
//       return aNum - bNum;
//     });

//   // Tạo danh sách lesson kèm audio tương ứng
//   const lessons = imageList.map(image => ({
//     image,
//     audios: lessonAudioMap[image] || []
//   }));

//   res.render('BaihocOurWorld1_Unit9', { lessons });
// });
app.get('/baihoc/phonic_Ourworld1/:unit', (req, res) => {
  const unit = req.params.unit; // unit1, unit7, unit8, unit9
  const unitNumber = unit.replace('unit', ''); // ví dụ "1", "7", "8", "9"
  const imgDir = path.join(__dirname, 'public/PhonicOurworld1');

  function makeAudioFiles(start, end) {
    return Array.from({ length: end - start + 1 }, (_, i) => {
      const num = String(start + i).padStart(3, '0');
      return `TR${num}.mp3`;
    });
  }

  let lessonAudioMap = {};

  if (unit === "unit1") {
    lessonAudioMap = {
      'unit1_lesson1.png': makeAudioFiles(11, 14),
      'unit1_lesson2.png': makeAudioFiles(15, 18),
      'unit1_lesson3.png': makeAudioFiles(19, 22),
      'unit1_lesson4.png': makeAudioFiles(23, 26),
      'unit1_lesson5.png': ['TR027.mp3'],
      'unit1_lesson6.png': makeAudioFiles(28, 30)
    };
  }else if (unit === "unit7") {
    lessonAudioMap = {
      'unit7_lesson1.png': makeAudioFiles(133, 136),
      'unit7_lesson2.png': makeAudioFiles(137, 140),
      'unit7_lesson3.png': makeAudioFiles(141, 144),
      'unit7_lesson4.png': makeAudioFiles(145, 148),
      'unit7_lesson5.png': ['TR149.mp3'],
      'unit7_lesson6.png': makeAudioFiles(150, 152)
    };
  }else if (unit === "unit8") {
    lessonAudioMap = {
      'unit8_lesson1.png': makeAudioFiles(153, 156),
      'unit8_lesson2.png': makeAudioFiles(157, 159),
      'unit8_lesson3.png': makeAudioFiles(161, 164),
      'unit8_lesson4.png': makeAudioFiles(165, 168),
      'unit8_lesson5.png': ['TR169.mp3'],
      'unit8_lesson6.png': makeAudioFiles(170, 172)
    };
  }else if (unit === "unit9") {
    lessonAudioMap = {
      'unit9_lesson1.png': makeAudioFiles(173, 176),
      'unit9_lesson2.png': makeAudioFiles(177, 180),
      'unit9_lesson3.png': makeAudioFiles(181, 184),
      'unit9_lesson4.png': makeAudioFiles(185, 188),
      'unit9_lesson5.png': ['TR190.mp3'],
      'unit9_lesson6.png': makeAudioFiles(191, 193)
    };
  }

  // Với unit7 hoặc unit8, không có lesson
  // if (unit === "unit7" ) {
  //   return res.render("baihoc_phonic_ourworld1", {
  //     unitNumber,
  //     lessons: []
  //   });
  // }

  // Với unit1 hoặc unit9
  const unitPattern = new RegExp(`^${unit}_lesson\\d+\\.png$`);
  const filesImg = fs.readdirSync(imgDir);
  const imageList = filesImg
    .filter(name => unitPattern.test(name))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/\d+/g)[1]);
      const bNum = parseInt(b.match(/\d+/g)[1]);
      return aNum - bNum;
    });

  const lessons = imageList.map(image => ({
    image,
    audios: lessonAudioMap[image] || []
  }));

  res.render("baihoc_phonic_ourworld1", {
    unitNumber,
    lessons
  });
});

app.get('/ourworld3/unit0', (req, res) => {
  const wordPath = path.join('D:/nodejs/Json', 'ourworld3_unit0.json');
  const rawData = fs.readFileSync(wordPath, 'utf-8');
  const wordData = JSON.parse(rawData);

  const audioDir = path.join(__dirname, 'public/audio');
  const files = fs.readdirSync(audioDir);
  const audioList = files
    .filter(name => name.endsWith('.mp3') && name.startsWith('S3'))
    .map(name => {
      const match = name.match(/ow2e_(sb3|wb3)_ame_0_(\d+)_?/);
      if (!match) return null;

      const book = match[1];
      const trackNum = match[2];
      const track = `TR${trackNum.padStart(2, '0')}`;
      const label = `${book} – Unit 0 – ${track}`;
      const trackNumber = parseInt(trackNum, 10);

      return { name, label, trackNumber, book };
    })
    .filter(item =>
      item &&
      item.book === 'sb3' &&
      ['03', '04', '05'].includes(String(item.trackNumber).padStart(2, '0'))
    )
    .sort((a, b) => a.trackNumber - b.trackNumber);

  res.render('seasons_and_months', {
    data: wordData,
    audioList
  });
});
app.get('/list-audio', (req, res) => {
  const audioDir = path.join(__dirname, 'public/audio');
  const requestedUnit = req.query.unit ? parseInt(req.query.unit, 10) : null;

  fs.readdir(audioDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Không đọc được thư mục audio' });

    const audioFiles = files
      .filter(name => name.endsWith('.mp3'))
      .map(name => {
        let book = '', unit = 0, trackNum = 0, title = '', label = '';

        const matchSimple = name.match(/ourworld3_unit(\d+)_tr(\d+)\.mp3$/);
        const matchBook = name.match(/ow2e_(sb3|wb3)_ame_(\d+)_0*(\d+)(?:_\d+)?\.orig\.mp3$/);  // ✅ Updated
        const matchRdr = name.match(/ow2e_rdr_ame_l3u(\d+)_([A-Za-z_]+)_TR_(\d+)_\d+\.orig\.mp3$/);

        if (matchSimple) {
          unit = parseInt(matchSimple[1], 10);
          trackNum = parseInt(matchSimple[2], 10);
          book = 'ourworld3';
          label = `${book} – Unit ${unit} – TR${String(trackNum).padStart(2, '0')}`;
        } else if (matchBook) {
          book = matchBook[1];
          unit = parseInt(matchBook[2], 10);
          trackNum = parseInt(matchBook[3], 10);
          label = `${book} – Unit ${unit} – TR${String(trackNum).padStart(2, '0')}`;
        } else if (matchRdr) {
          unit = parseInt(matchRdr[1], 10);
          title = matchRdr[2].replace(/_/g, ' ');
          trackNum = parseInt(matchRdr[3], 10);
          book = 'rdr';
          label = `${book} – Unit ${unit} – ${title} – TR${String(trackNum).padStart(2, '0')}`;
        } else {
          console.log(`❌ Không khớp tên file: ${name}`);
          return null;
        }

        return { name, label, book, unit, trackNum };
      })
      .filter(item => item !== null)
      .filter(item => requestedUnit === null || item.unit === requestedUnit)
      .sort((a, b) => {
        if (a.book !== b.book) return a.book.localeCompare(b.book);
        if (a.unit !== b.unit) return a.unit - b.unit;
        return a.trackNum - b.trackNum;
      });

    res.json(audioFiles);
  });
});
app.get('/reach_for_reading_grade1_volume1/:week', (req, res) => {
  const weekParam = req.params.week; // ví dụ: "1"
  const key = `week${weekParam}`;
  const fileName = `reachforreading_week${weekParam}.json`;
  const dataFile = path.join(__dirname, 'Json', fileName);

  fs.readFile(dataFile, 'utf8', (err, jsonData) => {
    if (err) {
      console.error('❌ Không tìm thấy file:', dataFile);
      return res.status(404).send('❌ Không tìm thấy file dữ liệu JSON');
    }

    try {
      const parsed = JSON.parse(jsonData);

      const words = parsed[key];
      if (!Array.isArray(words)) {
        return res.status(500).send(`❌ Dữ liệu không hợp lệ cho key "${key}"`);
      }

      const weeks = Object.keys(parsed); // ví dụ: ["week1"]
      const selectedWeek = key;

      res.render('reach_for_reading_grade1_volume1_week1', {
        weeks,
        selectedWeek,
        words
      });

    } catch (err) {
      console.error('❌ Lỗi phân tích JSON:', err);
      return res.status(500).send('❌ Lỗi đọc JSON');
    }
  });
});
app.get('/reach_for_reading_grade1_volume1/1/find_a_hat', (req, res) => {
  
  res.render('reach_for_reading_grade1_volume1_week1_find_a_hat');
});

app.get('/reach_for_reading_grade1_volume1/1/use_nouns', (req, res) => {
  
  res.render('reach_for_reading_grade1_volume1_week1_use_nouns');
});

app.get('/reach_for_reading_grade1_volume1/1/grammar_and_writing_write_nouns', (req, res) => {
  
  res.render('reach_for_reading_grade1_volume1_week1_grammar_and_writing_write_nouns');
});

app.get('/reach_for_reading_grade1_volume1/1/vocabulary_yes_or_no', (req, res) => {
  
  res.render('reach_for_reading_grade1_volume1_week1_vocabulary_yes_or_no');
});

// app.get('/reach_for_reading_grade1_volume1/1/my_m_book', (req, res) => {
  
//   res.render('reach_for_reading_grade1_volume1_week1_my_m_book');
// });
// app.get('/reach_for_reading_grade1_volume1/1/my_s_book', (req, res) => {
  
//   res.render('reach_for_reading_grade1_volume1_week1_my_s_book');
// });
// app.get('/reach_for_reading_grade1_volume1/1/my_h_book', (req, res) => {
  
//   res.render('reach_for_reading_grade1_volume1_week1_my_h_book');
// });
app.get('/reach_for_reading_grade1_volume1/1/my_:char_book', (req, res) => {
  const charParam = req.params.char_book; // Get the dynamic parameter (e.g., 'h_book')
  const fileName = `my_${charParam}.json`; // Construct filename (e.g., 'my_h_book.json')
  const dataFile = path.join(__dirname, 'Json', fileName);

  fs.readFile(dataFile, 'utf8', (err, jsonData) => {
    if (err) {
      console.error('❌ Không tìm thấy file:', dataFile);
      return res.status(404).send('❌ Không tìm thấy file dữ liệu JSON');
    }

    try {
      const parsed = JSON.parse(jsonData);
      const letter = parsed.letter; // Extract letter from JSON
      const words = parsed.words; // Extract words array from JSON

      if (!Array.isArray(words)) {
        return res.status(500).send('❌ Dữ liệu không hợp lệ cho key "words"');
      }

      res.render('reach_for_reading_grade1_volume1_week1_my_book', {
        letter,
        words
      });
    } catch (err) {
      console.error('❌ Lỗi phân tích JSON:', err);
      return res.status(500).send('❌ Lỗi đọc JSON');
    }
  });
});
// app.get('/eating_up_and_diving_in_page3', (req, res) => {
//   const jsonFilePath = path.join('D:/nodejs/Json', 'learn_high_frequency_words_page3.json');
//   const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

//   // Danh sách câu muốn hiển thị (theo sách)
//   const selectedSentences = [
//     "1 This fun place fits into a case. Nơi vui chơi này nằm gọn trong một chiếc hộp.",
//     "2 Lots of fleas once played here. Ngày xưa có rất nhiều bọ chét chơi ở đây.",
//     "3 Just a few of these cases are left. Chỉ còn lại một vài chiếc hộp như thế này.",
//     "4 Hold a lens to make the fleas look big. Hãy cầm kính lúp để nhìn bọ chét to lên.",
//     "5 But keep your head and hands away. Nhưng hãy giữ đầu và tay tránh xa.",
//     "6 You do not want to be flea food! Bạn không muốn trở thành thức ăn của bọ chét đâu!"
//   ];

//   // Lọc dữ liệu để chỉ lấy từ liên quan đến các câu trên
//   const filteredWords = jsonData.eating_up_and_diving_in.filter(item =>
//     selectedSentences.includes(item.source_phrase)
//   );

//   res.render('eating_up_and_diving_in_page3', {
//     words: filteredWords,
//     sentences: selectedSentences
//   });
// });
app.get('/eating_up_and_diving_in_page3', (req, res) => {
  
  const jsonFilePath = path.join('D:/nodejs/Json', 'learn_high_frequency_words_page3.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

  // Lấy danh sách câu duy nhất
  const uniqueSentences = [];
  jsonData.eating_up_and_diving_in.forEach(item => {
    if (!uniqueSentences.find(s => s.source_phrase === item.source_phrase)) {
      uniqueSentences.push({
        source_phrase: item.source_phrase,
        translation: item.translation || ""
      });
    }
  });

  res.render('eating_up_and_diving_in_page3', {
    words: jsonData.eating_up_and_diving_in,
    sentences: uniqueSentences
  });
});
app.get('/blood_suckers_by_Deanne_W_Kells', (req, res) => {
  const fileName = `blood_suckers_by_Deanne_W_Kells.json`;
  const dataFile = path.join(__dirname, 'Json', fileName);

  

  fs.readFile(dataFile, 'utf8', (err, jsonData) => {
    if (err) {
      console.error('❌ Không tìm thấy file:', dataFile);
      return res.status(404).send('❌ Không tìm thấy file dữ liệu JSON');
    }

    try {
      const parsed = JSON.parse(jsonData);
      const words = parsed["blood_suckers"];

      if (!words || !Array.isArray(words)) {
        return res.status(500).send(`❌ Dữ liệu không hợp lệ: không tìm thấy danh sách từ`);
      }

      res.render('blood_suckers_by_Deanne_W_Kells', { words });
    } catch (err) {
      console.error('❌ Lỗi JSON:', err);
      return res.status(500).send('❌ Lỗi đọc JSON');
    }
  });
});

// 🟢 Hàm đọc JSON
function loadWordsWithEEEAIE(callback) {
  const jsonFile = path.join(__dirname, 'Json', 'words_with_ee_ea_ie_done.json');
  fs.readFile(jsonFile, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ JSON load error:', err);
      return callback(err);
    }
    try {
      const parsed = JSON.parse(data);
      const words = parsed["words with ee,ea,ie"];
      if (!words || !Array.isArray(words)) {
        return callback(new Error('❌ Dữ liệu không hợp lệ: không tìm thấy danh sách từ'));
      }
      callback(null, words);
    } catch (err) {
      console.error('❌ JSON parse error:', err);
      return callback(err);
    }
  });
}
app.get('/words_with_ee_ea_ie', (req, res) => {
  loadWordsWithEEEAIE((err, words) => {
    if (err) return res.status(500).send(err.message);
    res.render('words_with_ee_ea_ie', { words });
  });
});
app.get('/game_words_with_ee_ea_ie_done', (req, res) => {
  loadWordsWithEEEAIE((err, words) => {
    if (err) return res.status(500).send(err.message);
    res.render('game_words_with_ee_ea_ie_done', { words });
  });
});

app.get('/game_blood_suckers_by_Deanne_W_Kells', (req, res) => {
  const jsonFile = path.join(__dirname, 'Json', 'blood_suckers_by_Deanne_W_Kells.json');
  fs.readFile(jsonFile, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ JSON load error:', err);
      return res.status(500).send('❌ Error reading JSON');
    }
    try {
      const parsed = JSON.parse(data);
      const words = parsed["blood_suckers"];
      console.log("🟢 Words loaded:", words);
      res.render('game_blood_suckers_by_Deanne_W_Kells', { words });
    } catch (err) {
      console.error('❌ JSON parse error:', err);
      res.status(500).send('❌ Invalid JSON format');
    }
  });
});
app.get('/book_eating_up_and_diving_in', (req, res) => {
  
  res.render('book_eating_up_and_diving_in');
});
// Route Game
app.get("/game_mean_blood_suckers_by_Deanne_W_Kells", (req, res) => {
  const jsonFile = path.join(__dirname, "Json", "blood_suckers_by_Deanne_W_Kells.json");

  fs.readFile(jsonFile, "utf8", (err, data) => {
    if (err) {
      console.error("❌ JSON load error:", err);
      return res.status(500).send("❌ Error reading JSON");
    }
    try {
      console.log("🟢 JSON file path:", jsonFile);
      console.log("🟢 Raw JSON data:", data);

      const parsed = JSON.parse(data);
      console.log("🟢 Parsed data:", parsed);

      const words = parsed["blood_suckers"].map(item => ({
        word_text: item.word_text,
        meaning_en: item.meaning_en
      }));
      console.log("🟢 Final words array:", words);

      res.render("game_mean_blood_suckers_by_Deanne_W_Kells", { words });
    } catch (err) {
      console.error("❌ JSON parse error:", err);
      res.status(500).send("❌ Invalid JSON format");
    }
  });
});

app.get("/game_pronounce_sentences", (req, res) => {
  const jsonFile = path.join(__dirname, "Json", "learn_high_frequency_words_page3.json");
  fs.readFile(jsonFile, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error reading JSON");
    try {
      const parsed = JSON.parse(data);
      const uniqueSentences = [];
      parsed.eating_up_and_diving_in.forEach(item => {
        if (!uniqueSentences.find(s => s.source_phrase === item.source_phrase)) {
          uniqueSentences.push({ source_phrase: item.source_phrase });
        }
      });
      res.render("game_pronounce_sentences", { sentences: uniqueSentences });
    } catch (err) {
      res.status(500).send("Invalid JSON format");
    }
  });
});
app.get("/game_pronounce_sentences_blood_suckers_by_Deanne_W_Kells", (req, res) => {
  const jsonFile = path.join(__dirname, "Json", "blood_suckers_by_Deanne_W_Kells.json");
  fs.readFile(jsonFile, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error reading JSON");
    try {
      const parsed = JSON.parse(data);
      const uniqueSentences = [];
      parsed.blood_suckers.forEach(item => {
        if (!uniqueSentences.find(s => s.source_phrase === item.source_phrase)) {
          uniqueSentences.push({ source_phrase: item.source_phrase });
        }
      });
      res.render("game_pronounce_sentences_blood_suckers_by_Deanne_W_Kells", { sentences: uniqueSentences });
    } catch (err) {
      res.status(500).send("Invalid JSON format");
    }
  });
});
// app.get('/words_with_ee_ea_ie_1', (req, res) => {
//   const fileName = `words_with_ee_ea_ie_1_done.json`; // Đổi lại tên file JSON đúng
//   const dataFile = path.join(__dirname, 'Json', fileName);

//   console.log("🟢 Đang truy cập:", dataFile);

//   fs.readFile(dataFile, 'utf8', (err, jsonData) => {
//     if (err) {
//       console.error('❌ Không tìm thấy file:', dataFile);
//       return res.status(404).send('❌ Không tìm thấy file dữ liệu JSON');
//     }

//     try {
//       const parsed = JSON.parse(jsonData);
//       const words = parsed["words_with_ee_ea_ie_1"];

//       if (!words || !Array.isArray(words)) {
//         return res.status(500).send(`❌ Dữ liệu không hợp lệ: không tìm thấy danh sách từ`);
//       }

//       res.render('words_with_ee_ea_ie_1', { words });
//     } catch (err) {
//       console.error('❌ Lỗi JSON:', err);
//       return res.status(500).send('❌ Lỗi đọc JSON');
//     }
//   });
// });
// 🟢 Hàm đọc JSON
function loadWordsWithEEEAIE1(callback) {
  const jsonFile = path.join(__dirname, 'Json', 'words_with_ee_ea_ie_1_done.json');
  fs.readFile(jsonFile, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ JSON load error:', err);
      return callback(err);
    }
    try {
      const parsed = JSON.parse(data);
      const words = parsed["words_with_ee_ea_ie_1"];
      if (!words || !Array.isArray(words)) {
        return callback(new Error('❌ Dữ liệu không hợp lệ: không tìm thấy danh sách từ'));
      }
      callback(null, words);
    } catch (err) {
      console.error('❌ JSON parse error:', err);
      return callback(err);
    }
  });
}
app.get('/words_with_ee_ea_ie_1', (req, res) => {
  loadWordsWithEEEAIE1((err, words) => {
    if (err) return res.status(500).send(err.message);
    res.render('words_with_ee_ea_ie_1', { words });
  });
});
app.get('/game_words_with_ee_ea_ie_1', (req, res) => {
  loadWordsWithEEEAIE1((err, words) => {
    if (err) return res.status(500).send(err.message);
    res.render('game_words_with_ee_ea_ie_1', { words });
  });
});
// 🟢 Hàm đọc JSON
function loadWordsWitheding(callback) {
  const jsonFile = path.join(__dirname, 'Json', 'endings_ed_ing_done.json');
  fs.readFile(jsonFile, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ JSON load error:', err);
      return callback(err);
    }
    try {
      const parsed = JSON.parse(data);
      const words = parsed["endings_ed_ing"];
      if (!words || !Array.isArray(words)) {
        return callback(new Error('❌ Dữ liệu không hợp lệ: không tìm thấy danh sách từ'));
      }
      callback(null, words);
    } catch (err) {
      console.error('❌ JSON parse error:', err);
      return callback(err);
    }
  });
}
app.get('/words_endings_ed_ing', (req, res) => {
  loadWordsWitheding((err, words) => {
    if (err) return res.status(500).send(err.message);
    res.render('words_endings_ed_ing', { words });
  });
});
app.get('/game_words_endings_ed_ing', (req, res) => {
  loadWordsWitheding((err, words) => {
    if (err) return res.status(500).send(err.message);
    res.render('game_words_endings_ed_ing', { words });
  });
});

// 🟢 Hàm đọc JSON
function loadWordsWithPondAnimals(callback) {
  const jsonFile = path.join(__dirname, 'Json', 'pond_animals_done.json');
  fs.readFile(jsonFile, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ JSON load error:', err);
      return callback(err);
    }
    try {
      const parsed = JSON.parse(data);
      const words = parsed["pond_animals"];
      if (!words || !Array.isArray(words)) {
        return callback(new Error('❌ Dữ liệu không hợp lệ: không tìm thấy danh sách từ'));
      }
      callback(null, words);
    } catch (err) {
      console.error('❌ JSON parse error:', err);
      return callback(err);
    }
  });
}
// Route để render trang pond_animals_done
app.get('/pond_animals_done', (req, res) => {
  loadWordsWithPondAnimals((err, words) => {
    if (err) {
      return res.status(500).send('Lỗi khi tải dữ liệu JSON');
    }

    // Lấy danh sách câu duy nhất
    const uniqueSentences = [];
    words.forEach(item => {
      if (item.source_phrase && !uniqueSentences.find(s => s.source_phrase === item.source_phrase)) {
        uniqueSentences.push({
          source_phrase: item.source_phrase,
          translation: item.translation || ""
        });
      }
    });

    res.render('pond_animals_done', {
      words: words,
      sentences: uniqueSentences
    });
  });
});
app.get("/game_pronounce_sentences_pond_animals", (req, res) => {
  loadWordsWithPondAnimals((err, words) => {
    if (err) {
      return res.status(500).send('Lỗi khi tải dữ liệu JSON');
    }

    // Lấy danh sách câu duy nhất
    const uniqueSentences = [];
    words.forEach(item => {
      if (item.source_phrase && !uniqueSentences.find(s => s.source_phrase === item.source_phrase)) {
        uniqueSentences.push({
          source_phrase: item.source_phrase,
          translation: item.translation || ""
        });
      }
    });

    res.render('game_pronounce_sentences_pond_animals', {
      words: words,
      sentences: uniqueSentences
    });
  });
});
app.get('/pond_life', (req, res) => {
  const fileName = `pond_life_done.json`;
  const dataFile = path.join(__dirname, 'Json', fileName);

  

  fs.readFile(dataFile, 'utf8', (err, jsonData) => {
    if (err) {
      console.error('❌ Không tìm thấy file:', dataFile);
      return res.status(404).send('❌ Không tìm thấy file dữ liệu JSON');
    }

    try {
      const parsed = JSON.parse(jsonData);
      const words = parsed["pond_life"];

      if (!words || !Array.isArray(words)) {
        return res.status(500).send(`❌ Dữ liệu không hợp lệ: không tìm thấy danh sách từ`);
      }

      res.render('pond_life', { words });
    } catch (err) {
      console.error('❌ Lỗi JSON:', err);
      return res.status(500).send('❌ Lỗi đọc JSON');
    }
  });
});
app.get("/game_pronounce_sentences_pond_life", (req, res) => {
  const jsonFile = path.join(__dirname, "Json", "pond_life_done.json");
  fs.readFile(jsonFile, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error reading JSON");
    try {
      const parsed = JSON.parse(data);
      const uniqueSentences = [];
      parsed.pond_life.forEach(item => {
        if (!uniqueSentences.find(s => s.source_phrase === item.source_phrase)) {
          uniqueSentences.push({ source_phrase: item.source_phrase });
        }
      });
      res.render("game_pronounce_sentences_pond_life", { sentences: uniqueSentences });
    } catch (err) {
      res.status(500).send("Invalid JSON format");
    }
  });
});
app.get('/game_pronounce_sentences_pond_life_image', (req, res) => {
  const jsonFile = path.join(__dirname, 'Json', 'pond_life_done.json');
  fs.readFile(jsonFile, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ JSON load error:', err);
      return res.status(500).send('❌ Error reading JSON');
    }
    try {
      const parsed = JSON.parse(data);
      const words = parsed["pond_life"];
      console.log("🟢 Words loaded:", words);
      res.render('game_pronounce_sentences_pond_life_image', { words });
    } catch (err) {
      console.error('❌ JSON parse error:', err);
      res.status(500).send('❌ Invalid JSON format');
    }
  });
});
// Route Game
app.get("/game_mean_pond_life", (req, res) => {
  const jsonFile = path.join(__dirname, "Json", "pond_life_done.json");

  fs.readFile(jsonFile, "utf8", (err, data) => {
    if (err) {
      console.error("❌ JSON load error:", err);
      return res.status(500).send("❌ Error reading JSON");
    }
    try {
      console.log("🟢 JSON file path:", jsonFile);
      console.log("🟢 Raw JSON data:", data);

      const parsed = JSON.parse(data);
      console.log("🟢 Parsed data:", parsed);

      const words = parsed["pond_life"].map(item => ({
        word_text: item.word_text,
        meaning_en: item.meaning_en
      }));
      console.log("🟢 Final words array:", words);

      res.render("game_mean_pond_life", { words });
    } catch (err) {
      console.error("❌ JSON parse error:", err);
      res.status(500).send("❌ Invalid JSON format");
    }
  });
});
//===================ghi điểm=====================
app.post('/api/score', (req, res) => {
  const { username, score, totalTime } = req.body;
  const user_id = req.session.user?.id || null;

  if (!username || score == null || totalTime == null) {
    return res.status(400).json({ error: "Thiếu thông tin" });
  }

  db.run(`
    INSERT INTO game_scores (user_id, username, score, total_time)
    VALUES (?, ?, ?, ?)
  `, [user_id, username, score, totalTime], function (err) {
    if (err) {
      console.error("❌ Lỗi ghi điểm:", err);
      return res.status(500).json({ error: "Không thể lưu điểm." });
    }
    res.json({ success: true, id: this.lastID });
  });
});
// 🟢 Hàm đọc JSON
function loadWordsWithpracticeeding(callback) {
  const jsonFile = path.join(__dirname, 'Json', 'practice_endings_ed_ing_done.json');
  fs.readFile(jsonFile, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ JSON load error:', err);
      return callback(err);
    }
    try {
      const parsed = JSON.parse(data);
      const words = parsed["practice_endings_ed_ing"];
      if (!words || !Array.isArray(words)) {
        return callback(new Error('❌ Dữ liệu không hợp lệ: không tìm thấy danh sách từ'));
      }
      callback(null, words);
    } catch (err) {
      console.error('❌ JSON parse error:', err);
      return callback(err);
    }
  });
}
app.get('/practice_endings_ed_ing', (req, res) => {
  loadWordsWithpracticeeding((err, words) => {
    if (err) return res.status(500).send(err.message);
    res.render('practice_endings_ed_ing', { words });
  });
});
app.get('/game_practice_endings_ed_ing', (req, res) => {
  loadWordsWithpracticeeding((err, words) => {
    if (err) return res.status(500).send(err.message);
    res.render('game_practice_endings_ed_ing', { words });
  });
});

// 🟢 Hàm đọc JSON
function loadWordsWithreachforreading_week1(callback) {
  const jsonFile = path.join(__dirname, 'Json', 'reachforreading_week1.json');
  fs.readFile(jsonFile, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ JSON load error:', err);
      return callback(err);
    }
    try {
      const parsed = JSON.parse(data);
      const words = parsed["week1"];
      if (!words || !Array.isArray(words)) {
        return callback(new Error('❌ Dữ liệu không hợp lệ: không tìm thấy danh sách từ'));
      }
      callback(null, words);
    } catch (err) {
      console.error('❌ JSON parse error:', err);
      return callback(err);
    }
  });
}
app.get('/game_practice_reachforreading_week1', (req, res) => {
  loadWordsWithreachforreading_week1((err, words) => {
    if (err) return res.status(500).send(err.message);
    res.render('game_practice_reachforreading_week1', { words });
  });
});
//============API lấy leaderboard=====================
// ✅ Route trả về bảng xếp hạng (TOP 10 người chơi)
app.get('/api/leaderboard', (req, res) => {
  db.all(`
    SELECT username, score, total_time, created_at
    FROM game_scores
    ORDER BY score DESC, total_time ASC
    LIMIT 10
  `, (err, rows) => {
    if (err) {
      console.error("❌ Lỗi lấy bảng xếp hạng:", err);
      return res.status(500).json({ error: "Không thể lấy bảng xếp hạng" });
    }
    res.json({ leaderboard: rows });
  });
});

// Trang chủ: Danh sách bài học
app.get('/lesson/unit8', (req, res) => {
  res.render('index', { lessons: phonicsData.lessons });
});

// Trang bài học
app.get('/lesson/:lessonId', (req, res) => {
  const lesson = phonicsData.lessons.find(l => l.lesson === parseInt(req.params.lessonId));
  if (!lesson) return res.status(404).send('Lesson not found');
  res.render('lesson', { lesson });
});

// Trang hoạt động
app.get('/lesson/:lessonId/activity/:step', (req, res) => {
  const lesson = phonicsData.lessons.find(l => l.lesson === parseInt(req.params.lessonId));
  const activity = lesson.activities.find(a => a.step === parseInt(req.params.step));
  if (!activity) return res.status(404).send('Activity not found');
  res.render('activity', { lesson, activity });
});
// ========== Khởi động server ==========
// function getLocalIP() {
//   const interfaces = os.networkInterfaces();
//   for (const name of Object.keys(interfaces)) {
//     for (const iface of interfaces[name]) {
//       if (iface.family === 'IPv4' && !iface.internal) {
//         return iface.address;
//       }
//     }
//   }
//   return 'localhost';
// }

// const ip = getLocalIP();
const port = 5000;
// app.listen(port, '0.0.0.0', () => {
//   console.log(`Server running at http://${ip}:${port}`);
// });

app.listen(5000, () => {
  console.log('✅ Server chạy tại http://localhost:5000');
});

//const port = 3000;
// Lắng nghe trên tất cả các IP của máy
// app.listen(port, '0.0.0.0', () => {
//   console.log(`Server running at http://0.0.0.0:${port}`);
// });

// Debug CSDL
db.all("SELECT * FROM videos", (err, rows) => {
  if (err) {
    console.error("Lỗi truy vấn:", err);
    return res.send("Lỗi khi lấy dữ liệu video.");
  }
  
});