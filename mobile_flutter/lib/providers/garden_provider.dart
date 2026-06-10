import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:async';
import '../models/plant.dart';

class GardenProvider with ChangeNotifier {
  final List<Plant> _plants = [];
  String? _activeRescanPlantId;
  int _currentTabIndex = 0;

  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  StreamSubscription? _gardenSubscription;

  List<Plant> get plants => _plants;
  int get plantCount => _plants.length;
  String? get activeRescanPlantId => _activeRescanPlantId;
  int get currentTabIndex => _currentTabIndex;

  GardenProvider() {
    _auth.authStateChanges().listen((User? user) {
      if (user != null) {
        _listenToGarden(user.uid);
      } else {
        _gardenSubscription?.cancel();
        _plants.clear();
        notifyListeners();
      }
    });
  }

  void _listenToGarden(String uid) {
    _gardenSubscription?.cancel();
    _gardenSubscription = _db.collection('users').doc(uid).collection('plants')
      .snapshots()
      .listen((snapshot) {
        _plants.clear();
        for (var doc in snapshot.docs) {
          final data = doc.data();
          
          DateTime lastWatered = DateTime.now();
          if (data['last_watered_at'] != null) {
            if (data['last_watered_at'] is Timestamp) {
              lastWatered = (data['last_watered_at'] as Timestamp).toDate();
            } else if (data['last_watered_at'] is String) {
              lastWatered = DateTime.parse(data['last_watered_at']);
            }
          }

          _plants.add(Plant(
            id: doc.id,
            nickname: data['nickname'] ?? '',
            bitki: data['bitki'] ?? '',
            imageUrl: data['image_url'],
            saglik: data['sağlık'] ?? 80,
            sorun: data['sorun'] ?? 'Belirgin bir sorun yok (Sağlıklı)',
            yorum: data['yorum'] ?? '',
            oneri: data['öneri'] ?? '',
            waterFrequencyDays: data['water_frequency_days'] ?? 7,
            lastWateredAt: lastWatered,
            needsWater: data['needs_water'] ?? false,
            addedDate: data['addedDate'] ?? '',
            analyses: [], // Loaded dynamically in detail screen
          ));
        }
        notifyListeners();
      });
  }

  Future<List<AnalysisReport>> getAnalysesForPlant(String plantId) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return [];
    
    final snap = await _db.collection('users').doc(uid)
        .collection('plants').doc(plantId)
        .collection('reports').orderBy('createdAt', descending: true).get();
        
