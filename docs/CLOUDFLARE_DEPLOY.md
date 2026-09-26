# Deploy lên Cloudflare Workers

Repo đã được chuẩn bị để deploy dạng **Workers Static Assets**.

## Cấu hình Cloudflare
- Worker name: `webgis`
- Repository: `phongtran278/WebGIS-3D`
- Production branch: `main`
- Root directory: `/`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Build output: `dist`

Sau khi deploy thành công:
1. Mở Worker `webgis`
2. Vào **Settings → Domains & Routes**
3. Chọn **Add → Custom domain**
4. Nhập `webgis.phongtran.tech`

Cloudflare sẽ xử lý DNS/SSL cho custom domain khi zone `phongtran.tech` đang nằm trong cùng account.
