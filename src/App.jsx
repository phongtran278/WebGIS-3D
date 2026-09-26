import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const STATUS = {
  vacant: { label: 'Phòng trống', color: '#6cb69f', soft: '#e6f1ed' },
  occupied: { label: 'Đang thuê', color: '#c97970', soft: '#f7e9e7' },
  maintenance: { label: 'Bảo trì', color: '#d6ad58', soft: '#fff4ce' },
}

const rooms = Array.from({ length: 8 }, (_, floorIndex) =>
  Array.from({ length: 5 }, (_, roomIndex) => {
    const floor = floorIndex + 1
    const no = floor * 100 + roomIndex + 1
    const statusPool = ['occupied','occupied','vacant','occupied','maintenance']
    return {
      id: 'R' + no,
      code: String(no),
      floor,
      bodyId: 'BODY_' + String(no).padStart(4,'0'),
      area: [28,32,36,42,48][roomIndex],
      bedrooms: roomIndex < 2 ? 1 : 2,
      rent: [5200000,5900000,6500000,7200000,7800000][roomIndex],
      status: statusPool[(roomIndex + floorIndex) % statusPool.length],
      tenant: ((roomIndex + floorIndex) % statusPool.length) === 0 ? 'Nguyễn Minh Anh' : ((roomIndex + floorIndex) % statusPool.length) === 1 ? 'Trần Quốc Huy' : null,
      contractEnd: ((roomIndex + floorIndex) % statusPool.length) < 2 ? '30/11/2026' : null,
      electricity: 286 + floor * 13 + roomIndex * 7,
      water: 18 + floor + roomIndex,
    }
  })
).flat()

const navItems = [
  ['about','Về đề tài','?'],
  ['overview','Tổng quan','⌂'],
  ['map','WebGIS 3D','◇'],
  ['rooms','Căn hộ','▦'],
  ['tenants','Cư dân','◎'],
  ['contracts','Hợp đồng','▤'],
  ['utilities','Điện & Nước','◫'],
  ['maintenance','Bảo trì','△'],
  ['reports','Báo cáo','⌁'],
]

function formatMoney(v){ return new Intl.NumberFormat('vi-VN').format(v) + ' ₫' }

