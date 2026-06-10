# -*- coding: utf-8 -*-
import os
import json
import urllib.request
import urllib.error
import ssl

def test_api():
    env_path = '.env'
    gemini_key = ""
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                if 'GEMINI_API_KEY' in line:
                    gemini_key = line.split('=', 1)[1].strip().strip('"').strip("'")
                    
    if not gemini_key:
        print("DURUM: .env dosyasında GEMINI_API_KEY bulunamadı!")
        return

    print("--- DOĞRULAMA KONTROLLERİ ---")
    print(f"Format Kontrolü (AIzaSy ile mi başlıyor?): {'EVET' if gemini_key.startswith('AIzaSy') else 'HAYIR'}")
    print(f"Anahtar Karakter Uzunluğu: {len(gemini_key)}")
    
    # Using gemini-2.5-flash
    print("\nGoogle Gemini API'ye bağlantı kuruluyor (gemini-2.5-flash + SSL Bypass Aktif)...")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    payload = {
        "contents": [{"parts": [{"text": "Hello, respond with one word: Active"}]}]
    }
    
    context = ssl._create_unverified_context()
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, context=context) as response:
            res_data = response.read().decode('utf-8')
            res_json = json.loads(res_data)
            text = res_json['candidates'][0]['content']['parts'][0]['text']
            print(f"Google Sunucu Yanıtı: {text.strip()}")
            print("\nDURUM: BASARILI (API Anahtari Gecerli ve Calisiyor!)")
    except urllib.error.HTTPError as e:
        print(f"\nDURUM: HATA (API Anahtarı Geçersiz!) - HTTP Kod: {e.code}")
        try:
            error_details = json.loads(e.read().decode('utf-8'))
            print(f"Hata Açıklaması: {error_details['error']['message']}")
        except Exception:
            pass
    except Exception as e:
        print(f"\nDURUM: HATA (Bağlantı Kurulamadı!) - {str(e)}")

if __name__ == '__main__':
    test_api()
