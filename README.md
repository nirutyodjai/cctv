# CCTV Planner - เครื่องมือวางแผนระบบกล้องวงจรปิด

เครื่องมือสำหรับวางแผนและออกแบบระบบกล้องวงจรปิด (CCTV) แบบครบวงจร พร้อมระบบคำนวณค่าใช้จ่ายและการจัดการอุปกรณ์

## 🚀 การแก้ไขล่าสุด (Latest Fix)

### ปัญหา: "เพิ่มอุปกรณ์ไม่ได้" (Cannot add devices)
**สาเหตุ:** JavaScript พยายามเข้าถึง DOM elements ก่อนที่ HTML จะโหลดเสร็จ

**การแก้ไข:**
1. ย้าย `toolsEl` initialization ไปอยู่ใน `initializeToolsPanel()` function
2. ย้าย `init()` call ไปอยู่ใน `DOMContentLoaded` event listener
3. สร้างไฟล์ `test-fix.html` สำหรับทดสอบการแก้ไข

**ผลลัพธ์:** ตอนนี้สามารถเพิ่มอุปกรณ์ได้ทุกประเภท (กล้อง, ตู้ Rack, เสากล้อง)

## 📁 โครงสร้างไฟล์

```
cctv/
├── index.htm                 # หน้าหลักของแอปพลิเคชัน
├── cctv.js                   # JavaScript หลัก (แก้ไข DOM loading แล้ว)
├── collaborative.js          # ระบบทำงานร่วมกัน (ปิดใช้งาน)
├── test-fix.html            # ไฟล์ทดสอบการแก้ไข DOM loading
├── test-404.html            # ไฟล์ทดสอบ 404 errors
├── quick-fix-404.html       # ไฟล์แก้ไข 404 แบบรวดเร็ว
├── menu-redesign.html       # เมนูใหม่
├── quick-start.html         # หน้าเริ่มต้นด่วน
└── README.md                # คู่มือนี้
```

## 🛠️ การติดตั้งและใช้งาน

### วิธีที่ 1: ใช้ Python (แนะนำ)
```bash
cd cctv
python -m http.server 8000
```
เปิดเบราว์เซอร์ไปที่: `http://localhost:8000`

### วิธีที่ 2: ใช้ Node.js
```bash
cd cctv
npx http-server -p 8000
```

### วิธีที่ 3: ใช้ PHP
```bash
cd cctv
php -S localhost:8000
```

## 🎯 ฟีเจอร์หลัก

### 📹 ระบบกล้อง
- **กล้อง 3 ประเภท:** บูลเล็ต, โดม, PTZ
- **การหมุนกล้อง:** ลากเพื่อปรับมุมมอง
- **การคำนวณ:** ระยะการมองเห็น, พื้นที่ครอบคลุม
- **SVG Icons:** ไอคอนเฉพาะสำหรับแต่ละประเภท

### 🏗️ อุปกรณ์สนับสนุน
- **ตู้ Rack:** 6U, 9U, 12U, 18U, 27U, 42U
- **เสากล้อง:** สำหรับติดตั้งกล้องกลางแจ้ง
- **ระบบสายเคเบิล:** UTP, Fiber, Coaxial
- **ท่อร้อยสาย:** PVC, Metal, Flexible

### 💰 ระบบคำนวณค่าใช้จ่าย
- ราคากล้องตามประเภทและความละเอียด
- ราคาตู้ Rack ตามขนาด
- ราคาสายเคเบิลและท่อ
- ค่าแรงติดตั้ง
- สรุปค่าใช้จ่ายรวม

### 🗺️ แผนที่และการค้นหา
- **OpenStreetMap:** ไม่ต้องใช้ API Key
- **การค้นหาสถานที่:** ใช้ Nominatim Geocoder
- **การวาดพื้นที่:** สร้างโพลีกอนพื้นที่งาน

## 🔧 การแก้ไขปัญหา

### ปัญหาที่แก้ไขแล้ว:
1. ✅ **DOM Loading:** แก้ไขปัญหา "เพิ่มอุปกรณ์ไม่ได้"
2. ✅ **404 Errors:** แก้ไขปัญหาไฟล์ไม่พบ
3. ✅ **MIME Types:** แก้ไขปัญหา JavaScript ไม่ทำงาน
4. ✅ **Google Maps:** เปลี่ยนเป็น OpenStreetMap
5. ✅ **Camera Icons:** แก้ไขไอคอนกล้อง
6. ✅ **Camera Rotation:** เพิ่มการหมุนกล้อง
7. ✅ **Cable System:** เพิ่มระบบสายเคเบิล

### ไฟล์ทดสอบ:
- `test-fix.html` - ทดสอบการแก้ไข DOM loading
- `test-404.html` - ทดสอบ 404 errors
- `quick-fix-404.html` - แก้ไข 404 แบบรวดเร็ว

## 🌐 การ Deploy

### สำหรับ Apache (.htaccess)
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.htm [L]

AddType application/javascript .js
AddType text/css .css
AddType text/html .htm .html
```

### สำหรับ IIS (web.config)
```xml
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="index.htm" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

## 📞 การสนับสนุน

หากพบปัญหา:
1. เปิด `test-fix.html` เพื่อทดสอบการแก้ไข
2. เปิด `quick-fix-404.html` หากมีปัญหา 404
3. ตรวจสอบ Console ใน Developer Tools
4. อ่านคู่มือการแก้ไขปัญหาในไฟล์นี้

## 🔄 การอัปเดต

เวอร์ชันล่าสุด: **v2.1**
- แก้ไขปัญหา DOM loading
- เพิ่มระบบทดสอบ
- ปรับปรุง UI/UX
- เพิ่มระบบสายเคเบิล

---

**หมายเหตุ:** โปรเจคนี้ใช้ OpenStreetMap แทน Google Maps เพื่อไม่ต้องใช้ API Key และลดค่าใช้จ่าย