function Building3D({ activeFloor, statusFilter, selectedRoom, onSelectRoom }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const roomMeshesRef = useRef(new Map())
  const roomDataRef = useRef(rooms)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#f5f4f1')
    scene.fog = new THREE.Fog('#f5f4f1', 28, 58)

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.set(16, 13, 20)

    const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = .07
    controls.minDistance = 11
    controls.maxDistance = 38
    controls.maxPolarAngle = Math.PI * .48
    controls.target.set(0,5.5,0)

    scene.add(new THREE.HemisphereLight('#ffffff','#c8cbc6',2.2))
    const key = new THREE.DirectionalLight('#ffffff',3)
    key.position.set(9,18,12); key.castShadow = true
    key.shadow.mapSize.set(2048,2048)
    scene.add(key)

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(6.3,6.3,.22,64),
      new THREE.MeshStandardMaterial({color:'#dedfd9',roughness:.9})
    )
    base.position.y = -.2; base.receiveShadow = true; scene.add(base)

    const grid = new THREE.GridHelper(34,34,'#d9dad5','#e9e9e5')
    grid.position.y = -.08
    scene.add(grid)

    roomMeshesRef.current.clear()
    rooms.forEach((room) => {
      const col = (Number(room.code) % 100) - 1
      const xPositions = [-4.4,-2.2,0,2.2,4.4]
      const shape = new THREE.BoxGeometry(1.92,.94,5.2)
      const mat = new THREE.MeshStandardMaterial({
        color: STATUS[room.status].color,
        roughness:.72,
        metalness:.02,
        transparent:true,
        opacity:.93,
      })
      const mesh = new THREE.Mesh(shape,mat)
      mesh.position.set(xPositions[col], (room.floor-1)*1.24 + .52, 0)
      mesh.castShadow = true; mesh.receiveShadow = true
      mesh.userData.roomId = room.id
      scene.add(mesh)
      roomMeshesRef.current.set(room.id,mesh)

      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(shape),
        new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.65})
      )
      edge.position.copy(mesh.position)
      scene.add(edge)
      mesh.userData.edge = edge
    })

    const core = new THREE.Mesh(
      new THREE.BoxGeometry(1.4,10.1,1.6),
      new THREE.MeshStandardMaterial({color:'#d6d8d2',roughness:.9})
    )
    core.position.set(0,4.9,-3.35); core.castShadow=true; scene.add(core)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const onPointer = (e) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left)/rect.width)*2-1
      pointer.y = -((e.clientY - rect.top)/rect.height)*2+1
      raycaster.setFromCamera(pointer,camera)
      const visibleMeshes = [...roomMeshesRef.current.values()].filter(m=>m.visible)
      const hit = raycaster.intersectObjects(visibleMeshes,false)[0]
      if(hit){
        const room = roomDataRef.current.find(r=>r.id===hit.object.userData.roomId)
        if(room) onSelectRoom(room)
      }
    }
    renderer.domElement.addEventListener('pointerdown',onPointer)

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight
      renderer.setSize(w,h,false)
      camera.aspect = w/h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize); ro.observe(mount); resize()

    let frame
    const loop = () => { controls.update(); renderer.render(scene,camera); frame=requestAnimationFrame(loop) }
    loop()
    sceneRef.current = {scene,camera,renderer,controls}

    return () => {
      cancelAnimationFrame(frame); ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown',onPointer)
      controls.dispose(); renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [onSelectRoom])

  useEffect(() => {
    roomMeshesRef.current.forEach((mesh,id) => {
      const room = rooms.find(r=>r.id===id)
      const floorVisible = activeFloor === 0 || room.floor === activeFloor
      const statusVisible = statusFilter === 'all' || room.status === statusFilter
      mesh.visible = floorVisible && statusVisible
      if(mesh.userData.edge) mesh.userData.edge.visible = mesh.visible
      mesh.material.opacity = selectedRoom?.id === id ? 1 : .9
      mesh.scale.setScalar(selectedRoom?.id === id ? 1.06 : 1)
      mesh.material.emissive = new THREE.Color(selectedRoom?.id === id ? '#173d35' : '#000000')
      mesh.material.emissiveIntensity = selectedRoom?.id === id ? .16 : 0
    })
  }, [activeFloor,statusFilter,selectedRoom])

  return <div className="three-mount" ref={mountRef} />
}

function Sidebar({page,setPage}) {
  return <aside className="sidebar">
    <div className="brand brand-text-only"><div><strong>WebGIS 3D</strong><span>Apartment Management</span></div></div>
    <nav>{navItems.map(([id,label,icon]) =>
      <button key={id} className={'nav-item '+(page===id?'active':'')} onClick={()=>setPage(id)}>
        <span className="nav-icon">{icon}</span><span>{label}</span>{id==='map'&&<span className="live-dot"/>}
      </button>)}
    </nav>
    <div className="sidebar-spacer"/>
    <div className="building-mini"><span className="eyebrow">TÒA NHÀ</span><strong>Mini Apartment 01</strong><span>8 tầng · 40 căn hộ</span></div>
    <button className="profile"><span className="avatar">P</span><span><strong>Phong Trần</strong><small>Ban quản lý</small></span><span>•••</span></button>
  </aside>
}

function Topbar({page}) {
  const title = navItems.find(x=>x[0]===page)?.[1] || 'WebGIS 3D'
  return <header className="topbar">
    <div><span className="crumb">Mini Apartment 01</span><h1>{title}</h1></div>
    <div className="top-actions">
      <label className="search"><span>⌕</span><input placeholder="Tìm phòng, cư dân..." /></label>
      <button className="icon-btn">?</button><button className="icon-btn">◌</button>
    </div>
  </header>
}

function StatCard({label,value,meta,tone}) {
  return <div className="stat-card"><div className={'stat-dot '+tone}/><span>{label}</span><strong>{value}</strong><small>{meta}</small></div>
}

