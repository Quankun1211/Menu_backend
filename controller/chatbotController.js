import Groq from "groq-sdk";
import dotenv from "dotenv";
import { searchProducts } from "../services/productQuery.js";
import {
    detectIntent,
    CHATBOT_INTENTS,
} from "../utils/chatbotIntent.js";

dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

const PRODUCT_INTENTS = [
    CHATBOT_INTENTS.PRODUCT_SEARCH,
    CHATBOT_INTENTS.PRODUCT_DETAIL,
    CHATBOT_INTENTS.PRODUCT_PRICE,
    CHATBOT_INTENTS.PRODUCT_STOCK,
];

const SYSTEM_INSTRUCTION = `
Bạn là "Bếp Phó" - một chuyên gia am hiểu sâu sắc về ẩm thực dân gian Việt Nam và dinh dưỡng an toàn.

PHONG CÁCH:
- Thân thiện, mộc mạc, ngắn gọn.
- Trả lời bằng tiếng Việt.
- Không tự bịa thông tin.

QUY TẮC TRÌNH BÀY (QUAN TRỌNG):
- Có câu chào lịch sự, thân thiện, ngắn gọn. VD: Chào bạn, bên mình có...
- Tuyệt đối KHÔNG sử dụng bảng Markdown (bảng có dấu gạch đứng |) trong câu trả lời vì giao diện khung chat không hỗ trợ tốt.
- Khi liệt kê nhiều sản phẩm, hãy trình bày dạng danh sách gạch đầu dòng hoặc viết đoạn văn ngắn gọn, rõ ràng.
- Giữ câu trả lời ngắn gọn, súc tích, không rườm rà.
- Tuyệt đối KHÔNG dùng bảng Markdown, không dùng các ký tự như ** hay * để dẫn đầu dòng.
- Liệt kê siêu ngắn gọn, mỗi sản phẩm đúng 1 dòng duy nhất theo mẫu:
  • Tên sản phẩm (Đơn vị) - Còn: [Số lượng]
- Không lặp lại các từ ngữ rườm rà hay in đậm quá nhiều ký tự.

QUY TẮC SẢN PHẨM:
- Khi được cung cấp dữ liệu sản phẩm từ DATABASE, chỉ sử dụng dữ liệu đó.
- Không tự bịa giá, tồn kho, nguồn gốc hoặc sản phẩm.
- Nếu có sản phẩm phù hợp, trả lời trực tiếp câu hỏi của khách.
- Nếu có nhiều sản phẩm phù hợp, liệt kê những sản phẩm phù hợp nhất.
- Có thể đề cập tên, giá, đơn vị, mô tả, nguồn gốc, tồn kho, khuyến mãi.
- Không cần hiển thị URL ảnh hoặc slug trong nội dung câu trả lời.
- Thông tin hình ảnh và điều hướng sản phẩm sẽ được frontend xử lý.
- Nếu không tìm thấy sản phẩm phù hợp, nói rõ rằng hiện chưa tìm thấy sản phẩm phù hợp.

QUY TẮC AN TOÀN:

Nếu người dùng hỏi về sự kết hợp thực phẩm, hãy cảnh báo nếu gặp:

1. Mật ong + Đậu phụ/Tào phớ
2. Mật ong + Sắn dây
3. Trứng + Sữa đậu nành
4. Gan lợn + Giá đỗ
5. Sữa + Cam/Quýt
6. Tôm/Hải sản + Trái cây giàu Vitamin C
7. Thịt chó + Nước chè

Nếu phát hiện vấn đề an toàn:
- Bắt đầu câu trả lời bằng "⚠️ CẢNH BÁO AN TOÀN".
- Đặt sức khỏe người dùng lên hàng đầu.
`;

export const askChatbot = async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message?.trim()) {
            return res.status(400).json({
                error: "Message is required",
            });
        }

        const userMessage = message.trim();

        const intent = await detectIntent(userMessage);

        console.log("\n========== CHATBOT ==========");
        console.log("[CHATBOT] Message:", userMessage);
        console.log("[CHATBOT] Intent:", intent);

        let products = [];
        let productContext = "";

        if (PRODUCT_INTENTS.includes(intent?.intent)) {
            console.log("[PRODUCT] Query product database...");
            console.log("[PRODUCT] Keyword:", intent.keyword);
            console.log("[PRODUCT] Region:", intent.region);
            console.log("[PRODUCT] Location:", intent.location);

            products = await searchProducts({
                keyword: intent.keyword,
                region: intent.region,
                location: intent.location,
                limit: 5,
            });

            console.log("[PRODUCT] Found:", products.length);

            if (products.length > 0) {
                console.log(
                    "[PRODUCT] Products:",
                    products.map((product) => ({
                        id: product._id,
                        name: product.name,
                        type: product.type,
                        price: product.price,
                        stock: product.stock,
                        region: product.region,
                        origin: product.origin,
                        images: product.images,
                        slug: product.slug,
                    }))
                );
            }

            productContext = `
DỮ LIỆU SẢN PHẨM TỪ DATABASE:

${JSON.stringify(products, null, 2)}

INTENT CỦA KHÁCH:
${intent.intent}

TỪ KHÓA:
${intent.keyword || "(không có)"}

VÙNG MIỀN:
${intent.region || "(không có)"}

ĐỊA ĐIỂM:
${intent.location || "(không có)"}

QUY TẮC:
- Chỉ sử dụng dữ liệu sản phẩm ở trên.
- Không tự bịa thông tin.
- Nếu intent là PRODUCT_PRICE, tập trung vào giá và đơn vị.
- Nếu intent là PRODUCT_STOCK, tập trung vào tồn kho.
- Nếu intent là PRODUCT_DETAIL, trả lời thông tin chi tiết phù hợp.
- Nếu intent là PRODUCT_SEARCH, liệt kê sản phẩm phù hợp.
- Nếu khách hỏi giá của nhiều sản phẩm, hiển thị tên + giá + đơn vị.
- Nếu danh sách rỗng, nói rằng không tìm thấy sản phẩm phù hợp.
`;
        }

        const messages = history
            .filter(
                (msg) =>
                    msg?.parts?.[0]?.text &&
                    (msg.role === "user" || msg.role === "model")
            )
            .map((msg) => ({
                role: msg.role === "model" ? "assistant" : "user",
                content: msg.parts[0].text,
            }));

        messages.push({
            role: "user",
            content: userMessage,
        });

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: SYSTEM_INSTRUCTION,
                },
                ...(productContext
                    ? [
                          {
                              role: "system",
                              content: productContext,
                          },
                      ]
                    : []),
                ...messages,
            ],
            model: "openai/gpt-oss-120b",
            temperature: 0.3,
        });

        const reply =
            chatCompletion.choices[0]?.message?.content || "";

        console.log("[CHATBOT] Reply:", reply);
        console.log("========== CHATBOT END ==========\n");

        return res.status(200).json({
            reply,
            intent: intent?.intent || CHATBOT_INTENTS.GENERAL,
            products: products.map((product) => ({
                _id: product._id,
                type: product.type,
                name: product.name,
                slug: product.slug,
                price: product.price,
                unit: product.unit,
                images: product.images,
                stock: product.stock,
                salePercent: product.salePercent,
                region: product.region,
                origin: product.origin,
                description: product.description,
            })),
        });
    } catch (error) {
        console.error("Groq Chat Error:", error);

        return res.status(500).json({
            error: "Lỗi kết nối AI (Groq)",
            details: error.message,
        });
    }
};