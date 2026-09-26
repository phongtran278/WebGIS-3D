import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const STATUS = {
  vacant: { label: 'Phòng trống', color: '#6cb69f', soft: '#e6f1ed' },
  occupied: { label: 'Đang thuê', color: '#c97970', soft: '#f7e9e7' },
  maintenance: { label: 'Bảo trì', color: '#d6ad58', soft: '#fff4ce' },
}

const tenantNames = [
  'Nguyễn Minh Anh','Trần Quốc Huy','Lê Thảo Vy','Phạm Gia Bảo','Võ Ngọc Hà','Đặng Hoàng Nam',
  'Bùi Khánh Linh','Nguyễn Tuấn Kiệt','Trương Mỹ Duyên','Lê Đức Anh','Huỳnh Bảo Trân','Phan Minh Khang',
  'Đỗ Ngọc Mai','Trần Anh Khoa','Nguyễn Hà My','Võ Thành Đạt','Lương Khánh An','Phạm Quỳnh Như',
  'Mai Nhật Minh','Đinh Thanh Trúc','Nguyễn Quốc Bảo','Lê Hoài Phương','Trần Minh Quân','Vũ Thùy Dương',
  'Ngô Gia Hân','Phạm Đức Long','Lê Minh Châu','Nguyễn Hải Đăng','Trần Bảo Ngọc','Võ Hoàng Phúc',
  'Đỗ Thanh Tâm','Nguyễn Khánh Vy','Lê Quốc Khánh','Trương Anh Thư','Phạm Minh Triết','Bùi Yến Nhi'
]

const roomIssues = ['Điều hòa cần kiểm tra','Rò rỉ vòi lavabo','Đèn hành lang chập chờn','Khóa cửa cần bảo dưỡng','Kiểm tra áp lực nước','Sơn tường cần xử lý']

const rooms = Array.from({ length: 8 }, (_, floorIndex) =>
  Array.from({ length: 6 }, (_, roomIndex) => {
    const floor = floorIndex + 1
    const no = floor * 100 + roomIndex + 1
    const statusPool = ['occupied','occupied','vacant','occupied','maintenance','vacant']
    const status = statusPool[(roomIndex + floorIndex) % statusPool.length]
    const tenantIndex = floorIndex * 4 + roomIndex
    const tenant = status === 'occupied' ? tenantNames[tenantIndex % tenantNames.length] : null
    return {
      id: 'R' + no,
      code: String(no),
      floor,
      bodyId: 'BODY_' + String(no).padStart(4,'0'),
      area: [28,31,35,39,43,47][roomIndex],
      bedrooms: roomIndex < 3 ? 1 : 2,
      rent: [5200000,5700000,6200000,6800000,7300000,7900000][roomIndex] + floorIndex * 100000,
      status,
      tenant,
      phone: tenant ? '09' + String(12000000 + tenantIndex * 731).slice(-8) : null,
      contractCode: tenant ? 'HD-' + String(no) + '-26' : null,
      contractEnd: tenant ? ['30/11/2026','31/12/2026','28/02/2027','31/03/2027'][tenantIndex % 4] : null,
      electricity: 218 + floor * 17 + roomIndex * 11,
      water: 14 + floor + roomIndex * 2,
      issue: status === 'maintenance' ? roomIssues[(floorIndex + roomIndex) % roomIssues.length] : null,
    }
  })
).flat()

const navItems = [
  ['about','Về đề tài','/about'],
  ['overview','Tổng quan','/overview'],
  ['map','WebGIS 3D','/map'],
  ['rooms','Căn hộ','/apartments'],
  ['tenants','Cư dân','/tenants'],
  ['contracts','Hợp đồng','/contracts'],
  ['utilities','Điện & Nước','/utilities'],
  ['maintenance','Bảo trì','/maintenance'],
  ['reports','Báo cáo','/reports'],
]

