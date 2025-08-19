# การแก้ไขปัญหา CCTV Planner

## ปัญหาที่พบบ่อย

### 1. ไฟล์ JavaScript ไม่โหลด (404 Error)

**อาการ**: 
```
Failed to load resource: the server responded with a status of 404 ()
```

**วิธีแก้ไข**:

1. **ตรวจสอบไฟล์**:
   ```bash
   ls -la
   # ต้องมีไฟล์เหล่านี้:
   # - index.htm
   # - cctv.js
   # - collaborative.js
   ```

2. **ตรวจสอบ URL**:
   - ใช้ `./cctv.js` แทน `cctv.js`
   - ตรวจสอบว่าไฟล์อยู่ในโฟลเดอร์เดียวกัน

3. **ตั้งค่า Server**:
   - Apache: ใช้ `.htaccess` หรือ `.htaccess-subdir`
   - IIS: ใช้ `web.config`
   - Nginx: ใช้ `nginx.conf`

4. **ทดสอบ MIME Type**:
   - เปิดไฟล์ `test-mime.html` เพื่อทดสอบ
   - ตรวจสอบ Content-Type ของไฟล์ JavaScript

### 2. MIME Type Error

**อาการ**:
```
Refused to execute script because its MIME type ('text/html') is not executable
```

**วิธีแก้ไข**:

1. **Apache (.htaccess)**:
   ```apache
   AddType application/javascript .js
   <FilesMatch "\.js$">
       Header set Content-Type "application/javascript"
   </FilesMatch>
   ```

2. **IIS (web.config)**:
   ```xml
   <mimeMap fileExtension=".js" mimeType="application/javascript" />
   ```

3. **Nginx (nginx.conf)**:
   ```nginx
   location ~* \.js$ {
       add_header Content-Type "application/javascript";
   }
   ```

### 3. ภาษาไทยแสดงผิด

**อาการ**: ตัวอักษรภาษาไทยแสดงเป็นเครื่องหมายคำถาม

**วิธีแก้ไข**:

1. **เพิ่ม meta charset**:
   ```html
   <meta charset="UTF-8">
   ```

2. **ตั้งค่า Server**:
   ```apache
   AddDefaultCharset UTF-8
   ```

3. **ตรวจสอบไฟล์ encoding**: ต้องเป็น UTF-8

### 4. Google Maps ไม่แสดง

**อาการ**: แผนที่ไม่แสดงหรือแสดง error

**วิธีแก้ไข**:

1. **ใช้ OpenStreetMap แทน**:
   - ไม่ต้องใช้ API Key
   - ทำงานได้ทันที

2. **ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต**

3. **ตรวจสอบ Console errors**

### 5. Collaboration ไม่ทำงาน

**อาการ**: ระบบการทำงานร่วมกันไม่เชื่อมต่อ

**วิธีแก้ไข**:

1. **ตรวจสอบ Server**:
   ```bash
   npm start
   ```

2. **ตรวจสอบ Socket.IO**:
   - เปิด Console (F12)
   - ดู error messages

3. **ตรวจสอบ Firewall**:
   - เปิด port 3000

## การ Debug

### 1. เปิด Developer Tools
- กด F12
- ไปที่ Console tab
- ดู error messages

### 2. ตรวจสอบ Network
- ไปที่ Network tab
- ดูไฟล์ที่โหลดไม่ได้

### 3. ตรวจสอบ Sources
- ไปที่ Sources tab
- ตรวจสอบไฟล์ JavaScript

## การทดสอบ

### 1. ทดสอบไฟล์พื้นฐาน
```bash
# เปิดไฟล์ test.html
http://localhost:3000/cctv/test.html

# เปิดไฟล์ test-mime.html เพื่อทดสอบ MIME Type
http://localhost:3000/cctv/test-mime.html
```

### 2. ทดสอบ API
```bash
# ตรวจสอบ server status
curl http://localhost:3000/health
```

### 3. ทดสอบ Collaboration
- เปิด 2 browser tabs
- เข้าร่วมห้องเดียวกัน
- ทดสอบการแชท

## การติดต่อ Support

หากยังแก้ไขไม่ได้:

1. **เก็บข้อมูล**:
   - Screenshot ของ error
   - Console log
   - Browser version
   - OS version

2. **รายงานปัญหา**:
   - อธิบายอาการที่เกิดขึ้น
   - ขั้นตอนที่ทำ
   - ผลลัพธ์ที่ได้

## คำแนะนำเพิ่มเติม

1. **ใช้ HTTPS ใน Production**
2. **ตั้งค่า CORS ให้ถูกต้อง**
3. **ใช้ CDN สำหรับ libraries**
4. **ทำ backup ข้อมูล**
5. **อัปเดต dependencies เป็นประจำ**
