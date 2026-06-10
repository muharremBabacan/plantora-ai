# -*- coding: utf-8 -*-
import os
import base64
from flask import Blueprint, request, jsonify
import json
import urllib.request
import urllib.error

analysis_bp = Blueprint('analysis', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def encode_image(file_storage):
    """Encode Werkzeug file storage to base64 string."""
    image_bytes = file_storage.read()
    # Reset read pointer in case we need it again
    file_storage.seek(0)
    return base64.b64encode(image_bytes).decode('utf-8')

@analysis_bp.route('/analyze', methods=['POST'])
def analyze_plant():
    """
    Accepts a plant image file and performs AI-based species and health analysis.
    If GEMINI_API_KEY is configured, queries Google Gemini 1.5 Flash API.
    Otherwise, returns high-fidelity mock data.
    """
    if 'file' not in request.files:
        return jsonify({"error": "Dosya yüklenmedi."}), 400
        
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "Geçersiz dosya adı."}), 400
        
    if not allowed_file(file.filename):
        return jsonify({"error": "Yalnızca PNG, JPG ve JPEG formatları desteklenmektedir."}), 400

    openai_key = os.environ.get("OPENAI_API_KEY", "")
    
    # --- PRODUCTION PATH (OpenAI GPT-4o-Mini API Entegrasyonu) ---
    if openai_key:
        try:
            base64_image = encode_image(file)
            
            # Determine mime type
            mime_type = "image/jpeg"
            ext = file.filename.rsplit('.', 1)[1].lower()
            if ext == "png":
                mime_type = "image/png"
            
            prompt = """
            Sana bir bitki fotoğrafı gönderiyorum. Lütfen bu bitkiyi analiz et.
            Yanıtı şu JSON şemasına uygun olarak ver:
            {
              "bitki": "Bitki Türü ismi (Türkçe)",
              "sağlık": 82, // Bitki genel sağlık durumu (0-100 arası tamsayı)
              "sorun": "Varsa bitkideki hastalık veya bakım sorunu (Örn: 'Yaprak uçlarında kuruma ve kahverengileşme', 'Şiddetli susuzluk belirtisi', 'Sağlıklı', 'Güneş yanığı lekeleri')",
              "yorum": "Bitkinin sağlık durumunu açıklayan kısa ve anlaşılır AI yorumu (Örn: 'Bu durum genellikle düşük nem veya düzensiz sulama ile ilişkilidir.')",
              "öneri": "Kullanıcıya özel kısa Türkçe sulama/bakım tavsiyesi veya önerilen çözüm (Örn: 'Toprağın üst kısmı kurudukça sulayın ve ortam nemini artırın.')"
            }
            """

            # OpenAI Chat Completions payload
            url = "https://api.openai.com/v1/chat/completions"
            data_url = f"data:{mime_type};base64,{base64_image}"
            
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": data_url
                                }
                            }
                        ]
                    }
                ],
                "response_format": {"type": "json_object"}
            }

            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {openai_key}'
                },
                method='POST'
            )

            # Bypass local CA verify constraints on Windows
            import ssl
            context = ssl._create_unverified_context()

            with urllib.request.urlopen(req, context=context) as response:
                res_data = response.read().decode('utf-8')
                res_json = json.loads(res_data)
                
                # Extract the text content from OpenAI response structure
                text_content = res_json['choices'][0]['message']['content']
                analysis_result = json.loads(text_content)
                
                return jsonify(analysis_result), 200

        except Exception as e:
            # Fallback to mock if API call fails
            return jsonify({
                "warning": f"OpenAI API Analiz Hatası ({str(e)}), simüle veriye yönlendirildi.",
                "bitki": "Monstera",
                "sağlık": 58,
                "sorun": "Yaprak sararması (Aşırı sulama riski)",
                "yorum": "Deve tabanı yapraklarındaki sararma, toprağın çok nemli kalıp köklerin havasız kalmasından kaynaklanır.",
                "öneri": "Sulamayı en az 7 gün durdurun, toprağın kurumasını bekleyin."
            }), 200

    # --- DEVELOPMENT PATH (Simüle Mock Veri) ---
    else:
        # Generate dynamic mock based on uploaded filename keywords
        filename_lower = file.filename.lower()
        if 'aloe' in filename_lower:
            mock_data = {
                "bitki": "Aloe Vera",
                "sağlık": 72,
                "sorun": "Yaprakta kahverengi lekeler (Güneş yanığı)",
                "yorum": "Aloe vera doğrudan güneş ışığına maruz kaldığında yapraklarında güneş yanığı lekeleri oluşabilir.",
                "öneri": "Bitkiyi doğrudan öğle güneşinden koruyun ve yarı gölge bir konuma taşıyın."
            }
        elif 'lily' in filename_lower or 'baris' in filename_lower:
            mock_data = {
                "bitki": "Barış Çiçeği",
                "sağlık": 35,
                "sorun": "Yapraklarda sarkma ve solma (Şiddetli susuzluk)",
                "yorum": "Barış çiçeği toprağındaki nem tamamen bittiğinde yapraklarını salarak su ihtiyacını belli eder.",
                "öneri": "Hemen saksı altından su süzülene kadar derin sulama yapın ve yapraklarına nem spreyi sıkın."
            }
        elif 'ficus' in filename_lower or 'keman' in filename_lower:
            mock_data = {
                "bitki": "Keman Yapraklı İncir",
                "sağlık": 95,
                "sorun": "Belirgin bir sorun yok (Sağlıklı)",
                "yorum": "Bitkinizin gelişimi gayet dengeli ve yaprakları sağlıklı görünmektedir.",
                "öneri": "Mevcut düzeni sürdürün ve yaprakların tozunu nemli bezle silin."
            }
        else:
            # Default fallback mock (Monstera)
            mock_data = {
                "bitki": "Monstera",
                "sağlık": 58,
                "sorun": "Yaprak sararması (Aşırı sulama riski)",
                "yorum": "Deve tabanı yapraklarındaki sararma, toprağın çok nemli kalıp köklerin havasız kalmasından kaynaklanır.",
                "öneri": "Sulamayı azaltın ve toprağın kurumasını bekleyin."
            }
            
        return jsonify(mock_data), 200