function Overview({setPage}) {
  const occupied=rooms.filter(r=>r.status==='occupied').length
  const vacant=rooms.filter(r=>r.status==='vacant').length
  const maintenance=rooms.filter(r=>r.status==='maintenance').length
  return <div className="page-scroll">
    <div className="section-head"><div><span className="eyebrow">TỔNG QUAN VẬN HÀNH</span><h2>Chào buổi chiều, Phong.</h2><p>Tình trạng tòa nhà được cập nhật theo dữ liệu phòng hiện tại.</p></div><button className="primary-btn" onClick={()=>setPage('map')}>Mở sa bàn 3D →</button></div>
    <div className="stats-grid">
      <StatCard tone="green" label="Tổng căn hộ" value="40" meta="8 tầng · 5 căn/tầng"/>
      <StatCard tone="red" label="Đang thuê" value={occupied} meta={Math.round(occupied/40*100)+'% công suất'}/>
      <StatCard tone="teal" label="Phòng trống" value={vacant} meta="Sẵn sàng cho thuê"/>
      <StatCard tone="yellow" label="Bảo trì" value={maintenance} meta="Cần xử lý"/>
    </div>
    <div className="overview-grid">
      <section className="panel occupancy-card"><div className="panel-head"><div><span className="eyebrow">LẤP ĐẦY</span><h3>Công suất theo tầng</h3></div><strong>{Math.round(occupied/40*100)}%</strong></div>
        <div className="bars">{[8,7,6,5,4,3,2,1].map(f=>{const rs=rooms.filter(r=>r.floor===f); const n=rs.filter(r=>r.status==='occupied').length; return <div className="bar-row" key={f}><span>T{f}</span><div><i style={{width:(n/5*100)+'%'}}/></div><b>{n}/5</b></div>})}</div>
      </section>
      <section className="panel activity"><div className="panel-head"><div><span className="eyebrow">GẦN ĐÂY</span><h3>Hoạt động</h3></div><button className="ghost-btn">Xem tất cả</button></div>
        {[['P.701','Gia hạn hợp đồng','12 phút trước'],['P.402','Nhập chỉ số điện nước','36 phút trước'],['P.305','Tạo yêu cầu bảo trì','1 giờ trước'],['P.103','Cập nhật trạng thái phòng','2 giờ trước']].map(x=><div className="activity-row" key={x[0]}><span className="room-chip">{x[0]}</span><div><strong>{x[1]}</strong><small>{x[2]}</small></div><span>›</span></div>)}
      </section>
    </div>
  </div>
}

function Inspector({room,onClose}) {
  if(!room) return <aside className="inspector empty-inspector"><div className="empty-icon">◇</div><h3>Chọn một căn hộ</h3><p>Nhấp trực tiếp vào khối phòng trên sa bàn để xem dữ liệu nghiệp vụ.</p><div className="hint"><kbd>Drag</kbd> xoay · <kbd>Scroll</kbd> zoom</div></aside>
  const st=STATUS[room.status]
  return <aside className="inspector">
    <div className="inspector-head"><div><span className="eyebrow">CĂN HỘ</span><h2>P.{room.code}</h2></div><button className="icon-btn" onClick={onClose}>×</button></div>
    <div className="status-pill" style={{background:st.soft,color:st.color}}><i style={{background:st.color}}/>{st.label}</div>
    <div className="room-hero"><div><span>Diện tích</span><strong>{room.area} m²</strong></div><div><span>Phòng ngủ</span><strong>{room.bedrooms} PN</strong></div></div>
    <section className="ins-section"><span className="eyebrow">GIÁ THUÊ</span><strong className="rent">{formatMoney(room.rent)}<small>/ tháng</small></strong></section>
    <section className="ins-section"><span className="eyebrow">THÔNG TIN KHÔNG GIAN</span><div className="info-row"><span>Tầng</span><b>{room.floor}</b></div><div className="info-row"><span>Room ID</span><code>{room.id}</code></div><div className="info-row"><span>Body ID</span><code>{room.bodyId}</code></div></section>
    {room.tenant && <section className="ins-section"><span className="eyebrow">HỢP ĐỒNG HIỆN TẠI</span><div className="tenant-card"><span className="avatar small">N</span><div><strong>{room.tenant}</strong><small>Đến {room.contractEnd}</small></div><span>›</span></div></section>}
    <section className="ins-section"><span className="eyebrow">CHỈ SỐ GẦN NHẤT</span><div className="meter-grid"><div><span>Điện</span><strong>{room.electricity}</strong><small>kWh</small></div><div><span>Nước</span><strong>{room.water}</strong><small>m³</small></div></div></section>
    <div className="inspector-actions"><button className="secondary-btn">Cập nhật</button><button className="primary-btn">Xem chi tiết</button></div>
  </aside>
}

