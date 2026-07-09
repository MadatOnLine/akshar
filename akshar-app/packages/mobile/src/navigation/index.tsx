/**
 * Navigation — auth gate + tab navigation + stack screens.
 * Dark-themed with emoji tab icons, branded loading screen.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../providers/AuthProvider';
import { EnrollmentScreen } from '../screens/EnrollmentScreen';
import { GroupListScreen } from '../screens/GroupListScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

import type { RootStackParamList, AuthStackParamList, MainTabParamList } from '../types';

const AuthStack = createStackNavigator<AuthStackParamList>();
const MainStack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/* ─── Dark theme constants ─── */
const DARK_BG = '#0c1018';
const ACTIVE_TINT = '#6d8cff';
const INACTIVE_TINT = '#566178';
const BORDER_TOP = '#283347';
const HEADER_TEXT = '#e8edf6';
const SUBTITLE_COLOR = '#8b97ad';

/* ─── Loading / splash screen ─── */
function LoadingScreen() {
  return (
    <View testID="loading-screen" style={styles.loadingContainer}>
      <Text testID="loading-logo" style={styles.loadingLogo}>
        अ
      </Text>
      <ActivityIndicator
        testID="loading-indicator"
        size="large"
        color={ACTIVE_TINT}
        style={styles.loadingSpinner}
      />
      <Text testID="loading-text" style={styles.loadingText}>
        Establishing secure connection...
      </Text>
    </View>
  );
}

/* ─── Tab bar icon helper ─── */
function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 22, color }}>{emoji}</Text>;
}

/* ─── Tab navigator ─── */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_TINT,
        tabBarInactiveTintColor: INACTIVE_TINT,
        tabBarStyle: {
          backgroundColor: DARK_BG,
          borderTopColor: BORDER_TOP,
          borderTopWidth: 1,
        },
      }}
    >
      <Tab.Screen
        name="Groups"
        component={GroupListScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <TabIcon emoji="💬" color={color} />,
          tabBarTestID: 'tab-chat',
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ color }) => <TabIcon emoji="📡" color={color} />,
          tabBarTestID: 'tab-feed',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
          tabBarTestID: 'tab-profile',
        }}
      />
    </Tab.Navigator>
  );
}

/* ─── Stack navigators ─── */
const darkHeaderOptions = {
  headerStyle: { backgroundColor: DARK_BG },
  headerTintColor: HEADER_TEXT,
  headerTitleStyle: { color: HEADER_TEXT },
};

function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerShown: false,
        ...darkHeaderOptions,
      }}
    >
      <MainStack.Screen name="Home" component={MainTabs} />
      <MainStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: true, title: 'Chat' }}
      />
    </MainStack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        ...darkHeaderOptions,
      }}
    >
      <AuthStack.Screen name="FaceLogin" component={EnrollmentScreen} />
    </AuthStack.Navigator>
  );
}

/* ─── Root component ─── */
export function AppNavigation() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: DARK_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    fontSize: 72,
    color: ACTIVE_TINT,
    marginBottom: 24,
  },
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: SUBTITLE_COLOR,
    letterSpacing: 0.5,
  },
});
