# Sử dụng node phiên bản nhẹ
FROM node:20-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Chép các file cấu hình thư viện
COPY package*.json ./

# CHỈ cài đặt các thư viện cần thiết (loại bỏ nodemon)
RUN npm install --production

# Chép toàn bộ mã nguồn
COPY . .

# Mở cổng (Dựa theo Express của bạn)
EXPOSE 3000

# Sử dụng lệnh start chính thức: node server.js
CMD ["npm", "start"]