const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.analyzePlant = onRequest(
  { cors: true, secrets: ["PLANTORA_OPENAI_KEY"] },
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

      // Prepare the image payload for OpenAI (expects a data URL)
      const dataUrl = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;

      const openAIKey = process.env.PLANTORA_OPENAI_KEY;
      if (!openAIKey) {
        throw new Error("PLANTORA_OPENAI_KEY environment variable is not configured.");
      }

      const url = "https://api.openai.com/v1/chat/completions";

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
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAIKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`OpenAI API returned status ${response.status}`);
      }

      const resData = await response.json();
      const textContent = resData.choices[0].message.content;
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
        warning: `OpenAI API Analiz Hatası (${error.message}), simüle veriye yönlendirildi.`,
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
