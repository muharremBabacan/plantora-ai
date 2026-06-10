import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/garden_provider.dart';
import 'detail_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  Color _getHealthColor(int score) {
    if (score >= 85) return Colors.green;
    if (score < 60) return Colors.red;
    return Colors.orange;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Plantora AI 🌿', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.15),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.green.withOpacity(0.3)),
            ),
            child: const Text(
              'MVP Aktif',
              style: TextStyle(color: Colors.green, fontSize: 11, fontWeight: FontWeight.bold),
            ),
          )
        ],
      ),
      body: Consumer<GardenProvider>(
        builder: (context, provider, child) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Merhaba, Bitki Dostu! 👋',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Bahçenizdeki bitkilerin genel durumunu takip edin.',
                  style: TextStyle(color: Colors.grey, fontSize: 14),
                ),
                const SizedBox(height: 20),

                // Health Summary Card
                _buildHealthSummaryCard(context, provider),

                const SizedBox(height: 24),
                Text(
                  'Bitkilerim (${provider.plantCount})',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),

                if (provider.plants.isEmpty)
                  _buildEmptyState(context)
                else
                  _buildPlantGrid(provider),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildHealthSummaryCard(BuildContext context, GardenProvider provider) {
    final score = provider.averageHealthScore;
    final isNone = provider.plantCount == 0;
    
    final healthColor = _getHealthColor(score);
    String healthText = "Mükemmel! Bitkileriniz mutlu 🌿";
    if (score < 60) {
      healthText = "Tehlikede! Bitkilerinize dikkat edin! 🚨";
    } else if (score < 85) {
      healthText = "Genel sağlık iyi, kontrol gerek ⚠️";
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.green.withOpacity(0.1),
            Colors.black.withOpacity(0.2),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: Colors.green.withOpacity(0.2)),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'GENEL BAHÇE SAĞLIĞI',
                  style: TextStyle(fontSize: 10, color: Colors.grey, letterSpacing: 1),
                ),
                const SizedBox(height: 4),
                Text(
                  isNone ? '-%' : '%$score',
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  isNone ? 'Henüz bitki eklenmedi' : healthText,
                  style: TextStyle(fontSize: 12, color: isNone ? Colors.grey : healthColor, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 60,
                height: 60,
                child: CircularProgressIndicator(
                  value: isNone ? 0 : score / 100,
                  backgroundColor: Colors.white10,
                  valueColor: AlwaysStoppedAnimation<Color>(isNone ? Colors.grey : healthColor),
                  strokeWidth: 5,
                ),
              ),
              const Icon(Icons.spa, color: Colors.green, size: 24),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.02),
        border: Border.all(color: Colors.white10),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          const Text('🪴', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          const Text(
            'Bahçeniz Henüz Boş',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          const SizedBox(height: 6),
          const Text(
            'Kamera sekmesini kullanarak ilk bitkinizi taratın ve teşhis edin!',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildPlantGrid(GardenProvider provider) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.85,
      ),
      itemCount: provider.plants.length,
      itemBuilder: (context, index) {
        final plant = provider.plants[index];
        final badgeColor = _getHealthColor(plant.saglik);

        return Card(
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => DetailScreen(plantId: plant.id),
                ),
              );
            },
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Container(
                    width: double.infinity,
                    color: Colors.white12,
                    child: Stack(
                      children: [
                        const Center(child: Icon(Icons.local_florist, size: 40, color: Colors.green)),
                        Positioned(
                          top: 8,
                          right: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.black54,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '%${plant.saglik}',
                              style: TextStyle(color: badgeColor, fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                          ),
                        )
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        plant.nickname,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        plant.bitki,
                        style: const TextStyle(color: Colors.grey, fontSize: 10, fontStyle: FontStyle.italic),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        plant.needsWater ? '💧 Sulama Gerekli' : '👍 Sağlıklı',
                        style: TextStyle(
                          color: plant.needsWater ? Colors.red : Colors.green,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                )
              ],
            ),
          ),
        );
      },
    );
  }
}
