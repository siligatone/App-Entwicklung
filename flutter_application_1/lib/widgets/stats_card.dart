import 'package:flutter/material.dart' hide Card;
import 'package:shadcn_ui/shadcn_ui.dart';

class StatsGrid extends StatelessWidget {
  const StatsGrid({
    super.key,
    required this.open,
    required this.done,
    required this.mine,
    required this.overdue,
  });

  final int open;
  final int done;
  final int mine;
  final int overdue;

  @override
  Widget build(BuildContext context) {
    final cs = ShadTheme.of(context).colorScheme;
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 1.8,
      children: [
        _StatCard(
          label: 'Offen',
          value: open,
          icon: LucideIcons.circleDot,
          color: cs.primary,
        ),
        _StatCard(
          label: 'Erledigt',
          value: done,
          icon: LucideIcons.circleCheck,
          color: const Color(0xFF22C55E),
        ),
        _StatCard(
          label: 'Meine',
          value: mine,
          icon: LucideIcons.userRound,
          color: cs.ring,
        ),
        _StatCard(
          label: 'Überfällig',
          value: overdue,
          icon: LucideIcons.triangleAlert,
          color: cs.destructive,
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final int value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = ShadTheme.of(context);
    return ShadCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withAlpha(25),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(value.toString(), style: theme.textTheme.h3),
              Text(label, style: theme.textTheme.muted),
            ],
          ),
        ],
      ),
    );
  }
}
