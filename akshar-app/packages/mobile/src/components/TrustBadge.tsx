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
  'Trusted Human': '#43d17a',
  'Likely Human': '#6d8cff',
  'Provisional': '#ffc66b',
  'Low Trust / Suspect': '#ff6b6b',
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

  // 15% opacity background from the solid color
  const bgColor = color + '26'; // hex 26 ≈ 15% opacity

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bgColor },
        isSmall && styles.badgeSmall,
      ]}
      accessibilityLabel={`Trust tier: ${tier}`}
      testID="trust-badge"
    >
      <Text style={[styles.text, { color }, isSmall && styles.textSmall]}>
        {label}
      </Text>
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
    fontSize: 12,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 10,
  },
});