const pageFromPath = (pathname) => {
  const hit = navItems.find(([, , path]) => path === pathname)
  return hit?.[0] || 'about'
}
const pathFromPage = (page) => navItems.find(([id]) => id === page)?.[2] || '/about'

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

    const floorH = 1.38
    const roomW = 2.45
    const roomD = 2.55
    const roomH = 1.02
    const roomPositions = [
      [-2.65,-1.65],[0,-1.65],[2.65,-1.65],
      [-2.65, 1.65],[0, 1.65],[2.65, 1.65],
    ]

    for(let f=1; f<=8; f++){
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(8.65,.10,6.65),
        new THREE.MeshStandardMaterial({color:'#ecece8',roughness:.92,metalness:0})
      )
      slab.position.set(0,(f-1)*floorH,.0)
      slab.receiveShadow=true
      scene.add(slab)

      const corridor = new THREE.Mesh(
        new THREE.BoxGeometry(8.15,.035,.72),
        new THREE.MeshStandardMaterial({color:'#dfe1dc',roughness:.9})
      )
      corridor.position.set(0,(f-1)*floorH+.08,0)
      corridor.receiveShadow=true
      scene.add(corridor)
    }

    rooms.forEach((room) => {
      const idx = (Number(room.code) % 100) - 1
      const [x,z] = roomPositions[idx]
      const shape = new THREE.BoxGeometry(roomW,roomH,roomD)
      const mat = new THREE.MeshStandardMaterial({
        color: STATUS[room.status].color,
        roughness:.62,
        metalness:.015,
        transparent:true,
        opacity:.90,
      })
      const mesh = new THREE.Mesh(shape,mat)
      mesh.position.set(x,(room.floor-1)*floorH+.60,z)
      mesh.castShadow=true; mesh.receiveShadow=true
      mesh.userData.roomId=room.id
      scene.add(mesh)
      roomMeshesRef.current.set(room.id,mesh)

      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(shape),
        new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.72})
      )
      edge.position.copy(mesh.position)
      scene.add(edge)
      mesh.userData.edge=edge

      const balcony = new THREE.Mesh(
        new THREE.BoxGeometry(roomW*.78,.045,.42),
        new THREE.MeshStandardMaterial({color:'#d9dbd6',roughness:.88})
      )
      balcony.position.set(x,(room.floor-1)*floorH+.20,z + (z<0?-1:1)*1.49)
      balcony.castShadow=true
      scene.add(balcony)
    })

    const core = new THREE.Mesh(
      new THREE.BoxGeometry(1.45,11.15,1.28),
      new THREE.MeshStandardMaterial({color:'#cfd2cc',roughness:.82})
    )
    core.position.set(0,5.25,0)
    core.castShadow=true
    scene.add(core)

    ;[[-4.05,-2.95],[4.05,-2.95],[-4.05,2.95],[4.05,2.95]].forEach(([x,z])=>{
      const column=new THREE.Mesh(
        new THREE.BoxGeometry(.18,11.2,.18),
        new THREE.MeshStandardMaterial({color:'#bfc3bd',roughness:.8})
      )
      column.position.set(x,5.25,z)
      column.castShadow=true
      scene.add(column)
    })

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(8.8,.14,6.8),
      new THREE.MeshStandardMaterial({color:'#e4e5e1',roughness:.9})
    )
    roof.position.set(0,8*floorH-.03,0)
    roof.castShadow=true
    scene.add(roof)

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
    <button className="brand brand-text-only brand-button" onClick={()=>setPage('about')} aria-label="Về đề tài">
      <div><strong>WebGIS 3D</strong><span>Spatial apartment management</span></div>
    </button>
    <nav>{navItems.map(([id,label,path]) =>
      <button key={id} className={'nav-item '+(page===id?'active':'')} onClick={()=>setPage(id)} aria-current={page===id?'page':undefined}>
        <span>{label}</span>{id==='map'&&<span className="live-dot"/>}
      </button>)}
    </nav>
    <div className="sidebar-spacer"/>
    <div className="building-mini"><span className="eyebrow">TÒA NHÀ</span><strong>Mini Apartment 01</strong><span>8 tầng · 48 căn hộ</span></div>
    <button className="profile profile-text"><span><strong>Ban quản lý</strong><small>Mini Apartment 01</small></span><span>•••</span></button>
  </aside>
}

