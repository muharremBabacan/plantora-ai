import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:convert';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import '../providers/garden_provider.dart';
import '../models/plant.dart';
import 'detail_screen.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  bool _isScanning = false;
  String _scanStatusText = "";
  Map<String, dynamic>? _scanResult;
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 1200,
        maxHeight: 1200,
        imageQuality: 80,
      );

      if (pickedFile != null) {
        final bytes = await pickedFile.readAsBytes();
        final base64Image = base64Encode(bytes);
        _startRealScan(base64Image);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Görsel seçilemedi: $e")),
      );
    }
  }

  Future<void> _startRealScan(String base64Image) async {
    setState(() {
      _isScanning = true;
      _scanStatusText = "Görsel hazırlanıyor...";
      _scanResult = null;
    });

    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _scanStatusText = "Canlı sunucuya gönderiliyor...");
    });
    Future.delayed(const Duration(milliseconds: 1200), () {
      if (mounted) setState(() => _scanStatusText = "Gemini modelleri çalıştırılıyor...");
    });

    try {
      final response = await http.post(
        Uri.parse('https://us-central1-plantora-ai-002.cloudfunctions.net/analyzePlant'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'image': 'data:image/jpeg;base64,$base64Image',
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (mounted) {
          setState(() {
            _isScanning = false;
            _scanResult = {
              'bitki': data['bitki'] ?? 'Bilinmeyen Bitki',
              'sağlık': data['sağlık'] ?? 80,
              'sorun': data['sorun'] ?? 'Teşhis edilemedi',
              'yorum': data['yorum'] ?? '',
              'öneri': data['öneri'] ?? '',
              'waterFrequencyDays': 7,
            };
          });
        }
      } else {
        throw Exception("Sunucu hatası: ${response.statusCode}");
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isScanning = false;
          _scanStatusText = "";
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Analiz başarısız: $e")),
        );
      }
    }
  }

  // Presets using the updated 5-key JSON format
  final List<Map<String, dynamic>> _presets = [
    {
      'id': 'monstera',
      'name': 'Deve Tabanı (Sararma)',
      'bitki': 'Monstera',
      'sağlık': 58,
      'sorun': 'Yaprak sararması (Aşırı sulama riski)',
      'yorum': 'Deve tabanı yapraklarındaki sararma, toprağın çok nemli kalıp köklerin havasız kalmasından kaynaklanır.',
      'öneri': 'Sulamayı azaltın ve toprağın kurumasını bekleyin.',
      'waterFrequencyDays': 7
    },
    {
      'id': 'aloe',
      'name': 'Aloe Vera (Güneş Yanığı)',
      'bitki': 'Aloe Vera',
      'sağlık': 72,
      'sorun': 'Yaprakta kahverengi lekeler (Güneş yanığı)',
      'yorum': 'Aloe vera doğrudan güneş ışığına maruz kaldığında yapraklarında güneş yanığı lekeleri oluşabilir.',
      'öneri': 'Bitkiyi doğrudan öğle güneşinden koruyun ve yarı gölge bir konuma taşıyın.',
      'waterFrequencyDays': 14
    },
    {
      'id': 'lily',
      'name': 'Barış Çiçeği (Susuzluk)',
      'bitki': 'Barış Çiçeği',
      'sağlık': 35,
      'sorun': 'Yapraklarda sarkma ve solma (Şiddetli susuzluk)',
      'yorum': 'Barış çiçeği toprağındaki nem tamamen bittiğinde yapraklarını salarak su ihtiyacını belli eder.',
      'öneri': 'Hemen saksı altından su süzülene kadar derin sulama yapın ve yapraklarına nem spreyi sıkın.',
      'waterFrequencyDays': 4
    },
    {
      'id': 'ficus',
      'name': 'Keman Yapraklı İncir (Sağlıklı)',
      'bitki': 'Keman Yapraklı İncir',
      'sağlık': 95,
      'sorun': 'Belirgin bir sorun yok (Sağlıklı)',
      'yorum': 'Bitkinizin gelişimi gayet dengeli ve yaprakları sağlıklı görünmektedir.',
      'öneri': 'Mevcut düzeni sürdürün ve yaprakların tozunu nemli bezle silin.',
      'waterFrequencyDays': 10
    }
  ];

  Color _getHealthColor(int score) {
    if (score >= 85) return Colors.green;
    if (score < 60) return Colors.red;
    return Colors.orange;
  }

  String _getHealthLabel(int score) {
    if (score >= 85) return "🟢 İyi Durumda";
    if (score < 60) return "🔴 Acil Müdahale";
    return "🟡 Dikkat Gerek";
  }

  String _getFormattedDate() {
    final months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    final now = DateTime.now();
    return "${now.day} ${months[now.month - 1]}";
  }

  void _startScan(Map<String, dynamic> preset) {
    setState(() {
      _isScanning = true;
      _scanStatusText = "Görsel yükleniyor...";
      _scanResult = null;
    });

    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _scanStatusText = "Görüntü analiz ediliyor...");
    });
    Future.delayed(const Duration(milliseconds: 1200), () {
      if (mounted) setState(() => _scanStatusText = "JSON çıktısı hazırlanıyor...");
    });
    Future.delayed(const Duration(milliseconds: 2000), () {
      if (mounted) {
        setState(() {
          _isScanning = false;
          _scanResult = preset;
        });
      }
    });
  }

  void _saveOrAddResult() {
    if (_scanResult == null) return;
    
    final provider = Provider.of<GardenProvider>(context, listen: false);
    final isRescan = provider.activeRescanPlantId != null;

    if (isRescan) {
      final plantId = provider.activeRescanPlantId!;
      final plantIndex = provider.plants.indexWhere((p) => p.id == plantId);
      if (plantIndex == -1) return;

      final plant = provider.plants[plantIndex];
      final dateStr = _getFormattedDate();
      
      final newReport = AnalysisReport(
        id: 'rep_${DateTime.now().millisecondsSinceEpoch}',
        date: dateStr,
        saglik: _scanResult!['sağlık'] as int,
        sorun: _scanResult!['sorun'] as String,
        yorum: _scanResult!['yorum'] as String,
        oneri: _scanResult!['öneri'] as String,
      );

      provider.addAnalysisReport(plantId, newReport);
      provider.activeRescanPlantId = null;

      setState(() {
        _scanResult = null;
      });

      // Switch to Garden tab and push details page for this plant
      provider.currentTabIndex = 0;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => DetailScreen(plantId: plantId),
        ),
      );

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${plant.nickname} için yeni sağlık raporu başarıyla kaydedildi! 📋')),
      );
    } else {
      // Regular "Add to Garden" flow
      final bitki = _scanResult!['bitki'] as String;

      showDialog(
        context: context,
        builder: (context) {
          final textController = TextEditingController(text: bitki);
          return AlertDialog(
            title: const Text('Bahçeme Ekle'),
            content: TextField(
              controller: textController,
              decoration: const InputDecoration(
                labelText: 'Bitki Takma Adı',
                hintText: 'Örn: Monstera',
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('İptal'),
              ),
              ElevatedButton(
                onPressed: () {
                  final nickname = textController.text.trim().isEmpty 
                      ? bitki 
                      : textController.text.trim();
                  
                  final dateStr = _getFormattedDate();
                  
                  final initialReport = AnalysisReport(
                    id: 'rep_${DateTime.now().millisecondsSinceEpoch}',
                    date: dateStr,
                    saglik: _scanResult!['sağlık'] as int,
                    sorun: _scanResult!['sorun'] as String,
                    yorum: _scanResult!['yorum'] as String,
                    oneri: _scanResult!['öneri'] as String,
                  );

                  final newPlant = Plant(
                    id: 'plant_${DateTime.now().millisecondsSinceEpoch}',
                    nickname: nickname,
                    bitki: bitki,
                    imageUrl: null,
                    saglik: _scanResult!['sağlık'] as int,
                    sorun: _scanResult!['sorun'] as String,
                    yorum: _scanResult!['yorum'] as String,
                    oneri: _scanResult!['öneri'] as String,
                    waterFrequencyDays: _scanResult!['waterFrequencyDays'] as int,
                    lastWateredAt: DateTime.now(),
                    needsWater: _scanResult!['sağlık'] < 85 && !_scanResult!['sorun'].contains("Fazla sulama"),
                    addedDate: dateStr,
                    analyses: [initialReport],
                  );

                  provider.addPlant(newPlant);
                  Navigator.pop(context);
                  
                  setState(() {
                    _scanResult = null;
                  });
                  
                  provider.currentTabIndex = 0; // Navigate back to Garden tab

                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('$nickname bahçenize başarıyla eklendi! 🌿')),
                  );
                },
                style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                child: const Text('Ekle'),
              ),
            ],
          );
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<GardenProvider>(context);
    final isRescan = provider.activeRescanPlantId != null;
    String? rescanPlantName;
    if (isRescan) {
      final plant = provider.plants.firstWhere((p) => p.id == provider.activeRescanPlantId);
      rescanPlantName = plant.nickname;
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(isRescan ? 'Yeni Fotoğraf Tara' : 'Bitki Teşhisi'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Re-scan Banner Alert
            if (isRescan) ...[
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.green.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: Colors.green, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '📸 $rescanPlantName için yeni fotoğraf tarıyorsunuz.',
                        style: const TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 16, color: Colors.green),
                      onPressed: () {
                        provider.activeRescanPlantId = null;
                      },
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    )
                  ],
                ),
              ),
            ],

            if (!_isScanning && _scanResult == null) ...[
              GestureDetector(
                onTap: () {
                  showModalBottomSheet(
                    context: context,
                    builder: (context) => SafeArea(
                      child: Wrap(
                        children: [
                          ListTile(
                            leading: const Icon(Icons.camera_alt),
                            title: const Text('Fotoğraf Çek (Kamera)'),
                            onTap: () {
                              Navigator.pop(context);
                              _pickImage(ImageSource.camera);
                            },
                          ),
                          ListTile(
                            leading: const Icon(Icons.photo_library),
                            title: const Text('Galeriden Seç'),
                            onTap: () {
                              Navigator.pop(context);
                              _pickImage(ImageSource.gallery);
                            },
                          ),
                        ],
                      ),
                    ),
                  );
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.02),
                    border: Border.all(color: Colors.white10),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.camera_alt, size: 48, color: Colors.green),
                      const SizedBox(height: 12),
                      Text(
                        isRescan ? 'Yeni Fotoğraf Yükleyin' : 'Bitki Fotoğrafı Yükleyin',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        isRescan 
                          ? '$rescanPlantName bitkisini yeniden analiz etmek için bir resim yükleyin.'
                          : 'Analiz edip JSON çıktısı üretmek için bir bitki resmi yükleyin.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Hızlı Test Senaryoları:',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 12),
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _presets.length,
                itemBuilder: (context, index) {
                  final preset = _presets[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: const Icon(Icons.spa, color: Colors.green),
                      title: Text(preset['name'] as String, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                      trailing: const Icon(Icons.chevron_right, size: 16),
                      onTap: () => _startScan(preset),
                    ),
                  );
                },
              )
            ],

            if (_isScanning) ...[
              const SizedBox(height: 60),
              const Center(
                child: CircularProgressIndicator(color: Colors.green),
              ),
              const SizedBox(height: 24),
              Text(
                _scanStatusText,
                style: const TextStyle(fontSize: 14, fontStyle: FontStyle.italic, color: Colors.grey),
              ),
            ],

            if (_scanResult != null && !_isScanning) ...[
              Card(
                color: const Color(0xFF141916),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                  side: const BorderSide(color: Colors.white10),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header Badge Row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.auto_awesome, color: Colors.green, size: 16),
                              const SizedBox(width: 6),
                              Text(
                                isRescan ? '🌿 Gelişim Kaydediliyor...' : '🌿 Gemini Vision Analizi',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.green),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.green.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text('OK', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                      const Divider(color: Colors.white10, height: 20),
                      
                      // Health Score Hero Widget
                      Center(
                        child: Column(
                          children: [
                            const SizedBox(height: 8),
                            Stack(
                              alignment: Alignment.center,
                              children: [
                                SizedBox(
                                  width: 80,
                                  height: 80,
                                  child: CircularProgressIndicator(
                                    value: (_scanResult!['sağlık'] as int) / 100,
                                    backgroundColor: Colors.white10,
                                    valueColor: AlwaysStoppedAnimation<Color>(_getHealthColor(_scanResult!['sağlık'] as int)),
                                    strokeWidth: 6,
                                  ),
                                ),
                                Text(
                                  '${_scanResult!['sağlık']}/100',
                                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _getHealthLabel(_scanResult!['sağlık'] as int),
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: _getHealthColor(_scanResult!['sağlık'] as int),
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],
                        ),
                      ),
                      
                      const Text('BİTKİ', style: TextStyle(fontSize: 10, color: Colors.grey, letterSpacing: 0.5)),
                      const SizedBox(height: 2),
                      Text(_scanResult!['bitki'] as String, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 16),

                      const Text('TESPİT EDİLEN DURUM', style: TextStyle(fontSize: 10, color: Colors.grey, letterSpacing: 0.5)),
                      const SizedBox(height: 2),
                      Text(
                        _scanResult!['sorun'] as String,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.orange),
                      ),
                      const SizedBox(height: 16),

                      if (_scanResult!['yorum'] != null) ...[
                        const Text('AI YORUMU', style: TextStyle(fontSize: 10, color: Colors.grey, letterSpacing: 0.5)),
                        const SizedBox(height: 2),
                        Text(
                          _scanResult!['yorum'] as String,
                          style: const TextStyle(fontSize: 13, color: Colors.grey, height: 1.4),
                        ),
                        const SizedBox(height: 16),
                      ],

                      const Text('ÖNERİLEN ÇÖZÜM', style: TextStyle(fontSize: 10, color: Colors.grey, letterSpacing: 0.5)),
                      const SizedBox(height: 4),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.green.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.green.withOpacity(0.1)),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('🛠', style: TextStyle(fontSize: 16)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _scanResult!['öneri'] as String,
                                style: const TextStyle(color: Colors.grey, fontSize: 12, height: 1.4),
                              ),
                            )
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () {
                                setState(() {
                                  _scanResult = null;
                                });
                              },
                              child: const Text('Tekrar Tara'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: _saveOrAddResult,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green, 
                                foregroundColor: Colors.white,
                              ),
                              child: Text(isRescan ? 'Raporu Kaydet 📋' : 'Bahçeme Ekle 🌿'),
                            ),
                          ),
                        ],
                      )
                    ],
                  ),
                ),
              )
            ]
          ],
        ),
      ),
    );
  }
}
