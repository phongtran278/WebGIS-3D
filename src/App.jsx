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
  ['about','Về đề tài'],
  ['overview','Tổng quan'],
  ['map','WebGIS 3D'],
  ['rooms','Căn hộ'],
  ['tenants','Cư dân'],
  ['contracts','Hợp đồng'],
  ['utilities','Điện & Nước'],
  ['maintenance','Bảo trì'],
  ['reports','Báo cáo'],
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
    <nav>{navItems.map(([id,label]) =>
      <button key={id} className={'nav-item '+(page===id?'active':'')} onClick={()=>setPage(id)}>
        <span>{label}</span>{id==='map'&&<span className="live-dot"/>}
      </button>)}
    </nav>
    <div className="sidebar-spacer"/>
    <div className="building-mini"><span className="eyebrow">TÒA NHÀ</span><strong>Mini Apartment 01</strong><span>8 tầng · 40 căn hộ</span></div>
    <button className="profile profile-text"><span><strong>Ban quản lý</strong><small>Mini Apartment 01</small></span><span>•••</span></button>
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
  const occupancy=Math.round(occupied/40*100)

  return <div className="page-scroll overview-premium">
    <section className="overview-hero">
      <div>
        <span className="eyebrow">TỔNG QUAN VẬN HÀNH · MINI APARTMENT 01</span>
        <h2>Một tòa nhà.<br/><em className="editorial-serif">Một góc nhìn vận hành.</em></h2>
        <p>Trạng thái căn hộ, tỷ lệ lấp đầy và các hoạt động gần đây được gom vào một bức tranh duy nhất — trước khi đi sâu vào từng phòng trên sa bàn 3D.</p>
      </div>
      <button className="primary-btn hero-cta" onClick={()=>setPage('map')}>Mở WebGIS 3D →</button>
    </section>

    <section className="metric-row">
      <div className="metric-card metric-main"><span className="eyebrow">TỶ LỆ LẤP ĐẦY</span><strong>{occupancy}%</strong><p>{occupied} trên 40 căn hộ đang có người thuê.</p></div>
      <div className="metric-card"><span className="metric-kicker">40</span><strong>Tổng căn hộ</strong><p>8 tầng · 5 căn/tầng trong dữ liệu prototype.</p></div>
      <div className="metric-card"><span className="metric-kicker">{vacant}</span><strong>Phòng trống</strong><p>Sẵn sàng cho nhu cầu tìm thuê.</p></div>
      <div className="metric-card"><span className="metric-kicker">{maintenance}</span><strong>Đang bảo trì</strong><p>Cần theo dõi trong vận hành.</p></div>
    </section>

    <section className="overview-editorial-grid">
      <div className="panel occupancy-card premium-overview-panel">
        <div className="panel-head premium-panel-head">
          <div><span className="eyebrow">OCCUPANCY BY FLOOR</span><h3>Công suất theo từng tầng</h3></div>
          <span className="panel-number">{occupancy}%</span>
        </div>
        <div className="bars premium-bars">{[8,7,6,5,4,3,2,1].map(f=>{const rs=rooms.filter(r=>r.floor===f); const n=rs.filter(r=>r.status==='occupied').length; return <div className="bar-row" key={f}><span>T{f}</span><div><i style={{width:(n/5*100)+'%'}}/></div><b>{n}/5</b></div>})}</div>
      </div>

      <div className="panel activity premium-overview-panel">
        <div className="panel-head premium-panel-head">
          <div><span className="eyebrow">RECENT ACTIVITY</span><h3>Những gì vừa thay đổi</h3></div>
          <button className="ghost-btn">Xem tất cả</button>
        </div>
        {[['P.701','Gia hạn hợp đồng','12 phút trước'],['P.402','Nhập chỉ số điện nước','36 phút trước'],['P.305','Tạo yêu cầu bảo trì','1 giờ trước'],['P.103','Cập nhật trạng thái phòng','2 giờ trước']].map(x=><div className="activity-row premium-activity" key={x[0]}><span className="room-chip">{x[0]}</span><div><strong>{x[1]}</strong><small>{x[2]}</small></div><span>›</span></div>)}
      </div>
    </section>
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
  const statusLabel = status==='all' ? 'Tất cả trạng thái' : STATUS[status].label

  return <div className="map-layout premium-map-layout">
    <main className="map-stage premium-map-stage">
      <div className="map-story">
        <span className="eyebrow">SPATIAL OPERATIONS · LIVE PROTOTYPE</span>
        <h2>{floor===0?'Toàn bộ tòa nhà':'Tầng '+floor}</h2>
        <p>{statusLabel} · Click trực tiếp vào căn hộ để xem dữ liệu không gian và nghiệp vụ.</p>
      </div>

      <div className="map-toolbar premium-map-toolbar">
        <div className="segmented"><button className={floor===0?'active':''} onClick={()=>setFloor(0)}>Tất cả</button>{[1,2,3,4,5,6,7,8].map(f=><button key={f} className={floor===f?'active':''} onClick={()=>setFloor(f)}>T{f}</button>)}</div>
        <select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="vacant">Phòng trống</option><option value="occupied">Đang thuê</option><option value="maintenance">Bảo trì</option></select>
      </div>

      <Building3D activeFloor={floor} statusFilter={status} selectedRoom={selected} onSelectRoom={selectRoom}/>

      <div className="legend premium-legend">{Object.entries(STATUS).map(([k,v])=><button key={k} className={status===k?'active':''} onClick={()=>setStatus(status===k?'all':k)}><i style={{background:v.color}}/>{v.label}</button>)}</div>
      <div className="view-help"><span>Kéo để xoay</span><span>Cuộn để zoom</span></div>
    </main>
    <Inspector room={selected} onClose={()=>setSelected(null)}/>
  </div>
}

