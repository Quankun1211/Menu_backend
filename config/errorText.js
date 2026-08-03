// Mã lỗi là hợp đồng giữa backend và các giao diện. Không đặt nội dung kỹ thuật
// (JWT, token, stack trace...) vào message trả về cho người dùng.
export const AUTH_ERRORS = Object.freeze({
  ACCOUNT_NOT_FOUND: { status: 401, message: "Tài khoản không tồn tại." },
  PASSWORD_INCORRECT: { status: 401, message: "Mật khẩu không chính xác." },
  ACCOUNT_UNVERIFIED: { status: 403, message: "Tài khoản chưa được xác minh." },
  ACCOUNT_LOCKED: { status: 403, message: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên." },
  ACCOUNT_UNAVAILABLE: { status: 401, message: "Tài khoản hiện không thể sử dụng." },
  LOGIN_REQUIRED: { status: 401, message: "Vui lòng đăng nhập để tiếp tục." },
  SESSION_EXPIRED: { status: 401, message: "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại." },
  SESSION_INVALID: { status: 401, message: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại." },
  PERMISSION_DENIED: { status: 403, message: "Bạn không có quyền thực hiện thao tác này." },
});

export const authErrorResponse = (res, key) => {
  const item = AUTH_ERRORS[key] || AUTH_ERRORS.SESSION_INVALID;
  return res.status(item.status).json({ success: false, code: key, message: item.message });
};
