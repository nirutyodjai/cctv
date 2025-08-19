// Collaborative CCTV Planner - Real-time collaboration
class CollaborativeCCTV {
    constructor() {
        this.socket = null;
        this.roomId = this.generateRoomId();
        this.userId = this.generateUserId();
        this.isConnected = false;
        this.collaborators = new Map();
        this.cursorMarkers = new Map();
        this.chatMessages = [];
        
        this.init();
    }
    
    init() {
        this.setupUI();
        this.connectToServer();
        this.setupEventListeners();
    }
    
    generateRoomId() {
        return 'room_' + Math.random().toString(36).substr(2, 9);
    }
    
    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }
    
    setupUI() {
        // สร้าง UI สำหรับ collaboration
        const collaborationPanel = document.createElement('div');
        collaborationPanel.id = 'collaborationPanel';
        collaborationPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            max-height: 400px;
            overflow: hidden;
        `;
        
        collaborationPanel.innerHTML = `
            <div style="background: #007bff; color: white; padding: 10px; font-weight: bold;">
                <i class="fas fa-users"></i> การทำงานร่วมกัน
                <button id="closeCollaboration" style="float: right; background: none; border: none; color: white; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="padding: 10px;">
                <div style="margin-bottom: 10px;">
                    <strong>ห้อง:</strong> <span id="roomId">${this.roomId}</span>
                    <button id="copyRoomId" style="margin-left: 10px; padding: 2px 8px; font-size: 12px;">คัดลอก</button>
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>สถานะ:</strong> <span id="connectionStatus" style="color: #dc3545;">ไม่เชื่อมต่อ</span>
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>ผู้ร่วมงาน:</strong> <span id="collaboratorCount">0</span> คน
                </div>
                <div id="collaboratorsList" style="margin-bottom: 10px; max-height: 100px; overflow-y: auto;">
                    <!-- รายชื่อผู้ร่วมงาน -->
                </div>
                <div style="border-top: 1px solid #eee; padding-top: 10px;">
                    <strong>แชท:</strong>
                    <div id="chatMessages" style="height: 150px; overflow-y: auto; border: 1px solid #ddd; padding: 5px; margin: 5px 0; background: #f9f9f9;">
                        <!-- ข้อความแชท -->
                    </div>
                    <div style="display: flex;">
                        <input type="text" id="chatInput" placeholder="พิมพ์ข้อความ..." style="flex: 1; padding: 5px; margin-right: 5px;">
                        <button id="sendChat" style="padding: 5px 10px;">ส่ง</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(collaborationPanel);
        
        // ปุ่มเปิด/ปิด collaboration panel
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggleCollaboration';
        toggleBtn.innerHTML = '<i class="fas fa-users"></i> ทำงานร่วมกัน';
        toggleBtn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px 15px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            z-index: 999;
        `;
        document.body.appendChild(toggleBtn);
    }
    
    setupEventListeners() {
        // ปุ่มเปิด/ปิด panel
        document.getElementById('toggleCollaboration').addEventListener('click', () => {
            const panel = document.getElementById('collaborationPanel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        
        // ปุ่มปิด panel
        document.getElementById('closeCollaboration').addEventListener('click', () => {
            document.getElementById('collaborationPanel').style.display = 'none';
        });
        
        // คัดลอก Room ID
        document.getElementById('copyRoomId').addEventListener('click', () => {
            navigator.clipboard.writeText(this.roomId).then(() => {
                this.showNotification('คัดลอก Room ID แล้ว', 'success');
            });
        });
        
        // ส่งข้อความแชท
        document.getElementById('sendChat').addEventListener('click', () => {
            this.sendChatMessage();
        });
        
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
    }
    
    connectToServer() {
        // ใช้ Socket.IO สำหรับ real-time collaboration
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                this.isConnected = true;
                this.updateConnectionStatus();
                this.joinRoom();
            });
            
            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.updateConnectionStatus();
            });
            
            this.socket.on('userJoined', (data) => {
                this.addCollaborator({
                    id: data.userId,
                    name: data.userName,
                    color: this.getRandomColor()
                });
            });
            
            this.socket.on('userLeft', (data) => {
                this.removeCollaborator(data.userId);
                this.addChatMessage('ระบบ', `${data.userName} ออกจากห้องแล้ว`);
            });
            
            this.socket.on('dataSync', (data) => {
                this.applyRemoteChanges(data);
            });
            
            this.socket.on('chatMessage', (data) => {
                this.addChatMessage(data.userName, data.message);
            });
            
            this.socket.on('cursorMove', (data) => {
                this.updateCollaboratorCursor(data);
            });
            
            this.socket.on('userList', (userList) => {
                this.updateUserList(userList);
            });
            
            this.socket.on('roomData', (data) => {
                this.loadRoomData(data);
            });
            
        } catch (error) {
            console.error('Failed to connect to server:', error);
            this.showNotification('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    }
    
    joinRoom() {
        if (this.socket && this.isConnected) {
            const userName = prompt('กรุณาใส่ชื่อของคุณ:', 'ผู้ใช้ ' + Math.floor(Math.random() * 1000));
            if (userName) {
                this.userName = userName;
                this.socket.emit('joinRoom', {
                    roomId: this.roomId,
                    userId: this.userId,
                    userName: this.userName
                });
            }
        }
    }
    
    getRandomColor() {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    syncData() {
        if (!this.socket || !this.isConnected) return;
        
        // ส่งข้อมูลการเปลี่ยนแปลงไปยัง server
        const data = {
            roomId: this.roomId,
            cameras: cameras || [],
            racks: racks || [],
            rectOverlays: rectOverlays || [],
            cableLines: cableLines || []
        };
        
        this.socket.emit('syncData', data);
    }
    
    applyRemoteChanges(data) {
        // ใช้ข้อมูลจากผู้ร่วมงานคนอื่น
        if (data.cameras) {
            // อัปเดตกล้อง
            console.log('Applying remote camera changes');
        }
        
        if (data.racks) {
            // อัปเดตตู้ Rack
            console.log('Applying remote rack changes');
        }
        
        if (data.rectOverlays) {
            // อัปเดตสี่เหลี่ยมโปร่งแสง
            console.log('Applying remote overlay changes');
        }
        
        if (data.cableLines) {
            // อัปเดตสายเคเบิล
            console.log('Applying remote cable changes');
        }
    }
    
    loadRoomData(data) {
        // โหลดข้อมูลห้องเมื่อเข้าร่วม
        console.log('Loading room data:', data);
        this.showNotification('โหลดข้อมูลห้องเรียบร้อยแล้ว', 'success');
    }
    
    updateUserList(userList) {
        // อัปเดตรายชื่อผู้ใช้
        this.collaborators.clear();
        userList.forEach(user => {
            if (user.userId !== this.userId) {
                this.collaborators.set(user.userId, {
                    id: user.userId,
                    name: user.userName,
                    color: this.getRandomColor()
                });
            }
        });
        this.updateCollaboratorsList();
    }
    
    removeCollaborator(userId) {
        this.collaborators.delete(userId);
        this.updateCollaboratorsList();
        
        // ลบ cursor marker
        const cursorMarker = this.cursorMarkers.get(userId);
        if (cursorMarker) {
            map.removeLayer(cursorMarker);
            this.cursorMarkers.delete(userId);
        }
    }
    
    updateCollaboratorCursor(data) {
        // อัปเดตตำแหน่ง cursor ของผู้ร่วมงาน
        const cursorMarker = this.cursorMarkers.get(data.userId);
        if (cursorMarker && data.position) {
            cursorMarker.setLatLng([data.position.lat, data.position.lng]);
        }
    }
    
    syncData() {
        // ส่งข้อมูลการเปลี่ยนแปลงไปยัง server
        const data = {
            roomId: this.roomId,
            userId: this.userId,
            timestamp: Date.now(),
            cameras: cameras,
            racks: racks,
            rectOverlays: rectOverlays,
            cableLines: cableLines,
            cursor: this.getCursorPosition()
        };
        
        // ในที่นี้จะจำลองการส่งข้อมูล
        console.log('Syncing data:', data);
        
        // จำลองการรับข้อมูลจากผู้ร่วมงานคนอื่น
        this.simulateOtherUsers();
    }
    
    getCursorPosition() {
        // รับตำแหน่ง cursor ปัจจุบัน
        return {
            x: 0,
            y: 0,
            timestamp: Date.now()
        };
    }
    
    simulateOtherUsers() {
        // จำลองผู้ร่วมงานคนอื่น
        const fakeUsers = [
            { id: 'user_abc123', name: 'ผู้ใช้ A', color: '#ff0000' },
            { id: 'user_def456', name: 'ผู้ใช้ B', color: '#00ff00' }
        ];
        
        fakeUsers.forEach(user => {
            if (!this.collaborators.has(user.id)) {
                this.addCollaborator(user);
            }
        });
    }
    
    addCollaborator(user) {
        this.collaborators.set(user.id, user);
        this.updateCollaboratorsList();
        
        // สร้าง cursor marker สำหรับผู้ร่วมงาน
        const cursorMarker = L.circleMarker([0, 0], {
            radius: 5,
            color: user.color,
            fillColor: user.color,
            fillOpacity: 0.7
        }).addTo(map);
        
        this.cursorMarkers.set(user.id, cursorMarker);
        
        // แสดงข้อความต้อนรับ
        this.addChatMessage('ระบบ', `${user.name} เข้าร่วมห้องแล้ว`);
    }
    
    updateCollaboratorsList() {
        const list = document.getElementById('collaboratorsList');
        const count = document.getElementById('collaboratorCount');
        
        count.textContent = this.collaborators.size;
        
        list.innerHTML = '';
        this.collaborators.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.style.cssText = `
                padding: 5px;
                margin: 2px 0;
                background: ${user.color}20;
                border-left: 3px solid ${user.color};
                border-radius: 3px;
            `;
            userDiv.textContent = user.name;
            list.appendChild(userDiv);
        });
    }
    
    updateConnectionStatus() {
        const status = document.getElementById('connectionStatus');
        if (this.isConnected) {
            status.textContent = 'เชื่อมต่อแล้ว';
            status.style.color = '#28a745';
        } else {
            status.textContent = 'ไม่เชื่อมต่อ';
            status.style.color = '#dc3545';
        }
    }
    
    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (message && this.socket && this.isConnected) {
            this.addChatMessage('คุณ', message);
            input.value = '';
            
            // ส่งข้อความไปยัง server
            this.socket.emit('chatMessage', {
                roomId: this.roomId,
                message: message,
                userName: this.userName
            });
        }
    }
    
    addChatMessage(sender, message) {
        const chatDiv = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            margin: 5px 0;
            padding: 5px;
            background: white;
            border-radius: 3px;
            font-size: 12px;
        `;
        
        const time = new Date().toLocaleTimeString();
        messageDiv.innerHTML = `
            <strong style="color: #007bff;">${sender}</strong> 
            <span style="color: #666; font-size: 10px;">${time}</span><br>
            ${message}
        `;
        
        chatDiv.appendChild(messageDiv);
        chatDiv.scrollTop = chatDiv.scrollHeight;
        
        this.chatMessages.push({ sender, message, time });
    }
    
    showNotification(message, type = 'info') {
        // ใช้ฟังก์ชัน showNotification ที่มีอยู่แล้ว
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
    
    // ฟังก์ชันสำหรับการทำงานร่วมกันกับแผนที่
    syncMapChanges() {
        // ตรวจจับการเปลี่ยนแปลงในแผนที่
        const originalAddCamera = window.addCamera;
        const originalAddRack = window.addRackMode;
        
        // Override ฟังก์ชันเพื่อส่งข้อมูลการเปลี่ยนแปลง
        window.addCamera = function(latlng) {
            originalAddCamera(latlng);
            if (window.collaborativeCCTV) {
                window.collaborativeCCTV.syncData();
            }
        };
        
        window.addRackMode = function() {
            originalAddRack();
            if (window.collaborativeCCTV) {
                window.collaborativeCCTV.syncData();
            }
        };
    }
}

// เริ่มต้นระบบ collaboration เมื่อโหลดหน้าเสร็จ
// ปิดการใช้งานชั่วคราวเพื่อแก้ปัญหา Socket.IO
// document.addEventListener('DOMContentLoaded', () => {
//     window.collaborativeCCTV = new CollaborativeCCTV();
// });

// แสดงข้อความแจ้งเตือน
console.log('Collaboration feature is temporarily disabled due to Socket.IO server issues.');
