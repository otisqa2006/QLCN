import { GoogleGenAI } from '@google/genai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;

if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
}

export interface ParsedExpense {
    id?: string;
    date: string;
    amount: number;
    category_keyword: string;
    category_id?: string;
    wallet_id?: string;
    description: string;
}

export const parseExpensesFromText = async (text: string): Promise<ParsedExpense[]> => {
    if (!ai) {
        throw new Error('Chưa cấu hình API Key cho Google Gemini. Vui lòng thêm VITE_GEMINI_API_KEY vào biến môi trường.');
    }

    const prompt = `
Bạn là một trợ lý ảo quản lý chi tiêu. Nhiệm vụ của bạn là phân tích đoạn văn bản do người dùng nhập vào để bóc tách thông tin các khoản chi tiêu.
Người dùng có thể nhập nhiều khoản chi tiêu trong cùng một đoạn văn.

Định dạng thời gian: Nếu người dùng không chỉ định năm, hãy mặc định là năm hiện tại (${new Date().getFullYear()}). Nếu số liệu tiền tệ kèm theo chữ 'k' (ví dụ 100k, 50k), hãy hiểu đó là nghìn đồng (ví dụ 100k = 100000).
Ngày tháng thường có định dạng DD/MM. Hãy chuyển đổi ngày tháng về định dạng chuẩn YYYY-MM-DD.
Nếu người dùng không nhập ngày tháng, hãy sử dụng ngày hôm nay: ${new Date().toISOString().split('T')[0]}.

Kết quả bạn trả về bắt buộc phải là một mảng JSON (không bọc trong markdown block như \`\`\`json ...) chứa các đối tượng có cấu trúc chính xác như sau:
[
  {
    "date": "YYYY-MM-DD",
    "amount": <Số tiền thực tế tính bằng VNĐ (number), ví dụ 100k -> 100000>,
    "category_keyword": "<Từ khóa danh mục, ví dụ: 'xăng', 'đồ ăn', 'tạp hoá'>",
    "description": "<Mô tả chi tiết nguyên văn hoặc giữ nguyên cách diễn đạt của user về khoản chi này>"
  }
]

Ví dụ 1:
User: "27/2 Mua xăng : 100k, đồ ăn : 200k, tạp hoá : 40k"
Bot:
[
  { "date": "${new Date().getFullYear()}-02-27", "amount": 100000, "category_keyword": "xăng", "description": "Mua xăng" },
  { "date": "${new Date().getFullYear()}-02-27", "amount": 200000, "category_keyword": "đồ ăn", "description": "đồ ăn" },
  { "date": "${new Date().getFullYear()}-02-27", "amount": 40000, "category_keyword": "tạp hoá", "description": "tạp hoá" }
]

Ví dụ 2:
User: "28/2 Ăn sáng : 90k, trả nợ cho Nam 500k"
Bot:
[
  { "date": "${new Date().getFullYear()}-02-28", "amount": 90000, "category_keyword": "ăn sáng", "description": "Ăn sáng" },
  { "date": "${new Date().getFullYear()}-02-28", "amount": 500000, "category_keyword": "trả nợ", "description": "trả nợ cho Nam" }
]

Chỉ trả về JSON thuần túy, không thêm bất kỳ văn bản giải thích nào khác.

Văn bản cần phân tích:
"${text}"
`;

    // Try these models in order, falling back if one fails with 404
    const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-1.5-pro',
        'gemini-1.5-flash'
    ];

    let lastError: any = null;

    for (const modelName of modelsToTry) {
        try {
            const result = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    temperature: 0.1, // Low temp for structured data
                }
            });

            const rawText = result.text || '';

            // Xử lý kết quả (cắt bỏ markdown nếu có)
            let jsonStr = rawText.trim();
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
            }

            const parsedData = JSON.parse(jsonStr);

            if (!Array.isArray(parsedData)) {
                throw new Error(`[${modelName}] Dữ liệu trả về không phải là mảng.`);
            }

            // Validate và trả về
            parsedData.forEach((item, index) => {
                if (!item.date || typeof item.amount !== 'number' || !item.category_keyword) {
                    console.warn(`[${modelName}] Cảnh báo cấu trúc không hợp lệ tại mục ${index}:`, item);
                }
            });

            return parsedData as ParsedExpense[];

        } catch (error: any) {
            console.warn(`Lỗi khi sử dụng model ${modelName}:`, error.message);
            lastError = error;

            // Nếu lỗi quota (429) thì báo luôn, không cần thử model tiếp theo
            if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('exceeded')) {
                throw new Error(`Tài khoản API Key đã vượt quá giới hạn lượt dùng hoặc hết quota. Vui lòng kiểm tra lại tài khoản Google Cloud của bạn.`);
            }
        }
    }

    // Nếu tất cả model đều thất bại
    console.error('Tất cả các model API đều thất bại.', lastError);
    throw new Error(`Lỗi API: ${lastError?.message || 'Không thể liên lạc với Gemini.'}`);
};
