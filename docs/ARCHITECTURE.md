# Kiến trúc hệ thống — WebGIS 3D

## 1. Kiến trúc tổng thể

Người dùng → React + Three.js → REST API / JSON → Node.js + Express.js → PostgreSQL + PostGIS.

- **Frontend:** React tổ chức UI theo component; Three.js dựng sa bàn 3D, raycasting, floor slicing và thematic mapping.
- **Backend:** Node.js + Express.js cung cấp REST API, kiểm tra dữ liệu và xử lý nghiệp vụ.
- **Database:** PostgreSQL + PostGIS lưu dữ liệu nghiệp vụ và dữ liệu không gian BODY–FACE–NODE.
- **3D exchange:** glTF/GLB là định dạng dự kiến khi có mô hình kiến trúc thật.

## 2. Prototype Checkpoint 3

Checkpoint 3 hiện dùng mock data ở frontend và mô hình 8 tầng dựng procedural bằng Three.js để chứng minh:
- điều hướng 3D;
- lọc tầng;
- bản đồ màu trạng thái;
- click phòng → đọc body_id/room_id;
- inspector dữ liệu phòng;
- phác thảo dashboard và các module CRUD.

Backend/PostGIS được giữ trong kiến trúc mục tiêu nhưng chưa bắt buộc để trình diễn giao diện.
