import sqlite3

# Đường dẫn đến CSDL
db_path = r"D:\nodejs\database.sqlite"

# Kết nối CSDL
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Tên người dùng cần cấp quyền (ví dụ: tester01)
username = 'tester01'

# Lấy id của người dùng từ bảng users
cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
user_id = cursor.fetchone()

if user_id:
    user_id = user_id[0]
    print(f"✅ Người dùng '{username}' có id: {user_id}")

    # Lấy tất cả video từ bảng videos (có thể chọn các video thuộc môn học cụ thể)
    cursor.execute("SELECT id FROM videos WHERE subject_id = 1")  # Ví dụ cho môn học English với subject_id = 1
    videos = cursor.fetchall()

    if videos:
        # Thêm quyền cho người dùng xem các video này
        for video in videos:
            video_id = video[0]
            cursor.execute("INSERT INTO user_videos (user_id, video_id) VALUES (?, ?)", (user_id, video_id))
            print(f"➕ Cấp quyền xem video ID {video_id} cho người dùng '{username}'.")

        # Lưu thay đổi vào CSDL
        conn.commit()
        print("✅ Cấp quyền xem video thành công!")
    else:
        print("❌ Không tìm thấy video nào với subject_id = 1.")
else:
    print("❌ Người dùng không tồn tại.")

# Đóng kết nối
conn.close()
