# أمان رُشد

## Firebase Web Client Config

القيمة الموجودة في `src/lib/firebase.ts` هي إعداد عميل Firebase للويب وليست Service Account أو مفتاحًا خاصًا. تطبيقات Firebase المنشورة ترسل هذه القيم للمتصفح بالضرورة، بينما الحماية الفعلية للبيانات تعتمد على Firebase Authentication وقواعد Cloud Firestore الموجودة في `firestore.rules`.

يدعم التطبيق متغيرات `VITE_FIREBASE_*` ويستخدمها عند اكتمالها. أبقينا Client Config العام كخيار احتياطي حتى لا يتوقف نشر Vercel القائم قبل نقل القيم إلى إعدادات المشروع. تنبيه GitHub Secret Scanning يجب إغلاقه باعتباره مفتاح عميل عامًا بعد التحقق من القيود أدناه؛ لا حاجة لتدويره لمجرد ظهوره في كود الويب.

لا يجب أبدًا إضافة أي من التالي إلى المستودع:

- Service Account JSON.
- Private key أو `FIREBASE_TOKEN`.
- مفاتيح إدارة Firebase أو Google Cloud.

## قيود Google Cloud المطلوبة

يجب تقييد Web API Key باستخدام HTTP referrers للنطاقات المستخدمة فقط:

- `https://rushd-app-nine.vercel.app/*`
- `https://rushd-app-git-release-sprint-0-6f5887-hamza00555-3384s-projects.vercel.app/*`
- `http://localhost:*/*` للتطوير عند الحاجة فقط.

وقصر API restrictions على الخدمات التي يستخدمها التطبيق، وأهمها Identity Toolkit وToken Service وCloud Firestore.

## Firebase Authentication Authorized Domains

احتفظ فقط بالنطاقات اللازمة لتسجيل الدخول:

- `rushd-app-fd5a8.firebaseapp.com`
- `rushd-app-nine.vercel.app`
- نطاق المعاينة الثابت أعلاه عند اختباره.
- `localhost` للتطوير المحلي فقط.

تم فحص إعداد المشروع عبر Firebase يوم 22 يوليو 2026. النطاقات المسجلة وقت الفحص كانت `localhost` و`rushd-app-fd5a8.firebaseapp.com` و`rushd-app-fd5a8.web.app` فقط؛ لذلك إضافة نطاق الإنتاج ونطاق المعاينة أعلاه بوابة إلزامية قبل الإطلاق العام. قيود HTTP referrer وAPI restrictions لا يمكن قراءتها عبر إعداد العميل العام ويجب تأكيدها من Google Cloud Console بواسطة مالك المشروع.

## فصل البيانات

- كل ما يقع تحت `users/{uid}` ومجموعاته الفرعية خاص بصاحب الحساب.
- خطط الأشهر والمعاملات والمحافظ والأهداف وسيناريوهات الترقية لا يقرأها أفراد العائلة.
- المشاركة تقع تحت `households/{householdId}` وتخضع لصلاحيات `view` و`edit` و`none`.
- الاختبار الحي ينشئ حسابات مؤقتة ويتحقق من العزل ثم ينظف بياناته.