function MapPage() {
  const [floor,setFloor]=useState(0)
  const [status,setStatus]=useState('all')
  const [selected,setSelected]=useState(null)
  const selectRoom = useMemo(()=>room=>setSelected(room),[])
  return <div className="map-layout">
    <main className="map-stage">
      <div className="map-toolbar">
        <div className="segmented"><button className={floor===0?'active':''} onClick={()=>setFloor(0)}>Tất cả</button>{[1,2,3,4,5,6,7,8].map(f=><button key={f} className={floor===f?'active':''} onClick={()=>setFloor(f)}>T{f}</button>)}</div>
        <select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="vacant">Phòng trống</option><option value="occupied">Đang thuê</option><option value="maintenance">Bảo trì</option></select>
      </div>
      <Building3D activeFloor={floor} statusFilter={status} selectedRoom={selected} onSelectRoom={selectRoom}/>
      <div className="map-caption"><span className="eyebrow">SA BÀN 3D · LIVE PROTOTYPE</span><strong>{floor===0?'Toàn bộ tòa nhà':'Tầng '+floor}</strong></div>
      <div className="legend">{Object.entries(STATUS).map(([k,v])=><button key={k} className={status===k?'active':''} onClick={()=>setStatus(status===k?'all':k)}><i style={{background:v.color}}/>{v.label}</button>)}</div>
      <div className="view-help"><span>↻ Kéo để xoay</span><span>⌕ Cuộn để zoom</span></div>
    </main>
    <Inspector room={selected} onClose={()=>setSelected(null)}/>
  </div>
}


