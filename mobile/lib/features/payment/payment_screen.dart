import 'package:flutter/material.dart';
import '../../core/services/api_service.dart';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final ApiService _apiService = ApiService();
  final List<Map<String, dynamic>> _creditPackages = [
    {'credits': 10, 'price': 999, 'label': '10 Credits - \$9.99'},
    {'credits': 25, 'price': 1999, 'label': '25 Credits - \$19.99'},
    {'credits': 50, 'price': 3499, 'label': '50 Credits - \$34.99'},
    {'credits': 100, 'price': 5999, 'label': '100 Credits - \$59.99'},
  ];

  Future<void> _purchaseCredits(int credits, int price) async {
    try {
      final response = await _apiService.post('payments/create-intent', {
        'amount': price,
        'credits': credits,
      });

      // In a real app, you would use Stripe SDK here
      // For now, just show a message
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Payment intent created. Client secret: ${response['clientSecret']}'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Purchase Credits'),
        backgroundColor: Colors.deepPurple,
        foregroundColor: Colors.white,
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _creditPackages.length,
        itemBuilder: (context, index) {
          final package = _creditPackages[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 16),
            child: ListTile(
              title: Text(package['label']),
              trailing: ElevatedButton(
                onPressed: () => _purchaseCredits(
                  package['credits'],
                  package['price'],
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepPurple,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Purchase'),
              ),
            ),
          );
        },
      ),
    );
  }
}