    return snap.docs.map((doc) {
      final data = doc.data();
      return AnalysisReport(
        id: doc.id,
        date: data['date'] ?? '',
        saglik: data['sağlık'] ?? 80,
        sorun: data['sorun'] ?? '',
        yorum: data['yorum'] ?? '',
        oneri: data['öneri'] ?? '',
      );
    }).toList();
  }

  set activeRescanPlantId(String? val) {
    _activeRescanPlantId = val;
    notifyListeners();
  }

  set currentTabIndex(int val) {
    _currentTabIndex = val;
    notifyListeners();
  }

  int get averageHealthScore {
    if (_plants.isEmpty) return 0;
    int total = _plants.fold(0, (sum, plant) => sum + plant.saglik);
    return (total / _plants.length).round();
  }

  List<Plant> get wateringTasks {
    return _plants.where((p) => p.needsWater).toList();
  }

  Future<void> addPlant(Plant plant) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return;

    final plantRef = _db.collection('users').doc(uid).collection('plants').doc(plant.id);
    
    await plantRef.set({
      'nickname': plant.nickname,
      'bitki': plant.bitki,
      'image_url': plant.imageUrl,
      'sağlık': plant.saglik,
      'sorun': plant.sorun,
      'yorum': plant.yorum,
      'öneri': plant.oneri,
      'water_frequency_days': plant.waterFrequencyDays,
      'last_watered_at': Timestamp.fromDate(plant.lastWateredAt),
      'needs_water': plant.needsWater,
      'addedDate': plant.addedDate,
    });

    final reportId = 'rep_${DateTime.now().millisecondsSinceEpoch}';
    await plantRef.collection('reports').doc(reportId).set({
      'date': plant.addedDate,
      'sağlık': plant.saglik,
      'sorun': plant.sorun,
      'yorum': plant.yorum,
      'öneri': plant.oneri,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> addAnalysisReport(String plantId, AnalysisReport report) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return;

    final plantRef = _db.collection('users').doc(uid).collection('plants').doc(plantId);
    
    await plantRef.update({
      'sağlık': report.saglik,
      'sorun': report.sorun,
      'yorum': report.yorum,
      'öneri': report.oneri,
      'needs_water': report.saglik < 85 && !report.sorun.contains("Fazla sulama"),
    });

    await plantRef.collection('reports').doc(report.id).set({
      'date': report.date,
      'sağlık': report.saglik,
      'sorun': report.sorun,
      'yorum': report.yorum,
      'öneri': report.oneri,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Future<String> waterPlant(String plantId) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return "Giriş yapılmadı.";

    final index = _plants.indexWhere((p) => p.id == plantId);
    if (index == -1) return "Bitki bulunamadı.";

    final plant = _plants[index];
    String feedback = "";
    int newSaglik = plant.saglik;
    String newSorun = plant.sorun;
    String newOneri = plant.oneri;
    bool newNeedsWater = false;

    if (plant.sorun.contains("Şiddetli susuzluk")) {
      newSorun = "Belirgin bir sorun yok (Sağlıklı)";
      newSaglik = 95;
      newNeedsWater = false;
      newOneri = "Bitkiniz başarıyla kurtarıldı! Mevcut yerini koruyun.";
      feedback = "Harika! ${plant.nickname} bitkisini can suyu vererek kurtardınız. Sağlık puanı %95'e yükseldi!";
      
      final plantRef = _db.collection('users').doc(uid).collection('plants').doc(plantId);
      await plantRef.update({
        'sağlık': newSaglik,
        'sorun': newSorun,
        'öneri': newOneri,
        'needs_water': newNeedsWater,
        'last_watered_at': FieldValue.serverTimestamp(),
      });
      
      final reports = await plantRef.collection('reports').orderBy('createdAt', descending: true).limit(1).get();
      if (reports.docs.isNotEmpty) {
        await reports.docs.first.reference.update({
          'sağlık': newSaglik,
          'sorun': newSorun,
          'öneri': newOneri,
        });
      }
    } else if (plant.sorun.contains("Fazla sulama") || 
               DateTime.now().difference(plant.lastWateredAt).inHours < 1) {
      newSaglik = (plant.saglik - 15).clamp(10, 100);
      newNeedsWater = false;
      feedback = "DİKKAT: ${plant.nickname} bitkiniz zaten aşırı ıslak! Tekrar sulamak kök çürümesini tetikler.";
      
      final plantRef = _db.collection('users').doc(uid).collection('plants').doc(plantId);
      await plantRef.update({
        'sağlık': newSaglik,
        'needs_water': newNeedsWater,
        'last_watered_at': FieldValue.serverTimestamp(),
      });
      
      final reports = await plantRef.collection('reports').orderBy('createdAt', descending: true).limit(1).get();
      if (reports.docs.isNotEmpty) {
        await reports.docs.first.reference.update({
          'sağlık': newSaglik,
        });
      }
    } else {
      newSaglik = (plant.saglik + 2).clamp(0, 100);
      newNeedsWater = false;
      feedback = "${plant.nickname} başarıyla sulandı.";
      
      final plantRef = _db.collection('users').doc(uid).collection('plants').doc(plantId);
      await plantRef.update({
        'sağlık': newSaglik,
        'needs_water': newNeedsWater,
        'last_watered_at': FieldValue.serverTimestamp(),
      });
      
      final reports = await plantRef.collection('reports').orderBy('createdAt', descending: true).limit(1).get();
      if (reports.docs.isNotEmpty) {
        await reports.docs.first.reference.update({
          'sağlık': newSaglik,
        });
      }
    }

    return feedback;
  }

  @override
  void dispose() {
    _gardenSubscription?.cancel();
    super.dispose();
  }
}
