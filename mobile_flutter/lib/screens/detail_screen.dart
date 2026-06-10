import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/plant.dart';
import '../providers/garden_provider.dart';

class DetailScreen extends StatefulWidget {
  final String plantId;

  const DetailScreen({super.key, required this.plantId});

  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  AnalysisReport? _selectedReport;
  List<AnalysisReport>? _analyses;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadAnalyses();
  }

  Future<void> _loadAnalyses() async {
    final provider = Provider.of<GardenProvider>(context, listen: false);
    final reports = await provider.getAnalysesForPlant(widget.plantId);
    if (mounted) {
      setState(() {
        _analyses = reports;
        _isLoading = false;
      });
    }
  }

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

  @override
  Widget build(BuildContext context) {
    return Consumer<GardenProvider>(
      builder: (context, provider, child) {
        // Find the plant. If not found, pop back.
        final plantIndex = provider.plants.indexWhere((p) => p.id == widget.plantId);
        if (plantIndex == -1) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            Navigator.of(context).pop();
          });
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        
        final plant = provider.plants[plantIndex];
        
        if (_isLoading) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        
        // Default to latest report if no report is selected yet
        final latestReport = (_analyses != null && _analyses!.isNotEmpty) ? _analyses![0] : null;
        final currentReport = _selectedReport ?? latestReport;

        return Scaffold(
          appBar: AppBar(
            title: Text(plant.nickname, style: const TextStyle(fontWeight: FontWeight.bold)),
            actions: [
              IconButton(
                icon: const Icon(Icons.water_drop),
                onPressed: () async {
                  final feedback = await provider.waterPlant(plant.id);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(feedback)),
                  );
                },
                tooltip: 'Sulama Yap',
              ),
            ],
          ),
          body: currentReport == null
              ? const Center(child: Text('Teşhis kaydı bulunamadı.'))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header Card with Image and Health Score
                      _buildHeaderCard(context, plant, currentReport),
                      const SizedBox(height: 20),

                      // Plant Specs (Species, added date, last watering, etc.)
                      _buildSpecsCard(plant, currentReport),
                      const SizedBox(height: 24),

                      // Diagnostic details (Sorun, Yorum, Öneri)
                      _buildReportDetails(currentReport),
                      const SizedBox(height: 28),

                      // Action Button - Re-scan
                      _buildRescanButton(context, provider, plant),
                      const SizedBox(height: 28),

                      // Vertical Timeline / Health History
                      const Text(
                        'Analiz Geçmişi (Zaman Tüneli)',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      _buildTimeline(currentReport),
                    ],
                  ),
                ),
        );
      },
    );
  }

  Widget _buildHeaderCard(BuildContext context, Plant plant, AnalysisReport report) {
    final healthColor = _getHealthColor(report.saglik);
    final healthLabel = _getHealthLabel(report.saglik);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.green.withOpacity(0.08),
            Colors.white.withOpacity(0.02),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          // Plant icon
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: Colors.white12,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: const Icon(Icons.local_florist, size: 40, color: Colors.green),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plant.bitki,
                  style: const TextStyle(fontSize: 14, color: Colors.grey, fontStyle: FontStyle.italic),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      '%${report.saglik}',
                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: healthColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        healthLabel,
                        style: TextStyle(color: healthColor, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Sağlık Skoru',
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSpecsCard(Plant plant, AnalysisReport report) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.01),
        border: Border.all(color: Colors.white10),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          _buildSpecRow('Bitki Türü', plant.bitki),
          const Divider(color: Colors.white10, height: 16),
          _buildSpecRow('Ekleme Tarihi', plant.addedDate),
          const Divider(color: Colors.white10, height: 16),
          _buildSpecRow('Son Analiz', report.date),
          const Divider(color: Colors.white10, height: 16),
          _buildSpecRow('Sulama Sıklığı', '${plant.waterFrequencyDays} günde bir'),
        ],
      ),
    );
  }

  Widget _buildSpecRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
      ],
    );
  }

  Widget _buildReportDetails(AnalysisReport report) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildReportSection('📋 Tespit Edilen Durum', report.sorun, Colors.orange),
        const SizedBox(height: 16),
        _buildReportSection('💡 AI Yorumu', report.yorum, Colors.green),
        const SizedBox(height: 16),
        _buildReportSection('🛠 Önerilen Çözüm', report.oneri, Colors.blue),
      ],
    );
  }

  Widget _buildReportSection(String title, String content, Color highlightColor) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.02),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: highlightColor),
          ),
          const SizedBox(height: 6),
          Text(
            content,
            style: const TextStyle(color: Colors.grey, fontSize: 13, height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _buildRescanButton(BuildContext context, GardenProvider provider, Plant plant) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        icon: const Icon(Icons.camera_alt),
        label: const Text('Yeniden Fotoğraf Tara', style: TextStyle(fontWeight: FontWeight.bold)),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.green,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        onPressed: () {
          // Set provider state to target this plant for re-scanning
          provider.activeRescanPlantId = plant.id;
          provider.currentTabIndex = 1; // Switch to scanner tab
          Navigator.of(context).pop(); // Close details screen
        },
      ),
    );
  }

  Widget _buildTimeline(AnalysisReport activeReport) {
    if (_analyses == null) return const SizedBox();
    return Column(
      children: List.generate(_analyses!.length, (index) {
        final report = _analyses![index];
        final isSelected = report.id == activeReport.id;
        final nodeColor = _getHealthColor(report.saglik);

        return InkWell(
          onTap: () {
            setState(() {
              _selectedReport = report;
            });
          },
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Left column: Dot and line
              Column(
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: isSelected ? nodeColor : nodeColor.withOpacity(0.3),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isSelected ? Colors.white : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  if (index < plant.analyses.length - 1)
                    Container(
                      width: 2,
                      height: 50,
                      color: Colors.white10,
                    ),
                ],
              ),
              const SizedBox(width: 16),
              // Right column: Content Card
              Expanded(
                child: Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isSelected 
                        ? Colors.green.withOpacity(0.08) 
                        : Colors.white.withOpacity(0.01),
                    border: Border.all(
                      color: isSelected 
                          ? Colors.green.withOpacity(0.3) 
                          : Colors.white10,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            report.date,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              color: isSelected ? Colors.green : Colors.grey,
                            ),
                          ),
                          Text(
                            'Skor: %${report.saglik}',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                              color: nodeColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        report.sorun,
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}