function AboutPage() {
  const faqs = [
    {
      q: 'Vì sao đề tài cần GIS 3D thay vì chỉ dùng bảng dữ liệu?',
      a: 'Tài liệu của nhóm xác định vấn đề cốt lõi là khoảng cách giữa dữ liệu dạng số, văn bản và cấu trúc kiến trúc thực tế. Khi chỉ dùng danh sách hoặc bảng, ban quản lý phải tự đối chiếu mã phòng với vị trí thật và khó nắm nhanh trạng thái của toàn tòa nhà. Mô hình 3D được dùng như một phần trực tiếp của quá trình quản lý, không chỉ để minh họa.'
    },
    {
      q: 'Đề tài đang xây dựng chính xác cái gì?',
      a: 'Một ứng dụng WebGIS 3D quản lý cho thuê căn hộ chung cư mini 8 tầng. Mỗi căn hộ được xem như một thực thể không gian độc lập và được liên kết với dữ liệu nghiệp vụ như trạng thái phòng, khách thuê, hợp đồng, điện nước, chi phí và bảo trì.'
    },
    {
      q: 'Người dùng thao tác với căn hộ trên mô hình như thế nào?',
      a: 'Người dùng có thể xoay, thu phóng, lọc hoặc bóc tách theo tầng và nhấp trực tiếp lên căn hộ. Theo thiết kế dữ liệu của nhóm, thao tác click trên bề mặt FACE được dùng để xác định khối BODY tương ứng, sau đó truy xuất dữ liệu căn hộ bằng mã định danh liên kết.'
    },
    {
      q: 'Màu sắc trên mô hình thể hiện điều gì?',
      a: 'Mô hình dùng bản đồ chuyên đề để thể hiện trạng thái vận hành: xanh cho phòng trống, đỏ cho phòng đang thuê và vàng cho phòng đang bảo trì. Khi dữ liệu nghiệp vụ thay đổi, trạng thái hiển thị của căn hộ cũng được cập nhật tương ứng.'
    },
    {
      q: 'Floor Slicing giải quyết vấn đề gì?',
      a: 'Tài liệu nêu rằng môi trường 3D nhiều tầng có thể gây che khuất tầm nhìn. Vì vậy hệ thống cho phép ẩn hoặc làm trong suốt các tầng phía trên để quan sát rõ mặt bằng của tầng đang được chọn.'
    },
    {
      q: 'Ai là người sử dụng hệ thống?',
      a: 'Các nhóm người dùng được xác định gồm Ban Quản Lý/chủ tòa nhà, Nhân Viên vận hành, Khách Tìm Thuê và Cư Dân. Mỗi nhóm có phạm vi thao tác khác nhau, trong đó Ban Quản Lý là nhóm có quyền quản trị rộng nhất.'
    },
    {
      q: 'Vì sao nhóm chọn quy mô 8 tầng, khoảng 4–6 căn mỗi tầng?',
      a: 'Đây là dữ liệu thử nghiệm trong phạm vi đồ án, đủ để thể hiện các đặc trưng GIS 3D như tổ chức đối tượng theo độ cao, truy vấn đối tượng không gian, bóc tách tầng và liên kết dữ liệu không gian với dữ liệu thuộc tính.'
    },
    {
      q: 'Đề tài có phải là mô hình BIM chi tiết không?',
      a: 'Không. Phạm vi tài liệu nêu rõ mô hình 3D tập trung vào cấu trúc cần thiết để biểu diễn và tương tác với tầng, căn hộ; không hướng đến xây dựng mô hình BIM chi tiết.'
    },
    {
      q: 'Những nội dung nào nằm ngoài phạm vi?',
      a: 'Các nội dung chuyên sâu như quản lý thuế, kế toán doanh nghiệp, tích hợp ngân hàng, hệ thống phòng cháy chữa cháy và quản lý thiết bị kỹ thuật chi tiết được xác định là ngoài phạm vi đồ án.'
    }
  ]

  return <div className="page-scroll about-page">
    <section className="about-hero">
      <span className="eyebrow">ĐỀ TÀI NHÓM 3 · WEBGIS 3D</span>
      <h2>Từ dữ liệu rời rạc đến quản lý trực tiếp trên không gian 3D.</h2>
      <p>Mục tiêu của đề tài là thu hẹp khoảng cách giữa thông tin quản lý và cấu trúc thực tế của tòa nhà, để người dùng có thể quan sát, truy vấn và cập nhật dữ liệu ngay trên mô hình căn hộ.</p>
    </section>

    <section className="why-what-how">
      <article className="concept-card">
        <span className="concept-index">01</span>
        <span className="eyebrow">WHY · VÌ SAO</span>
        <h3>Giảm “mù không gian” trong vận hành</h3>
        <p>Quản lý bằng bảng biểu khiến người dùng phải tự đối chiếu mã phòng với vị trí thực tế, khó nhìn nhanh tình trạng trống, đang thuê hay bảo trì và khó mô tả không gian cho khách tìm thuê.</p>
      </article>
      <article className="concept-card">
        <span className="concept-index">02</span>
        <span className="eyebrow">WHAT · LÀ GÌ</span>
        <h3>Một hệ thống quản lý căn hộ gắn với mô hình 3D</h3>
        <p>Mỗi căn hộ là một thực thể không gian độc lập, được liên kết với dữ liệu khách thuê, hợp đồng, giá thuê, điện nước, chi phí và trạng thái vận hành.</p>
      </article>
      <article className="concept-card">
        <span className="concept-index">03</span>
        <span className="eyebrow">HOW · LÀM NHƯ THẾ NÀO</span>
        <h3>Liên kết BODY–FACE–NODE với dữ liệu nghiệp vụ</h3>
        <p>Người dùng tương tác với mô hình bằng xoay, zoom, floor slicing và click-to-action. ID phòng/BODY là cầu nối giữa hình học 3D và dữ liệu nghiệp vụ phía sau.</p>
      </article>
    </section>

    <section className="about-split">
      <div className="panel about-scope">
        <span className="eyebrow">PHẠM VI THỬ NGHIỆM</span>
        <h3>1 tòa nhà · 8 tầng · khoảng 4–6 căn/tầng</h3>
        <p>Quy mô này được nhóm chọn để thể hiện tổ chức đối tượng theo độ cao, truy vấn không gian, bóc tách tầng và liên kết dữ liệu 3D với dữ liệu thuộc tính.</p>
        <div className="scope-tags"><span>3D spatial data</span><span>Room status</span><span>Contracts</span><span>Utilities</span><span>Maintenance</span></div>
      </div>
      <div className="panel tech-flow">
        <span className="eyebrow">KIẾN TRÚC CÔNG NGHỆ ĐỀ XUẤT</span>
        <div className="flow-row"><strong>React + Three.js</strong><span>Frontend & 3D interaction</span></div>
        <i>↓</i>
        <div className="flow-row"><strong>REST API + JSON</strong><span>Giao tiếp dữ liệu</span></div>
        <i>↓</i>
        <div className="flow-row"><strong>Node.js + Express.js</strong><span>Backend nghiệp vụ</span></div>
        <i>↓</i>
        <div className="flow-row"><strong>PostgreSQL + PostGIS</strong><span>Dữ liệu nghiệp vụ & không gian</span></div>
      </div>
    </section>

    <section className="faq-section">
      <div className="faq-title">
        <span className="eyebrow">Q&A · CÂU HỎI THƯỜNG GẶP</span>
        <h3>Hiểu nhanh logic của đề tài</h3>
        <p>Các câu trả lời dưới đây được rút trực tiếp từ phạm vi, mục tiêu, use case và lựa chọn công nghệ của nhóm.</p>
      </div>
      <div className="faq-list">
        {faqs.map((item,index)=><details key={item.q} className="faq-item" open={index===0}>
          <summary><span>{String(index+1).padStart(2,'0')}</span><strong>{item.q}</strong><b>＋</b></summary>
          <p>{item.a}</p>
        </details>)}
      </div>
    </section>
  </div>
}

