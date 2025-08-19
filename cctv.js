var toolsEl;
var cameras = [];
var currentCam = null;
var poles = [];
var racks = [];

// ฟังก์ชันสำหรับแสดงผลเริ่มต้นในแผงควบคุม
function initializeToolsPanel() {
    toolsEl = document.getElementById('tools');
    if (toolsEl) {
        toolsEl.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <h4 style="color: #495057; margin-bottom: 15px;">🎥 เลือกกล้อง</h4>
                <p style="margin-bottom: 20px;">คลิกที่กล้องบนแผนที่เพื่อเลือกและปรับแต่ง</p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button onclick="addBulletCameraMode()" style="background: linear-gradient(45deg, #ffc107, #e0a800); color: #333; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        📹 เพิ่มกล้องบูลเล็ต
                    </button>
                    <button onclick="addDomeCameraMode()" style="background: linear-gradient(45deg, #007bff, #0056b3); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        🔵 เพิ่มกล้องโดม
                    </button>
                    <button onclick="addPTZCameraMode()" style="background: linear-gradient(45deg, #dc3545, #c82333); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        🔴 เพิ่มกล้อง PTZ
                    </button>
                </div>
                <hr style="margin: 20px 0; border: 1px solid #dee2e6;">
                <h4 style="color: #495057; margin-bottom: 15px;">🏗️ อุปกรณ์อื่นๆ</h4>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button onclick="addRackMode()" style="background: linear-gradient(45deg, #28a745, #1e7e34); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        🗄️ เพิ่มตู้ Rack
                    </button>
                    <button onclick="addPoleMode()" style="background: linear-gradient(45deg, #6f42c1, #5a2d91); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        🏗️ เพิ่มเสากล้อง
                    </button>
                </div>
            </div>
        `;
    }
}
var cableLines = [];
var totalDistance = 0;
var map;
// ราคาตามขนาดตู้ Rack (บาท) - กำหนดเป็น global ให้ใช้ได้ทุกที่
const rackPrices = {6: 3500, 9: 4500, 12: 6500, 18: 8500, 27: 12500, 42: 18500};
// ตัวแปรสำหรับพื้นที่งานและตู้ Rack
var drawingArea = false;
var areaPoints = [];
var areaPolygon = null;
var areaTempLine = null;
var racks = []; // { id, marker }
// สถานะเครื่องมือปัจจุบัน (null | 'drawArea' | 'addRack')
var currentTool = null;
// การเชื่อมต่อระหว่าง Rack
var rackLinks = []; // { fromId, toId, line, cableType }
// สี่เหลี่ยมโปร่งแสง (overlays)
var rectOverlays = []; // { id, center, width, height, angle, color, opacity, polygon, centerMarker, cornerMarkers: [] }
var currentOverlay = null;
// Global drag state
var draggingCornerIdx = -1;
var draggingCenter = false;
var draggingBody = false;
var dragStartData = null;

Math.degrees = function(radians) {
    return radians * 180 / Math.PI;
}

// ====== วาดพื้นที่งาน (Polygon) ======
function handleAreaClick(e) {
    if (!drawingArea) return;
    areaPoints.push(e.latlng);
    if (areaTempLine) {
        areaTempLine.setLatLngs(areaPoints);
    } else {
        areaTempLine = L.polyline(areaPoints, { color: '#6c757d', dashArray: '5,5' }).addTo(map);
    }
}

function toggleDrawArea() {
    drawingArea = !drawingArea;
    if (drawingArea) {
        currentTool = 'drawArea';
        showNotification('โหมดวาดพื้นที่: คลิกบนแผนที่เพื่อเพิ่มจุด และกดปุ่มอีกครั้งเพื่อปิด', 'info');
        areaPoints = [];
        if (areaPolygon) { map.removeLayer(areaPolygon); areaPolygon = null; }
        if (areaTempLine) { map.removeLayer(areaTempLine); areaTempLine = null; }
        map.on('click', handleAreaClick);
    } else {
        map.off('click', handleAreaClick);
        if (areaTempLine) { map.removeLayer(areaTempLine); areaTempLine = null; }
        if (areaPoints.length >= 3) {
            areaPolygon = L.polygon(areaPoints, { color: '#ffc107', fillOpacity: 0.1 }).addTo(map);
            showNotification('สร้างพื้นที่งานสำเร็จ', 'success');
        } else {
            showNotification('ยกเลิกวาดพื้นที่ (ต้องการอย่างน้อย 3 จุด)', 'error');
        }
        currentTool = null;
    }
}

// ====== การจัดการตู้ Rack ======
function addRackMode() {
    showNotification('โหมดเพิ่มตู้ Rack: คลิกบนแผนที่เพื่อตำแหน่งตู้', 'info');
    currentTool = 'addRack';
    const placeRack = (latlng) => {
        const id = 'rack_' + (racks.length + 1);
        const name = id;
        const marker = L.marker(latlng, { title: id, draggable: true }).addTo(map).bindPopup('ตู้ Rack: ' + id);
        // แสดงชื่อบนหัวแบบถาวรและแก้ไขได้
        marker.bindTooltip(name, { permanent: true, direction: 'top', offset: [0, -10], className: 'rack-label' });
        const rack = { id, name, marker };
        racks.push(rack);
        // อัปเดตเส้นเชื่อมเมื่อย้ายตู้
        marker.on('drag', () => updateRackConnections(id));
        marker.on('dragend', () => { try { calculateCosts(); } catch(_){} });
        // แก้ไขชื่อด้วยการดับเบิลคลิกที่มาร์คเกอร์
        marker.on('dblclick', () => editRackName(rack));
        // อัปเดตรายการใน select (rackList, rackFrom, rackTo)
        const addOpt = (selId) => {
            const sel = document.getElementById(selId);
            if (sel) {
                const opt = document.createElement('option');
                opt.value = id; opt.textContent = name;
                sel.appendChild(opt);
                if (!sel.value) sel.value = id;
            }
        };
        addOpt('rackList');
        addOpt('rackFrom');
        addOpt('rackTo');
        showNotification('เพิ่มตู้ Rack เรียบร้อย: ' + name, 'success');
        updateCableDropdowns(); // อัปเดต dropdown
        map.off('click', onLeftClick);
        map.off('contextmenu', onRightClick);
        currentTool = null;
    };
    const onLeftClick = (e) => placeRack(e.latlng);
    const onRightClick = (e) => placeRack(e.latlng);
    map.on('click', onLeftClick);
    map.on('contextmenu', onRightClick);
}

// ====== การจัดการเสากล้อง ======
function addPoleMode() {
    showNotification('โหมดเพิ่มเสากล้อง: คลิกบนแผนที่เพื่อตำแหน่งเสา', 'info');
    currentTool = 'addPole';
    const placePole = (latlng) => {
        const id = 'pole_' + (poles.length + 1);
        const name = id;
        const marker = L.marker(latlng, { title: id, draggable: true }).addTo(map).bindPopup('เสากล้อง: ' + id);
        // แสดงชื่อบนหัวแบบถาวรและแก้ไขได้
        marker.bindTooltip(name, { permanent: true, direction: 'top', offset: [0, -10], className: 'pole-label' });
        const pole = { id, name, marker };
        poles.push(pole);
        // อัปเดตเส้นเชื่อมเมื่อย้ายเสา
        marker.on('drag', () => updatePoleConnections(id));
        marker.on('dragend', () => { try { calculateCosts(); } catch(_){} });
        // แก้ไขชื่อด้วยการดับเบิลคลิกที่มาร์คเกอร์
        marker.on('dblclick', () => editPoleName(pole));
        showNotification('เพิ่มเสากล้อง เรียบร้อย: ' + name, 'success');
        updateCableDropdowns(); // อัปเดต dropdown
        map.off('click', onLeftClick);
        map.off('contextmenu', onRightClick);
        currentTool = null;
    };
    const onLeftClick = (e) => placePole(e.latlng);
    const onRightClick = (e) => placePole(e.latlng);
    map.on('click', onLeftClick);
    map.on('contextmenu', onRightClick);
}

// ฟังก์ชันอัปเดตการเชื่อมต่อเสา
function updatePoleConnections(poleId) {
    // อัปเดตเส้นเชื่อมที่เกี่ยวข้องกับเสานี้
    cableLines.forEach(line => {
        if (line.from === poleId || line.to === poleId) {
            const fromPole = poles.find(p => p.id === line.from);
            const toPole = poles.find(p => p.id === line.to);
            if (fromPole && toPole) {
                line.line.setLatLngs([fromPole.marker.getLatLng(), toPole.marker.getLatLng()]);
            }
        }
    });
}

// ฟังก์ชันแก้ไขชื่อเสา
function editPoleName(pole) {
    const newName = prompt('แก้ไขชื่อเสา:', pole.name);
    if (newName && newName.trim()) {
        pole.name = newName.trim();
        pole.marker.setTooltipContent(pole.name);
        pole.marker.getPopup().setContent('เสากล้อง: ' + pole.name);
        showNotification('แก้ไขชื่อเสาเรียบร้อย: ' + pole.name, 'success');
    }
}

// ====== การจัดการกล้อง ======
function addBulletCameraMode() {
    showNotification('โหมดเพิ่มกล้องบูลเล็ต: คลิกบนแผนที่เพื่อตำแหน่งกล้อง', 'info');
    currentTool = 'addBulletCamera';
    const placeBulletCamera = (latlng) => {
        // ใช้ฟังก์ชัน addCamera ที่มีอยู่แล้ว แต่เปลี่ยน type เป็น BULLET
        var cam = {
            position: latlng,
            angle: 0,
            sensorSize: 6.43,   // mm diagional = 1/2.8"
            focalLength: 2.8,   // mm
            range: 30,          // metres
            type: 'BULLET',     // เปลี่ยนเป็น BULLET
        };

        cam.fov = calcFov(cam.sensorSize, cam.focalLength);

        var coords = buildPolyCoords(cam.position, cam.angle, cam.fov, cam.range);
        var ndPolygon = L.polygon(coords).addTo(map);

        var ndCentre = L.circle([cam.position.lat, cam.position.lng], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.5,
            radius: 0.5
        }).addTo(map);

        // Rotation handle placed ahead of the camera to adjust angle by dragging
        var handleDist = 5; // metres ahead of camera center
        var handlePos = L.GeometryUtil.destination(cam.position, cam.angle, handleDist);
        var ndHandle = L.circleMarker(handlePos, { radius: 4, color: '#0d6efd', fillColor: '#0d6efd', fillOpacity: 0.9, weight: 1 }).addTo(map);

        // Camera icon marker (rotating SVG based on type and angle)
        var ndMarker = L.marker(cam.position, { icon: makeCamIcon(cam), zIndexOffset: 600 }).addTo(map);

        ndPolygon.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
        ndCentre.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
        ndHandle.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
        ndMarker.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });

        // Emulate dragging the camera by dragging its center
        var draggingCam = false;
        ndCentre.on('mousedown', function(e) {
            draggingCam = true;
            L.DomEvent.stopPropagation(e);
        });
        map.on('mousemove', function(e) {
            if (!draggingCam) return;
            cam.position = e.latlng;
            ndCentre.setLatLng(e.latlng);
            renderCam(cam);
            // move rotation handle to remain at fixed distance ahead of camera
            try { ndHandle.setLatLng(L.GeometryUtil.destination(cam.position, cam.angle, handleDist)); } catch(_) {}
            try { ndMarker.setLatLng(cam.position); } catch(_) {}
            if (currentCam === cam) {
                var posEl = document.getElementById('camPos');
                if (posEl) posEl.textContent = cam.position.lat.toFixed(6) + ', ' + cam.position.lng.toFixed(6);
            }
        });
        map.on('mouseup', function() { draggingCam = false; });

        // Emulate dragging the rotation handle to set camera angle
        var draggingHandle = false;
        ndHandle.on('mousedown', function(e) {
            draggingHandle = true;
            L.DomEvent.stopPropagation(e);
            // เพิ่ม cursor style
            map.getContainer().style.cursor = 'crosshair';
        });
        map.on('mousemove', function(e) {
            if (!draggingHandle) return;
            var ang = L.GeometryUtil.bearing(cam.position, e.latlng);
            // Normalize angle to -360..360 range similar to slider
            if (ang > 180) ang = ang - 360;
            cam.angle = ang;
            renderCam(cam);
            // reposition handle along the new angle
            try { ndHandle.setLatLng(L.GeometryUtil.destination(cam.position, cam.angle, handleDist)); } catch(_) {}
            if (currentCam === cam) {
                var angEl = document.getElementById('fld-angle');
                if (angEl) angEl.value = cam.angle;
                // อัปเดตการแสดงผลมุมกล้อง
                updateCameraAngleDisplay(cam);
            }
        });
        map.on('mouseup', function() { 
            draggingHandle = false; 
            // คืนค่า cursor style
            map.getContainer().style.cursor = '';
        });

        cam.ndPolygon = ndPolygon;
        cam.ndCentre = ndCentre;
        cam.ndHandle = ndHandle;
        cam.ndMarker = ndMarker;
        cameras.push(cam);

        setCurrent(cam);
        
        showNotification('เพิ่มกล้องบูลเล็ตเรียบร้อย', 'success');
        map.off('click', onLeftClick);
        map.off('contextmenu', onRightClick);
        currentTool = null;
    };
    
    const onLeftClick = (e) => placeBulletCamera(e.latlng);
    const onRightClick = (e) => placeBulletCamera(e.latlng);
    map.on('click', onLeftClick);
    map.on('contextmenu', onRightClick);
}

function addDomeCameraMode() {
    showNotification('โหมดเพิ่มกล้องโดม: คลิกบนแผนที่เพื่อตำแหน่งกล้อง', 'info');
    currentTool = 'addDomeCamera';
    const placeDomeCamera = (latlng) => {
        // ใช้ฟังก์ชัน addCamera ที่มีอยู่แล้ว แต่เปลี่ยน type เป็น DOME
        var cam = {
            position: latlng,
            angle: 0,
            sensorSize: 6.43,   // mm diagional = 1/2.8"
            focalLength: 2.8,   // mm
            range: 30,          // metres
            type: 'DOME',       // เปลี่ยนเป็น DOME
        };

        cam.fov = calcFov(cam.sensorSize, cam.focalLength);

        var coords = buildPolyCoords(cam.position, cam.angle, cam.fov, cam.range);
        var ndPolygon = L.polygon(coords).addTo(map);

        var ndCentre = L.circle([cam.position.lat, cam.position.lng], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.5,
            radius: 0.5
        }).addTo(map);

        // Rotation handle placed ahead of the camera to adjust angle by dragging
        var handleDist = 5; // metres ahead of camera center
        var handlePos = L.GeometryUtil.destination(cam.position, cam.angle, handleDist);
        var ndHandle = L.circleMarker(handlePos, { radius: 4, color: '#0d6efd', fillColor: '#0d6efd', fillOpacity: 0.9, weight: 1 }).addTo(map);

        // Camera icon marker (rotating SVG based on type and angle)
        var ndMarker = L.marker(cam.position, { icon: makeCamIcon(cam), zIndexOffset: 600 }).addTo(map);

        ndPolygon.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
        ndCentre.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
        ndHandle.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
        ndMarker.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });

        // Emulate dragging the camera by dragging its center
        var draggingCam = false;
        ndCentre.on('mousedown', function(e) {
            draggingCam = true;
            L.DomEvent.stopPropagation(e);
        });
        map.on('mousemove', function(e) {
            if (!draggingCam) return;
            cam.position = e.latlng;
            ndCentre.setLatLng(e.latlng);
            renderCam(cam);
            // move rotation handle to remain at fixed distance ahead of camera
            try { ndHandle.setLatLng(L.GeometryUtil.destination(cam.position, cam.angle, handleDist)); } catch(_) {}
            try { ndMarker.setLatLng(cam.position); } catch(_) {}
            if (currentCam === cam) {
                var posEl = document.getElementById('camPos');
                if (posEl) posEl.textContent = cam.position.lat.toFixed(6) + ', ' + cam.position.lng.toFixed(6);
            }
        });
        map.on('mouseup', function() { draggingCam = false; });

        // Emulate dragging the rotation handle to set camera angle
        var draggingHandle = false;
        ndHandle.on('mousedown', function(e) {
            draggingHandle = true;
            L.DomEvent.stopPropagation(e);
            // เพิ่ม cursor style
            map.getContainer().style.cursor = 'crosshair';
        });
        map.on('mousemove', function(e) {
            if (!draggingHandle) return;
            var ang = L.GeometryUtil.bearing(cam.position, e.latlng);
            // Normalize angle to -360..360 range similar to slider
            if (ang > 180) ang = ang - 360;
            cam.angle = ang;
            renderCam(cam);
            // reposition handle along the new angle
            try { ndHandle.setLatLng(L.GeometryUtil.destination(cam.position, cam.angle, handleDist)); } catch(_) {}
            if (currentCam === cam) {
                var angEl = document.getElementById('fld-angle');
                if (angEl) angEl.value = cam.angle;
                // อัปเดตการแสดงผลมุมกล้อง
                updateCameraAngleDisplay(cam);
            }
        });
        map.on('mouseup', function() { 
            draggingHandle = false; 
            // คืนค่า cursor style
            map.getContainer().style.cursor = '';
        });

        cam.ndPolygon = ndPolygon;
        cam.ndCentre = ndCentre;
        cam.ndHandle = ndHandle;
        cam.ndMarker = ndMarker;
        cameras.push(cam);

        setCurrent(cam);
        
        showNotification('เพิ่มกล้องโดมเรียบร้อย', 'success');
        map.off('click', onLeftClick);
        map.off('contextmenu', onRightClick);
        currentTool = null;
    };
    
    const onLeftClick = (e) => placeDomeCamera(e.latlng);
    const onRightClick = (e) => placeDomeCamera(e.latlng);
    map.on('click', onLeftClick);
    map.on('contextmenu', onRightClick);
}

function addPTZCameraMode() {
    showNotification('โหมดเพิ่มกล้อง PTZ: คลิกบนแผนที่เพื่อตำแหน่งกล้อง', 'info');
    currentTool = 'addPTZCamera';
    const placePTZCamera = (latlng) => {
        // ใช้ฟังก์ชัน addCamera ที่มีอยู่แล้ว แต่เปลี่ยน type เป็น PTZ
        var cam = {
            position: latlng,
            angle: 0,
            sensorSize: 6.43,   // mm diagional = 1/2.8"
            focalLength: 2.8,   // mm
            range: 30,          // metres
            type: 'PTZ',        // เปลี่ยนเป็น PTZ
        };

        cam.fov = calcFov(cam.sensorSize, cam.focalLength);

        var coords = buildPolyCoords(cam.position, cam.angle, cam.fov, cam.range);
        var ndPolygon = L.polygon(coords).addTo(map);

        var ndCentre = L.circle([cam.position.lat, cam.position.lng], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.5,
            radius: 0.5
        }).addTo(map);

        // Rotation handle placed ahead of the camera to adjust angle by dragging
        var handleDist = 5; // metres ahead of camera center
        var handlePos = L.GeometryUtil.destination(cam.position, cam.angle, handleDist);
        var ndHandle = L.circleMarker(handlePos, { radius: 4, color: '#0d6efd', fillColor: '#0d6efd', fillOpacity: 0.9, weight: 1 }).addTo(map);

        // Camera icon marker (rotating SVG based on type and angle)
        var ndMarker = L.marker(cam.position, { icon: makeCamIcon(cam), zIndexOffset: 600 }).addTo(map);

        ndPolygon.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
        ndCentre.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
        ndHandle.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
        ndMarker.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });

        // Emulate dragging the camera by dragging its center
        var draggingCam = false;
        ndCentre.on('mousedown', function(e) {
            draggingCam = true;
            L.DomEvent.stopPropagation(e);
        });
        map.on('mousemove', function(e) {
            if (!draggingCam) return;
            cam.position = e.latlng;
            ndCentre.setLatLng(e.latlng);
            renderCam(cam);
            // move rotation handle to remain at fixed distance ahead of camera
            try { ndHandle.setLatLng(L.GeometryUtil.destination(cam.position, cam.angle, handleDist)); } catch(_) {}
            try { ndMarker.setLatLng(cam.position); } catch(_) {}
            if (currentCam === cam) {
                var posEl = document.getElementById('camPos');
                if (posEl) posEl.textContent = cam.position.lat.toFixed(6) + ', ' + cam.position.lng.toFixed(6);
            }
        });
        map.on('mouseup', function() { draggingCam = false; });

        // Emulate dragging the rotation handle to set camera angle
        var draggingHandle = false;
        ndHandle.on('mousedown', function(e) {
            draggingHandle = true;
            L.DomEvent.stopPropagation(e);
            // เพิ่ม cursor style
            map.getContainer().style.cursor = 'crosshair';
        });
        map.on('mousemove', function(e) {
            if (!draggingHandle) return;
            var ang = L.GeometryUtil.bearing(cam.position, e.latlng);
            // Normalize angle to -360..360 range similar to slider
            if (ang > 180) ang = ang - 360;
            cam.angle = ang;
            renderCam(cam);
            // reposition handle along the new angle
            try { ndHandle.setLatLng(L.GeometryUtil.destination(cam.position, cam.angle, handleDist)); } catch(_) {}
            if (currentCam === cam) {
                var angEl = document.getElementById('fld-angle');
                if (angEl) angEl.value = cam.angle;
                // อัปเดตการแสดงผลมุมกล้อง
                updateCameraAngleDisplay(cam);
            }
        });
        map.on('mouseup', function() { 
            draggingHandle = false; 
            // คืนค่า cursor style
            map.getContainer().style.cursor = '';
        });

        cam.ndPolygon = ndPolygon;
        cam.ndCentre = ndCentre;
        cam.ndHandle = ndHandle;
        cam.ndMarker = ndMarker;
        cameras.push(cam);

        setCurrent(cam);
        
        showNotification('เพิ่มกล้อง PTZ เรียบร้อย', 'success');
        map.off('click', onLeftClick);
        map.off('contextmenu', onRightClick);
        currentTool = null;
    };
    
    const onLeftClick = (e) => placePTZCamera(e.latlng);
    const onRightClick = (e) => placePTZCamera(e.latlng);
    map.on('click', onLeftClick);
    map.on('contextmenu', onRightClick);
}

function addCameraPoleMode() {
    showNotification('โหมดเพิ่มเสากล้อง: คลิกบนแผนที่เพื่อตำแหน่งเสา', 'info');
    currentTool = 'addCameraPole';
    const placeCameraPole = (latlng) => {
        const id = 'pole_' + (cameras.length + 1);
        const name = id;
        
        // สร้างไอคอนเสากล้อง
        const icon = L.divIcon({
            className: 'pole-icon',
            html: '<i class="fas fa-flag"></i>',
            iconSize: [8, 30],
            iconAnchor: [4, 30]
        });
        
        const marker = L.marker(latlng, { 
            title: name, 
            draggable: true,
            icon: icon
        }).addTo(map);
        
        // สร้าง popup สำหรับเสากล้อง
        const popupContent = `
            <div>
                <strong>${name}</strong><br>
                <small>เสากล้อง</small><br>
                <button onclick="editCamera('${id}')" class="btn btn-sm btn-primary">แก้ไข</button>
                <button onclick="deleteCameraById('${id}')" class="btn btn-sm btn-danger">ลบ</button>
            </div>
        `;
        marker.bindPopup(popupContent);
        
        // แสดงชื่อบนหัวแบบถาวร
        marker.bindTooltip(name, { 
            permanent: true, 
            direction: 'top', 
            offset: [0, -35], 
            className: 'camera-label' 
        });
        
        const camera = { 
            id, 
            name, 
            latlng, 
            marker,
            type: 'pole',
            resolution: 2,
            fov: 90,
            range: 50,
            poleHeight: 6,
            cameraHeight: 4,
            tilt: 0,
            pan: 0,
            price: 0,
            polePrice: 5000
        };
        
        cameras.push(camera);
        currentCam = camera;
        
        // Event listeners
        marker.on('click', () => selectCamera(camera));
        marker.on('drag', () => updateCameraPosition(camera));
        marker.on('dragend', () => { 
            try { calculateCosts(); } catch(_){} 
        });
        marker.on('dblclick', () => editCameraName(camera));
        
        showNotification('เพิ่มเสากล้องเรียบร้อย: ' + name, 'success');
        map.off('click', onLeftClick);
        map.off('contextmenu', onRightClick);
        currentTool = null;
    };
    
    const onLeftClick = (e) => placeCameraPole(e.latlng);
    const onRightClick = (e) => placeCameraPole(e.latlng);
    map.on('click', onLeftClick);
    map.on('contextmenu', onRightClick);
}

// เลือกกล้อง
function selectCamera(camera) {
    currentCam = camera;
    updateCameraControls(camera);
    showNotification('เลือกกล้อง: ' + camera.name, 'info');
}

// อัปเดตตำแหน่งกล้อง
function updateCameraPosition(camera) {
    camera.latlng = camera.marker.getLatLng();
}

// แก้ไขชื่อกล้อง
function editCameraName(camera) {
    const newName = prompt('กรุณากรอกชื่อใหม่สำหรับกล้อง:', camera.name || camera.id);
    if (!newName) return;
    camera.name = newName.trim() || camera.id;
    
    try {
        if (camera.marker && camera.marker.getTooltip()) {
            camera.marker.getTooltip().setContent(camera.name);
        } else if (camera.marker) {
            camera.marker.bindTooltip(camera.name, { 
                permanent: true, 
                direction: 'top', 
                offset: [0, -15], 
                className: 'camera-label' 
            });
        }
        showNotification('อัปเดตชื่อกล้องสำเร็จ: ' + camera.name, 'success');
    } catch (e) { console.warn(e); }
}

// อัปเดตการควบคุมกล้อง
function updateCameraControls(camera) {
    if (!camera) return;
    
    const controls = [
        'cameraType', 'cameraResolution', 'cameraFOV', 'cameraRange',
        'poleHeight', 'cameraHeight', 'cameraTilt', 'cameraPan', 'cameraPrice', 'polePrice'
    ];
    
    controls.forEach(controlId => {
        const control = document.getElementById(controlId);
        if (control) {
            if (control.type === 'select-one') {
                control.value = camera[controlId.replace('camera', '').toLowerCase()] || control.value;
            } else {
                control.value = camera[controlId.replace('camera', '').toLowerCase()] || control.value;
            }
        }
    });
    
    // อัปเดตการแสดงผลการคำนวณ
    updateCameraCalculations(camera);
}

// อัปเดตการแสดงผลการคำนวณกล้อง
function updateCameraCalculations(camera) {
    if (!camera) return;
    
    const totalHeight = (camera.poleHeight || 0) + (camera.cameraHeight || 0);
    const viewingDistance = calculateViewingDistance(camera);
    const coverageArea = calculateCoverageArea(camera);
    const viewingAngle = camera.fov || 0;
    
    document.getElementById('totalHeight').textContent = totalHeight.toFixed(1);
    document.getElementById('viewingDistance').textContent = viewingDistance;
    document.getElementById('coverageArea').textContent = coverageArea;
    document.getElementById('viewingAngle').textContent = viewingAngle;
}

// แก้ไขกล้อง
function editCamera(cameraId) {
    const camera = cameras.find(c => c.id === cameraId);
    if (!camera) return;
    
    selectCamera(camera);
    showNotification('แก้ไขกล้อง: ' + camera.name, 'info');
}

// คำนวณระยะการมองเห็นตามความสูง
function calculateViewingDistance(camera) {
    if (!camera.poleHeight || !camera.cameraHeight) return 0;
    
    const totalHeight = camera.poleHeight + camera.cameraHeight;
    const baseRange = camera.range || 50;
    
    // คำนวณตามสูตร: ระยะการมองเห็น = ระยะฐาน * (ความสูง / 3)^0.5
    // 3 เมตรเป็นความสูงมาตรฐาน
    const heightFactor = Math.sqrt(totalHeight / 3);
    const calculatedRange = baseRange * heightFactor;
    
    return Math.round(calculatedRange);
}

// คำนวณพื้นที่ครอบคลุมของกล้อง
function calculateCoverageArea(camera) {
    if (!camera.fov || !camera.range) return 0;
    
    const range = calculateViewingDistance(camera);
    const fovRadians = (camera.fov * Math.PI) / 180;
    
    // คำนวณพื้นที่ครอบคลุม (พื้นที่เซกเตอร์)
    const area = (fovRadians * range * range) / 2;
    
    return Math.round(area);
}

// ลบกล้องตาม ID
function deleteCameraById(cameraId) {
    const camera = cameras.find(c => c.id === cameraId);
    if (!camera) return;
    
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบกล้อง: ' + camera.name)) {
        try {
            map.removeLayer(camera.marker);
        } catch (_) {}
        
        cameras = cameras.filter(c => c.id !== cameraId);
        if (currentCam && currentCam.id === cameraId) {
            currentCam = null;
        }
        
        showNotification('ลบกล้องสำเร็จ: ' + camera.name, 'success');
        try { calculateCosts(); } catch(_) {}
    }
}

function assignCurrentCamToRack() {
    const rackList = document.getElementById('rackList');
    if (!currentCam) { showNotification('ยังไม่ได้เลือกกล้อง', 'error'); return; }
    if (!rackList || !rackList.value) { showNotification('กรุณาเลือกตู้ Rack', 'error'); return; }
    currentCam.rackId = rackList.value;
    showNotification('กำหนดกล้องนี้ให้อยู่ใน ' + rackList.value, 'success');
}

// ค้นหา Rack ตามรหัส
function getRackById(rackId) {
    return racks.find(r => r.id === rackId);
}

// อัปเดตเส้นเชื่อมที่เกี่ยวข้องกับตู้ Rack ที่กำหนด
function updateRackConnections(rackId) {
    const rack = getRackById(rackId);
    if (!rack) return;
    const latlng = rack.marker.getLatLng();
    (rackLinks || []).forEach(link => {
        if (link.fromId === rackId || link.toId === rackId) {
            const fromRack = getRackById(link.fromId);
            const toRack = getRackById(link.toId);
            if (fromRack && toRack) {
                link.line.setLatLngs([fromRack.marker.getLatLng(), toRack.marker.getLatLng()]);
            }
        }
    });
}

// เปลี่ยนชื่อ Rack และซิงก์กับ tooltip และ dropdowns
function editRackName(rack) {
    const newName = prompt('กรุณากรอกชื่อใหม่สำหรับตู้ Rack:', rack.name || rack.id);
    if (!newName) return;
    rack.name = newName.trim() || rack.id;
    try {
        if (rack.marker && rack.marker.getTooltip()) {
            rack.marker.getTooltip().setContent(rack.name);
        } else if (rack.marker) {
            rack.marker.bindTooltip(rack.name, { permanent: true, direction: 'top', offset: [0, -10], className: 'rack-label' });
        }
        updateRackNameInSelects(rack);
        showNotification('อัปเดตชื่อตู้สำเร็จ: ' + rack.name, 'success');
    } catch (e) { console.warn(e); }
}

function updateRackNameInSelects(rack) {
    ['rackList','rackFrom','rackTo'].forEach(selId => {
        const sel = document.getElementById(selId);
        if (!sel) return;
        Array.from(sel.options).forEach(opt => {
            if (opt.value === rack.id) opt.textContent = rack.name || rack.id;
        });
    });
}

// ====== สี่เหลี่ยมโปร่งแสง (Overlay Rectangles) ======
function rectCornersFromCenter(center, widthM, heightM, angleDeg) {
    const dx = widthM / 2.0;  // along angle
    const dy = heightM / 2.0; // along angle + 90
    const a = angleDeg || 0;
    const b = a + 90;
    const move = (pt, bearing, meters) => L.GeometryUtil.destination(pt, bearing, meters);
    const p1 = move(move(center, a, +dx), b, +dy);
    const p2 = move(move(center, a, +dx), b, -dy);
    const p3 = move(move(center, a, -dx), b, -dy);
    const p4 = move(move(center, a, -dx), b, +dy);
    return [p1, p2, p3, p4];
}

function styleOverlayPolygon(poly, selected) {
    if (!poly) return;
    poly.setStyle(selected ? { color: '#ffcc00', weight: 2, dashArray: '4,2' } : { color: '#ff0000', weight: 1, dashArray: null });
}

function selectOverlay(ov) {
    // clear previous
    rectOverlays.forEach(o => styleOverlayPolygon(o.polygon, false));
    currentOverlay = ov || null;
    if (currentOverlay) {
        styleOverlayPolygon(currentOverlay.polygon, true);
        refreshOverlayControlsFromCurrent();
        showNotification('เลือกสี่เหลี่ยม', 'info');
    }
}

function refreshOverlayControlsFromCurrent() {
    const ov = currentOverlay; if (!ov) return;
    const fillEl = document.getElementById('rectFillColor');
    const opEl = document.getElementById('rectOpacity');
    const wEl = document.getElementById('rectWidth');
    const hEl = document.getElementById('rectHeight');
    const aEl = document.getElementById('rectAngle');
    if (fillEl) fillEl.value = ov.color || '#ff0000';
    if (opEl) opEl.value = typeof ov.opacity === 'number' ? ov.opacity : 0.3;
    if (wEl) wEl.value = Math.round(ov.width || 50);
    if (hEl) hEl.value = Math.round(ov.height || 30);
    if (aEl) aEl.value = Math.round(ov.angle || 0);
}

function updateOverlayGeometry(ov) {
    if (!ov || !ov.polygon) return;
    const corners = rectCornersFromCenter(ov.center, ov.width, ov.height, ov.angle);
    ov.polygon.setLatLngs(corners);
    if (ov.centerMarker) ov.centerMarker.setLatLng(ov.center);
    if (ov.cornerMarkers && ov.cornerMarkers.length === corners.length) {
        ov.cornerMarkers.forEach((mk, i) => { try { mk.setLatLng(corners[i]); } catch(_) {} });
    }
    // Update rotation handle position
    if (ov.rotationHandle) {
        const rotationPoint = L.GeometryUtil.destination(ov.center, ov.angle, ov.height / 2 + 20);
        ov.rotationHandle.setLatLng(rotationPoint);
    }
}

function updateOverlayStyle(ov) {
    if (!ov || !ov.polygon) return;
    ov.polygon.setStyle({ fillColor: ov.color, fillOpacity: ov.opacity });
}

function createRectOverlay(center, opts = {}) {
    const ov = {
        id: 'rect_' + Date.now(),
        center: center,
        width: opts.width || (parseFloat(document.getElementById('rectWidth')?.value) || 50),
        height: opts.height || (parseFloat(document.getElementById('rectHeight')?.value) || 30),
        angle: opts.angle || (parseFloat(document.getElementById('rectAngle')?.value) || 0),
        color: opts.color || (document.getElementById('rectFillColor')?.value || '#ff0000'),
        opacity: typeof opts.opacity === 'number' ? opts.opacity : (parseFloat(document.getElementById('rectOpacity')?.value) || 0.3),
        polygon: null,
        centerMarker: null,
        cornerMarkers: [],
        rotationHandle: null
    };
    
    const corners = rectCornersFromCenter(ov.center, ov.width, ov.height, ov.angle);
    const poly = L.polygon(corners, { 
        color: '#ff0000', 
        fillColor: ov.color, 
        fillOpacity: ov.opacity, 
        weight: 2,
        interactive: true
    }).addTo(map);
    ov.polygon = poly;
    styleOverlayPolygon(poly, false);
    
    // Center marker for dragging
    const ctr = L.circleMarker(ov.center, { 
        radius: 6, 
        color: '#333', 
        fillColor: '#fff', 
        fillOpacity: 0.9, 
        weight: 2,
        interactive: true
    }).addTo(map);
    ov.centerMarker = ctr;
    
    // Corner markers for resizing
    corners.forEach((pt, i) => {
        const mk = L.circleMarker(pt, { 
            radius: 5, 
            color: '#212529', 
            fillColor: '#ffffff', 
            fillOpacity: 0.9, 
            weight: 2,
            interactive: true
        }).addTo(map);
        ov.cornerMarkers.push(mk);
    });
    
    // Rotation handle
    const rotationPoint = L.GeometryUtil.destination(ov.center, ov.angle, ov.height / 2 + 20);
    const rotHandle = L.circleMarker(rotationPoint, {
        radius: 4,
        color: '#007bff',
        fillColor: '#007bff',
        fillOpacity: 0.8,
        weight: 1,
        interactive: true
    }).addTo(map);
    ov.rotationHandle = rotHandle;
    
    // Event handlers
    setupOverlayEventHandlers(ov);
    
    rectOverlays.push(ov);
    selectOverlay(ov);
    return ov;
}

function setupOverlayEventHandlers(ov) {
    // Center marker drag
    ov.centerMarker.on('mousedown', (e) => {
        L.DomEvent.stopPropagation(e);
        selectOverlay(ov);
        draggingCenter = true;
        dragStartData = { center: ov.center };
    });
    
    // Polygon body drag and selection
    ov.polygon.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        selectOverlay(ov);
    });
    
    ov.polygon.on('mousedown', (e) => {
        L.DomEvent.stopPropagation(e);
        selectOverlay(ov);
        draggingBody = true;
        dragStartData = {
            mousePos: map.latLngToLayerPoint(e.latlng),
            center: ov.center
        };
    });
    
    // Corner markers for resizing
    ov.cornerMarkers.forEach((marker, idx) => {
        marker.on('mousedown', (e) => {
        L.DomEvent.stopPropagation(e);
        selectOverlay(ov);
        draggingCornerIdx = idx;
            dragStartData = {
                center: ov.center,
                width: ov.width,
                height: ov.height,
                angle: ov.angle
            };
        });
        
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            selectOverlay(ov);
        });
    });
    
    // Rotation handle
    ov.rotationHandle.on('mousedown', (e) => {
        L.DomEvent.stopPropagation(e);
    selectOverlay(ov);
        dragStartData = {
            center: ov.center,
            startAngle: ov.angle
        };
    });
    
    ov.rotationHandle.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        selectOverlay(ov);
    });
}

// ฟังก์ชันลบวัตถุที่เลือก
function deleteSelected() {
    let deletedCount = 0;
    
    // ลบสี่เหลี่ยมโปร่งแสงที่เลือก
    if (currentOverlay) {
        try {
            if (currentOverlay.polygon) map.removeLayer(currentOverlay.polygon);
            if (currentOverlay.centerMarker) map.removeLayer(currentOverlay.centerMarker);
            if (currentOverlay.cornerMarkers && currentOverlay.cornerMarkers.length) {
                currentOverlay.cornerMarkers.forEach(mk => { try { map.removeLayer(mk); } catch(_) {} });
            }
            if (currentOverlay.rotationHandle) map.removeLayer(currentOverlay.rotationHandle);
        } catch (_) {}
        rectOverlays = rectOverlays.filter(o => o !== currentOverlay);
        currentOverlay = null;
        deletedCount++;
    }
    
    // ลบกล้องที่เลือก
    if (currentCam) {
        try {
            map.removeLayer(currentCam);
            cameras = cameras.filter(cam => cam !== currentCam);
        } catch (_) {}
        currentCam = null;
        deletedCount++;
    }
    
    // ลบตู้ Rack ที่เลือก
    const selectedRack = getSelectedRack();
    if (selectedRack) {
        deleteRack(selectedRack.id);
        deletedCount++;
    }
    
    // ลบสายเคเบิลที่เลือก
    const selectedCable = getSelectedCable();
    if (selectedCable) {
        deleteCable(selectedCable);
        deletedCount++;
    }
    
    if (deletedCount > 0) {
        showNotification(`ลบวัตถุ ${deletedCount} รายการแล้ว`, 'success');
        try { calculateCosts(); } catch(_) {}
    } else {
        showNotification('กรุณาเลือกวัตถุที่ต้องการลบก่อน', 'error');
    }
}

// ฟังก์ชันลบวัตถุที่คลิก (ไม่ต้องเลือกก่อน)
function deleteClickedObject(e) {
    const clickedElement = e.target;
    let deleted = false;
    
    // ตรวจสอบว่าเป็นกล้องหรือไม่
    if (clickedElement._icon && clickedElement._icon.classList.contains('cam-icon-wrapper')) {
        const camera = cameras.find(cam => cam._icon === clickedElement._icon);
        if (camera) {
            deleteCamera(camera);
            deleted = true;
        }
    }
    
    // ตรวจสอบว่าเป็นตู้ Rack หรือไม่
    if (clickedElement._icon && clickedElement._icon.classList.contains('rack-label')) {
        const rackId = clickedElement.options?.title;
        if (rackId) {
            deleteRack(rackId);
            deleted = true;
        }
    }
    
    // ตรวจสอบว่าเป็นสี่เหลี่ยมโปร่งแสงหรือไม่
    if (clickedElement._path && clickedElement._path.classList.contains('leaflet-interactive')) {
        const overlay = rectOverlays.find(ov => ov.polygon === clickedElement);
        if (overlay) {
            deleteCurrentOverlay();
            deleted = true;
        }
    }
    
    if (!deleted) {
        showNotification('คลิกที่วัตถุที่ต้องการลบ', 'info');
    }
}

// ฟังก์ชันลบสี่เหลี่ยมโปร่งแสงที่เลือก
function deleteCurrentOverlay() {
    if (!currentOverlay) { showNotification('ยังไม่ได้เลือกสี่เหลี่ยม', 'error'); return; }
    try {
        if (currentOverlay.polygon) map.removeLayer(currentOverlay.polygon);
        if (currentOverlay.centerMarker) map.removeLayer(currentOverlay.centerMarker);
        if (currentOverlay.cornerMarkers && currentOverlay.cornerMarkers.length) {
            currentOverlay.cornerMarkers.forEach(mk => { try { map.removeLayer(mk); } catch(_) {} });
        }
        if (currentOverlay.rotationHandle) map.removeLayer(currentOverlay.rotationHandle);
    } catch (_) {}
    rectOverlays = rectOverlays.filter(o => o !== currentOverlay);
    currentOverlay = null;
    showNotification('ลบสี่เหลี่ยมแล้ว', 'success');
}

// ฟังก์ชันลบตู้ Rack
function deleteRack(rackId) {
    const rack = getRackById(rackId);
    if (!rack) {
        showNotification('ไม่พบตู้ Rack ที่ต้องการลบ', 'error');
        return;
    }
    
    // ลบการเชื่อมต่อที่เกี่ยวข้อง
    const linksToRemove = rackLinks.filter(link => link.fromId === rackId || link.toId === rackId);
    linksToRemove.forEach(link => {
        try {
            if (link.line) map.removeLayer(link.line);
        } catch (_) {}
    });
    rackLinks = rackLinks.filter(link => link.fromId !== rackId && link.toId !== rackId);
    
    // ลบมาร์คเกอร์
    try {
        if (rack.marker) map.removeLayer(rack.marker);
    } catch (_) {}
    
    // ลบจากอาร์เรย์
    racks = racks.filter(r => r.id !== rackId);
    
    // อัปเดต dropdowns
    ['rackList', 'rackFrom', 'rackTo'].forEach(selId => {
        const sel = document.getElementById(selId);
        if (sel) {
            const options = sel.querySelectorAll(`option[value="${rackId}"]`);
            options.forEach(opt => opt.remove());
            if (sel.value === rackId) {
                sel.value = sel.options.length > 0 ? sel.options[0].value : '';
            }
        }
    });
    
    showNotification(`ลบตู้ Rack ${rack.name} แล้ว`, 'success');
}

// ฟังก์ชันลบสายเคเบิล
function deleteCable(cable) {
    try {
        if (cable && cable.remove) {
            map.removeLayer(cable);
            cableLines = cableLines.filter(line => line !== cable);
            showNotification('ลบสายเคเบิลแล้ว', 'success');
        }
    } catch (_) {
        showNotification('ไม่สามารถลบสายเคเบิลได้', 'error');
    }
}

// ฟังก์ชันลบการเชื่อมต่อระหว่างตู้ Rack
function deleteRackConnection(fromId, toId) {
    const linkIndex = rackLinks.findIndex(link => 
        (link.fromId === fromId && link.toId === toId) || 
        (link.fromId === toId && link.toId === fromId)
    );
    
    if (linkIndex !== -1) {
        const link = rackLinks[linkIndex];
        try {
            if (link.line) map.removeLayer(link.line);
        } catch (_) {}
        rackLinks.splice(linkIndex, 1);
        showNotification(`ลบการเชื่อมต่อ ${fromId} ↔ ${toId} แล้ว`, 'success');
        try { calculateCosts(); } catch(_) {}
    } else {
        showNotification('ไม่พบการเชื่อมต่อที่ต้องการลบ', 'error');
    }
}

// ฟังก์ชันลบกล้อง
function deleteCamera(camera) {
    if (!camera) {
        showNotification('ไม่พบกล้องที่ต้องการลบ', 'error');
        return;
    }
    
    try {
        map.removeLayer(camera);
        cameras = cameras.filter(cam => cam !== camera);
        if (currentCam === camera) {
            currentCam = null;
        }
        showNotification('ลบกล้องแล้ว', 'success');
    } catch (_) {
        showNotification('ไม่สามารถลบกล้องได้', 'error');
    }
}

// ฟังก์ชันลบกล้องที่เลือกปัจจุบัน
function deleteCurrentCamera() {
    if (!currentCam) {
        showNotification('กรุณาเลือกกล้องที่ต้องการลบก่อน', 'error');
        return;
    }
    deleteCamera(currentCam);
}

// ฟังก์ชันลบพื้นที่งาน
function deleteWorkArea() {
    if (areaPolygon) {
        try {
            map.removeLayer(areaPolygon);
        } catch (_) {}
        areaPolygon = null;
        showNotification('ลบพื้นที่งานแล้ว', 'success');
    } else {
        showNotification('ไม่มีพื้นที่งานให้ลบ', 'error');
    }
}

// ฟังก์ชันลบทุกอย่าง
function deleteAll() {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบทุกอย่าง? การกระทำนี้ไม่สามารถยกเลิกได้')) {
        return;
    }
    
    let deletedCount = 0;
    
    // ลบกล้องทั้งหมด
    cameras.forEach(cam => {
        try { if (cam.marker) map.removeLayer(cam.marker); } catch(_) {}
        deletedCount++;
    });
    cameras = [];
    currentCam = null;
    
    // ลบสายเคเบิลทั้งหมด
    cableLines.forEach(line => {
        try { map.removeLayer(line); } catch(_) {}
        deletedCount++;
    });
    cableLines = [];
    
    // ลบตู้ Rack ทั้งหมด
    racks.forEach(rack => {
        try { if (rack.marker) map.removeLayer(rack.marker); } catch(_) {}
        deletedCount++;
    });
    racks = [];
    rackLinks.forEach(link => {
        try { if (link.line) map.removeLayer(link.line); } catch(_) {}
    });
    rackLinks = [];
    
    // ลบเสากล้องทั้งหมด
    poles.forEach(pole => {
        try { if (pole.marker) map.removeLayer(pole.marker); } catch(_) {}
        deletedCount++;
    });
    poles = [];
    
    // ลบสายเคเบิลทั้งหมด
    cableConnections.forEach(conn => {
        try { if (conn.line) map.removeLayer(conn.line); } catch(_) {}
        deletedCount++;
    });
    cableConnections = [];
    
    // ลบสี่เหลี่ยมโปร่งแสงทั้งหมด
    rectOverlays.forEach(overlay => {
        try {
            if (overlay.polygon) map.removeLayer(overlay.polygon);
            if (overlay.centerMarker) map.removeLayer(overlay.centerMarker);
            if (overlay.cornerMarkers) {
                overlay.cornerMarkers.forEach(mk => { try { map.removeLayer(mk); } catch(_) {} });
            }
            if (overlay.rotationHandle) map.removeLayer(overlay.rotationHandle);
        } catch (_) {}
        deletedCount++;
    });
    rectOverlays = [];
    currentOverlay = null;
    
    // ลบพื้นที่งาน
    if (areaPolygon) {
        try { map.removeLayer(areaPolygon); } catch(_) {}
        areaPolygon = null;
        deletedCount++;
    }
    
    // ลบข้อความตำแหน่งทั้งหมด
    locationTexts.forEach(textObj => {
        try { if (textObj.marker) map.removeLayer(textObj.marker); } catch(_) {}
        deletedCount++;
    });
    locationTexts = [];
    
    // ล้าง dropdowns
    ['rackList', 'rackFrom', 'rackTo'].forEach(selId => {
        const sel = document.getElementById(selId);
        if (sel) {
            sel.innerHTML = '';
        }
    });
    
    showNotification(`ลบทุกอย่างแล้ว (${deletedCount} รายการ)`, 'success');
    try { calculateCosts(); } catch(_) {}
}

// ฟังก์ชันช่วยเหลือสำหรับการเลือกวัตถุ
function getSelectedRack() {
    // ตรวจสอบจาก dropdown ที่เลือก
    const rackList = document.getElementById('rackList');
    if (rackList && rackList.value) {
        return getRackById(rackList.value);
    }
    return null;
}

function getSelectedCable() {
    // ตรวจสอบจากสายเคเบิลที่เลือก (ถ้ามีการเลือก)
    // สำหรับตอนนี้จะคืนค่า null เพราะยังไม่มีระบบเลือกสายเคเบิล
    return null;
}

// ฟังก์ชันลบตู้ Rack จาก dropdown
function deleteSelectedRack() {
    const selectedRack = getSelectedRack();
    if (selectedRack) {
        deleteRack(selectedRack.id);
    } else {
        showNotification('กรุณาเลือกตู้ Rack ที่ต้องการลบ', 'error');
    }
}

// ฟังก์ชันลบการเชื่อมต่อที่เลือก
function deleteSelectedConnection() {
    const fromSel = document.getElementById('rackFrom');
    const toSel = document.getElementById('rackTo');
    if (!fromSel || !toSel || !fromSel.value || !toSel.value) {
        showNotification('กรุณาเลือกตู้ต้นทางและปลายทาง', 'error');
        return;
    }
    deleteRackConnection(fromSel.value, toSel.value);
}

// เชื่อม UI ควบคุมกล้อง
function wireCameraControls() {
    const cameraControls = [
        'cameraType', 'cameraResolution', 'cameraFOV', 'cameraRange',
        'poleHeight', 'cameraHeight', 'cameraTilt', 'cameraPan', 'cameraPrice', 'polePrice'
    ];
    
    cameraControls.forEach(controlId => {
        const control = document.getElementById(controlId);
        if (control) {
            control.addEventListener('change', () => {
                if (currentCam) {
                    const propertyName = controlId.replace('camera', '').toLowerCase();
                    if (control.type === 'select-one') {
                        currentCam[propertyName] = control.value;
                    } else {
                        currentCam[propertyName] = parseFloat(control.value) || 0;
                    }
                    showNotification('อัปเดตการตั้งค่ากล้องแล้ว', 'success');
                    updateCameraCalculations(currentCam);
                    try { calculateCosts(); } catch(_) {}
                }
            });
        }
    });
}

// เชื่อม UI ควบคุมสี่เหลี่ยมโปร่งแสง
function wireOverlayControls() {
    const addBtn = document.getElementById('addRectOverlay');
    const delBtn = document.getElementById('deleteSelected');
    const fillEl = document.getElementById('rectFillColor');
    const opEl = document.getElementById('rectOpacity');
    const wEl = document.getElementById('rectWidth');
    const hEl = document.getElementById('rectHeight');
    const aEl = document.getElementById('rectAngle');

    if (addBtn) addBtn.addEventListener('click', () => {
        if (!map) return;
        const center = map.getCenter();
        createRectOverlay(center, {});
    });
    if (delBtn) delBtn.addEventListener('click', deleteSelected);

    const apply = () => {
        if (!currentOverlay) return;
        if (fillEl) currentOverlay.color = fillEl.value || currentOverlay.color;
        if (opEl) currentOverlay.opacity = parseFloat(opEl.value) || currentOverlay.opacity;
        if (wEl) currentOverlay.width = Math.max(1, parseFloat(wEl.value) || currentOverlay.width);
        if (hEl) currentOverlay.height = Math.max(1, parseFloat(hEl.value) || currentOverlay.height);
        if (aEl) currentOverlay.angle = parseFloat(aEl.value) || currentOverlay.angle;
        updateOverlayStyle(currentOverlay);
        updateOverlayGeometry(currentOverlay);
        showNotification('อัปเดตสี่เหลี่ยมแล้ว', 'success');
    };

    [fillEl, opEl, wEl, hEl, aEl].forEach(el => {
        if (!el) return;
        const evt = (el.id === 'rectFillColor' || el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(evt, apply);
    });

    if (map) {
        map.on('click', () => { selectOverlay(null); });
    }
}

// เชื่อมตู้ Rack สองใบเข้าด้วยกันด้วยเส้น พร้อมบันทึกชนิดสาย
function connectSelectedRacks() {
    const fromSel = document.getElementById('rackFrom');
    const toSel = document.getElementById('rackTo');
    if (!fromSel || !toSel) { showNotification('ไม่พบตัวเลือกตู้ Rack', 'error'); return; }
    const fromId = fromSel.value;
    const toId = toSel.value;
    if (!fromId || !toId || fromId === toId) {
        showNotification('กรุณาเลือกตู้ต้นทางและปลายทางที่แตกต่างกัน', 'error');
        return;
    }
    const fromRack = getRackById(fromId);
    const toRack = getRackById(toId);
    if (!fromRack || !toRack) {
        showNotification('ไม่พบตู้ที่เลือกบนแผนที่', 'error');
        return;
    }

    // ป้องกันการเชื่อมซ้ำ (ไม่บังคับ แต่เตือน)
    const exists = (rackLinks || []).some(l => (l.fromId === fromId && l.toId === toId) || (l.fromId === toId && l.toId === fromId));
    if (exists) {
        showNotification('มีการเชื่อมตู้คู่นี้อยู่แล้ว', 'info');
        return;
    }

    // ใช้ชนิดสายจากตัวเลือกปัจจุบัน
    const typeEl = document.getElementById('cableType');
    const cableType = typeEl ? typeEl.value : 'UTP';
    const color = cableType === 'FIBER' ? '#0d6efd' : '#198754';

    const fromLatLng = fromRack.marker.getLatLng();
    const toLatLng = toRack.marker.getLatLng();
    const line = L.polyline([fromLatLng, toLatLng], { color, weight: 4, dashArray: '6,4' }).addTo(map);
    line.cableType = cableType;

    rackLinks.push({ fromId, toId, line, cableType });
    showNotification(`เชื่อม ${fromId} → ${toId} ด้วยสาย ${cableType}`, 'success');
    // อัปเดตการคำนวณทันทีหลังเชื่อมตู้
    try { calculateCosts(); } catch (_) {}
}

/**
 * Build the coords for a polygon
 */
function buildPolyCoords(latlng, facingAngle, spanAngle, distMetres) {
    var pt1 = L.GeometryUtil.destination(latlng, facingAngle - (spanAngle / 2.0), distMetres);
    var pt2 = L.GeometryUtil.destination(latlng, facingAngle - (spanAngle / 4.0), distMetres);
    var pt3 = L.GeometryUtil.destination(latlng, facingAngle, distMetres);
    var pt4 = L.GeometryUtil.destination(latlng, facingAngle + (spanAngle / 4.0), distMetres);
    var pt5 = L.GeometryUtil.destination(latlng, facingAngle + (spanAngle / 2.0), distMetres);
    return [
        [latlng.lat, latlng.lng],
        [pt1.lat, pt1.lng],
        [pt2.lat, pt2.lng],
        [pt3.lat, pt3.lng],
        [pt4.lat, pt4.lng],
        [pt5.lat, pt5.lng],
    ];
}

/**
 * Add a camera at a given coordinate
 */
function addCamera(latlng) {
    var cam = {
        position: latlng,
        angle: 0,
        sensorSize: 6.43,   // mm diagional = 1/2.8"
        focalLength: 2.8,   // mm
        range: 30,          // metres
        type: 'BULLET',     // DOME | BULLET | PTZ
    };

    cam.fov = calcFov(cam.sensorSize, cam.focalLength);

    var coords = buildPolyCoords(cam.position, cam.angle, cam.fov, cam.range);
    var ndPolygon = L.polygon(coords).addTo(map);

    var ndCentre = L.circle([cam.position.lat, cam.position.lng], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.5,
        radius: 0.5
    }).addTo(map);

    // Rotation handle placed ahead of the camera to adjust angle by dragging
    var handleDist = 5; // metres ahead of camera center
    var handlePos = L.GeometryUtil.destination(cam.position, cam.angle, handleDist);
    var ndHandle = L.circleMarker(handlePos, { radius: 4, color: '#0d6efd', fillColor: '#0d6efd', fillOpacity: 0.9, weight: 1 }).addTo(map);

    // Camera icon marker (rotating SVG based on type and angle)
    var ndMarker = L.marker(cam.position, { icon: makeCamIcon(cam), zIndexOffset: 600 }).addTo(map);

    ndPolygon.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
    ndCentre.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
    ndHandle.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
    ndMarker.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });

    // Emulate dragging the camera by dragging its center
    var draggingCam = false;
    ndCentre.on('mousedown', function(e) {
        draggingCam = true;
        L.DomEvent.stopPropagation(e);
    });
    map.on('mousemove', function(e) {
        if (!draggingCam) return;
        cam.position = e.latlng;
        ndCentre.setLatLng(e.latlng);
        renderCam(cam);
        // move rotation handle to remain at fixed distance ahead of camera
        try { ndHandle.setLatLng(L.GeometryUtil.destination(cam.position, cam.angle, handleDist)); } catch(_) {}
        try { ndMarker.setLatLng(cam.position); } catch(_) {}
        if (currentCam === cam) {
            var posEl = document.getElementById('camPos');
            if (posEl) posEl.textContent = cam.position.lat.toFixed(6) + ', ' + cam.position.lng.toFixed(6);
        }
    });
    map.on('mouseup', function() { draggingCam = false; });

    // Emulate dragging the rotation handle to set camera angle
    var draggingHandle = false;
    ndHandle.on('mousedown', function(e) {
        draggingHandle = true;
        L.DomEvent.stopPropagation(e);
        // เพิ่ม cursor style
        map.getContainer().style.cursor = 'crosshair';
    });
    map.on('mousemove', function(e) {
        if (!draggingHandle) return;
        var ang = L.GeometryUtil.bearing(cam.position, e.latlng);
        // Normalize angle to -360..360 range similar to slider
        if (ang > 180) ang = ang - 360;
        cam.angle = ang;
        renderCam(cam);
        // reposition handle along the new angle
        try { ndHandle.setLatLng(L.GeometryUtil.destination(cam.position, cam.angle, handleDist)); } catch(_) {}
        if (currentCam === cam) {
            var angEl = document.getElementById('fld-angle');
            if (angEl) angEl.value = cam.angle;
            // อัปเดตการแสดงผลมุมกล้อง
            updateCameraAngleDisplay(cam);
        }
    });
    map.on('mouseup', function() { 
        draggingHandle = false; 
        // คืนค่า cursor style
        map.getContainer().style.cursor = '';
    });

    cam.ndPolygon = ndPolygon;
    cam.ndCentre = ndCentre;
    cam.ndHandle = ndHandle;
    cam.ndMarker = ndMarker;
    cameras.push(cam);

    setCurrent(cam);
    
    // เพิ่ม Event Listener สำหรับ slider หลังจากสร้าง UI
    setTimeout(() => {
        const angleSlider = document.getElementById('fld-angle');
        if (angleSlider) {
            angleSlider.addEventListener('input', function() {
                const newAngle = parseFloat(this.value);
                if (currentCam === cam) {
                    cam.angle = newAngle;
                    renderCam(cam);
                    updateCameraAngleDisplay(cam);
                    
                    // อัปเดตตำแหน่ง handle
                    const handleDist = 5;
                    try {
                        const handlePos = L.GeometryUtil.destination(cam.position, cam.angle, handleDist);
                        cam.ndHandle.setLatLng(handlePos);
                    } catch(_) {}
                }
            });
        }
    }, 100);
}

function calcFov(sensorSize, focalLength) {
    return Math.degrees(2 * Math.atan(sensorSize / (2.0 * focalLength)));
}

// ฟังก์ชันอัปเดตการแสดงผลมุมกล้อง
function updateCameraAngleDisplay(cam) {
    const angleDisplay = document.getElementById('cameraAngleDisplay');
    if (angleDisplay) {
        angleDisplay.textContent = `${cam.angle.toFixed(1)}°`;
    }
    
    // อัปเดตทิศทาง
    const directionDisplay = document.getElementById('cameraDirectionDisplay');
    if (directionDisplay) {
        const direction = getDirectionFromAngle(cam.angle);
        directionDisplay.textContent = direction;
    }
}

// ฟังก์ชันแปลงมุมเป็นทิศทาง
function getDirectionFromAngle(angle) {
    const normalizedAngle = ((angle % 360) + 360) % 360;
    
    if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'ทิศเหนือ';
    if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'ทิศตะวันออกเฉียงเหนือ';
    if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'ทิศตะวันออก';
    if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'ทิศตะวันออกเฉียงใต้';
    if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'ทิศใต้';
    if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'ทิศตะวันตกเฉียงใต้';
    if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'ทิศตะวันตก';
    if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) return 'ทิศตะวันตกเฉียงเหนือ';
    
    return 'ไม่ระบุ';
}

// ฟังก์ชันตั้งค่ามุมกล้อง
function setCameraAngle(newAngle) {
    if (!currentCam) return;
    
    // Normalize angle to -360..360 range
    if (newAngle > 360) newAngle = newAngle - 360;
    if (newAngle < -360) newAngle = newAngle + 360;
    
    currentCam.angle = newAngle;
    renderCam(currentCam);
    
    // อัปเดต UI
    const angleSlider = document.getElementById('fld-angle');
    if (angleSlider) {
        angleSlider.value = newAngle;
    }
    
    updateCameraAngleDisplay(currentCam);
    
    // อัปเดตตำแหน่ง handle
    const handleDist = 5;
    try {
        const handlePos = L.GeometryUtil.destination(currentCam.position, currentCam.angle, handleDist);
        currentCam.ndHandle.setLatLng(handlePos);
    } catch(_) {}
    
    showNotification(`ตั้งค่ามุมกล้องเป็น ${newAngle.toFixed(1)}° (${getDirectionFromAngle(newAngle)})`, 'success');
}

/**
 * Set the current camera in the tools panel
 */
function setCurrent(cam) {
    toolsEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;">
            <div>
                <strong style="color: #495057;">พิกัด:</strong> 
                <span id="camPos" style="color: #6c757d; font-family: monospace;">${cam.position.lat.toFixed(6)}, ${cam.position.lng.toFixed(6)}</span>
            </div>
            <button onclick="clearCurrentCamera()" style="background: linear-gradient(45deg, #dc3545, #c82333); color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;" title="กลับไปเลือกกล้อง" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">❌ ปิด</button>
        </div>
        <br>
        <div class="camera-controls">
            <div class="angle-control">
                <label>มุมกล้อง (องศา): </label>
                <div class="angle-display">
                    <span id="cameraAngleDisplay">${cam.angle.toFixed(1)}°</span>
                    <span id="cameraDirectionDisplay">${getDirectionFromAngle(cam.angle)}</span>
                </div>
                <input type="range" min="-360" max="360" id="fld-angle" value="${cam.angle}" step="0.1">
                <div class="angle-buttons">
                    <button onclick="setCameraAngle(${cam.angle - 90})" title="หมุนซ้าย 90°">↶ 90°</button>
                    <button onclick="setCameraAngle(${cam.angle - 45})" title="หมุนซ้าย 45°">↶ 45°</button>
                    <button onclick="setCameraAngle(${cam.angle + 45})" title="หมุนขวา 45°">45° ↷</button>
                    <button onclick="setCameraAngle(${cam.angle + 90})" title="หมุนขวา 90°">90° ↷</button>
                </div>
            </div>
        </div>
        <br>
        <br><label>ชนิดกล้อง: </label>
        <select id="fld-type">
            <option value="BULLET" ${cam.type==='BULLET'?'selected':''}>บูลเล็ต (Bullet)</option>
            <option value="DOME" ${cam.type==='DOME'?'selected':''}>โดม (Dome)</option>
            <option value="PTZ" ${cam.type==='PTZ'?'selected':''}>PTZ</option>
        </select>
        <br>
        <br>ขนาดเซนเซอร์: ${cam.sensorSize} มม.
        <br>ความยาวโฟกัส: ${cam.focalLength} มม.
        <br>
        <br><label>ระยะการมองเห็น (เมตร): </label> <input type="range" min="1" max="100" id="fld-range" value="${cam.range}">
        <br><label>มุมมองภาพ (FOV องศา): </label> <input type="range" min="1" max="359" id="fld-fov" value="${cam.fov}">
        <br>
        <br>
        <div style="text-align: center; margin-top: 20px; padding: 15px; background: #fff3cd; border: 2px solid #ffeaa7; border-radius: 8px;">
            <button onclick="clearCurrentCamera()" style="background: linear-gradient(45deg, #dc3545, #c82333); color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 4px 8px rgba(0,0,0,0.3); transition: all 0.3s ease; width: 100%;" title="กลับไปเลือกกล้อง" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                🚪 ปิดการเลือกกล้อง
            </button>
            <p style="margin-top: 10px; font-size: 12px; color: #856404;">คลิกเพื่อกลับไปเลือกกล้องอื่น</p>
        </div>
    `;

    document.getElementById('fld-angle').addEventListener('input', (e) => { cam.angle = parseFloat(e.target.value); renderCam(cam) });
    const typeSel = document.getElementById('fld-type');
    if (typeSel) typeSel.addEventListener('change', (e) => { cam.type = e.target.value; renderCam(cam); });
    document.getElementById('fld-range').addEventListener('input', (e) => { cam.range = parseFloat(e.target.value); renderCam(cam) });
    document.getElementById('fld-fov').addEventListener('input', (e) => { cam.fov = parseFloat(e.target.value); renderCam(cam) });

    currentCam = cam;
}

// ฟังก์ชันล้างการเลือกกล้องปัจจุบัน
function clearCurrentCamera() {
    currentCam = null;
    toolsEl.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
            <h4 style="color: #495057; margin-bottom: 15px;">🎥 เลือกกล้อง</h4>
            <p style="margin-bottom: 20px;">คลิกที่กล้องบนแผนที่เพื่อเลือกและปรับแต่ง</p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="addBulletCameraMode()" style="background: linear-gradient(45deg, #ffc107, #e0a800); color: #333; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    📹 เพิ่มกล้องบูลเล็ต
                </button>
                <button onclick="addDomeCameraMode()" style="background: linear-gradient(45deg, #007bff, #0056b3); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    🔵 เพิ่มกล้องโดม
                </button>
                <button onclick="addPTZCameraMode()" style="background: linear-gradient(45deg, #dc3545, #c82333); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    🔴 เพิ่มกล้อง PTZ
                </button>
            </div>
            <hr style="margin: 20px 0; border: 1px solid #dee2e6;">
            <h4 style="color: #495057; margin-bottom: 15px;">🏗️ อุปกรณ์อื่นๆ</h4>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="addRackMode()" style="background: linear-gradient(45deg, #28a745, #1e7e34); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    🗄️ เพิ่มตู้ Rack
                </button>
                <button onclick="addPoleMode()" style="background: linear-gradient(45deg, #6f42c1, #5a2d91); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    🏗️ เพิ่มเสากล้อง
                </button>
            </div>
        </div>
    `;
    showNotification('ล้างการเลือกกล้องแล้ว - คลิกที่กล้องเพื่อเลือกใหม่', 'info');
}

function renderCam(cam) {
    var coords = buildPolyCoords(cam.position, cam.angle, cam.fov, cam.range);
    cam.ndPolygon.setLatLngs(coords);
    // update rotation handle position if exists
    try {
        if (cam.ndHandle) {
            var handleDist = 5;
            cam.ndHandle.setLatLng(L.GeometryUtil.destination(cam.position, cam.angle, handleDist));
        }
    } catch(_) {}
    // update icon marker
    try {
        if (cam.ndMarker) {
            cam.ndMarker.setLatLng(cam.position);
            cam.ndMarker.setIcon(makeCamIcon(cam));
        }
    } catch(_) {}
}

// Build a rotating SVG icon for the camera by type and angle
function makeCamIcon(cam) {
    var angle = cam.angle || 0;
    var type = cam.type || 'BULLET';
    var svg = camIconSvg(type);
    var html = `<div class="cam-icon" style="width:28px;height:28px;transform: rotate(${angle}deg); transform-origin: 50% 50%;">${svg}</div>`;
    return L.divIcon({
        className: 'cam-icon-wrapper',
        html: html,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
}

function camIconSvg(type) {
    // ปรับปรุงไอคอนกล้องให้ชัดเจนขึ้น
    if (type === 'DOME') {
        return `
        <svg viewBox="0 0 64 64" width="28" height="28">
            <circle cx="32" cy="28" r="12" fill="#007bff"/>
            <circle cx="32" cy="28" r="8" fill="#ffffff"/>
            <circle cx="32" cy="28" r="4" fill="#007bff"/>
            <rect x="16" y="40" width="32" height="6" rx="3" fill="#6c757d"/>
            <polygon points="32,6 28,16 36,16" fill="#28a745"/>
        </svg>`;
    } else if (type === 'PTZ') {
        return `
        <svg viewBox="0 0 64 64" width="28" height="28">
            <circle cx="32" cy="28" r="14" fill="#dc3545"/>
            <circle cx="32" cy="28" r="10" fill="#ffffff"/>
            <circle cx="32" cy="28" r="6" fill="#dc3545"/>
            <circle cx="32" cy="28" r="2" fill="#ffffff"/>
            <rect x="24" y="42" width="16" height="6" rx="3" fill="#6c757d"/>
            <polygon points="32,6 28,16 36,16" fill="#28a745"/>
        </svg>`;
    } else { // BULLET
        return `
        <svg viewBox="0 0 64 64" width="28" height="28">
            <rect x="16" y="20" width="32" height="16" rx="6" fill="#ffc107"/>
            <rect x="6" y="24" width="14" height="8" rx="4" fill="#6c757d"/>
            <circle cx="48" cy="28" r="4" fill="#343a40"/>
            <polygon points="32,6 28,16 36,16" fill="#28a745"/>
        </svg>`;
    }
}


function startMapCoords() {
    var urlParams = new URLSearchParams(window.location.search);
    var lat = urlParams.get('lat');
    var lng = urlParams.get('lng');
    var z = urlParams.get('z');
    if (lat && lng && z) {
        return [lat, lng, z];
    } else {
        // เริ่มต้นที่กรุงเทพฯ ประเทศไทย
        return [13.7563, 100.5018, 12];
    }
}

function setUrlCoords(map) {
    var urlParams = new URLSearchParams(location.search);
    urlParams.set('lat', map.getCenter().lat);
    urlParams.set('lng', map.getCenter().lng);
    urlParams.set('z', map.getZoom());
    var newUrl = location.protocol + "//" + location.host + location.pathname + '?' + urlParams.toString();
    if (history && history.replaceState) {
        history.replaceState(null, '', newUrl);
    }
}
function calculateCosts() {
    // 1. คำนวณค่าสายและค่าแรงเดินสาย
    const utpPrice = parseFloat(document.getElementById('utpPrice')?.value) || 15;
    const fiberPrice = parseFloat(document.getElementById('fiberPrice')?.value) || 25;
    const laborPriceUtp = parseFloat(document.getElementById('laborPriceUtp')?.value) || 30;
    const laborPriceFiber = parseFloat(document.getElementById('laborPriceFiber')?.value) || 35;
    const pvcPriceUtp = parseFloat(document.getElementById('pvcPriceUtp')?.value) || 0;
    const pvcPriceFiber = parseFloat(document.getElementById('pvcPriceFiber')?.value) || 0;

    // คำนวณระยะทางทั้งหมด แยกตามชนิดสาย และรวมระยะของ rackLinks ด้วย
    let utpMeters = 0;
    let fiberMeters = 0;
    let totalMeters = 0;

    // จากสายที่เชื่อมกล้อง
    cableLines.forEach(line => {
        const latlngs = line.getLatLngs();
        for (let i = 1; i < latlngs.length; i++) {
            const seg = map.distance(latlngs[i - 1], latlngs[i]);
            totalMeters += seg;
            if (line.cableType === 'FIBER') fiberMeters += seg; else utpMeters += seg;
        }
    });

    // จากสายที่เชื่อมระหว่าง Rack
    (rackLinks || []).forEach(link => {
        const latlngs = link.line.getLatLngs();
        for (let i = 1; i < latlngs.length; i++) {
            const seg = map.distance(latlngs[i - 1], latlngs[i]);
            totalMeters += seg;
            if (link.cableType === 'FIBER') fiberMeters += seg; else utpMeters += seg;
        }
    });

    totalDistance = totalMeters / 1000.0; // แสดงเป็นกิโลเมตร
    
    // ต้นทุนวัสดุสายตามชนิด
    const cableMaterialCost = (utpMeters * utpPrice) + (fiberMeters * fiberPrice);
    // ค่าแรงคิดแยกตามชนิดสาย
    const cableLaborCost = (utpMeters * laborPriceUtp) + (fiberMeters * laborPriceFiber);
    // ค่าท่อ PVC แยกตามชนิดสาย
    const pvcCostUtp = utpMeters * pvcPriceUtp;
    const pvcCostFiber = fiberMeters * pvcPriceFiber;
    const pvcTotalCost = pvcCostUtp + pvcCostFiber;
    
    // 2. ค่าอุปกรณ์ (เดิม)
    var equipmentCost = 0;
    var rackLaborCost = 0;
    var rackSize = document.getElementById('rackSize').value;
    equipmentCost += rackPrices[parseInt(rackSize)] || 0;
    var switchQty = parseInt(document.getElementById('switchQty').value) || 0;
    var nvrQty = parseInt(document.getElementById('nvrQty').value) || 0;
    var upsQty = parseInt(document.getElementById('upsQty').value) || 0;
    equipmentCost += switchQty * 4500;
    equipmentCost += nvrQty * 9500;
    equipmentCost += upsQty * 12500;
    rackLaborCost = parseInt(document.getElementById('rackInstallation').value) || 5000;

    // 3. ค่ากล้องและเสา
    var cameraCost = 0;
    var poleCost = 0;
    var cameraInstallationCost = 0;
    
    cameras.forEach(camera => {
        // ค่ากล้อง
        cameraCost += camera.price || 0;
        
        // ค่าเสา
        poleCost += camera.polePrice || 0;
        
        // ค่าติดตั้ง (ประมาณ 20% ของราคากล้อง)
        cameraInstallationCost += (camera.price * 0.2) || 0;
    });
    
    equipmentCost += cameraCost + poleCost;
    rackLaborCost += cameraInstallationCost;
    
    var totalCost = cableMaterialCost + pvcTotalCost + cableLaborCost + equipmentCost + rackLaborCost;
    
    // อัปเดต UI
    document.getElementById('totalDistance').textContent = totalDistance.toFixed(3);
    
    // อัปเดตข้อมูลกล้อง
    const totalCameras = cameras.length;
    const fixedCameras = cameras.filter(c => c.type === 'fixed').length;
    const ptzCameras = cameras.filter(c => c.type === 'ptz').length;
    const totalPoles = cameras.filter(c => c.type === 'pole').length;
    
    // คำนวณความสูงเฉลี่ยและระยะการมองเห็นเฉลี่ย
    let totalHeight = 0;
    let totalRange = 0;
    let totalCoverageArea = 0;
    let validCameras = 0;
    
    cameras.forEach(camera => {
        if (camera.poleHeight && camera.cameraHeight) {
            totalHeight += camera.poleHeight + camera.cameraHeight;
            totalRange += camera.range || 0;
            totalCoverageArea += calculateCoverageArea(camera);
            validCameras++;
        }
    });
    
    const averageHeight = validCameras > 0 ? (totalHeight / validCameras).toFixed(1) : 0;
    const averageRange = validCameras > 0 ? (totalRange / validCameras).toFixed(1) : 0;
    
    document.getElementById('totalCameras').textContent = totalCameras;
    document.getElementById('fixedCameras').textContent = fixedCameras;
    document.getElementById('ptzCameras').textContent = ptzCameras;
    document.getElementById('totalPoles').textContent = totalPoles;
    document.getElementById('totalCameraCost').textContent = cameraCost.toLocaleString();
    document.getElementById('totalPoleCost').textContent = poleCost.toLocaleString();
    document.getElementById('cameraInstallationCost').textContent = Math.round(cameraInstallationCost).toLocaleString();
    document.getElementById('averageHeight').textContent = averageHeight;
    document.getElementById('averageRange').textContent = averageRange;
    document.getElementById('totalCoverageArea').textContent = totalCoverageArea.toLocaleString();
    // อัปเดตระยะสายแยกตามชนิด (กม.)
    const utpKm = (utpMeters / 1000).toFixed(3);
    const fiberKm = (fiberMeters / 1000).toFixed(3);
    const utpEl = document.getElementById('utpLengthKm');
    const fiberEl = document.getElementById('fiberLengthKm');
    if (utpEl) utpEl.textContent = utpKm;
    if (fiberEl) fiberEl.textContent = fiberKm;
    document.getElementById('materialCost').textContent = Math.round(cableMaterialCost).toLocaleString();
    const pvcCostEl = document.getElementById('pvcCost');
    if (pvcCostEl) pvcCostEl.textContent = Math.round(pvcTotalCost).toLocaleString();
    document.getElementById('laborCost').textContent = Math.round(cableLaborCost).toLocaleString();
    document.getElementById('equipmentCost').textContent = equipmentCost.toLocaleString();
    document.getElementById('rackLaborCost').textContent = rackLaborCost.toLocaleString();
    document.getElementById('totalCost').textContent = Math.round(totalCost).toLocaleString();
    
    return {
        cableMaterialCost,
        pvcTotalCost,
        cableLaborCost,
        equipmentCost,
        rackLaborCost,
        totalCost,
        utpMeters,
        fiberMeters
    };
}

// ฟังก์ชันสร้างใบเสนอราคา ตามราคาสาย UTP/Fiber แยกชนิด และรวมค่าแรง + อุปกรณ์
function generateQuote() {
    // คำนวณล่าสุดและดึงค่าที่ต้องใช้
    const costs = calculateCosts();
    const utpPrice = parseFloat(document.getElementById('utpPrice')?.value) || 15;
    const fiberPrice = parseFloat(document.getElementById('fiberPrice')?.value) || 25;
    const laborPriceUtp = parseFloat(document.getElementById('laborPriceUtp')?.value) || 30;
    const laborPriceFiber = parseFloat(document.getElementById('laborPriceFiber')?.value) || 35;
    const pvcPriceUtp = parseFloat(document.getElementById('pvcPriceUtp')?.value) || 0;
    const pvcPriceFiber = parseFloat(document.getElementById('pvcPriceFiber')?.value) || 0;
    const rackSize = parseInt(document.getElementById('rackSize')?.value) || 9;
    const switchQty = parseInt(document.getElementById('switchQty')?.value) || 0;
    const nvrQty = parseInt(document.getElementById('nvrQty')?.value) || 0;
    const upsQty = parseInt(document.getElementById('upsQty')?.value) || 0;
    const rackInstallation = parseInt(document.getElementById('rackInstallation')?.value) || 0;

    // หน่วยราคาของอุปกรณ์ให้สอดคล้องกับ calculateCosts
    const rackPrice = rackPrices[rackSize] || 0;
    const switchUnit = 4500;
    const nvrUnit = 9500;
    const upsUnit = 12500;

    // ระยะทาง
    const utpMeters = costs.utpMeters || 0;
    const fiberMeters = costs.fiberMeters || 0;
    const totalMeters = utpMeters + fiberMeters;

    const utpTotal = Math.round(utpMeters * utpPrice);
    const fiberTotal = Math.round(fiberMeters * fiberPrice);
    const utpLaborTotal = Math.round(utpMeters * laborPriceUtp);
    const fiberLaborTotal = Math.round(fiberMeters * laborPriceFiber);
    const utpPvcTotal = Math.round(utpMeters * pvcPriceUtp);
    const fiberPvcTotal = Math.round(fiberMeters * pvcPriceFiber);
    const switchTotal = switchQty * switchUnit;
    const nvrTotal = nvrQty * nvrUnit;
    const upsTotal = upsQty * upsUnit;

    const subTotal = utpTotal + fiberTotal + utpPvcTotal + fiberPvcTotal + utpLaborTotal + fiberLaborTotal + rackPrice + switchTotal + nvrTotal + upsTotal + rackInstallation;
    const vat = Math.round(subTotal * 0.07);
    const grandTotal = Math.round(subTotal + vat);

    const quoteContent = `
        <div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: 'TH Sarabun New', Arial, sans-serif;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="margin-bottom: 5px;">ใบเสนอราคาระบบ CCTV</h1>
                <p style="margin: 5px 0;">วันที่ ${new Date().toLocaleDateString('th-TH')}</p>
            </div>

            <h3>รายละเอียดการติดตั้ง</h3>
            <ul>
                <li>จำนวนกล้อง: ${cameras.length} ตัว</li>
                <li>ระยะสาย UTP: ${(utpMeters/1000).toFixed(3)} กม.</li>
                <li>ระยะสาย Fiber: ${(fiberMeters/1000).toFixed(3)} กม.</li>
                <li>ขนาดตู้ Rack: ${rackSize} U</li>
            </ul>

            <h3>รายการวัสดุและค่าใช้จ่าย</h3>
            <table border="1" cellpadding="8" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr style="background-color: #f5f5f5;">
                    <th width="50%">รายการ</th>
                    <th width="15%" style="text-align: center;">จำนวน</th>
                    <th width="15%" style="text-align: right;">ราคาต่อหน่วย</th>
                    <th width="20%" style="text-align: right;">รวม (บาท)</th>
                </tr>
                <tr>
                    <td>ค่าสาย UTP</td>
                    <td style="text-align: center;">${Math.round(utpMeters).toLocaleString()} เมตร</td>
                    <td style="text-align: right;">${utpPrice.toLocaleString()}</td>
                    <td style="text-align: right;">${utpTotal.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>ค่าสาย Fiber</td>
                    <td style="text-align: center;">${Math.round(fiberMeters).toLocaleString()} เมตร</td>
                    <td style="text-align: right;">${fiberPrice.toLocaleString()}</td>
                    <td style="text-align: right;">${fiberTotal.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>ค่าท่อ PVC สำหรับ UTP</td>
                    <td style="text-align: center;">${Math.round(utpMeters).toLocaleString()} เมตร</td>
                    <td style="text-align: right;">${pvcPriceUtp.toLocaleString()}</td>
                    <td style="text-align: right;">${utpPvcTotal.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>ค่าท่อ PVC สำหรับ Fiber</td>
                    <td style="text-align: center;">${Math.round(fiberMeters).toLocaleString()} เมตร</td>
                    <td style="text-align: right;">${pvcPriceFiber.toLocaleString()}</td>
                    <td style="text-align: right;">${fiberPvcTotal.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>ค่าแรงเดินสาย UTP</td>
                    <td style="text-align: center;">${Math.round(utpMeters).toLocaleString()} เมตร</td>
                    <td style="text-align: right;">${laborPriceUtp.toLocaleString()}</td>
                    <td style="text-align: right;">${utpLaborTotal.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>ค่าแรงเดินสาย Fiber</td>
                    <td style="text-align: center;">${Math.round(fiberMeters).toLocaleString()} เมตร</td>
                    <td style="text-align: right;">${laborPriceFiber.toLocaleString()}</td>
                    <td style="text-align: right;">${fiberLaborTotal.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>ตู้ Rack ขนาด ${rackSize}U</td>
                    <td style="text-align: center;">1</td>
                    <td style="text-align: right;">${rackPrice.toLocaleString()}</td>
                    <td style="text-align: right;">${rackPrice.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>สวิตช์ PoE</td>
                    <td style="text-align: center;">${switchQty}</td>
                    <td style="text-align: right;">${switchUnit.toLocaleString()}</td>
                    <td style="text-align: right;">${switchTotal.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>เครื่องบันทึกภาพ (NVR)</td>
                    <td style="text-align: center;">${nvrQty}</td>
                    <td style="text-align: right;">${nvrUnit.toLocaleString()}</td>
                    <td style="text-align: right;">${nvrTotal.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>เครื่องสำรองไฟ (UPS)</td>
                    <td style="text-align: center;">${upsQty}</td>
                    <td style="text-align: right;">${upsUnit.toLocaleString()}</td>
                    <td style="text-align: right;">${upsTotal.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>ค่าแรงติดตั้งตู้ Rack และอุปกรณ์</td>
                    <td style="text-align: center;">1</td>
                    <td style="text-align: right;">${rackInstallation.toLocaleString()}</td>
                    <td style="text-align: right;">${rackInstallation.toLocaleString()}</td>
                </tr>
                <tr style="font-weight: bold; background-color: #f9f9f9;">
                    <td colspan="3" style="text-align: right; padding-right: 15px;">รวมเป็นเงิน</td>
                    <td style="text-align: right;">${subTotal.toLocaleString()}</td>
                </tr>
                <tr style="font-weight: bold; background-color: #f0f0f0;">
                    <td colspan="3" style="text-align: right; padding-right: 15px;">ภาษีมูลค่าเพิ่ม 7%</td>
                    <td style="text-align: right;">${vat.toLocaleString()}</td>
                </tr>
                <tr style="font-weight: bold; font-size: 1.1em; background-color: #e9e9e9;">
                    <td colspan="3" style="text-align: right; padding-right: 15px;">ราคารวมทั้งสิ้น</td>
                    <td style="text-align: right;">${grandTotal.toLocaleString()}</td>
                </tr>
            </table>
        </div>
    `;

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ใบเสนอราคาระบบ CCTV</title>
        <style>
            @page { size: A4; margin: 1cm; }
            body { font-family: 'TH Sarabun New', 'Sarabun', Arial, sans-serif; margin: 0; padding: 0; color: #333; }
            .container { max-width: 21cm; margin: 0 auto; padding: 1cm; }
            @media print { .no-print { display: none; } }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;700&display=swap" rel="stylesheet">
    </head><body><div class="container">${quoteContent}</div>
    <div class="no-print" style="text-align:center; margin: 20px 0 50px;">
        <button onclick="window.print()" style="padding:10px 25px; background:#4CAF50; color:#fff; border:none; border-radius:4px;">พิมพ์ใบเสนอราคา</button>
        <button onclick="window.close()" style="padding:10px 25px; margin-left: 10px; background:#f44336; color:#fff; border:none; border-radius:4px;">ปิดหน้าต่าง</button>
    </div></body></html>`);
    w.document.close();
}

// ฟังก์ชันเพิ่มสายเชื่อมระหว่างกล้อง
function addCableLine(fromLatLng, toLatLng) {
    // อ่านชนิดสายจาก UI (UTP/FIBER) และกำหนดสีตามชนิด
    const typeEl = document.getElementById('cableType');
    const cableType = typeEl ? typeEl.value : 'UTP';
    const color = cableType === 'FIBER' ? '#007bff' : '#dc3545';
    const line = L.polyline([fromLatLng, toLatLng], {color, weight: 3});
    line.cableType = cableType;
    line.addTo(map);
    cableLines.push(line);
    calculateCosts();
}

// ฟังก์ชันลบสายทั้งหมด
function removeAllCableLines() {
    cableLines.forEach(line => map.removeLayer(line));
    cableLines = [];
    calculateCosts();
}

function init() {
    // OpenStreetMap
    var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    // OpenStreetMap layers only (no Google Maps required)
    var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    // Satellite layer using OpenStreetMap
    var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.esri.com/">Esri</a>'
    });

    var coords = startMapCoords();
    map = L.map('map', {
        center: [coords[0], coords[1]],
        zoom: coords[2],
        layers: [osm]
    });

    // Helper: setup OpenStreetMap Geocoder on #placesSearch
    function setupPlacesAutocomplete() {
        try {
            const input = document.getElementById('placesSearch');
            if (!input) return false;
            
            // ใช้ Leaflet Control Geocoder สำหรับ autocomplete
            const geocoder = L.Control.Geocoder.nominatim({
                geocodingQueryParams: {
                    countrycodes: 'th', // เน้นประเทศไทย
                    limit: 5
                }
            });
            
            // สร้าง autocomplete dropdown
            let autocompleteList = null;
            
            input.addEventListener('input', function() {
                const query = this.value.trim();
                if (query.length < 2) {
                    if (autocompleteList) {
                        autocompleteList.remove();
                        autocompleteList = null;
                    }
                    return;
                }
                
                geocoder.geocode(query, function(results) {
                    if (autocompleteList) {
                        autocompleteList.remove();
                    }
                    
                    if (results && results.length > 0) {
                        autocompleteList = L.DomUtil.create('div', 'autocomplete-list');
                        autocompleteList.style.cssText = `
                            position: absolute;
                            top: 100%;
                            left: 0;
                            right: 0;
                            background: white;
                            border: 1px solid #ccc;
                            border-top: none;
                            max-height: 200px;
                            overflow-y: auto;
                            z-index: 1000;
                        `;
                        
                        results.forEach(result => {
                            const item = L.DomUtil.create('div', 'autocomplete-item', autocompleteList);
                            item.textContent = result.name || result.html || 'ตำแหน่งที่ค้นหา';
                            item.style.cssText = 'padding: 8px; cursor: pointer; border-bottom: 1px solid #eee;';
                            
                            item.addEventListener('click', function() {
                                input.value = result.name || result.html || 'ตำแหน่งที่ค้นหา';
                                autocompleteList.remove();
                                autocompleteList = null;
                                
                                if (result.center) {
                                    map.setView(result.center, 17);
                                    L.marker(result.center).addTo(map)
                                        .bindPopup(result.name || result.html || 'ตำแหน่งที่ค้นหา')
                    .openPopup();
                                }
                            });
                            
                            item.addEventListener('mouseenter', function() {
                                this.style.backgroundColor = '#f0f0f0';
                            });
                            
                            item.addEventListener('mouseleave', function() {
                                this.style.backgroundColor = 'white';
                            });
                        });
                        
                        input.parentNode.style.position = 'relative';
                        input.parentNode.appendChild(autocompleteList);
                    }
                });
            });
            
            // ซ่อน autocomplete เมื่อคลิกที่อื่น
            document.addEventListener('click', function(e) {
                if (autocompleteList && !input.contains(e.target) && !autocompleteList.contains(e.target)) {
                    autocompleteList.remove();
                    autocompleteList = null;
                }
            });
            
            return true;
        } catch (err) {
            console.warn('OpenStreetMap Geocoder init failed:', err);
            return false;
        }
    }

    // Helper: perform search by query via OpenStreetMap Geocoder
    function performSearchQuery(query) {
        const q = (query || '').trim();
        if (!q) {
            showNotification('กรุณาใส่คำค้นหา', 'warning');
                                return;
                            }
        
        showNotification('กำลังค้นหา...', 'info');
        
        // ใช้ OpenStreetMap Nominatim API โดยตรง
        const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=th&limit=1&addressdetails=1`;
        
        fetch(searchUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data && data.length > 0) {
                    const result = data[0];
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);
                    
                    if (lat && lon) {
                        const center = [lat, lon];
                        map.setView(center, 17);
                        
                        // ลบ marker เดิม (ถ้ามี)
                        if (window.searchMarker) {
                            map.removeLayer(window.searchMarker);
                        }
                        
                        // สร้าง marker ใหม่
                        window.searchMarker = L.marker(center).addTo(map);
                        
                        // สร้าง popup content
                        let popupContent = `<strong>${result.display_name}</strong>`;
                        if (result.address) {
                            popupContent += '<br><small>';
                            if (result.address.road) popupContent += `ถนน: ${result.address.road}<br>`;
                            if (result.address.suburb) popupContent += `แขวง: ${result.address.suburb}<br>`;
                            if (result.address.district) popupContent += `เขต: ${result.address.district}<br>`;
                            if (result.address.city) popupContent += `จังหวัด: ${result.address.city}`;
                            popupContent += '</small>';
                        }
                        
                        window.searchMarker.bindPopup(popupContent).openPopup();
                        showNotification(`พบตำแหน่ง: ${result.display_name}`, 'success');
                    } else {
                        showNotification('ไม่พบตำแหน่งที่ค้นหา', 'error');
                    }
                } else {
                    showNotification('ไม่พบตำแหน่งที่ค้นหา', 'error');
                }
            })
            .catch(error => {
                console.error('Search error:', error);
                showNotification('ไม่สามารถค้นหาตำแหน่งได้ กรุณาลองใหม่อีกครั้ง', 'error');
            });
    }



    // Wire up search button and Enter key
    function wireSearchHandlers() {
        const input = document.getElementById('placesSearch');
        const btn = document.getElementById('placesSearchBtn');
        if (btn) {
            btn.addEventListener('click', () => performSearchQuery(input ? input.value : ''));
        }
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    performSearchQuery(input.value);
                }
            });
        }
    }

    // Setup OpenStreetMap Geocoder
    const placesReady = setupPlacesAutocomplete();
    wireSearchHandlers();
    
    // Add geocoder control to map
        try {
            if (L.Control && L.Control.Geocoder) {
                const geocoder = L.Control.geocoder({
                    defaultMarkGeocode: false,
                placeholder: 'ค้นหาสถานที่...',
                geocoder: L.Control.Geocoder.nominatim({
                    geocodingQueryParams: {
                        countrycodes: 'th'
                    }
                })
                })
                .on('markgeocode', function(e) {
                    const center = e.geocode.center;
                    const name = e.geocode.name || 'ตำแหน่งที่ค้นหา';
                    map.setView(center, 17);
                    L.marker(center).addTo(map).bindPopup(name).openPopup();
                })
                .addTo(map);
            }
        } catch (err) {
            console.warn('ไม่สามารถเริ่ม Geocoder ได้:', err);
    }

    const baseLayers = {
        "แผนที่ถนน (OpenStreetMap)": osm,
        "ภาพถ่ายดาวเทียม": sat
    };
    L.control.layers(baseLayers, {}).addTo(map);

    // Global mouse event handlers for overlay dragging
    map.on('mousemove', (e) => {
        if (!currentOverlay) return;
        
        // Center dragging
        if (draggingCenter) {
            currentOverlay.center = e.latlng;
            updateOverlayGeometry(currentOverlay);
            return;
        }
        
        // Body dragging
        if (draggingBody && dragStartData) {
            const currMouseLP = map.latLngToLayerPoint(e.latlng);
            const dx = currMouseLP.x - dragStartData.mousePos.x;
            const dy = currMouseLP.y - dragStartData.mousePos.y;
            const newCenterLP = L.point(
                map.latLngToLayerPoint(dragStartData.center).x + dx,
                map.latLngToLayerPoint(dragStartData.center).y + dy
            );
            currentOverlay.center = map.layerPointToLatLng(newCenterLP);
            updateOverlayGeometry(currentOverlay);
            return;
        }
        
        // Corner resizing
        if (draggingCornerIdx >= 0 && dragStartData) {
            const bearing = L.GeometryUtil.bearing(currentOverlay.center, e.latlng);
            const dist = map.distance(currentOverlay.center, e.latlng);
            const diff = (bearing - dragStartData.angle) * Math.PI / 180.0;
            let x = dist * Math.cos(diff);
            let y = dist * Math.sin(diff);
            currentOverlay.width = Math.max(1, Math.abs(x) * 2);
            currentOverlay.height = Math.max(1, Math.abs(y) * 2);
            updateOverlayGeometry(currentOverlay);
            return;
        }
        
        // Rotation
        if (dragStartData && dragStartData.startAngle !== undefined) {
            const bearing = L.GeometryUtil.bearing(currentOverlay.center, e.latlng);
            currentOverlay.angle = bearing;
            updateOverlayGeometry(currentOverlay);
            return;
        }
    });
    
    map.on('mouseup', () => {
        draggingCenter = false;
        draggingBody = false;
        draggingCornerIdx = -1;
        dragStartData = null;
    });

    map.on('contextmenu', (e) => {
        // อย่าเพิ่มกล้องเมื่ออยู่ในโหมดเพิ่ม Rack หรือวาดพื้นที่
        if (currentTool === 'addRack' || currentTool === 'drawArea') return;
        addCamera(e.latlng);
        if (cameras.length > 1) {
            const lastCam = cameras[cameras.length - 2];
            addCableLine(lastCam.position, e.latlng);
        }
    });
    
    map.on('moveend', (e) => setUrlCoords(map));

    // เพิ่มปุ่มลบสายทั้งหมด
    L.Control.RemoveCablesControl = L.Control.extend({
        onAdd: function(map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            container.innerHTML = '<a href="#" style="padding: 6px 10px; display: block;" title="ลบสายทั้งหมด">ลบสายทั้งหมด</a>';
            container.onclick = function(e) {
                e.preventDefault();
                removeAllCableLines();
            };
            return container;
        }
    });
    
    new L.Control.RemoveCablesControl({ position: 'topleft' }).addTo(map);
    
    // ตัวแปรสำหรับเก็บข้อมูล Google Drive
let gapiInited = false;
let gisInited = false;
let tokenClient;
let accessToken = '';

// ฟังก์ชันเริ่มต้น Google API
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: 'YOUR_API_KEY',
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse) => {
            accessToken = tokenResponse.access_token;
            document.getElementById('saveToDrive').style.display = 'inline-block';
            document.getElementById('loadFromDrive').style.display = 'inline-block';
        },
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.querySelector('.g_id_signin').style.display = 'inline-block';
    }
}

// ฟังก์ชันจัดการการตอบรับการเข้าสู่ระบบ
function handleCredentialResponse(response) {
    if (response.credential) {
        tokenClient.requestAccessToken();
    }
}

// ฟังก์ชันบันทึกข้อมูลไปยัง Google Drive
async function saveToDrive() {
    if (!accessToken) {
        alert('กรุณาเข้าสู่ระบบ Google ก่อนบันทึกข้อมูล');
        return;
    }

    // รวบรวมข้อมูลที่จะบันทึก
    const projectData = {
        cameras: cameras.map(cam => ({
            latlng: cam.getLatLng(),
            type: cam.options.icon.options.iconUrl.includes('2103633') ? 'dome' : 
                  cam.options.icon.options.iconUrl.includes('2103653') ? 'bullet' : 'ptz'
        })),
        cableLines: cableLines.map(line => ({
            latlngs: line.getLatLngs(),
            cableType: line.cableType || 'UTP'
        })),
        racks: racks.map(r => ({ id: r.id, latlng: r.marker.getLatLng() })),
        rackLinks: (rackLinks || []).map(l => ({ fromId: l.fromId, toId: l.toId, cableType: l.cableType })),
        settings: {
            utpPrice: document.getElementById('utpPrice').value,
            fiberPrice: document.getElementById('fiberPrice').value,
            laborPriceUtp: document.getElementById('laborPriceUtp').value,
            laborPriceFiber: document.getElementById('laborPriceFiber').value,
            pvcPriceUtp: document.getElementById('pvcPriceUtp') ? document.getElementById('pvcPriceUtp').value : 0,
            pvcPriceFiber: document.getElementById('pvcPriceFiber') ? document.getElementById('pvcPriceFiber').value : 0,
            rackSize: document.getElementById('rackSize').value,
            switchQty: document.getElementById('switchQty').value,
            nvrQty: document.getElementById('nvrQty').value,
            upsQty: document.getElementById('upsQty').value,
            rackInstallation: document.getElementById('rackInstallation').value
        },
        timestamp: new Date().toISOString()
    };

    const fileName = `CCTV_Project_${new Date().toISOString().split('T')[0]}.json`;
    const fileContent = JSON.stringify(projectData, null, 2);
    const file = new Blob([fileContent], { type: 'application/json' });
    
    const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: ['root']
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    try {
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form,
        });
        
        const result = await response.json();
        if (result.error) {
            throw new Error(result.error.message);
        }
        
        alert('บันทึกข้อมูลสำเร็จใน Google Drive แล้ว');
    } catch (error) {
        console.error('Error saving to Google Drive:', error);
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);
    }
}

// ฟังก์ชันโหลดข้อมูลจาก Google Drive
async function loadFromDrive() {
    if (!accessToken) {
        alert('กรุณาเข้าสู่ระบบ Google ก่อนโหลดข้อมูล');
        return;
    }

    try {
        // เรียกดูไฟล์ใน Google Drive
        const response = await gapi.client.drive.files.list({
            q: "mimeType='application/json' and name contains 'CCTV_Project'",
            fields: 'files(id, name, modifiedTime)',
            orderBy: 'modifiedTime desc',
            pageSize: 10
        });

        const files = response.result.files;
        if (!files || files.length === 0) {
            alert('ไม่พบไฟล์โครงการ CCTV ใน Google Drive');
            return;
        }

        // แสดงรายการไฟล์ให้เลือก
        const fileList = files.map(file => 
            `<div style="padding: 5px; border-bottom: 1px solid #eee; cursor: pointer;" 
                  onclick="loadProjectFile('${file.id}')">
                ${file.name}<br>
                <small>แก้ไขล่าสุด: ${new Date(file.modifiedTime).toLocaleString()}</small>
            </div>`
        ).join('');

        document.getElementById('analysisResults').innerHTML = `
            <h4>เลือกไฟล์โครงการ</h4>
            <div style="max-height: 300px; overflow-y: auto;">
                ${fileList}
            </div>
        `;
    } catch (error) {
        console.error('Error loading files from Google Drive:', error);
        alert('เกิดข้อผิดพลาดในการโหลดรายการไฟล์: ' + error.message);
    }
}

// ฟังก์ชันโหลดข้อมูลจากไฟล์ที่เลือก
async function loadProjectFile(fileId) {
    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
                'Authorization': 'Bearer ' + accessToken
            }
        });
        
        if (!response.ok) {
            throw new Error('ไม่สามารถโหลดไฟล์ได้');
        }
        
        const projectData = await response.json();
        
        // ลบกล้อง สาย และ Rack เก่าทั้งหมด
        cameras.forEach(cam => map.removeLayer(cam));
        cameras = [];
        cableLines.forEach(line => map.removeLayer(line));
        cableLines = [];
        (racks || []).forEach(r => { if (r.marker) map.removeLayer(r.marker); });
        racks = [];
        (rackLinks || []).forEach(l => { if (l.line) map.removeLayer(l.line); });
        rackLinks = [];
        
        // โหลดกล้องกลับเข้าไป
        const cameraIcons = {
            'dome': 'https://cdn-icons-png.flaticon.com/512/2103/2103633.png',
            'bullet': 'https://cdn-icons-png.flaticon.com/512/2103/2103653.png',
            'ptz': 'https://cdn-icons-png.flaticon.com/512/2103/2103667.png'
        };
        
        projectData.cameras.forEach((cam, index) => {
            const cameraIcon = L.icon({
                iconUrl: cameraIcons[cam.type] || cameraIcons.dome,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16]
            });
            
            const camera = L.marker([cam.latlng.lat, cam.latlng.lng], {
                icon: cameraIcon,
                draggable: true
            }).addTo(map);
            
            camera.bindPopup(`กล้อง ${index+1}<br>ประเภท: ${cam.type}`);
            cameras.push(camera);
        });
        
        // โหลดสายเคเบิล พร้อมชนิดสาย
        (projectData.cableLines || []).forEach(line => {
            const cableType = line.cableType || 'UTP';
            const color = cableType === 'FIBER' ? '#007bff' : '#dc3545';
            const polyline = L.polyline(line.latlngs, {color, weight: 3});
            polyline.cableType = cableType;
            polyline.addTo(map);
            cableLines.push(polyline);
        });

        // โหลด Racks
        (projectData.racks || []).forEach(r => {
            const id = r.id;
            const name = r.name || r.id;
            const marker = L.marker([r.latlng.lat, r.latlng.lng], { title: id, draggable: true }).addTo(map).bindPopup('ตู้ Rack: ' + name);
            marker.bindTooltip(name, { permanent: true, direction: 'top', offset: [0, -10], className: 'rack-label' });
            const rack = { id, name, marker };
            racks.push(rack);
            marker.on('drag', () => updateRackConnections(id));
            marker.on('dragend', () => { try { calculateCosts(); } catch(_){} });
            marker.on('dblclick', () => editRackName(rack));
            // เติม dropdowns
            ['rackList','rackFrom','rackTo'].forEach(selId => {
                const sel = document.getElementById(selId);
                if (sel) {
                    const opt = document.createElement('option');
                    opt.value = id; opt.textContent = name;
                    sel.appendChild(opt);
                    if (!sel.value) sel.value = id;
                }
            });
        });
        // โหลดการเชื่อมต่อ Racks
        (projectData.rackLinks || []).forEach(lnk => {
            const fromRack = racks.find(rr => rr.id === lnk.fromId);
            const toRack = racks.find(rr => rr.id === lnk.toId);
            if (fromRack && toRack) {
                const color = (lnk.cableType === 'FIBER') ? '#0d6efd' : '#198754';
                const line = L.polyline([fromRack.marker.getLatLng(), toRack.marker.getLatLng()], { color, weight: 4, dashArray: '6,4' }).addTo(map);
                line.cableType = lnk.cableType || 'UTP';
                rackLinks.push({ fromId: lnk.fromId, toId: lnk.toId, line, cableType: line.cableType });
            }
        });
        
        // อัพเดทการตั้งค่า
        const settings = projectData.settings || {};
        document.getElementById('utpPrice').value = settings.utpPrice || 15;
        document.getElementById('fiberPrice').value = settings.fiberPrice || 25;
        document.getElementById('laborPriceUtp').value = settings.laborPriceUtp || 30;
        document.getElementById('laborPriceFiber').value = settings.laborPriceFiber || 35;
        if (document.getElementById('pvcPriceUtp')) document.getElementById('pvcPriceUtp').value = settings.pvcPriceUtp ?? 12;
        if (document.getElementById('pvcPriceFiber')) document.getElementById('pvcPriceFiber').value = settings.pvcPriceFiber ?? 18;
        document.getElementById('rackSize').value = settings.rackSize || 9;
        document.getElementById('switchQty').value = settings.switchQty || 1;
        document.getElementById('nvrQty').value = settings.nvrQty || 1;
        document.getElementById('upsQty').value = settings.upsQty || 1;
        document.getElementById('rackInstallation').value = settings.rackInstallation || 5000;
        
        // คำนวณค่าใช้จ่ายใหม่
        calculateCosts();
        
        document.getElementById('analysisResults').innerHTML = '<p>โหลดโครงการสำเร็จแล้ว</p>';
    } catch (error) {
        console.error('Error loading project file:', error);
        alert('เกิดข้อผิดพลาดในการโหลดไฟล์: ' + error.message);
    }
}

// เรียกใช้ฟังก์ชันเริ่มต้นเมื่อโหลดหน้าเว็บเสร็จ
document.addEventListener('DOMContentLoaded', function() {
    // กำหนด event listeners สำหรับปุ่ม Google Drive
    document.getElementById('saveToDrive').addEventListener('click', saveToDrive);
    document.getElementById('loadFromDrive').addEventListener('click', loadFromDrive);
    
    // เรียกใช้ฟังก์ชันเริ่มต้นของ Google API
    gapiLoaded();
    gisLoaded();
});

// เรียกคำนวณค่าใช้จ่ายเมื่อมีการเปลี่ยนแปลงข้อมูล (อัปเดตให้รองรับ UTP/Fiber)
    const inputs = ['utpPrice', 'fiberPrice', 'laborPriceUtp', 'laborPriceFiber', 'pvcPriceUtp', 'pvcPriceFiber', 'rackSize', 'switchQty', 'nvrQty', 'upsQty', 'rackInstallation'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculateCosts);
            el.addEventListener('change', calculateCosts);
        }
    });
    
    // ระบบ MCP สำหรับวิเคราะห์พื้นที่
    document.getElementById('analyzeArea').addEventListener('click', function() {
        const resultsDiv = document.getElementById('analysisResults');
        resultsDiv.innerHTML = '<p>กำลังวิเคราะห์พื้นที่... <span class="loading"></span></p>';
        
        // จำลองการวิเคราะห์ด้วย AI (ในเวอร์ชันจริงจะเชื่อมต่อกับ AI API)
        setTimeout(() => {
            const analysis = {
                areaSize: (Math.random() * 500 + 100).toFixed(2) + ' ตร.ม.',
                recommendedCameras: Math.floor(Math.random() * 5) + 2,
                riskAreas: ['ทางเข้า', 'จุดบอด', 'ที่จอดรถ'],
                recommendations: [
                    'แนะนำติดตั้งกล้องความละเอียดสูงที่บริเวณทางเข้า',
                    'เพิ่มจุดเชื่อมต่อเครือข่ายที่จุดบอด',
                    'พิจารณาติดตั้งกล้องแบบ PTZ ที่บริเวณจอดรถ'
                ]
            };
            
            let html = `
                <h4>ผลการวิเคราะห์พื้นที่</h4>
                <p><strong>ขนาดพื้นที่:</strong> ${analysis.areaSize}</p>
                <p><strong>แนะนำจำนวนกล้อง:</strong> ${analysis.recommendedCameras} ตัว</p>
                
                <h5>จุดเสี่ยงที่พบ:</h5>
                <ul>
                    ${analysis.riskAreas.map(area => `<li>${area}</li>`).join('')}
                </ul>
                
                <h5>คำแนะนำ:</h5>
                <ul>
                    ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
                
                <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                    <p><strong>หมายเหตุ:</strong> การวิเคราะห์นี้ใช้ AI สำหรับให้คำแนะนำเบื้องต้นเท่านั้น</p>
                </div>
            `;
            
            resultsDiv.innerHTML = html;
        }, 1500);
    });
    
    // ระบบแนะนำตำแหน่งกล้องอัตโนมัติ
    document.getElementById('suggestCameras').addEventListener('click', function() {
        const resultsDiv = document.getElementById('analysisResults');
        resultsDiv.innerHTML = '<p>กำลังวิเคราะห์และแนะนำตำแหน่งกล้อง... <span class="loading"></span></p>';
        
        // จำลองการวิเคราะห์ด้วย AI (ในเวอร์ชันจริงจะเชื่อมต่อกับ AI API)
        setTimeout(() => {
            // ล้างกล้องเก่าทั้งหมด
            cameras.forEach(cam => map.removeLayer(cam));
            cameras = [];
            
            // สร้างตำแหน่งกล้องตัวอย่างแบบสุ่ม
            const bounds = map.getBounds();
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            
            const numCameras = 3 + Math.floor(Math.random() * 3); // 3-5 ตัว
            const cameraIcons = [
                'https://cdn-icons-png.flaticon.com/512/2103/2103633.png', // กล้องโดม
                'https://cdn-icons-png.flaticon.com/512/2103/2103653.png', // กล้องบูลเล็ต
                'https://cdn-icons-png.flaticon.com/512/2103/2103667.png'  // กล้อง PTZ
            ];
            
            for (let i = 0; i < numCameras; i++) {
                const lat = sw.lat + Math.random() * (ne.lat - sw.lat);
                const lng = sw.lng + Math.random() * (ne.lng - sw.lng);
                const cameraType = Math.floor(Math.random() * cameraIcons.length);
                
                const cameraIcon = L.icon({
                    iconUrl: cameraIcons[cameraType],
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                    popupAnchor: [0, -16]
                });
                
                const camera = L.marker([lat, lng], {
                    icon: cameraIcon,
                    draggable: true
                }).addTo(map);
                
                camera.bindPopup(`กล้อง ${i+1}<br>ประเภท: ${['โดม', 'บูลเล็ต', 'PTZ'][cameraType]}`);
                cameras.push(camera);
            }
            
            // อัพเดทสายเคเบิล
            updateCableLines();
            
            resultsDiv.innerHTML = `
                <h4>แนะนำตำแหน่งกล้อง</h4>
                <p>ระบบได้เพิ่มกล้องจำนวน ${numCameras} ตัวในตำแหน่งที่เหมาะสมแล้ว</p>
                <p>คุณสามารถลากวางกล้องเพื่อปรับตำแหน่งได้ตามต้องการ</p>
                
                <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                    <p><strong>คำแนะนำ:</strong></p>
                    <ul>
                        <li>ตรวจสอบมุมกล้องให้ครอบคลุมจุดสำคัญ</li>
                        <li>หลีกเลี่ยงการหันกล้องเข้าหาแสงแดดโดยตรง</li>
                        <li>พิจารณาติดตั้งกล้องเพิ่มในจุดบอด</li>
                    </ul>
                </div>
            `;
            
        }, 2000);
    });
    
    // ฟังก์ชันอัพเดทสายเคเบิลเมื่อมีการย้ายกล้อง
    function updateCableLines() {
        // ลบสายเก่าทั้งหมด
        cableLines.forEach(line => map.removeLayer(line));
        cableLines = [];
        
        // สร้างสายใหม่เชื่อมต่อระหว่างกล้อง
        for (let i = 1; i < cameras.length; i++) {
            const fromLatLng = cameras[i-1].getLatLng();
            const toLatLng = cameras[i].getLatLng();
            addCableLine(fromLatLng, toLatLng);
        }
    }
    
    // (ยกเลิกการสร้างใบเสนอราคาอัตโนมัติบนการลากแผนที่) ใช้ปุ่ม "สร้างใบเสนอราคา" แทน
    window.map = map;
}


// ฟังก์ชันสำหรับส่งข้อมูลไปยัง MCP Server
async function exportToMCPServer(projectData) {
    try {
        showNotification('กำลังส่งข้อมูลไปยัง MCP Server...', 'info');
        
        // สร้างข้อมูลที่จะส่งไปยัง MCP
        const mcpData = {
            project: {
                name: projectData.metadata.projectName,
                description: 'CCTV Project Export',
                cameras: projectData.cameras.map(cam => ({
                    id: cam.id,
                    position: {
                        lat: cam.position.lat,
                        lng: cam.position.lng,
                        height: cam.height || 3.0
                    },
                    rotation: cam.angle || 0,
                    fov: cam.fov || 90,
                    type: cam.type || 'Dome'
                })),
                cables: projectData.cables.map((cable, index) => ({
                    id: cable.id,
                    points: cable.points.map(p => ({
                        lat: p.lat,
                        lng: p.lng,
                        height: 0.1 // ความสูงจากพื้นดิน
                    })),
                    type: 'CAT6'
                }))
            },
            analysis: {
                timestamp: new Date().toISOString(),
                images: capturedPhotos.filter(photo => photo.mcpResults).map(photo => ({
                    id: photo.id,
                    position: photo.position,
                    timestamp: photo.timestamp,
                    analysis: photo.mcpResults,
                    image_url: photo.analyzedImage || photo.data
                }))
            }
        };

        // ส่งข้อมูลไปยัง MCP Server
        const response = await fetch('https://api.mcp.example.com/v1/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MCP_CONFIG.API_KEY}`
            },
            body: JSON.stringify(mcpData)
        });

        if (!response.ok) {
            throw new Error('Failed to export to MCP Server');
        }

        const result = await response.json();
        showNotification('ส่งออกข้อมูลไปยัง MCP Server เรียบร้อยแล้ว', 'success');
        return result;
    } catch (error) {
        console.error('Export to MCP Server failed:', error);
        showNotification('การส่งออกข้อมูลไปยัง MCP Server ล้มเหลว', 'error');
        throw error;
    }
}

// ฟังก์ชันสำหรับส่งข้อมูลไปยัง Blender
function exportToBlender() {
    const projectData = {
        cameras: [],
        cables: [],
        building: {
            width: 0,
            length: 0,
            height: 0,
            walls: []
        },
        metadata: {
            projectName: 'CCTV_Project_' + new Date().toISOString().split('T')[0],
            exportDate: new Date().toISOString(),
            totalCameras: 0,
            totalCableLength: totalDistance
        }
    };

    // รวบรวมข้อมูลกล้อง
    cameras.forEach(cam => {
        projectData.cameras.push({
            id: cam.id,
            position: cam.marker.getLatLng(),
            type: cam.type || 'Dome',
            angle: cam.angle || 0,
            height: cam.height || 3.0,
            fov: cam.fov || 90
        });
    });

    // รวบรวมข้อมูลสายเคเบิล
    cableLines.forEach((line, index) => {
        const latlngs = line.getLatLngs();
        projectData.cables.push({
            id: `cable_${index}`,
            points: latlngs,
            length: line.length || 0,
            type: 'CAT6'
        });
    });

    // สร้างไฟล์ Python สำหรับ Blender
    const blendTemplate = `import bpy\nimport math\n\n# ลบวัตถุที่มีอยู่ทั้งหมด\nbpy.ops.object.select_all(action='SELECT')\nbpy.ops.object.delete()\n\n# สร้างกล้อง\ncameras = ${JSON.stringify(projectData.cameras, null, 2)}\nfor cam_data in cameras:\n    # สร้างกล้อง\n    bpy.ops.object.camera_add(location=(cam_data.position.lng, cam_data.position.lat, cam_data.height || 3.0))\n    camera = bpy.context.active_object\n    camera.name = f\"Camera_{cam_data.id}\"\n    camera.rotation_euler = (math.radians(90), 0, math.radians(cam_data.angle || 0))\n    \n    # กำหนดมุมมองกล้อง\n    camera.data.lens = 4.5  # มม.\n    camera.data.sensor_width = 6.16  # มม.\n    camera.data.angle = math.radians(cam_data.fov || 90)\n    \n    # สร้างกล่องแสดงทิศทางกล้อง\n    bpy.ops.mesh.primitive_cube_add(size=0.3, location=(cam_data.position.lng, cam_data.position.lat, cam_data.height || 3.0))\n    cam_box = bpy.context.active_object\n    cam_box.name = f\"Camera_Box_{cam_data.id}\"\n    cam_box.scale = (0.2, 0.2, 0.1)\n    cam_box.rotation_euler = (0, 0, math.radians(cam_data.angle || 0))\n\n# สร้างสายเคเบิล\ncables = ${JSON.stringify(projectData.cables, null, 2)}\nfor cable in cables:\n    points = [(p.lng, p.lat, 0.1) for p in cable.points]\n    \n    # สร้างเส้นโค้งสำหรับสายเคเบิล\n    curve_data = bpy.data.curves.new('cable', type='CURVE')\n    curve_data.dimensions = '3D'\n    curve_data.resolution_u = 2\n    \n    # สร้างเส้นโค้ง\n    polyline = curve_data.splines.new('POLY')\n    polyline.points.add(len(points)-1)\n    for i, coord in enumerate(points):\n        x, y, z = coord\n        polyline.points[i].co = (x, y, z, 1)\n    \n    # สร้างวัตถุเส้นโค้ง\n    cable_obj = bpy.data.objects.new('Cable', curve_data)\n    cable_obj.data.bevel_depth = 0.02\n    bpy.context.collection.objects.link(cable_obj)\n\n# ตั้งค่ามุมมอง\nbpy.context.scene.render.engine = 'CYCLES'\nbpy.context.scene.render.resolution_x = 1920\nbpy.context.scene.render.resolution_y = 1080\nbpy.context.scene.render.resolution_percentage = 100\n\nprint(\"Import CCTV data to Blender completed!\")\n`;

    // แสดงสถานะการส่งออก
    const statusElement = document.getElementById('blenderExportStatus');
    if (statusElement) {
        statusElement.style.display = 'block';
        statusElement.innerHTML = '<i class="fas fa-sync fa-spin" style="color: #17a2b8;"></i> กำลังสร้างไฟล์...';
        
        // หน่วงเวลาเพื่อให้เห็นการโหลด
        setTimeout(() => {
            // สร้าง Blob และลิงก์ดาวน์โหลด
            const blob = new Blob([blendTemplate], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cctv_export_${new Date().toISOString().split('T')[0]}.py`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // อัปเดตสถานะเป็นสำเร็จ
            statusElement.innerHTML = '<i class="fas fa-check-circle" style="color: #28a745;"></i> ส่งออกข้อมูลสำเร็จ! กำลังดาวน์โหลดไฟล์...';
            statusElement.style.background = '#e9f7ef';
            
            // ซ่อนสถานะหลังจาก 5 วินาที
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 5000);
        }, 1000);
    }
}

// ตัวแปรสำหรับ MCP
const MCP_CONFIG = {
    API_URL: 'https://api.mcp.example.com/v1',
    API_KEY: 'YOUR_MCP_API_KEY', // ควรเก็บในตัวแปรสภาพแวดล้อมในสภาพแวดล้อมจริง
    MODEL_IDS: {
        OBJECT_DETECTION: 'mcp-object-detection-v2',
        FACE_RECOGNITION: 'mcp-face-recognition-v1',
        LICENSE_PLATE: 'mcp-license-plate-v1'
    },
    DETECTION_CONFIDENCE: 0.7
};

// ฟังก์ชันสำหรับเรียกใช้ MCP API
async function callMCPApi(endpoint, data) {
    try {
        const response = await fetch(`${MCP_CONFIG.API_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MCP_CONFIG.API_KEY}`,
                'X-Model-ID': MCP_CONFIG.MODEL_IDS.OBJECT_DETECTION
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`MCP API Error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('MCP API Call Failed:', error);
        showNotification('การเชื่อมต่อ MCP ล้มเหลว', 'error');
        throw error;
    }
}

// ฟังก์ชันวิเคราะห์ภาพด้วย MCP
async function analyzeWithMCP(imageData) {
    try {
        showNotification('กำลังวิเคราะห์ภาพด้วย MCP...', 'info');
        
        const result = await callMCPApi('analyze/image', {
            image: imageData.split(',')[1], // ลบ header base64
            confidence_threshold: MCP_CONFIG.DETECTION_CONFIDENCE,
            features: ['objects', 'faces', 'license_plates']
        });

        return result;
    } catch (error) {
        console.error('Analysis failed:', error);
        showNotification('การวิเคราะห์ภาพล้มเหลว', 'error');
        return null;
    }
}

// ฟังก์ชันวาดผลลัพธ์การวิเคราะห์บน Canvas
function drawMCPResults(canvas, results) {
    const ctx = canvas.getContext('2d');
    
    // วาดกรอบและข้อความสำหรับแต่ละวัตถุที่พบ
    if (results.objects) {
        results.objects.forEach(obj => {
            // วาดกรอบ
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(obj.bbox.x, obj.bbox.y, obj.bbox.width, obj.bbox.height);
            
            // วาดป้ายชื่อ
            ctx.fillStyle = '#FF0000';
            const text = `${obj.label} (${(obj.confidence * 100).toFixed(1)}%)`;
            const textWidth = ctx.measureText(text).width;
            ctx.fillRect(obj.bbox.x - 2, obj.bbox.y - 20, textWidth + 4, 20);
            
            // วาดข้อความ
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px Arial';
            ctx.fillText(text, obj.bbox.x, obj.bbox.y - 5);
        });
    }
}

// ตัวแปรสำหรับจัดการกล้อง
let stream = null;
let capturedPhotos = [];

// ฟังก์ชันเริ่มต้นการทำงานของกล้อง
async function startCamera() {
    try {
        const video = document.getElementById('cameraView');
        const noCamera = document.getElementById('noCamera');
        
        // ปิดสตรีมเดิมถ้ามี
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        // เปิดกล้อง
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment' 
            } 
        });
        
        video.srcObject = stream;
        video.style.display = 'block';
        noCamera.style.display = 'none';
        
        // เปิดปุ่มถ่ายภาพ
        document.getElementById('capturePhoto').disabled = false;
        
        await video.play();
    } catch (err) {
        console.error('ไม่สามารถเปิดกล้องได้:', err);
        alert('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง');
    }
}

// ฟังก์ชันวิเคราะห์ภาพด้วย MCP หลังจากถ่ายภาพ
async function analyzeCapturedPhoto(photoData) {
    try {
        const results = await analyzeWithMCP(photoData);
        if (results) {
            // แสดงผลลัพธ์บน Canvas
            const canvas = document.createElement('canvas');
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                // วาดผลลัพธ์การวิเคราะห์
                drawMCPResults(canvas, results);
                
                // แสดงผลลัพธ์
                const resultContainer = document.createElement('div');
                resultContainer.className = 'mcp-result';
                resultContainer.style.marginTop = '10px';
                resultContainer.innerHTML = `
                    <h5>ผลการวิเคราะห์ MCP</h5>
                    <div class="mcp-stats">
                        <span>พบวัตถุ: ${results.objects?.length || 0} รายการ</span>
                        <span>พบใบหน้า: ${results.faces?.length || 0} ใบหน้า</span>
                        <span>พบป้ายทะเบียน: ${results.license_plates?.length || 0} ป้าย</span>
                    </div>
                    <div class="mcp-image-container">
                        <img src="${canvas.toDataURL('image/jpeg')}" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                `;
                
                // เพิ่มผลลัพธ์ลงในหน้า
                const resultsContainer = document.getElementById('analysisResultsInner') || document.getElementById('analysisResults');
                if (resultsContainer) {
                    resultsContainer.appendChild(resultContainer);
                }
                
                // บันทึกผลลัพธ์ลงในอาร์เรย์รูปภาพ
                const currentPhoto = capturedPhotos[capturedPhotos.length - 1];
                if (currentPhoto) {
                    currentPhoto.mcpResults = results;
                    currentPhoto.analyzedImage = canvas.toDataURL('image/jpeg');
                }
            };
            img.src = photoData;
        }
    } catch (error) {
        console.error('Error analyzing photo:', error);
    }
}

// ฟังก์ชันถ่ายภาพ
function capturePhoto() {
    const video = document.getElementById('cameraView');
    const canvas = document.getElementById('photoCanvas');
    const photoList = document.getElementById('photoList');
    
    // ตั้งค่าขนาด Canvas ให้เท่ากับวิดีโอ
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // วาดภาพจากวิดีโอลงบน Canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // แปลง Canvas เป็น Data URL
    const photoData = canvas.toDataURL('image/jpeg', 0.8);
    
    // เพิ่มรูปภาพลงในอาร์เรย์
    const photoId = 'photo_' + Date.now();
    capturedPhotos.push({
        id: photoId,
        data: photoData,
        timestamp: new Date().toISOString(),
        position: map.getCenter() // ตำแหน่งปัจจุบันบนแผนที่
    });
    
    // แสดงรูปภาพที่ถ่าย
    updatePhotoList();
    
    // แจ้งเตือนและวิเคราะห์ภาพ
    showNotification('ถ่ายภาพสำเร็จ! กำลังวิเคราะห์ภาพ...', 'success');
    
    // วิเคราะห์ภาพด้วย MCP
    analyzeCapturedPhoto(photoData);
}

// อัปเดตรายการรูปภาพ
function updatePhotoList() {
    const photoList = document.getElementById('photoList');
    photoList.innerHTML = '';
    
    capturedPhotos.forEach((photo, index) => {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-thumbnail';
        photoItem.innerHTML = `
            <img src="${photo.data}" alt="รูปที่ ${index + 1}" data-id="${photo.id}">
            <div class="remove-photo" data-id="${photo.id}" title="ลบรูปภาพ">×</div>
        `;
        
        // เพิ่ม Event Listener สำหรับการคลิกที่รูป
        photoItem.querySelector('img').addEventListener('click', () => {
            // โฟกัสไปที่ตำแหน่งที่ถ่ายภาพ
            map.setView(photo.position, 18);
        });
        
        // เพิ่ม Event Listener สำหรับปุ่มลบ
        photoItem.querySelector('.remove-photo').addEventListener('click', (e) => {
            e.stopPropagation();
            removePhoto(photo.id);
        });
        
        photoList.appendChild(photoItem);
    });
}

// ลบรูปภาพ
function removePhoto(photoId) {
    capturedPhotos = capturedPhotos.filter(photo => photo.id !== photoId);
    updatePhotoList();
}

// อัปโหลดรูปภาพ
function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const photoData = e.target.result;
        const photoId = 'upload_' + Date.now();
        
        capturedPhotos.push({
            id: photoId,
            data: photoData,
            timestamp: new Date().toISOString(),
            position: map.getCenter()
        });
        
        updatePhotoList();
        showNotification('อัปโหลดรูปภาพสำเร็จ!', 'success');
    };
    
    reader.readAsDataURL(file);
    
    // รีเซ็ต input file เพื่อให้สามารถเลือกไฟล์เดิมซ้ำได้
    event.target.value = '';
}

// สร้างโมเดล 3D จากรูปภาพ
async function generate3DModel() {
    if (capturedPhotos.length < 3) {
        showNotification('ต้องการอย่างน้อย 3 รูปภาพเพื่อสร้างโมเดล 3D', 'error');
        return;
    }
    
    const processingSection = document.getElementById('processingSection');
    const processingText = document.getElementById('processingText');
    const progressBar = document.getElementById('progressBar');
    const result3D = document.getElementById('result3D');
    
    // แสดงส่วนประมวลผล
    processingSection.style.display = 'block';
    result3D.style.display = 'none';
    
    try {
        // จำลองการประมวลผล
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            if (progress > 90) {
                clearInterval(interval);
                processingText.textContent = 'กำลังสร้างโมเดล 3D...';
                
                // จำลองการโหลดเสร็จสิ้น
                setTimeout(() => {
                    processingSection.style.display = 'none';
                    result3D.style.display = 'block';
                    showNotification('สร้างโมเดล 3D สำเร็จ!', 'success');
                }, 2000);
            } else {
                progressBar.style.width = `${progress}%`;
                processingText.textContent = `กำลังประมวลผลภาพ... (${progress}%)`;
            }
        }, 200);
        
        // ในที่นี้เป็นตัวอย่างเท่านั้น
        // ในสภาพแวดล้อมการทำงานจริง ควรส่งรูปภาพไปยัง API สำหรับสร้างโมเดล 3D
        // เช่น ใช้ API ของ RealityCapture, Meshroom, หรือบริการอื่นๆ
        
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการสร้างโมเดล 3D:', error);
        showNotification('เกิดข้อผิดพลาดในการสร้างโมเดล 3D', 'error');
        processingSection.style.display = 'none';
    }
}