function AboutPage() {
  const faqs = [
    {
      q: 'Vì sao đề tài cần GIS 3D thay vì chỉ dùng bảng dữ liệu?',
      a: 'Vấn đề cốt lõi mà nhóm xác định là khoảng cách giữa dữ liệu dạng số, văn bản và cấu trúc kiến trúc thực tế của tòa nhà. Khi chỉ dùng bảng biểu, ban quản lý phải tự đối chiếu mã phòng với vị trí thật, khó nắm nhanh tình trạng của toàn bộ công trình và dễ rơi vào trạng thái “mù không gian” trong vận hành.'
    },
    {
      q: 'Đề tài này thực chất đang xây dựng cái gì?',
      a: 'Đây là ứng dụng WebGIS 3D quản lý cho thuê căn hộ chung cư mini 8 tầng. Mỗi căn hộ được xem như một thực thể không gian độc lập, đồng thời được liên kết với dữ liệu nghiệp vụ như trạng thái phòng, khách thuê, hợp đồng, điện nước, chi phí và bảo trì.'
    },
    {
      q: 'Điểm nổi bật của đề tài nằm ở đâu?',
      a: 'Điểm nổi bật không nằm ở CRUD dữ liệu đơn thuần, mà ở việc mô hình 3D trở thành một phần trực tiếp của quy trình quản lý. Người dùng có thể quan sát, truy vấn, lọc tầng, nhấp vào từng phòng và thao tác quản lý ngay trên đối tượng 3D.'
    },
    {
      q: 'Người dùng thao tác với căn hộ trên mô hình như thế nào?',
      a: 'Người dùng có thể xoay, thu phóng, chọn tầng và nhấp trực tiếp lên căn hộ. Theo hướng dữ liệu mà nhóm xác định, thao tác nhấp trên bề mặt FACE được dùng để xác định khối BODY tương ứng, sau đó truy xuất dữ liệu căn hộ thông qua mã định danh liên kết.'
    },
    {
      q: 'Floor Slicing giải quyết vấn đề gì?',
      a: 'Trong môi trường 3D nhiều tầng, các khối phía trên có thể che khuất tầm nhìn. Vì vậy hệ thống cung cấp chức năng bóc tách tầng, cho phép ẩn hoặc làm trong suốt các tầng phía trên để quan sát rõ mặt bằng tầng đang chọn.'
    },
    {
      q: 'Màu sắc trên mô hình có ý nghĩa gì?',
      a: 'Hệ thống dùng bản đồ chuyên đề để trực quan hóa trạng thái vận hành: xanh cho phòng trống, đỏ cho phòng đang thuê và vàng cho phòng đang bảo trì. Khi dữ liệu nghiệp vụ thay đổi, màu hiển thị của căn hộ cũng thay đổi tương ứng.'
    },
    {
      q: 'Ai là người sử dụng hệ thống?',
      a: 'Các nhóm người dùng chính gồm Ban Quản Lý, Nhân Viên vận hành, Khách Tìm Thuê và Cư Dân. Trong đó Ban Quản Lý là nhóm có nhu cầu giám sát tổng thể và có quyền thao tác rộng nhất.'
    },
    {
      q: 'Vì sao nhóm chọn quy mô 8 tầng, khoảng 4–6 căn mỗi tầng?',
      a: 'Đây là quy mô thử nghiệm phù hợp cho phạm vi đồ án. Nó đủ để thể hiện các đặc trưng của GIS 3D như tổ chức đối tượng theo độ cao, truy vấn không gian, bóc tách tầng và liên kết dữ liệu hình học với dữ liệu thuộc tính.'
    },
    {
      q: 'Đề tài có hướng tới mô hình BIM chi tiết không?',
      a: 'Không. Phạm vi đồ án tập trung vào cấu trúc cần thiết để biểu diễn và tương tác với tầng, căn hộ và dữ liệu vận hành, chứ không hướng đến xây dựng mô hình BIM chi tiết.'
    },
    {
      q: 'Những gì nằm ngoài phạm vi của đề tài?',
      a: 'Các nội dung chuyên sâu như quản lý thuế, kế toán doanh nghiệp, tích hợp ngân hàng, phòng cháy chữa cháy hay quản lý thiết bị kỹ thuật chi tiết được xác định là nằm ngoài phạm vi đồ án.'
    }
  ]

  return <div className="page-scroll about-page landing-about">
    <section className="landing-hero">
      <div className="hero-copy">
        <span className="eyebrow">WEBGIS 3D · NHÓM 3 · CHUNG CƯ MINI 8 TẦNG</span>
        <h2>Quản lý căn hộ<br/>không chỉ bằng dữ liệu,<br/><em>mà bằng chính không gian.</em></h2>
        <p>Đề tài hướng đến việc biến mô hình 3D của tòa nhà thành một công cụ quản lý trực tiếp — nơi người dùng có thể quan sát, truy vấn và cập nhật thông tin ngay trên từng căn hộ, thay vì phải tự đối chiếu dữ liệu rời rạc trong bảng biểu.</p>

        <div className="hero-meta">
          <div><strong>8 tầng</strong><span>Một tòa chung cư mini thử nghiệm</span></div>
          <div><strong>4–6 căn / tầng</strong><span>Đủ để thể hiện logic GIS 3D</span></div>
          <div><strong>WebGIS</strong><span>Quản lý vận hành qua trình duyệt</span></div>
        </div>
      </div>

      <div className="hero-note">
        <div className="hero-note-card">
          <span className="eyebrow">CORE IDEA</span>
          <h3>Thu hẹp khoảng cách giữa dữ liệu quản lý và cấu trúc thực tế của công trình.</h3>
          <p>Thay vì nhìn tòa nhà như một danh sách mã phòng, hệ thống nhìn mỗi căn hộ như một thực thể không gian có vị trí, trạng thái và dữ liệu nghiệp vụ đi kèm.</p>
        </div>
      </div>
    </section>

    <section className="story-grid">
      <article className="story-card"><span className="story-index editorial-serif">WHY</span><h3>Vì sao cần đề tài này?</h3><p>Quản lý bằng bảng dữ liệu khiến ban quản lý khó nhìn nhanh bức tranh tổng thể của công trình, khó theo dõi trạng thái từng phòng và thiếu công cụ trực quan khi làm việc với khách thuê tiềm năng.</p></article>
      <article className="story-card"><span className="story-index editorial-serif">WHAT</span><h3>Đề tài giải quyết điều gì?</h3><p>Xây dựng một ứng dụng WebGIS 3D cho phép quản lý căn hộ, khách thuê, hợp đồng, điện nước và bảo trì, đồng thời gắn các thông tin đó vào mô hình không gian 3D của một tòa nhà 8 tầng.</p></article>
      <article className="story-card"><span className="story-index editorial-serif">HOW</span><h3>Đề tài vận hành như thế nào?</h3><p>Mô hình 3D và dữ liệu nghiệp vụ được liên kết thông qua ID căn hộ/BODY. Người dùng có thể floor slicing, thematic mapping, click-to-action và xem dữ liệu chi tiết ngay trên các đối tượng 3D.</p></article>
    </section>

    <section className="logic-strip">
      <div className="logic-item"><span className="eyebrow">INPUT</span><strong>Dữ liệu không gian + dữ liệu thuộc tính</strong><p>Mô hình 3D tòa nhà, tầng, căn hộ và dữ liệu khách thuê, hợp đồng, điện nước, bảo trì.</p></div>
      <div className="logic-arrow">→</div>
      <div className="logic-item"><span className="eyebrow">MECHANISM</span><strong>Liên kết hình học với nghiệp vụ</strong><p>Click vào phòng để truy xuất thông tin, cập nhật trạng thái và hỗ trợ quan sát trực tiếp trên mô hình.</p></div>
      <div className="logic-arrow">→</div>
      <div className="logic-item"><span className="eyebrow">OUTPUT</span><strong>Quản lý trực quan và chính xác hơn</strong><p>Hỗ trợ giám sát tình trạng lấp đầy, tìm phòng trống, theo dõi bảo trì và nắm bắt vận hành nhanh hơn.</p></div>
    </section>

    <section className="split-panels">
      <div className="panel premium-panel">
        <span className="eyebrow">PHẠM VI THỬ NGHIỆM</span>
        <h3>Một prototype đủ rõ để <em className="editorial-serif">chứng minh giá trị.</em></h3>
        <p>Hệ thống được triển khai thử nghiệm trên một chung cư mini 8 tầng, mỗi tầng khoảng 4–6 căn hộ. Mô hình tập trung vào cấu trúc cần thiết để biểu diễn, tương tác và liên kết dữ liệu, không đi theo hướng BIM chi tiết.</p>
        <div className="tag-cluster"><span>3D Spatial Data</span><span>Room Status</span><span>Tenants</span><span>Contracts</span><span>Utilities</span><span>Maintenance</span></div>
      </div>

      <div className="panel premium-panel">
        <span className="eyebrow">CÔNG NGHỆ ĐỀ XUẤT</span>
        <h3>Một stack gọn và rõ cho <em className="editorial-serif">WebGIS 3D.</em></h3>
        <div className="stack-list">
          <div className="stack-row"><strong>React + Three.js</strong><span>Giao diện, component và tương tác mô hình 3D</span></div>
          <div className="stack-row"><strong>REST API + JSON</strong><span>Lớp giao tiếp giữa frontend và backend</span></div>
          <div className="stack-row"><strong>Node.js + Express.js</strong><span>Xử lý nghiệp vụ và cung cấp dịch vụ dữ liệu</span></div>
          <div className="stack-row"><strong>PostgreSQL + PostGIS</strong><span>Lưu trữ dữ liệu nghiệp vụ và dữ liệu không gian</span></div>
        </div>
      </div>
    </section>

    <section className="faq-landing">
      <div className="faq-landing-head"><span className="eyebrow">Q&A</span><h3>Những câu hỏi giúp nhìn ra <em className="editorial-serif">logic của đề tài.</em></h3><p>Phần này giải thích nhanh giá trị, cơ chế và giới hạn của hệ thống dựa trên tài liệu nhóm.</p></div>
      <div className="faq-list large-faq">
        {faqs.map((item,index)=><details key={item.q} className="faq-item" open={index===0}><summary><span>{String(index+1).padStart(2,'0')}</span><strong>{item.q}</strong><b>＋</b></summary><p>{item.a}</p></details>)}
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