function DataPage({type}) {
  const configs={
    rooms:['Danh mục căn hộ','Quản lý trạng thái, diện tích và giá thuê','Thêm căn hộ'],
    tenants:['Cư dân','Hồ sơ khách thuê đang lưu trú','Thêm cư dân'],
    contracts:['Hợp đồng','Theo dõi hợp đồng và thời hạn thuê','Tạo hợp đồng'],
    utilities:['Điện & Nước','Ghi nhận chỉ số tiêu thụ hàng tháng','Nhập chỉ số'],
    maintenance:['Bảo trì','Tiếp nhận và theo dõi yêu cầu sửa chữa','Tạo yêu cầu'],
    reports:['Báo cáo','Thống kê doanh thu và tỷ lệ lấp đầy','Xuất báo cáo'],
  }
  const [title,desc,action]=configs[type] || configs.rooms
  const sample=rooms.slice(0,9)
  return <div className="page-scroll"><div className="section-head"><div><span className="eyebrow">QUẢN LÝ</span><h2>{title}</h2><p>{desc}</p></div><button className="primary-btn">＋ {action}</button></div>
    <section className="panel table-panel"><div className="table-tools"><label className="search wide"><span>⌕</span><input placeholder="Tìm kiếm..." /></label><button className="secondary-btn">Bộ lọc</button></div>
    <div className="data-table"><div className="tr th"><span>Phòng</span><span>Tầng</span><span>Diện tích</span><span>Giá thuê</span><span>Trạng thái</span><span/></div>
    {sample.map(r=><div className="tr" key={r.id}><strong>P.{r.code}</strong><span>Tầng {r.floor}</span><span>{r.area} m²</span><span>{formatMoney(r.rent)}</span><span><i className="mini-dot" style={{background:STATUS[r.status].color}}/>{STATUS[r.status].label}</span><button className="table-more">•••</button></div>)}</div></section>
  </div>
}

export default function App(){
  const [page,setPage]=useState('map')
  return <div className="app-shell"><Sidebar page={page} setPage={setPage}/><div className="workspace"><Topbar page={page}/><div className="content">{page==='about'?<AboutPage/>:page==='overview'?<Overview setPage={setPage}/>:page==='map'?<MapPage/>:<DataPage type={page}/>}</div></div></div>
}
