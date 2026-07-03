/**
 * TrustBadge — displays trust tier with color coding.
 * Always visible next to usernames (BR-08).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TrustBadgeProps {
  tier: string;
  size?: 'small' | 'medium';
}

const TIER_COLORS: Record<string, string> = {
  'Trusted Human': '#4CAF50',
  'Likely Human': '#2196F3',
  'Provisional': '#FF9800',
  'Low Trust / Suspect': '#F44336',
};

const TIER_LABELS: Record<string, string> = {
  'Trusted Human': 'Colony',
  'Likely Human': 'Drone',
  'Provisional': 'Larva',
  'Low Trust / Suspect': 'Suspect',
};

export function TrustBadge({ tier, size = 'small' }: TrustBadgeProps) {
  const color = TIER_COLORS[tier] || '#9E9E9E';
  const label = TIER_LABELS[tier] || tier;
  const isSmall = size === 'small';

  return (
    <View
      style={[styles.badge, { backgroundColor: color }, isSmall && styles.badgeSmall]}
      accessibilityLabel={`Trust tier: ${tier}`}
      data-testid="trust-badge"
    >
      <Text style={[styles.text, isSmall && styles.textSmall]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 10,
  },
});
