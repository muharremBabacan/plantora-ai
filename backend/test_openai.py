# -*- coding: utf-8 -*-
import os
import json
import urllib.request
import urllib.error
import ssl

def test_api():
    env_path = '.env'
    openai_key = ""
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                if 'OPENAI_API_KEY' in line:
                    openai_key = line.split('=', 1)[1].strip().strip('"').strip("'")
                    
    if not openai_key:
        print("DURUM: .env dosyasında OPENAI_API_KEY bulunamadı!")
        return

    print("--- DOĞRULAMA KONTROLLERİ ---")
    print(f"Format Kontrolü (sk- ile mi başlıyor?): {'EVET' if openai_key.startswith('sk-') else 'HAYIR'}")
    print(f"Anahtar Karakter Uzunluğu: {len(openai_key)}")
    
    print("\nOpenAI API'ye bağlantı kuruluyor (gpt-4o-mini + SSL Bypass Aktif)...")
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": "Hello, respond with one word: Active"}]
    }
    
    context = ssl._create_unverified_context()
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {openai_key}'
            },
            method='POST'
        )
        with urllib.request.urlopen(req, context=context) as response:
            res_data = response.read().decode('utf-8')
            res_json = json.loads(res_data)
            text = res_json['choices'][0]['message']['content']
            print(f"OpenAI Sunucu Yanıtı: {text.strip()}")
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
