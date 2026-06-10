class AnalysisReport {
  final String id;
  final String date; // e.g. "10 Haziran"
  final int saglik;
  final String sorun;
  final String yorum;
  final String oneri;

  AnalysisReport({
    required this.id,
    required this.date,
    required this.saglik,
    required this.sorun,
    required this.yorum,
    required this.oneri,
  });

  factory AnalysisReport.fromJson(Map<String, dynamic> json) {
    return AnalysisReport(
      id: json['id']?.toString() ?? '',
      date: json['date'] ?? '',
      saglik: json['sağlık'] ?? 100,
      sorun: json['sorun'] ?? '',
      yorum: json['yorum'] ?? '',
      oneri: json['öneri'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'date': date,
      'sağlık': saglik,
      'sorun': sorun,
      'yorum': yorum,
      'öneri': oneri,
    };
  }
}

class Plant {
  final String id;
  final String nickname;
  final String bitki; // Plant species
  final String? imageUrl;
  int saglik; // Health score (0-100)
  String sorun; // Health status/problem
  String yorum; // AI commentary
  String oneri; // Care recommendation
  final int waterFrequencyDays;
  DateTime lastWateredAt;
  bool needsWater;
  final String addedDate;
  final List<AnalysisReport> analyses;

  Plant({
    required this.id,
    required this.nickname,
    required this.bitki,
    this.imageUrl,
    required this.saglik,
    required this.sorun,
    required this.yorum,
    required this.oneri,
    required this.waterFrequencyDays,
    required this.lastWateredAt,
    required this.needsWater,
    required this.addedDate,
    required this.analyses,
  });

  factory Plant.fromJson(Map<String, dynamic> json) {
    var analysesList = json['analyses'] as List?;
    List<AnalysisReport> loadedAnalyses = analysesList != null
        ? analysesList.map((i) => AnalysisReport.fromJson(i)).toList()
        : [];

    return Plant(
      id: json['id']?.toString() ?? '',
      nickname: json['nickname'] ?? '',
      bitki: json['bitki'] ?? '',
      imageUrl: json['image_url'],
      saglik: json['sağlık'] ?? 100,
      sorun: json['sorun'] ?? 'Belirgin bir sorun yok (Sağlıklı)',
      yorum: json['yorum'] ?? '',
      oneri: json['öneri'] ?? '',
      waterFrequencyDays: json['water_frequency_days'] ?? 7,
      lastWateredAt: json['last_watered_at'] != null 
          ? DateTime.parse(json['last_watered_at']) 
          : DateTime.now(),
      needsWater: json['needs_water'] ?? false,
      addedDate: json['addedDate'] ?? '',
      analyses: loadedAnalyses,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nickname': nickname,
      'bitki': bitki,
      'image_url': imageUrl,
      'sağlık': saglik,
      'sorun': sorun,
      'yorum': yorum,
      'öneri': oneri,
      'water_frequency_days': waterFrequencyDays,
      'last_watered_at': lastWateredAt.toIso8601String(),
      'needs_water': needsWater,
      'addedDate': addedDate,
      'analyses': analyses.map((a) => a.toJson()).toList(),
    };
  }
}
