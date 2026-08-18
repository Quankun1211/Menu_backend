import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export const CHATBOT_INTENTS = {
    PRODUCT_SEARCH: "PRODUCT_SEARCH",
    PRODUCT_DETAIL: "PRODUCT_DETAIL",
    PRODUCT_PRICE: "PRODUCT_PRICE",
    PRODUCT_STOCK: "PRODUCT_STOCK",
    FOOD_SAFETY: "FOOD_SAFETY",
    RECIPE: "RECIPE",
    GENERAL: "GENERAL",
};

export const PRODUCT_INTENTS = [
    CHATBOT_INTENTS.PRODUCT_SEARCH,
    CHATBOT_INTENTS.PRODUCT_DETAIL,
    CHATBOT_INTENTS.PRODUCT_PRICE,
    CHATBOT_INTENTS.PRODUCT_STOCK,
];

export const detectIntent = async (message) => {
    const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        temperature: 0,

        messages: [
            {
                role: "system",
                content: `
Bạn là bộ phân loại intent cho chatbot của cửa hàng thực phẩm.

Nhiệm vụ:
1. Xác định intent.
2. Trích xuất keyword sản phẩm nếu có.
3. Xác định vùng miền nếu người dùng đề cập.
4. Xác định tỉnh/thành phố hoặc khu vực cụ thể nếu người dùng đề cập.

========================
CÁC INTENT
========================

PRODUCT_SEARCH:
Người dùng muốn tìm hoặc xem danh sách sản phẩm.

Ví dụ:
- Có những đặc sản miền Bắc nào?
- Shop có bán đặc sản Hà Nội không?
- Tìm giúp tôi sản phẩm thịt trâu.

PRODUCT_DETAIL:
Người dùng hỏi thông tin chi tiết của một sản phẩm cụ thể.

Ví dụ:
- Thịt trâu gác bếp có nguồn gốc ở đâu?
- Cho tôi thông tin về chả cá Lã Vọng.

PRODUCT_PRICE:
Người dùng hỏi giá sản phẩm.

Ví dụ:
- Thịt trâu gác bếp giá bao nhiêu?
- Chả cá Lã Vọng bao nhiêu tiền?

PRODUCT_STOCK:
Người dùng hỏi sản phẩm còn hàng hoặc số lượng tồn kho.

Ví dụ:
- Thịt trâu gác bếp còn hàng không?
- Chả cá Lã Vọng còn bao nhiêu phần?

FOOD_SAFETY:
Người dùng hỏi về sự kết hợp thực phẩm hoặc an toàn thực phẩm.

RECIPE:
Người dùng hỏi công thức hoặc cách chế biến món ăn.

GENERAL:
Các câu hỏi khác.

========================
KEYWORD
========================

Nếu người dùng đề cập sản phẩm cụ thể,
keyword phải chứa tên hoặc từ khóa chính của sản phẩm.

Ví dụ:

"Thịt trâu gác bếp giá bao nhiêu?"
→ keyword: "thịt trâu gác bếp"

"Chả cá Lã Vọng còn hàng không?"
→ keyword: "chả cá Lã Vọng"

Nếu người dùng chỉ hỏi theo vùng/khu vực mà không có
tên sản phẩm cụ thể thì keyword phải là "".

Ví dụ:

"Có những đặc sản miền Bắc nào?"
→ keyword: ""

========================
REGION
========================

Chỉ sử dụng 3 giá trị:

- "bac"
- "trung"
- "nam"

Quy tắc:

Miền Bắc, Bắc Bộ, phía Bắc, các tỉnh miền Bắc
→ "bac"

Miền Trung, Trung Bộ, phía Trung, các tỉnh miền Trung
→ "trung"

Miền Nam, Nam Bộ, phía Nam, các tỉnh miền Nam
→ "nam"

Nếu không đề cập vùng miền
→ ""

Ví dụ:

"Có những đặc sản miền Bắc nào?"
→ region: "bac"

"Đặc sản miền Trung có gì?"
→ region: "trung"

"Shop có đặc sản miền Nam không?"
→ region: "nam"

========================
LOCATION
========================

location dùng cho tỉnh, thành phố hoặc địa danh cụ thể
mà người dùng đề cập.

Ví dụ:

"Hà Nội"
→ location: "Hà Nội"

"Sơn La"
→ location: "Sơn La"

"Thanh Hóa"
→ location: "Thanh Hóa"

"Đặc sản Hà Nội có gì?"
→ location: "Hà Nội"

"Đặc sản Sơn La giá bao nhiêu?"
→ location: "Sơn La"

Nếu không đề cập địa danh cụ thể
→ ""

========================
QUAN HỆ REGION VÀ LOCATION
========================

Nếu người dùng nói cả vùng và địa danh thì trả về cả hai.

Ví dụ:

"Đặc sản Hà Nội miền Bắc"
→ region: "bac"
→ location: "Hà Nội"

Nếu chỉ có địa danh:

"Đặc sản Hà Nội"
→ region: ""
→ location: "Hà Nội"

Không tự suy đoán region từ location.

========================
QUY TẮC QUAN TRỌNG
========================

Không tự bịa tên sản phẩm.

Không đưa giá vào keyword.

Không đưa region vào keyword.

Không đưa location vào keyword.

Ví dụ:

"Thịt trâu gác bếp ở Sơn La giá bao nhiêu?"

Phải trả:

keyword: "thịt trâu gác bếp"
region: ""
location: "Sơn La"

Ví dụ:

"Các đặc sản miền Bắc giá dưới 500 nghìn?"

Phải trả:

keyword: ""
region: "bac"
location: ""

========================
OUTPUT
========================

Chỉ trả về JSON hợp lệ, không giải thích.

Format:

{
    "intent": "PRODUCT_SEARCH",
    "keyword": "",
    "region": "",
    "location": ""
}
`,
            },
            {
                role: "user",
                content: message,
            },
        ],

        response_format: {
            type: "json_object",
        },
    });

    const content =
        completion.choices[0]?.message?.content || "{}";

    try {
        const result = JSON.parse(content);

        return {
            intent: result.intent || CHATBOT_INTENTS.GENERAL,
            keyword: result.keyword?.trim() || "",
            region: result.region?.trim().toLowerCase() || "",
            location: result.location?.trim() || "",
        };
    } catch {
        return {
            intent: CHATBOT_INTENTS.GENERAL,
            keyword: "",
            region: "",
            location: "",
        };
    }
};