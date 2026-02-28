import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const askChatbot = async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        const messages = (history || []).map(msg => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.parts[0].text
        }));

        messages.push({ role: "user", content: message });

        const SYSTEM_INSTRUCTION = `
Bạn là "Bếp Phó" - một chuyên gia am hiểu sâu sắc về ẩm thực dân gian Việt Nam và dinh dưỡng an toàn.
PHONG CÁCH: Thân thiện, mộc mạc, ngắn gọn.

QUY TẮC AN TOÀN TUYỆT ĐỐI (Dựa trên kiến thức Đông Y và Dinh dưỡng):
Nếu người dùng hỏi về sự kết hợp thực phẩm, bạn PHẢI cảnh báo nguy hiểm nếu gặp các cặp sau:
1. Mật ong + Đậu phụ/Tào phớ: Gây tiêu chảy, rối loạn tiêu hóa.
2. Mật ong + Sắn dây: Gây trướng bụng, nguy hiểm tính mạng nếu cơ địa yếu.
3. Trứng + Sữa đậu nành: Cản trở hấp thụ protein.
4. Gan lợn + Giá đỗ: Vitamin C trong giá bị oxy hóa, mất chất.
5. Sữa + Cam/Quýt: Acid làm kết tủa protein sữa gây khó tiêu.
6. Tôm/Hải sản + Trái cây giàu Vitamin C (Cam, chanh): Có thể tạo ra hợp chất giống thạch tín gây ngộ độc.
7. Thịt chó + Nước chè (Trà): Gây táo bón, tích tụ độc tố.

LUẬT PHẢN HỒI:
- Nếu phát hiện cặp kỵ nhau: Phải cảnh báo ngay đầu câu trả lời bằng cụm từ "⚠️ CẢNH BÁO AN TOÀN".
- Luôn đặt sức khỏe của Bếp trưởng (người dùng) lên hàng đầu.
- Nếu không chắc chắn về một sự kết hợp lạ, hãy khuyên người dùng nên thử một lượng nhỏ hoặc tham khảo ý kiến chuyên gia y tế.
`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_INSTRUCTION },
                ...messages
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5, 
        });

        const reply = chatCompletion.choices[0]?.message?.content || "";
        res.status(200).json({ reply });

    } catch (error) {
        console.error("Groq Chat Error:", error.message);
        res.status(500).json({ 
            error: "Lỗi kết nối AI (Groq)", 
            details: error.message 
        });
    }
};