function Topbar({page,setPage}) {
  const title = navItems.find(x=>x[0]===page)?.[1] || 'WebGIS 3D'
  const navigate = useNavigate()
  const [query,setQuery] = useState('')
  const [noticeOpen,setNoticeOpen] = useState(false)

  const submitSearch = (e) => {
    e.preventDefault()
    const q=query.trim()
    navigate(q ? '/apartments?q='+encodeURIComponent(q) : '/apartments')
  }

  return <header className="topbar">
    <div><span className="crumb">Mini Apartment 01</span><h1>{title}</h1></div>
    <div className="top-actions">
      <form className="search" onSubmit={submitSearch}><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm phòng / cư dân" /></form>
      <button className="top-text-btn" onClick={()=>setPage('about')}>Q&A đề tài</button>
      <div className="notice-wrap">
        <button className={'top-text-btn '+(noticeOpen?'active':'')} onClick={()=>setNoticeOpen(v=>!v)}>Thông báo <span className="notice-count">3</span></button>
        {noticeOpen&&<div className="notice-popover">
          <span className="eyebrow">THÔNG BÁO GẦN ĐÂY</span>
          <strong>Vận hành tòa nhà</strong>
          <div><b>P.305</b><span>Yêu cầu bảo trì mới</span></div>
          <div><b>P.701</b><span>Hợp đồng sắp đến kỳ rà soát</span></div>
          <div><b>P.402</b><span>Đã cập nhật điện nước tháng này</span></div>
        </div>}
      </div>
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
  const occupancy=Math.round(occupied/rooms.length*100)

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
      <div className="metric-card metric-main"><span className="eyebrow">TỶ LỆ LẤP ĐẦY</span><strong>{occupancy}%</strong><p>{occupied} trên 48 căn hộ đang có người thuê.</p></div>
      <div className="metric-card"><span className="metric-kicker">{rooms.length}</span><strong>Tổng căn hộ</strong><p>8 tầng · 6 căn/tầng, vẫn nằm trong phạm vi 4–6 căn/tầng của đồ án.</p></div>
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
          <button className="ghost-btn" onClick={()=>setPage('reports')}>Xem báo cáo</button>
        </div>
        {[['P.701','Gia hạn hợp đồng','12 phút trước'],['P.402','Nhập chỉ số điện nước','36 phút trước'],['P.305','Tạo yêu cầu bảo trì','1 giờ trước'],['P.103','Cập nhật trạng thái phòng','2 giờ trước']].map(x=><div className="activity-row premium-activity" key={x[0]}><span className="room-chip">{x[0]}</span><div><strong>{x[1]}</strong><small>{x[2]}</small></div><span>›</span></div>)}
      </div>
    </section>
  </div>
}

function Inspector({room,onClose,onUpdate,onDetail}) {
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
    <div className="inspector-actions"><button className="secondary-btn" onClick={()=>onUpdate?.(room)}>Cập nhật</button><button className="primary-btn" onClick={()=>onDetail?.(room)}>Xem chi tiết</button></div>
  </aside>
}

