-- Thêm cột is_archived vào bảng expenses để hỗ trợ chức năng "Xóa mềm"
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Cập nhật logic: Nếu đang hiển thị các khoản chi trong Lịch sử chi, 
-- có thể bạn sẽ muốn lọc thêm điều kiện `is_archived = false` ở các truy vấn SELECT, 
-- nhưng hiện tại nó sẽ tự động nhận là false cho các giao dịch cũ.
