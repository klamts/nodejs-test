import sqlite3
import os

# Đường dẫn đến thư mục video và CSDL
video_folder = r"D:\nodejs\video"
db_path = r"D:\nodejs\lms_demo.sqlite"  # Đảm bảo đúng file đang được Express sử dụng

# Kết nối CSDL
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# ✅ Tạo bảng 'videos' nếu chưa tồn tại
cursor.execute("""
CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    path TEXT,
    url TEXT,
    subject_id INTEGER
)
""")
conn.commit()
print("✅ Đã kiểm tra hoặc tạo bảng 'videos'.")
# Thêm cột role vào bảng users (nếu chưa có)
#cursor.execute("ALTER TABLE users ADD COLUMN role TEXT")

cursor.execute("ALTER TABLE videos ADD COLUMN path TEXT")
# ✅ Tạo bảng 'users' nếu chưa tồn tại
cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    role TEXT
)
""")
conn.commit()
print("✅ Đã kiểm tra hoặc tạo bảng 'users'.")

# ✅ Thêm người dùng mẫu
cursor.execute("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)",
               ("tester01", "123456", "student"))
cursor.execute("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)",
               ("admin01", "admin123", "admin"))
conn.commit()
print("✅ Đã thêm user tester01 và admin01 (nếu chưa có).")

# ✅ Lấy danh sách video .mp4 trong thư mục
videos = [f for f in os.listdir(video_folder) if f.lower().endswith('.mp4')]
videos.sort()

# ✅ Thêm từng video vào bảng 'videos'
for index, filename in enumerate(videos, start=1):
    title = f"english{index}"
    path = filename  # chỉ lưu tên file, ví dụ: dialogue_001.mp4
    url = f"/video/{filename}"  # đường dẫn tĩnh để phát video
    subject_id = 1  # bạn có thể thay đổi theo môn học

    cursor.execute("INSERT INTO videos (title, path, url, subject_id) VALUES (?, ?, ?, ?)",
                   (title, path, url, subject_id))
    print(f"➕ Thêm video: {title} – {path}")

# ✅ Lưu thay đổi
conn.commit()

# ✅ Kiểm tra lại CSDL
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("\n📦 Danh sách bảng:", cursor.fetchall())

cursor.execute("PRAGMA table_info(videos)")
print("\n📋 Cấu trúc bảng 'videos':")
for column in cursor.fetchall():
    print(column)

cursor.execute("SELECT * FROM videos")
print("\n📺 Danh sách video đã thêm:")
for row in cursor.fetchall():
    print(row)

# Kiểm tra bảng 'users'
cursor.execute("SELECT * FROM users")
print("\n👤 Danh sách users:")
for row in cursor.fetchall():
    print(row)

# Đóng kết nối
conn.close()
