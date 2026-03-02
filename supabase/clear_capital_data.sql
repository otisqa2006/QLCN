-- CẢNH BÁO: SCRIPT NÀY SẼ XOÁ TOÀN BỘ DỮ LIỆU Liên quan đến VỐN và KHOẢN VAY.
-- Cấu trúc bảng (Schema) sẽ vẫn được giữ nguyên.
-- Chú ý: Việc xoá dữ liệu này sẽ KHÔNG tự động trừ tiền trong Ví (wallets) hay Quỹ (funds). 
-- Nếu muốn số dư ví/quỹ cũng được đưa về 0, bạn cần Cập nhật lại tay hoặc reset toàn bộ dữ liệu.

TRUNCATE TABLE 
    loan_repayments, 
    loans, 
    contributions, 
    contributors
RESTART IDENTITY CASCADE;

-- Lệnh `CASCADE` sẽ tự động xoá luôn các dữ liệu ở bảng con (nếu có).
