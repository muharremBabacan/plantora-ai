const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.analyzePlant = onRequest(
  { cors: true },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    try {
      const { image, userId, plantId } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Resim verisi bulunamadı." });
      }

      // Extract raw base64 data and mime type
      let base64Data = image;
      let mimeType = "image/jpeg";

      if (image.startsWith("data:")) {
        const parts = image.split(",");
        base64Data = parts[1];
        const mimePart = parts[0].split(";")[0];
        mimeType = mimePart.substring(5); // strip "data:"
      }

      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not configured.");
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

      const prompt = `
      Sana bir bitki fotoğrafı gönderiyorum. Lütfen bu bitkiyi analiz et.
      Yanıtı şu JSON şemasına uygun olarak ver:
      {
        "bitki": "Bitki Türü ismi (Türkçe)",
        "sağlık": 82, // Bitki genel sağlık durumu (0-100 arası tamsayı)
        "sorun": "Varsa bitkideki hastalık veya bakım sorunu (Örn: 'Yaprak uçlarında kuruma ve kahverengileşme', 'Şiddetli susuzluk belirtisi', 'Sağlıklı', 'Güneş yanığı lekeleri')",
        "yorum": "Bitkinin sağlık durumunu açıklayan kısa ve anlaşılır AI yorumu (Örn: 'Bu durum genellikle düşük nem veya düzensiz sulama ile ilişkilidir.')",
        "öneri": "Kullanıcıya özel kısa Türkçe sulama/bakım tavsiyesi veya önerilen çözüm (Örn: 'Toprağın üst kısmı kurudukça sulayın ve ortam nemini artırın.')"
      }
      `;

      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              bitki: { type: "STRING" },
              sağlık: { type: "INTEGER" },
              sorun: { type: "STRING" },
              yorum: { type: "STRING" },
              öneri: { type: "STRING" }
            },
            required: ["bitki", "sağlık", "sorun", "yorum", "öneri"]
          }
        }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const resData = await response.json();
      const textContent = resData.candidates[0].content.parts[0].text;
      const analysisResult = JSON.parse(textContent);

      // If userId and plantId are provided, save to Firestore
      if (userId && plantId) {
        const db = admin.firestore();
        const dateStr = getFormattedDate();
        const reportId = "rep_" + Date.now();

        const reportRef = db.collection("users").doc(userId)
          .collection("plants").doc(plantId)
          .collection("reports").doc(reportId);

        const newReport = {
          id: reportId,
          date: dateStr,
          sağlık: Number(analysisResult.sağlık) || 80,
          sorun: analysisResult.sorun || "Bilinmiyor",
          yorum: analysisResult.yorum || "",
          öneri: analysisResult.öneri || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await reportRef.set(newReport);

        const plantRef = db.collection("users").doc(userId)
          .collection("plants").doc(plantId);

        await plantRef.set({
          sağlık: newReport.sağlık,
          sorun: newReport.sorun,
          yorum: newReport.yorum,
          öneri: newReport.öneri,
          needsWater: newReport.sağlık < 85 && !newReport.sorun.includes("Fazla sulama"),
          lastWateredAt: newReport.sorun.includes("Fazla sulama") ? admin.firestore.FieldValue.serverTimestamp() : null
        }, { merge: true });

        analysisResult.reportId = reportId;
        analysisResult.date = dateStr;
      }

      return res.status(200).json(analysisResult);

    } catch (error) {
      console.error("Error analyzing plant:", error);
      return res.status(200).json({
        warning: `Gemini API Analiz Hatası (${error.message}), simüle veriye yönlendirildi.`,
        bitki: "Monstera",
        sağlık: 58,
        sorun: "Yaprak sararması (Aşırı sulama riski)",
        yorum: "Deve tabanı yapraklarındaki sararma, toprağın çok nemli kalıp köklerin havasız kalmasından kaynaklanır.",
        öneri: "Sulamayı en az 7 gün durdurun, toprağın kurumasını bekleyin."
      });
    }
  }
);

function getFormattedDate() {
  const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const now = new Date();
  return `${now.getDate()} ${months[now.getMonth()]}`;
}
