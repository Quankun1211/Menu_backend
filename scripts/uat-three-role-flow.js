const baseUrl = process.env.UAT_API_BASE_URL;
const userToken = process.env.UAT_USER_ACCESS_TOKEN;
const adminToken = process.env.UAT_ADMIN_ACCESS_TOKEN;
const shipperToken = process.env.UAT_SHIPPER_ACCESS_TOKEN;

if (!baseUrl || !userToken || !adminToken || !shipperToken) {
  console.error("Thiếu UAT_API_BASE_URL hoặc access token của user/admin/shipper.");
  process.exit(1);
}

const call = async (path, token) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${body.message || body.error}`);
  return body;
};

const checks = await Promise.all([
  call("/users/me", userToken),
  call("/admin/dashboard?period=7", adminToken),
  call("/shippers/orders/assigned", shipperToken),
]);

console.log(JSON.stringify({
  success: true,
  user: checks[0].data?.email,
  dashboardLoaded: Boolean(checks[1].data),
  shipperOrderCount: checks[2].data?.length || 0,
  note: "Kiểm tra ghi dữ liệu cần ID sản phẩm, địa chỉ và tài khoản sandbox riêng.",
}, null, 2));
