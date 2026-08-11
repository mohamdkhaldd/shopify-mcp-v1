import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    // بيولّد service worker بيخزّن نسخة من التطبيق جوه الموبايل نفسه أول
    // مرة تفتحه وانت متصل بالنت — من ساعتها التطبيق بيفتح ويشتغل من غير
    // نت خالص، حتى لو قفلت النت أو مسحته من الخلفية، لحد ما يظهر تحديث
    // جديد (وقتها بيتحمّل في الخلفية ويتفعّل المرة الجاية اللي تفتحه فيها).
    VitePWA({
      registerType: "autoUpdate",
      // بنسجّل الـ service worker يدويًا في main.tsx (بدل السكريبت الجاهز
      // اللي بيتحط تلقائي) عشان نقدر نستخدم registerSW({ immediate: true })
      // اللي بيتأكد إن أي تحديث جديد يتفعّل ويعمل reload للصفحة فورًا، بدل
      // ما يفضل التطبيق شغال بالكود القديم لحد ما حد يقفله ويفتحه من الأول.
      injectRegister: false,
      includeAssets: ["logo.png"],
      manifest: false, // بنستخدم public/manifest.json الجاهز بدل ما نولّده تاني
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,woff,woff2}"],
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
});
