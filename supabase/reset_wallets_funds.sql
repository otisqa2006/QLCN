-- CẢNH BÁO: SCRIPT NÀY SẼ ĐƯA TOÀN BỘ SỐ DƯ CỦA VÍ VÀ QUỸ VỀ 0.
-- Thường dùng kết hợp sau khi chạy clear_all_data.sql hoặc clear_capital_data.sql
-- để đảm bảo Dashboard hiển thị đúng 0 đồng nếu dữ liệu giao dịch đã bị xoá.

UPDATE wallets SET balance = 0;
UPDATE funds SET balance = 0;

-- Xoá luôn lịch sử chuyển tiền nội bộ giữa các ví/quỹ cho sạch sẽ
TRUNCATE TABLE fund_transfers RESTART IDENTITY CASCADE;