function MapPage() {
  const [floor,setFloor]=useState(0)
  const [status,setStatus]=useState('all')
  const [selected,setSelected]=useState(null)
  const [actionRoom,setActionRoom]=useState(null)
  const [actionMode,setActionMode]=useState(null)
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
    <Inspector room={selected} onClose={()=>setSelected(null)} onUpdate={room=>{setActionRoom(room);setActionMode('update')}} onDetail={room=>{setActionRoom(room);setActionMode('detail')}}/>
    {actionRoom&&<div className="modal-backdrop" onClick={()=>setActionRoom(null)}><div className="action-modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">{actionMode==='update'?'CẬP NHẬT CĂN HỘ':'CHI TIẾT CĂN HỘ'}</span><h3>P.{actionRoom.code}</h3></div><button className="icon-btn" onClick={()=>setActionRoom(null)}>×</button></div>
      <div className="modal-grid"><div><span>Trạng thái</span><strong>{STATUS[actionRoom.status].label}</strong></div><div><span>Người thuê</span><strong>{actionRoom.tenant||'Chưa có'}</strong></div><div><span>Giá thuê</span><strong>{formatMoney(actionRoom.rent)}</strong></div><div><span>BODY ID</span><code>{actionRoom.bodyId}</code></div></div>
      {actionMode==='update'?<><label className="field-label">Trạng thái prototype<select defaultValue={actionRoom.status}><option value="vacant">Phòng trống</option><option value="occupied">Đang thuê</option><option value="maintenance">Bảo trì</option></select></label><button className="primary-btn modal-primary" onClick={()=>setActionRoom(null)}>Lưu bản demo</button></>:<button className="primary-btn modal-primary" onClick={()=>setActionRoom(null)}>Đóng chi tiết</button>}
    </div></div>}
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
    <section className="bento-hero">
      <div className="bento-card bento-hero-main motion-rise">
        <span className="eyebrow">WEBGIS 3D · NHÓM 3 · CHUNG CƯ MINI 8 TẦNG</span>
        <div className="hero-main-copy">
          <h2>Quản lý căn hộ<br/>không chỉ bằng dữ liệu,<br/><em className="editorial-serif">mà bằng chính không gian.</em></h2>
          <p>Đề tài hướng đến việc biến mô hình 3D của tòa nhà thành một công cụ quản lý trực tiếp — nơi người dùng có thể quan sát, truy vấn và cập nhật thông tin ngay trên từng căn hộ, thay vì phải tự đối chiếu dữ liệu rời rạc trong bảng biểu.</p>
        </div>
        <div className="hero-arrow-flow" aria-hidden="true"><span>→</span><span>→</span><span>→</span></div>
      </div>

      <div className="bento-card bento-core motion-rise delay-1">
        <span className="eyebrow">CORE IDEA</span>
        <h3>Thu hẹp khoảng cách giữa <em className="editorial-serif">dữ liệu quản lý</em> và cấu trúc thực tế.</h3>
        <p>Thay vì nhìn tòa nhà như một danh sách mã phòng, hệ thống nhìn mỗi căn hộ như một thực thể không gian có vị trí, trạng thái và dữ liệu nghiệp vụ đi kèm.</p>
      </div>

      <div className="bento-card bento-metric metric-one motion-rise delay-2"><strong>8 tầng</strong><span>Một mô hình thử nghiệm đủ rõ để thể hiện logic GIS 3D.</span></div>
      <div className="bento-card bento-metric metric-two motion-rise delay-3"><strong>4–6 căn / tầng</strong><span>Quy mô phù hợp để tổ chức đối tượng theo độ cao, truy vấn và bóc tách tầng.</span></div>
    </section>

    <section className="bento-grid">
      <article className="bento-card bento-story motion-rise"><span className="story-index editorial-serif">WHY</span><h3>Vì sao cần đề tài này?</h3><p>Quản lý bằng bảng dữ liệu khiến ban quản lý khó nhìn nhanh bức tranh tổng thể của công trình, khó theo dõi trạng thái từng phòng và thiếu công cụ trực quan khi làm việc với khách thuê tiềm năng.</p></article>
      <article className="bento-card bento-story motion-rise delay-1"><span className="story-index editorial-serif">WHAT</span><h3>Đề tài giải quyết điều gì?</h3><p>Xây dựng một ứng dụng WebGIS 3D cho phép quản lý căn hộ, khách thuê, hợp đồng, điện nước và bảo trì, đồng thời gắn các thông tin đó vào mô hình không gian 3D của một tòa nhà 8 tầng.</p></article>
      <article className="bento-card bento-story motion-rise delay-2"><span className="story-index editorial-serif">HOW</span><h3>Đề tài vận hành như thế nào?</h3><p>Mô hình 3D và dữ liệu nghiệp vụ được liên kết thông qua ID căn hộ/BODY. Người dùng có thể floor slicing, thematic mapping, click-to-action và xem dữ liệu chi tiết ngay trên các đối tượng 3D.</p></article>

      <article className="bento-card bento-logic motion-rise">
        <span className="eyebrow">MECHANISM</span>
        <h3>Input → Interaction → Insight</h3>
        <p>Dữ liệu không gian và dữ liệu thuộc tính được kết nối để tạo ra một luồng quản lý trực quan: chọn tầng, nhấp căn hộ, đọc thông tin và theo dõi vận hành.</p>
        <div className="mini-flow"><span>Data</span><i>→</i><span>3D Model</span><i>→</i><span>Action</span></div>
      </article>

      <article className="bento-card bento-scope motion-rise delay-1">
        <span className="eyebrow">PHẠM VI THỬ NGHIỆM</span>
        <h3>Một prototype đủ rõ để <em className="editorial-serif">chứng minh giá trị.</em></h3>
        <p>Hệ thống được triển khai thử nghiệm trên một chung cư mini 8 tầng, mỗi tầng khoảng 4–6 căn hộ. Mô hình tập trung vào cấu trúc cần thiết để biểu diễn, tương tác và liên kết dữ liệu, không đi theo hướng BIM chi tiết.</p>
        <div className="tag-cluster"><span>3D Spatial Data</span><span>Room Status</span><span>Tenants</span><span>Contracts</span><span>Utilities</span><span>Maintenance</span></div>
      </article>

      <article className="bento-card bento-tech motion-rise delay-2">
        <span className="eyebrow">CÔNG NGHỆ ĐỀ XUẤT</span>
        <h3>Một stack gọn và rõ cho <em className="editorial-serif">WebGIS 3D.</em></h3>
        <div className="stack-list">
          <div className="stack-row"><strong>React + Three.js</strong><span>Giao diện, component và tương tác mô hình 3D</span></div>
          <div className="stack-row"><strong>REST API + JSON</strong><span>Lớp giao tiếp giữa frontend và backend</span></div>
          <div className="stack-row"><strong>Node.js + Express.js</strong><span>Xử lý nghiệp vụ và cung cấp dịch vụ dữ liệu</span></div>
          <div className="stack-row"><strong>PostgreSQL + PostGIS</strong><span>Lưu trữ dữ liệu nghiệp vụ và dữ liệu không gian</span></div>
        </div>
      </article>
    </section>

    <section className="faq-landing">
      <div className="faq-landing-head motion-rise"><span className="eyebrow">Q&A</span><h3>Những câu hỏi giúp nhìn ra <em className="editorial-serif">logic của đề tài.</em></h3><p>Giải thích nhanh giá trị, cơ chế và giới hạn của hệ thống dựa trên tài liệu nhóm.</p></div>
      <div className="faq-list large-faq">{faqs.map((item,index)=><details key={item.q} className="faq-item motion-rise" open={index===0}><summary><span>{String(index+1).padStart(2,'0')}</span><strong>{item.q}</strong><b>＋</b></summary><p>{item.a}</p></details>)}</div>
    </section>
  </div>
}

