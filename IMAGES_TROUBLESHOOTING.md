# تشخيص مشكلة الصور

## المشاكل الشائعة وحلولها:

### 1️⃣ الصور موجودة لكن لا تظهر

**السبب:** المسار نسبي ولا يعمل في Electron

**الحل:**
```javascript
// في Products.jsx تم إضافة:
const imageUrl = product.image 
  ? (product.image.startsWith('http') || product.image.startsWith('data:') 
      ? product.image 
      : `file://${product.image}`)
  : null;
```

هذا يحول المسارات النسبية إلى مسارات مطلقة `file://`

### 2️⃣ الصور في قاعدة البيانات فارغة (NULL)

**التحقق:**
```javascript
// في browser console:
// اذهب إلى Network tab وشوف الـ response من getProducts
// ابحث عن حقل "image" - هل قيمته null؟
```

**الحل - إضافة صور:**
- استخدم Modal إضافة المنتج لرفع صورة
- أو حدّث البيانات يدوياً في قاعدة البيانات

### 3️⃣ مشاكل الأمان (CORS/CSP)

**إذا كانت الصور في مجلد محلي:**

تأكد من أن `package.json` يحتوي على:
```json
{
  "build": {
    "files": [
      "dist/**/*",
      "node_modules/**/*",
      "path/to/images/**/*"  // أضف مسار الصور
    ]
  }
}
```

### 4️⃣ تعطل الصور

إذا حدث خطأ تحميل الصورة، يظهر الـ fallback (أيقونة Package).

**التحقق من الأخطاء:**
```javascript
// أفتح Developer Tools (F12)
// اذهب لـ Console tab
// شوف إذا فيه أخطاء تحميل صور
```

## خطوات التشخيص:

### Step 1: تحقق من البيانات
```sql
SELECT id, name, image FROM "Product" LIMIT 10;
```

إذا كانت column `image` فارغة (NULL)، لا توجد صور.

### Step 2: تحقق من نوع المسار
```javascript
// اذهب إلى Network tab في F12
// Filter: XHR/Fetch
// ابحث عن getProducts
// شوف الـ response → products → [0] → image

// نموذج مسار صحيح:
// "/path/to/images/product1.jpg"          // نسبي
// "C:\\Users\\...\\images\\product1.jpg"  // مطلق (Windows)
// "file:///path/to/images/product1.jpg"   // مطلق محلي
// "http://..."                             // URL
// "data:image/png;base64,..."              // Base64
```

### Step 3: اختبر عرض الصورة

```javascript
// في console:
const testImg = new Image();
testImg.src = "file:///path/to/your/image.jpg";
testImg.onload = () => console.log("✅ الصورة تحميل بنجاح");
testImg.onerror = () => console.log("❌ خطأ في تحميل الصورة");
```

## الحل الفوري:

إذا كنت تريد اختبار الصور فوراً:

### استخدم Base64:
```javascript
// في db-service.js، عدّل getProducts ليحول الصور إلى Base64:
// (غالي الأداء لكن يعمل 100%)
```

### أو استخدم URL عام:
```javascript
// مثال: رفع الصور إلى image hosting service
// ثم حفظ الـ URL الكامل في database
```

## الحل الأمثل:

1. **حفظ الصور في مجلد ثابت:**
   ```
   /app/resources/images/
   ```

2. **حفظ مسار نسبي في DB:**
   ```javascript
   product.image = "/images/product-123.jpg"
   ```

3. **خدم الصور عبر Electron preload:**
   ```javascript
   // في preload.js:
   if (url.startsWith('/images/')) {
     return path.join(__dirname, '..', url);
   }
   ```

---

**الآن تم إصلاح:**
- ✅ معالجة المسارات المحلية
- ✅ Fallback مناسب عند فشل التحميل
- ✅ دعم جميع أنواع المسارات (http, file://, data:, نسبي)