// แสดงการแจ้งเตือน
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // เพิ่มสไตล์ CSS สำหรับการแจ้งเตือน
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        }
        .notification.show {
            opacity: 1;
            transform: translateX(0);
        }
        .success { background-color: #28a745; }
        .error { background-color: #dc3545; }
        .info { background-color: #17a2b8; }
    `;
    document.head.appendChild(style);
    
    // แสดงการแจ้งเตือน
    setTimeout(() => notification.classList.add('show'), 10);
    
    // ซ่อนการแจ้งเตือนหลังจาก 3 วินาที
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// เพิ่ม CSS สำหรับผลลัพธ์ MCP
const mcpStyles = document.createElement('style');
mcpStyles.textContent = `
    .mcp-result {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        padding: 15px;
        margin-top: 15px;
    }
    .mcp-stats {
        display: flex;
        gap: 15px;
        margin: 10px 0;
        padding: 8px;
        background: #e9ecef;
        border-radius: 4px;
        font-size: 14px;
    }
    .mcp-stats span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }
    .mcp-stats span:before {
        content: '•';
        color: #6c757d;
    }
    .mcp-image-container {
        margin-top: 10px;
        text-align: center;
    }
`;
document.head.appendChild(mcpStyles);

// เรียกใช้งานฟังก์ชันต่างๆ เมื่อหน้าเว็บโหลดเสร็จ
document.addEventListener('DOMContentLoaded', function() {
    // Blender Export
    const exportBtn = document.getElementById('exportToBlender');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToBlender);
    }
    
    // เพิ่มปุ่มส่งออกไปยัง MCP Server
    const exportToMCPBtn = document.createElement('button');
    exportToMCPBtn.className = 'drive-btn btn-primary';
    exportToMCPBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> ส่งออกไปยัง MCP';
    exportToMCPBtn.style.marginTop = '10px';
    exportToMCPBtn.style.width = '100%';
    exportToMCPBtn.addEventListener('click', async () => {
        try {
            const projectData = prepareProjectData();
            await exportToMCPServer(projectData);
        } catch (error) {
            console.error('Export to MCP failed:', error);
        }
    });
    
    // เพิ่มปุ่มส่งออกไปยัง MCP Server
    const driveButtons = document.getElementById('driveButtons');
    if (driveButtons) {
        driveButtons.appendChild(exportToMCPBtn);
    }

    // ฟังก์ชันเตรียมข้อมูลโปรเจค
    function prepareProjectData() {
        return {
            cameras: cameras.map(cam => ({
                id: cam.id,
                position: cam.marker.getLatLng(),
                type: cam.type || 'Dome',
                angle: cam.angle || 0,
                height: cam.height || 3.0,
                fov: cam.fov || 90
            })),
            cables: cableLines.map((line, index) => ({
                id: `cable_${index}`,
                points: line.getLatLngs(),
                length: line.length || 0,
                type: 'CAT6'
            })),
            metadata: {
                projectName: 'CCTV_Project_' + new Date().toISOString().split('T')[0],
                exportDate: new Date().toISOString(),
                totalCameras: cameras.length,
                totalCableLength: totalDistance
            }
        };
    }

    // กล้องถ่ายรูป
    const startCameraBtn = document.getElementById('startCamera');
    const capturePhotoBtn = document.getElementById('capturePhoto');
    const uploadPhotoBtn = document.getElementById('uploadPhoto');
    const photoUpload = document.getElementById('photoUpload');
    const generateModelBtn = document.createElement('button');
    
    // สร้างปุ่มสร้างโมเดล 3D
    generateModelBtn.className = 'btn btn-primary';
    generateModelBtn.innerHTML = '<i class="fas fa-cube"></i> สร้างโมเดล 3D';
    generateModelBtn.style.marginTop = '10px';
    generateModelBtn.style.width = '100%';
    generateModelBtn.addEventListener('click', generate3DModel);
    
    // เพิ่มปุ่มสร้างโมเดล 3D
    const capturedPhotosSection = document.getElementById('capturedPhotos');
    if (capturedPhotosSection) {
        capturedPhotosSection.appendChild(generateModelBtn);
    }
    
    // Event Listeners
    if (startCameraBtn) {
        startCameraBtn.addEventListener('click', startCamera);
    }
    
    if (capturePhotoBtn) {
        capturePhotoBtn.addEventListener('click', capturePhoto);
    }
    
    if (uploadPhotoBtn && photoUpload) {
        uploadPhotoBtn.addEventListener('click', () => photoUpload.click());
        photoUpload.addEventListener('change', handlePhotoUpload);
    }
    
    // ปุ่มส่งออกโมเดล
    const exportModelBtn = document.getElementById('exportModel');
    if (exportModelBtn) {
        exportModelBtn.addEventListener('click', () => {
            // จำลองการส่งออกไฟล์
            const link = document.createElement('a');
            link.href = '#'; // ควรเป็น URL ของโมเดล 3D
            link.download = '3d_model.obj';
            link.click();
            showNotification('กำลังดาวน์โหลดไฟล์โมเดล 3D', 'info');
        });
    }
    
    // ปุ่มเพิ่มลงแผนที่
    const addToMapBtn = document.getElementById('addToMap');
    if (addToMapBtn) {
        addToMapBtn.addEventListener('click', () => {
            // จำลองการเพิ่มโมเดลลงแผนที่
            showNotification('เพิ่มโมเดลลงแผนที่เรียบร้อยแล้ว', 'success');
        });
    }

    // คำนวณค่าใช้จ่ายแบบ real-time เมื่อผู้ใช้ปรับค่า
    const costInputs = [
        'utpPrice', 'fiberPrice', 'laborPriceUtp', 'laborPriceFiber', 'rackSize',
        'switchQty', 'nvrQty', 'upsQty', 'rackInstallation'
    ];
    costInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculateCosts);
            el.addEventListener('change', calculateCosts);
        }
    });

    // ====== Event Listeners สำหรับเครื่องมือใหม่ ======
    const drawAreaBtn = document.getElementById('drawArea');
    if (drawAreaBtn) {
        drawAreaBtn.addEventListener('click', toggleDrawArea);
    }

    const addRackBtn = document.getElementById('addRack');
    if (addRackBtn) {
        addRackBtn.addEventListener('click', addRackMode);
    }

    // Event listeners สำหรับกล้อง
    const addBulletCameraBtn = document.getElementById('addBulletCamera');
    if (addBulletCameraBtn) {
        addBulletCameraBtn.addEventListener('click', addBulletCameraMode);
    }

    const addDomeCameraBtn = document.getElementById('addDomeCamera');
    if (addDomeCameraBtn) {
        addDomeCameraBtn.addEventListener('click', addDomeCameraMode);
    }

    const addPTZCameraBtn = document.getElementById('addPTZCamera');
    if (addPTZCameraBtn) {
        addPTZCameraBtn.addEventListener('click', addPTZCameraMode);
    }

    const assignToRackBtn = document.getElementById('assignToRack');
    if (assignToRackBtn) {
        assignToRackBtn.addEventListener('click', assignCurrentCamToRack);
    }

    const connectRacksBtn = document.getElementById('connectRacks');
    if (connectRacksBtn) {
        connectRacksBtn.addEventListener('click', connectSelectedRacks);
    }

    const deleteConnectionBtn = document.getElementById('deleteConnection');
    if (deleteConnectionBtn) {
        deleteConnectionBtn.addEventListener('click', deleteSelectedConnection);
    }

    const deleteAllBtn = document.getElementById('deleteAll');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', deleteAll);
    }

    const deleteCameraBtn = document.getElementById('deleteCamera');
    if (deleteCameraBtn) {
        deleteCameraBtn.addEventListener('click', deleteCurrentCamera);
    }

    const deleteRackBtn = document.getElementById('deleteRack');
    if (deleteRackBtn) {
        deleteRackBtn.addEventListener('click', deleteSelectedRack);
    }

    const deleteOverlayBtn = document.getElementById('deleteOverlay');
    if (deleteOverlayBtn) {
        deleteOverlayBtn.addEventListener('click', deleteCurrentOverlay);
    }

    // Wire up rectangle overlay controls
    try { wireOverlayControls(); } catch (e) { console.warn('wireOverlayControls failed:', e); }

    // Wire up camera controls
    try { wireCameraControls(); } catch (e) { console.warn('wireCameraControls failed:', e); }

    // ====== Event Listeners สำหรับเมนูใหม่ ======
    
    // บันทึกโปรเจค
    const saveProjectBtn = document.getElementById('saveProject');
    if (saveProjectBtn) {
        saveProjectBtn.addEventListener('click', saveProject);
    }

    // โหลดโปรเจค
    const loadProjectBtn = document.getElementById('loadProject');
    if (loadProjectBtn) {
        loadProjectBtn.addEventListener('click', () => {
            document.getElementById('loadProjectFile').click();
        });
    }

    // ปริ้นแผนที่
    const printMapBtn = document.getElementById('printMap');
    if (printMapBtn) {
        printMapBtn.addEventListener('click', printMap);
    }

    // ส่งออกเป็นรูปภาพ
    const exportImageBtn = document.getElementById('exportImage');
    if (exportImageBtn) {
        exportImageBtn.addEventListener('click', exportMapAsImage);
    }

    // เพิ่มข้อความตำแหน่ง
    const addLocationTextBtn = document.getElementById('addLocationText');
    if (addLocationTextBtn) {
        addLocationTextBtn.addEventListener('click', enableLocationTextMode);
    }

    // โหลดไฟล์โปรเจค
    const loadProjectFile = document.getElementById('loadProjectFile');
    if (loadProjectFile) {
        loadProjectFile.addEventListener('change', loadProjectFromFile);
    }

    // คำนวณครั้งแรกเมื่อโหลดหน้า
    try { calculateCosts(); } catch (e) { /* ignore */ }
}

// ====== ฟังก์ชันสำหรับเมนูใหม่ ======

// ตัวแปรสำหรับข้อความตำแหน่ง
var locationTexts = [];
var locationTextMode = false;

// บันทึกโปรเจค
function saveProject() {
    const projectData = {
        cameras: cameras.map(cam => ({
            ...cam,
            marker: null // ไม่บันทึก marker object
        })),
        racks: racks,
        poles: poles,
        rackLinks: rackLinks,
        cableConnections: cableConnections.map(conn => ({
            ...conn,
            line: null // ไม่บันทึก line object
        })),
        rectOverlays: rectOverlays,
        locationTexts: locationTexts,
        areaPoints: areaPoints,
        timestamp: new Date().toISOString(),
        version: '1.0'
    };

    const dataStr = JSON.stringify(projectData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `cctv_project_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification('บันทึกโปรเจคสำเร็จ', 'success');
}

// โหลดโปรเจคจากไฟล์
function loadProjectFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const projectData = JSON.parse(e.target.result);
            
            // ลบข้อมูลเก่า
            deleteAll();
            
            // โหลดข้อมูลใหม่
            if (projectData.cameras) {
                cameras = projectData.cameras;
                cameras.forEach(cam => {
                    // สร้าง marker ใหม่
                    let icon;
                    if (cam.type === 'ptz') {
                        icon = L.divIcon({
                            className: 'ptz-icon',
                            html: '<i class="fas fa-video"></i>',
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        });
                    } else if (cam.type === 'pole') {
                        icon = L.divIcon({
                            className: 'pole-icon',
                            html: '<i class="fas fa-flag"></i>',
                            iconSize: [8, 30],
                            iconAnchor: [4, 30]
                        });
                    } else {
                        icon = L.divIcon({
                            className: 'camera-icon',
                            html: '<i class="fas fa-camera"></i>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        });
                    }
                    
                    const marker = L.marker(cam.latlng, { 
                        title: cam.name, 
                        draggable: true,
                        icon: icon
                    }).addTo(map);
                    
                    // สร้าง popup
                    const popupContent = `
                        <div>
                            <strong>${cam.name}</strong><br>
                            <small>${cam.type === 'ptz' ? 'กล้อง PTZ' : cam.type === 'pole' ? 'เสากล้อง' : 'กล้องธรรมดา'}</small><br>
                            <button onclick="editCamera('${cam.id}')" class="btn btn-sm btn-primary">แก้ไข</button>
                            <button onclick="deleteCameraById('${cam.id}')" class="btn btn-sm btn-danger">ลบ</button>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    
                    // แสดงชื่อ
                    const offset = cam.type === 'pole' ? [0, -35] : [0, -15];
                    marker.bindTooltip(cam.name, { 
                        permanent: true, 
                        direction: 'top', 
                        offset: offset, 
                        className: 'camera-label' 
                    });
                    
                    // Event listeners
                    marker.on('click', () => selectCamera(cam));
                    marker.on('drag', () => updateCameraPosition(cam));
                    marker.on('dragend', () => { 
                        try { calculateCosts(); } catch(_){} 
                    });
                    marker.on('dblclick', () => editCameraName(cam));
                    
                    cam.marker = marker;
                });
            }
            
            if (projectData.racks) {
                racks = projectData.racks;
                racks.forEach(rack => {
                    if (rack.marker) {
                        rack.marker.addTo(map);
                    }
                });
            }
            
            if (projectData.poles) {
                poles = projectData.poles;
                poles.forEach(pole => {
                    if (pole.marker) {
                        pole.marker.addTo(map);
                    }
                });
            }
            
            if (projectData.rackLinks) {
                rackLinks = projectData.rackLinks;
                rackLinks.forEach(link => {
                    if (link.line) {
                        link.line.addTo(map);
                    }
                });
            }
            
            if (projectData.cableConnections) {
                cableConnections = projectData.cableConnections;
                cableConnections.forEach(conn => {
                    const fromPos = getDevicePosition(conn.fromId);
                    const toPos = getDevicePosition(conn.toId);
                    
                    if (fromPos && toPos) {
                        const color = getCableColor(conn.cableType);
                        const line = L.polyline([fromPos, toPos], {
                            color: color,
                            weight: 3,
                            opacity: 0.8
                        }).addTo(map);
                        
                        line.bindPopup(`
                            <div>
                                <strong>สายเคเบิล</strong><br>
                                <small>จาก: ${getDeviceName(conn.fromId)}</small><br>
                                <small>ไป: ${getDeviceName(conn.toId)}</small><br>
                                <small>ชนิด: ${getCableTypeName(conn.cableType)}</small><br>
                                <small>ท่อ: ${getConduitTypeName(conn.conduitType)} ${conn.conduitSize}"</small><br>
                                <small>ความยาว: ${conn.length.toFixed(1)} ม.</small><br>
                                <small>ราคา: ${conn.price.toFixed(2)} บาท</small><br>
                                <button onclick="deleteCableById('${conn.fromId}_${conn.toId}')" class="btn btn-sm btn-danger">ลบ</button>
                            </div>
                        `);
                        
                        conn.line = line;
                    }
                });
                
                updateCableList();
                updateCablePrice();
            }
            
            if (projectData.rectOverlays) {
                rectOverlays = projectData.rectOverlays;
                rectOverlays.forEach(overlay => {
                    if (overlay.polygon) {
                        overlay.polygon.addTo(map);
                    }
                    if (overlay.centerMarker) {
                        overlay.centerMarker.addTo(map);
                    }
                    if (overlay.cornerMarkers) {
                        overlay.cornerMarkers.forEach(marker => {
                            if (marker) marker.addTo(map);
                        });
                    }
                });
            }
            
            if (projectData.locationTexts) {
                locationTexts = projectData.locationTexts;
                locationTexts.forEach(textObj => {
                    if (textObj.marker) {
                        textObj.marker.addTo(map);
                    }
                });
            }
            
            if (projectData.areaPoints) {
                areaPoints = projectData.areaPoints;
                if (areaPoints.length >= 3) {
                    areaPolygon = L.polygon(areaPoints, { color: '#ffc107', fillOpacity: 0.1 }).addTo(map);
                }
            }
            
            showNotification('โหลดโปรเจคสำเร็จ', 'success');
            calculateCosts();
            
        } catch (error) {
            showNotification('เกิดข้อผิดพลาดในการโหลดไฟล์: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

// ปริ้นแผนที่
function printMap() {
    // สร้างหน้าต่างใหม่สำหรับการพิมพ์
    const printWindow = window.open('', '_blank');
    const mapContainer = document.getElementById('map');
    const mapClone = mapContainer.cloneNode(true);
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>CCTV Planner - แผนที่</title>
            <style>
                body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                .print-header { text-align: center; margin-bottom: 20px; }
                .print-info { margin-bottom: 20px; }
                .print-info table { width: 100%; border-collapse: collapse; }
                .print-info td { padding: 5px; border: 1px solid #ddd; }
                .map-container { width: 100%; height: 600px; border: 1px solid #ccc; }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>CCTV Planner - แผนที่ระบบกล้องวงจรปิด</h1>
                <p>วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH')}</p>
            </div>
            
            <div class="print-info">
                <h3>ข้อมูลสรุป</h3>
                <table>
                    <tr><td>จำนวนกล้อง</td><td>${cameras.length} ตัว</td></tr>
                    <tr><td>จำนวนตู้ Rack</td><td>${racks.length} ตู้</td></tr>
                    <tr><td>จำนวนสายเคเบิล</td><td>${rackLinks.length} เส้น</td></tr>
                    <tr><td>ระยะทางรวม</td><td>${(totalDistance/1000).toFixed(2)} กิโลเมตร</td></tr>
                </table>
            </div>
            
            <div class="map-container">
                <p style="text-align: center; padding: 20px;">แผนที่จะแสดงที่นี่</p>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // รอให้โหลดเสร็จแล้วพิมพ์
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 1000);
    
    showNotification('กำลังเปิดหน้าต่างพิมพ์...', 'info');
}

// ส่งออกเป็นรูปภาพ
function exportMapAsImage() {
    // ใช้ html2canvas หรือ dom-to-image สำหรับการส่งออก
    if (typeof html2canvas !== 'undefined') {
        html2canvas(document.getElementById('map')).then(canvas => {
            const link = document.createElement('a');
            link.download = `cctv_map_${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL();
            link.click();
            showNotification('ส่งออกรูปภาพสำเร็จ', 'success');
        });
    } else {
        // วิธีสำรอง: ใช้ screenshot ของหน้าจอ
        showNotification('กรุณากด PrtScn เพื่อถ่ายภาพหน้าจอ', 'info');
    }
}

// เปิดโหมดเพิ่มข้อความตำแหน่ง
function enableLocationTextMode() {
    const textInput = document.getElementById('locationText');
    const text = textInput.value.trim();
    
    if (!text) {
        showNotification('กรุณาใส่ข้อความก่อน', 'warning');
        return;
    }
    
    locationTextMode = true;
    showNotification('คลิกที่แผนที่เพื่อเพิ่มข้อความ: ' + text, 'info');
    
    // เพิ่ม event listener ชั่วคราว
    const tempClickHandler = (e) => {
        addLocationTextToMap(e.latlng, text);
        map.off('click', tempClickHandler);
        locationTextMode = false;
        textInput.value = '';
    };
    
    map.on('click', tempClickHandler);
}

// เพิ่มข้อความตำแหน่งลงแผนที่
function addLocationTextToMap(latlng, text) {
    const id = 'text_' + Date.now();
    
    // สร้าง marker สำหรับข้อความ
    const marker = L.marker(latlng, {
        icon: L.divIcon({
            className: 'location-text-marker',
            html: `<div style="background: white; border: 2px solid #007bff; border-radius: 5px; padding: 5px 10px; font-weight: bold; color: #007bff; white-space: nowrap;">${text}</div>`,
            iconSize: [200, 30],
            iconAnchor: [100, 15]
        }),
        draggable: true
    }).addTo(map);
    
    // เพิ่ม popup สำหรับแก้ไข
    marker.bindPopup(`
        <div>
            <input type="text" id="editText_${id}" value="${text}" style="width: 100%; margin-bottom: 5px;">
            <button onclick="editLocationText('${id}')" class="btn btn-sm btn-primary">แก้ไข</button>
            <button onclick="deleteLocationText('${id}')" class="btn btn-sm btn-danger">ลบ</button>
        </div>
    `);
    
    const textObj = { id, text, marker, latlng };
    locationTexts.push(textObj);
    
    showNotification('เพิ่มข้อความตำแหน่งสำเร็จ', 'success');
}

// แก้ไขข้อความตำแหน่ง
function editLocationText(id) {
    const textObj = locationTexts.find(t => t.id === id);
    if (!textObj) return;
    
    const newText = document.getElementById(`editText_${id}`).value.trim();
    if (!newText) return;
    
    textObj.text = newText;
    
    // อัปเดต marker
    textObj.marker.setIcon(L.divIcon({
        className: 'location-text-marker',
        html: `<div style="background: white; border: 2px solid #007bff; border-radius: 5px; padding: 5px 10px; font-weight: bold; color: #007bff; white-space: nowrap;">${newText}</div>`,
        iconSize: [200, 30],
        iconAnchor: [100, 15]
    }));
    
    textObj.marker.closePopup();
    showNotification('แก้ไขข้อความสำเร็จ', 'success');
}

// ลบข้อความตำแหน่ง
function deleteLocationText(id) {
    const textObj = locationTexts.find(t => t.id === id);
    if (!textObj) return;
    
    map.removeLayer(textObj.marker);
    locationTexts = locationTexts.filter(t => t.id !== id);
    
    showNotification('ลบข้อความตำแหน่งสำเร็จ', 'success');
}

// Event Listeners สำหรับปุ่มเสากล้อง
document.addEventListener('DOMContentLoaded', function() {
    const addPoleBtn = document.getElementById('addPole');
    if (addPoleBtn) {
        addPoleBtn.addEventListener('click', addPoleMode);
    }
    
    const deletePoleBtn = document.getElementById('deletePole');
    if (deletePoleBtn) {
        deletePoleBtn.addEventListener('click', () => {
            if (poles.length === 0) {
                showNotification('ไม่มีเสากล้องให้ลบ', 'warning');
                return;
            }
            const poleToDelete = poles[poles.length - 1];
            map.removeLayer(poleToDelete.marker);
            poles = poles.filter(p => p.id !== poleToDelete.id);
            showNotification('ลบเสากล้องสำเร็จ: ' + poleToDelete.name, 'success');
        });
    }

    // Event Listeners สำหรับระบบสายเคเบิล
    const connectCableBtn = document.getElementById('connectCable');
    if (connectCableBtn) {
        connectCableBtn.addEventListener('click', connectCable);
    }

    const deleteCableBtn = document.getElementById('deleteCable');
    if (deleteCableBtn) {
        deleteCableBtn.addEventListener('click', deleteSelectedCable);
    }

    // อัปเดตรายการอุปกรณ์ใน dropdown
    updateCableDropdowns();
});

// ====== ระบบสายเคเบิลและท่อ ======
var cableConnections = []; // { fromId, toId, cableType, conduitType, conduitSize, length, price, line }

// อัปเดตรายการอุปกรณ์ใน dropdown
function updateCableDropdowns() {
    const cableFrom = document.getElementById('cableFrom');
    const cableTo = document.getElementById('cableTo');
    
    if (!cableFrom || !cableTo) return;
    
    // ล้างรายการเก่า
    cableFrom.innerHTML = '<option value="">เลือกอุปกรณ์</option>';
    cableTo.innerHTML = '<option value="">เลือกอุปกรณ์</option>';
    
    // เพิ่มตู้ Rack
    racks.forEach(rack => {
        const option = document.createElement('option');
        option.value = `rack_${rack.id}`;
        option.textContent = `ตู้ Rack: ${rack.name}`;
        cableFrom.appendChild(option.cloneNode(true));
        cableTo.appendChild(option);
    });
    
    // เพิ่มเสากล้อง
    poles.forEach(pole => {
        const option = document.createElement('option');
        option.value = `pole_${pole.id}`;
        option.textContent = `เสากล้อง: ${pole.name}`;
        cableFrom.appendChild(option.cloneNode(true));
        cableTo.appendChild(option);
    });
    
    // เพิ่มกล้อง
    cameras.forEach(cam => {
        const option = document.createElement('option');
        option.value = `camera_${cam.id}`;
        option.textContent = `กล้อง: ${cam.name || cam.id}`;
        cableFrom.appendChild(option.cloneNode(true));
        cableTo.appendChild(option);
    });
}

// เชื่อมสายเคเบิล
function connectCable() {
    const fromId = document.getElementById('cableFrom').value;
    const toId = document.getElementById('cableTo').value;
    const cableType = document.getElementById('cableType').value;
    const conduitType = document.getElementById('conduitType').value;
    const conduitSize = document.getElementById('conduitSize').value;
    
    if (!fromId || !toId) {
        showNotification('กรุณาเลือกอุปกรณ์ต้นทางและปลายทาง', 'warning');
        return;
    }
    
    if (fromId === toId) {
        showNotification('ไม่สามารถเชื่อมอุปกรณ์เดียวกันได้', 'warning');
        return;
    }
    
    // หาตำแหน่งของอุปกรณ์
    const fromPos = getDevicePosition(fromId);
    const toPos = getDevicePosition(toId);
    
    if (!fromPos || !toPos) {
        showNotification('ไม่พบตำแหน่งของอุปกรณ์', 'error');
        return;
    }
    
    // คำนวณความยาว
    const length = fromPos.distanceTo(toPos);
    
    // คำนวณราคา
    const price = calculateCablePrice(cableType, conduitType, conduitSize, length);
    
    // สร้างเส้นสายเคเบิล
    const color = getCableColor(cableType);
    const line = L.polyline([fromPos, toPos], {
        color: color,
        weight: 3,
        opacity: 0.8
    }).addTo(map);
    
    // เพิ่ม popup แสดงข้อมูล
    line.bindPopup(`
        <div>
            <strong>สายเคเบิล</strong><br>
            <small>จาก: ${getDeviceName(fromId)}</small><br>
            <small>ไป: ${getDeviceName(toId)}</small><br>
            <small>ชนิด: ${getCableTypeName(cableType)}</small><br>
            <small>ท่อ: ${getConduitTypeName(conduitType)} ${conduitSize}"</small><br>
            <small>ความยาว: ${length.toFixed(1)} ม.</small><br>
            <small>ราคา: ${price.toFixed(2)} บาท</small><br>
            <button onclick="deleteCableById('${fromId}_${toId}')" class="btn btn-sm btn-danger">ลบ</button>
        </div>
    `);
    
    // บันทึกข้อมูล
    const connection = {
        fromId: fromId,
        toId: toId,
        cableType: cableType,
        conduitType: conduitType,
        conduitSize: conduitSize,
        length: length,
        price: price,
        line: line
    };
    
    cableConnections.push(connection);
    
    // อัปเดตการแสดงผล
    updateCableList();
    updateCablePrice();
    
    showNotification(`เชื่อมสายเคเบิลสำเร็จ: ${length.toFixed(1)} ม. (${price.toFixed(2)} บาท)`, 'success');
}

// หาตำแหน่งของอุปกรณ์
function getDevicePosition(deviceId) {
    const [type, id] = deviceId.split('_');
    
    if (type === 'rack') {
        const rack = racks.find(r => r.id === id);
        return rack ? rack.marker.getLatLng() : null;
    } else if (type === 'pole') {
        const pole = poles.find(p => p.id === id);
        return pole ? pole.marker.getLatLng() : null;
    } else if (type === 'camera') {
        const camera = cameras.find(c => c.id === id);
        return camera ? camera.position : null;
    }
    
    return null;
}

// หาชื่อของอุปกรณ์
function getDeviceName(deviceId) {
    const [type, id] = deviceId.split('_');
    
    if (type === 'rack') {
        const rack = racks.find(r => r.id === id);
        return rack ? `ตู้ Rack: ${rack.name}` : 'ไม่พบ';
    } else if (type === 'pole') {
        const pole = poles.find(p => p.id === id);
        return pole ? `เสากล้อง: ${pole.name}` : 'ไม่พบ';
    } else if (type === 'camera') {
        const camera = cameras.find(c => c.id === id);
        return camera ? `กล้อง: ${camera.name || camera.id}` : 'ไม่พบ';
    }
    
    return 'ไม่พบ';
}

// คำนวณราคาสายเคเบิล
function calculateCablePrice(cableType, conduitType, conduitSize, length) {
    let cablePrice = 0;
    let conduitPrice = 0;
    
    // ราคาสายเคเบิล (บาท/เมตร)
    switch (cableType) {
        case 'UTP': cablePrice = 15; break;
        case 'FIBER': cablePrice = 45; break;
        case 'COAX': cablePrice = 25; break;
        default: cablePrice = 15;
    }
    
    // ราคาท่อ (บาท/เมตร)
    switch (conduitType) {
        case 'PVC':
            switch (conduitSize) {
                case '0.5': conduitPrice = 8; break;
                case '0.75': conduitPrice = 12; break;
                case '1': conduitPrice = 18; break;
                case '1.25': conduitPrice = 25; break;
                case '1.5': conduitPrice = 35; break;
                case '2': conduitPrice = 50; break;
                default: conduitPrice = 18;
            }
            break;
        case 'METAL':
            switch (conduitSize) {
                case '0.5': conduitPrice = 15; break;
                case '0.75': conduitPrice = 22; break;
                case '1': conduitPrice = 30; break;
                case '1.25': conduitPrice = 40; break;
                case '1.5': conduitPrice = 55; break;
                case '2': conduitPrice = 80; break;
                default: conduitPrice = 30;
            }
            break;
        case 'FLEXIBLE':
            switch (conduitSize) {
                case '0.5': conduitPrice = 12; break;
                case '0.75': conduitPrice = 18; break;
                case '1': conduitPrice = 25; break;
                case '1.25': conduitPrice = 35; break;
                case '1.5': conduitPrice = 45; break;
                case '2': conduitPrice = 65; break;
                default: conduitPrice = 25;
            }
            break;
    }
    
    return (cablePrice + conduitPrice) * length;
}

// สีของสายเคเบิล
function getCableColor(cableType) {
    switch (cableType) {
        case 'UTP': return '#198754'; // เขียว
        case 'FIBER': return '#0d6efd'; // น้ำเงิน
        case 'COAX': return '#dc3545'; // แดง
        default: return '#6c757d'; // เทา
    }
}

// ชื่อชนิดสายเคเบิล
function getCableTypeName(cableType) {
    switch (cableType) {
        case 'UTP': return 'UTP (สายทองแดง)';
        case 'FIBER': return 'Fiber (ใยแก้วนำแสง)';
        case 'COAX': return 'Coaxial (สายโคแอกซ์)';
        default: return 'ไม่ทราบ';
    }
}

// ชื่อชนิดท่อ
function getConduitTypeName(conduitType) {
    switch (conduitType) {
        case 'PVC': return 'PVC (ท่อพลาสติก)';
        case 'METAL': return 'Metal (ท่อโลหะ)';
        case 'FLEXIBLE': return 'Flexible (ท่อยืดหยุ่น)';
        default: return 'ไม่ทราบ';
    }
}

// ลบสายเคเบิลตาม ID
function deleteCableById(connectionId) {
    const connection = cableConnections.find(c => `${c.fromId}_${c.toId}` === connectionId);
    if (!connection) return;
    
    map.removeLayer(connection.line);
    cableConnections = cableConnections.filter(c => c !== connection);
    
    updateCableList();
    updateCablePrice();
    
    showNotification('ลบสายเคเบิลสำเร็จ', 'success');
}

// ลบสายเคเบิลที่เลือก
function deleteSelectedCable() {
    if (cableConnections.length === 0) {
        showNotification('ไม่มีสายเคเบิลให้ลบ', 'warning');
        return;
    }
    
    const lastConnection = cableConnections[cableConnections.length - 1];
    deleteCableById(`${lastConnection.fromId}_${lastConnection.toId}`);
}

// อัปเดตรายการสายเคเบิล
function updateCableList() {
    const cableList = document.getElementById('cableList');
    if (!cableList) return;
    
    if (cableConnections.length === 0) {
        cableList.innerHTML = '<small class="text-muted">ยังไม่มีสายเคเบิล</small>';
        return;
    }
    
    let html = '';
    cableConnections.forEach((conn, index) => {
        html += `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <small>${index + 1}. ${getDeviceName(conn.fromId)} → ${getDeviceName(conn.toId)}</small>
                <button onclick="deleteCableById('${conn.fromId}_${conn.toId}')" class="btn btn-sm btn-outline-danger" style="font-size: 10px;">ลบ</button>
            </div>
        `;
    });
    
    cableList.innerHTML = html;
}

// อัปเดตราคาสายเคเบิล
function updateCablePrice() {
    const cableLength = document.getElementById('cableLength');
    const cablePrice = document.getElementById('cablePrice');
    
    if (!cableLength || !cablePrice) return;
    
    const totalLength = cableConnections.reduce((sum, conn) => sum + conn.length, 0);
    const totalPrice = cableConnections.reduce((sum, conn) => sum + conn.price, 0);
    
    cableLength.value = totalLength.toFixed(1);
    cablePrice.value = totalPrice.toFixed(2);
}

// เริ่มต้นแอปพลิเคชันเมื่อ DOM โหลดเสร็จ
document.addEventListener('DOMContentLoaded', function() {
    // เริ่มต้นแผงควบคุม
    initializeToolsPanel();
    
    // เริ่มต้นแผนที่และฟังก์ชันต่างๆ
init();
    
    console.log('CCTV Planner เริ่มต้นสำเร็จ!');
});
