import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/garden_provider.dart';

class CalendarScreen extends StatelessWidget {
  const CalendarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bakım Takvimi')),
      body: Consumer<GardenProvider>(
        builder: (context, provider, child) {
          final tasks = provider.wateringTasks;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Bugünkü Görevler',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Bitkilerinizin sağlıklı büyümesi için gereken rutin görevler.',
                  style: TextStyle(color: Colors.grey, fontSize: 13),
                ),
                const SizedBox(height: 20),

                if (tasks.isEmpty)
                  _buildEmptyCalendar()
                else
                  _buildTaskList(context, provider, tasks),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildEmptyCalendar() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.02),
        border: Border.all(color: Colors.white10),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: const [
          Text('📅', style: TextStyle(fontSize: 40)),
          SizedBox(height: 12),
          Text(
            'Bugünlük Görev Yok',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          SizedBox(height: 6),
          Text(
            'Harika! Bahçenizdeki tüm bitkilerin bakımları tamamlanmış görünüyor.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildTaskList(BuildContext context, GardenProvider provider, List tasks) {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: tasks.length,
      itemBuilder: (context, index) {
        final plant = tasks[index];
        final isCritical = plant.saglik < 60;

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(12.0),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isCritical ? Colors.red.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          isCritical ? 'ACİL SULAMA' : 'SULAMA ZAMANI',
                          style: TextStyle(
                            color: isCritical ? Colors.red : Colors.orange, 
                            fontSize: 8, 
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        plant.nickname,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      Text(
                        'Tür: ${plant.bitki} | Sıklık: ${plant.waterFrequencyDays} günde bir',
                        style: const TextStyle(color: Colors.grey, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final feedback = await provider.waterPlant(plant.id);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(feedback),
                        duration: const Duration(seconds: 4),
                        backgroundColor: feedback.contains('DİKKAT') ? Colors.red[800] : Colors.green[800],
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue[700],
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  ),
                  child: const Text('Sulandı', style: TextStyle(fontSize: 12)),
                )
              ],
            ),
          ),
        );
      },
    );
  }
}
