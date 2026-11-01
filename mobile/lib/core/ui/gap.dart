import 'package:flutter/widgets.dart';

/// Fixed gaps so screens stop hard-coding the same sizes.
class Gap extends StatelessWidget {
  const Gap(this.size, {super.key});

  const Gap.xs({super.key}) : size = 4;
  const Gap.sm({super.key}) : size = 8;
  const Gap.md({super.key}) : size = 16;
  const Gap.lg({super.key}) : size = 24;

  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(width: size, height: size);
}
