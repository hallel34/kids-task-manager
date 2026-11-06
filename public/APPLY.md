# שלב 1 — הוחל על הריפו האמיתי (kids-task-manager)

מחליף את החבילה הקודמת (kids-app-stage1) שהייתה מבוססת על עותק הדמו הציבורי.
השינויים הוחלו ישירות על שיבוט של הריפו האמיתי, הותאמו לקוד האמיתי
(גילאים מחושבים מתאריכי לידה, צבעי הילדים האמיתיים), ועברו בדיקה:
`tsc --noEmit` נקי (מלבד שגיאת @vercel/node קיימת ב־api/tts.ts) ו־`vite build` עובר.

## מה השתנה (5 קבצים, ‎+172/−2)

- `src/cloudStorage.ts` — loadFamilyConfigFromCloud / saveFamilyConfigToCloud מול
  `families/{code}/config/current`; טיפוס CloudFamilyConfig עם `birthdate` אופציונלי לכל ילד.
- `src/App.tsx` — שער קונפיג: כשהסנכרון פעיל ויש קוד משפחה, הקונפיג נטען מהענן
  לפני שהאפליקציה עולה ומוזן דרך אותו `familyData` prop של מסלול ה־Auth.
  גיל אפקטיבי מחושב מ־birthdate כשקיים. אין קונפיג → ברירות המחדל המקומפלות, בדיוק כמו היום.
- `src/data/tasksData.ts` — defaultScreenTimeReward(age): תעריפי ברירת מחדל לפי גיל,
  זהים לערכי SCREEN_TIME_REWARD הנוכחיים.
- `src/useAuth.ts` — שדה `birthdate?` אופציונלי ב־FamilyChild (שורה אחת).
- `firestore.rules` — match ל־`config/current`: קריאה פתוחה; כתיבה מאומתת־צורה בלבד.

רשימות המשימות אינן בקונפיג — הן נגזרות מגיל הילד מהתבניות ב־tasksData.ts.

## איך להחיל (אחת מהדרכים)

אפשרות א' — החלת הפאץ':
```
git apply stage1-real.patch
```
אפשרות ב' — החלפת קבצים: העתק את 5 הקבצים מתיקיית `files/` לנתיבים המקבילים בריפו.

## אחרי ההחלה

1. commit + push (Vercel יבנה ויפרסם אוטומטית אם מחובר לריפו).
2. פריסת חוקי Firestore:
   ```
   npx firebase-tools deploy --only firestore:rules
   ```
   או הדבקת תוכן firestore.rules בקונסול של Firebase.
3. הודע לאסי — הוא יזרע את קונפיג משפחת לוי (מוכן, עם תאריכי הלידה והצבעים
   האמיתיים) ויוודא שהאפליקציה החיה עולה ממנו.