function DataPage({type}) {
  const location=useLocation()
  const params=new URLSearchParams(location.search)
  const initial=params.get('q')||''
  const [query,setQuery]=useState(initial)
  const [onlyOccupied,setOnlyOccupied]=useState(false)
  const [modal,setModal]=useState(null)

  useEffect(()=>setQuery(initial),[initial])

  const configs={
    rooms:['Danh mục căn hộ','Trạng thái, diện tích, giá thuê và cư dân hiện tại','Thêm căn hộ'],
    tenants:['Cư dân','Danh sách cư dân đang thuê trong dữ liệu prototype','Thêm cư dân'],
    contracts:['Hợp đồng','Theo dõi hợp đồng gắn trực tiếp với từng căn hộ','Tạo hợp đồng'],
    utilities:['Điện & Nước','Chỉ số tiêu thụ gần nhất của từng phòng','Nhập chỉ số'],
    maintenance:['Bảo trì','Các căn hộ đang có yêu cầu kỹ thuật','Tạo yêu cầu'],
    reports:['Báo cáo','Tổng hợp trạng thái và mức độ lấp đầy','Xuất báo cáo'],
  }
  const [title,desc,action]=configs[type] || configs.rooms
  const q=query.trim().toLowerCase()
  const filtered=rooms.filter(r=>{
    const matches=!q||r.code.toLowerCase().includes(q)||(r.tenant||'').toLowerCase().includes(q)||(r.bodyId||'').toLowerCase().includes(q)
    return matches && (!onlyOccupied||r.status==='occupied')
  })

  if(type==='reports'){
    const occupied=rooms.filter(r=>r.status==='occupied').length
    const vacant=rooms.filter(r=>r.status==='vacant').length
    const maintenance=rooms.filter(r=>r.status==='maintenance').length
    return <div className="page-scroll"><div className="section-head"><div><span className="eyebrow">BÁO CÁO PROTOTYPE</span><h2>{title}</h2><p>{desc}</p></div><button className="primary-btn" onClick={()=>setModal({title:'Xuất báo cáo',text:'Bản prototype đã ghi nhận yêu cầu xuất báo cáo.'})}>Xuất báo cáo</button></div>
      <div className="report-grid"><div><span>Tổng căn</span><strong>{rooms.length}</strong></div><div><span>Đang thuê</span><strong>{occupied}</strong></div><div><span>Phòng trống</span><strong>{vacant}</strong></div><div><span>Bảo trì</span><strong>{maintenance}</strong></div></div>
      <section className="panel report-note"><span className="eyebrow">GHI CHÚ</span><h3>Dữ liệu hiện tại là dữ liệu prototype phục vụ trình diễn giao diện và tương tác.</h3></section>
      {modal&&<SimpleModal modal={modal} onClose={()=>setModal(null)}/>}
    </div>
  }

  const rows = type==='maintenance' ? filtered.filter(r=>r.status==='maintenance') : type==='tenants'||type==='contracts' ? filtered.filter(r=>r.tenant) : filtered

  return <div className="page-scroll">
    <div className="section-head"><div><span className="eyebrow">QUẢN LÝ</span><h2>{title}</h2><p>{desc}</p></div><button className="primary-btn" onClick={()=>setModal({title:action,text:'Đã mở thao tác '+action.toLowerCase()+' trong prototype.'})}>＋ {action}</button></div>
    <section className="panel table-panel">
      <div className="table-tools">
        <label className="search wide"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm phòng, tên cư dân, BODY ID..." /></label>
        <button className={'secondary-btn '+(onlyOccupied?'filter-active':'')} onClick={()=>setOnlyOccupied(v=>!v)}>{onlyOccupied?'Đang lọc: có người thuê':'Lọc phòng đang thuê'}</button>
      </div>
      <div className="data-table">
        {type==='rooms'&&<><div className="tr th rooms-tr"><span>Phòng</span><span>Tầng</span><span>Diện tích</span><span>Người thuê</span><span>Trạng thái</span><span/></div>{rows.map(r=><div className="tr rooms-tr" key={r.id}><strong>P.{r.code}</strong><span>Tầng {r.floor}</span><span>{r.area} m²</span><span>{r.tenant||'—'}</span><span><i className="mini-dot" style={{background:STATUS[r.status].color}}/>{STATUS[r.status].label}</span><button className="row-action" onClick={()=>setModal({title:'Căn hộ P.'+r.code,text:(r.tenant?'Người thuê: '+r.tenant+'. ':'Phòng hiện chưa có người thuê. ')+'Giá thuê '+formatMoney(r.rent)+'. BODY ID '+r.bodyId})}>Xem</button></div>)}</>}
        {type==='tenants'&&<><div className="tr th tenant-tr"><span>Cư dân</span><span>Phòng</span><span>Điện thoại</span><span>Hết hạn HĐ</span><span>Giá thuê</span><span/></div>{rows.map(r=><div className="tr tenant-tr" key={r.id}><strong>{r.tenant}</strong><span>P.{r.code}</span><span>{r.phone}</span><span>{r.contractEnd}</span><span>{formatMoney(r.rent)}</span><button className="row-action" onClick={()=>setModal({title:r.tenant,text:'Đang thuê căn P.'+r.code+', hợp đồng '+r.contractCode+' đến '+r.contractEnd+'.'})}>Xem</button></div>)}</>}
        {type==='contracts'&&<><div className="tr th contract-tr"><span>Hợp đồng</span><span>Cư dân</span><span>Phòng</span><span>Giá thuê</span><span>Hết hạn</span><span/></div>{rows.map(r=><div className="tr contract-tr" key={r.id}><strong>{r.contractCode}</strong><span>{r.tenant}</span><span>P.{r.code}</span><span>{formatMoney(r.rent)}</span><span>{r.contractEnd}</span><button className="row-action" onClick={()=>setModal({title:r.contractCode,text:r.tenant+' · P.'+r.code+' · '+formatMoney(r.rent)+'/tháng.'})}>Xem</button></div>)}</>}
        {type==='utilities'&&<><div className="tr th utility-tr"><span>Phòng</span><span>Cư dân</span><span>Điện</span><span>Nước</span><span>Kỳ ghi</span><span/></div>{rows.map(r=><div className="tr utility-tr" key={r.id}><strong>P.{r.code}</strong><span>{r.tenant||'—'}</span><span>{r.electricity} kWh</span><span>{r.water} m³</span><span>09/2026</span><button className="row-action" onClick={()=>setModal({title:'Điện & Nước P.'+r.code,text:'Chỉ số gần nhất: '+r.electricity+' kWh điện và '+r.water+' m³ nước.'})}>Xem</button></div>)}</>}
        {type==='maintenance'&&<><div className="tr th maintenance-tr"><span>Mã</span><span>Phòng</span><span>Sự cố</span><span>Tầng</span><span>Trạng thái</span><span/></div>{rows.map((r,i)=><div className="tr maintenance-tr" key={r.id}><strong>BT-{String(i+1).padStart(3,'0')}</strong><span>P.{r.code}</span><span>{r.issue}</span><span>Tầng {r.floor}</span><span><i className="mini-dot" style={{background:STATUS.maintenance.color}}/>Đang xử lý</span><button className="row-action" onClick={()=>setModal({title:'Bảo trì P.'+r.code,text:r.issue+'. Yêu cầu đang ở trạng thái xử lý trong dữ liệu prototype.'})}>Xem</button></div>)}</>}
      </div>
    </section>
    {modal&&<SimpleModal modal={modal} onClose={()=>setModal(null)}/>}
  </div>
}

function SimpleModal({modal,onClose}){
  return <div className="modal-backdrop" onClick={onClose}><div className="simple-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PROTOTYPE ACTION</span><h3>{modal.title}</h3></div><button className="icon-btn" onClick={onClose}>×</button></div><p>{modal.text}</p><button className="primary-btn modal-primary" onClick={onClose}>Xong</button></div></div>
}

export default function App(){
  const location = useLocation()
  const navigate = useNavigate()
  const page = pageFromPath(location.pathname)

  useEffect(() => {
    if (location.pathname === '/' || !navItems.some(([, , path]) => path === location.pathname)) {
      navigate('/about', { replace: true })
    }
  }, [location.pathname, navigate])

  const setPage = (nextPage) => navigate(pathFromPage(nextPage))

  return <div className="app-shell">
    <Sidebar page={page} setPage={setPage}/>
    <div className="workspace">
      <Topbar page={page} setPage={setPage}/>
      <div className="content">
        <div className="route-frame" key={location.pathname}>
          {page==='about'?<AboutPage/>:page==='overview'?<Overview setPage={setPage}/>:page==='map'?<MapPage/>:<DataPage type={page}/>}
        </div>
      </div>
    </div>
  </div>
}
