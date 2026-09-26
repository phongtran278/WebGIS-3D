# Phác thảo & đặc tả giao diện

## Design language
Giao diện kế thừa design language của PlotFlow: system UI typography, neutral canvas, panel sáng, border nhẹ, radius vừa, accent xanh chỉ dùng cho selection/primary action, progressive disclosure và inspector theo đối tượng.

## Màn hình
1. **Tổng quan:** số phòng, tỷ lệ lấp đầy, hoạt động gần đây.
2. **WebGIS 3D:** sa bàn tòa nhà 8 tầng, zoom/rotate, lọc tầng 1–8, lọc trạng thái, legend.
3. **Room Inspector:** mã phòng, diện tích, giá, trạng thái, BODY ID, hợp đồng, điện nước.
4. **Căn hộ:** bảng danh mục phòng + trạng thái.
5. **Cư dân:** hồ sơ người thuê.
6. **Hợp đồng:** hợp đồng cho thuê và thời hạn.
7. **Điện & Nước:** nhập và tra cứu chỉ số.
8. **Bảo trì:** yêu cầu sửa chữa và tình trạng xử lý.
9. **Báo cáo:** doanh thu và tỷ lệ lấp đầy.

## Quy ước màu trạng thái
- Xanh: phòng trống.
- Đỏ: đang thuê.
- Vàng: bảo trì.

## Tương tác chính
Click mesh phòng → Three.js Raycaster → room/body id → inspector. Ở bản triển khai đầy đủ, id này dùng để gọi REST API và lấy dữ liệu từ PostgreSQL/PostGIS.
